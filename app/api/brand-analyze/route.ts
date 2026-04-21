import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient as createClient } from '@/lib/supabase-server'
import { BrandAnalysis } from '@/lib/types'

export const maxDuration = 60

const BRAND_ANALYSIS_PROMPT = `You are a professional brand strategist analyzing brand assets.
Examine the provided file (logo, brand guidelines, or brand materials).

Extract the following information and respond in this EXACT JSON format with no other text:
{
  "colors": ["#hex1", "#hex2", "#hex3"],
  "fonts": ["Font Name 1", "Font Name 2"],
  "tone": "2-3 sentence description of the brand's tone, voice, and personality",
  "styleNotes": "2-3 sentence description of the visual style, aesthetic, and design approach",
  "logoDescription": "Brief description of the logo mark if visible"
}

For colors: identify the primary, secondary, and accent colors. Return as hex codes. Find at least 3.
For fonts: identify font families used. If unclear, describe the style (e.g., "Clean sans-serif, similar to Helvetica").
Be specific and actionable — creative teams will use this to match the brand in AI-generated ads.
Respond ONLY with the JSON object, no markdown, no explanation.`

async function analyzeWithGemini(file: File): Promise<BrandAnalysis> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured')

  const bytes = await file.arrayBuffer()
  const base64 = Buffer.from(bytes).toString('base64')

  // Map file types to Gemini mime types
  let mimeType = file.type || 'image/png'
  if (mimeType === 'application/pdf') mimeType = 'application/pdf'

  const models = ['gemini-2.5-flash', 'gemini-2.0-flash-001', 'gemini-1.5-flash']
  let lastError = ''

  for (const model of models) {
    try {
      console.log(`Trying brand analysis with ${model}, file size: ${file.size}, type: ${mimeType}`)
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                {
                  inlineData: {
                    mimeType: mimeType,
                    data: base64,
                  },
                },
                { text: BRAND_ANALYSIS_PROMPT },
              ],
            }],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 1024,
            },
          }),
        }
      )

      if (!res.ok) {
        const errText = await res.text()
        lastError = `${model}: ${res.status} ${errText.slice(0, 200)}`
        continue
      }

      const data = await res.json()
      const textPart = data.candidates?.[0]?.content?.parts?.find(
        (p: { text?: string }) => p.text
      )

      if (!textPart?.text) {
        lastError = `${model}: No text in response`
        continue
      }

      const jsonMatch = textPart.text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('Could not parse brand analysis response')
      return JSON.parse(jsonMatch[0]) as BrandAnalysis
    } catch (e: unknown) {
      lastError = `${model}: ${e instanceof Error ? e.message : String(e)}`
    }
  }

  throw new Error(`Brand analysis failed: ${lastError}`)
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'GEMINI_API_KEY not configured. Add it in Vercel environment variables.' }, { status: 500 })
    }

    const formData = await req.formData()
    let brandId = formData.get('brandId') as string
    const brandName = formData.get('brandName') as string || 'Fulton'
    const logoFile = formData.get('logo') as File | null
    const guidelinesFile = formData.get('guidelines') as File | null
    const guidelinesUrl = formData.get('guidelinesUrl') as string | null

    // Auto-create brand for demo mode
    if (!brandId || brandId === 'demo') {
      const { data: existing } = await supabase.from('brands').select('id').eq('name', brandName).limit(1).single()
      if (existing) {
        brandId = existing.id
      } else {
        const { data: newBrand } = await supabase.from('brands').insert({ name: brandName, color: '#2B4EFF' }).select('id').single()
        brandId = newBrand?.id || 'demo'
      }
    }

    if (!logoFile && !guidelinesFile && !guidelinesUrl) {
      return NextResponse.json({ error: 'Upload at least a logo or brand guidelines file' }, { status: 400 })
    }

    // File size limit: 20MB (only for files sent through FormData)
    const MAX_SIZE = 20 * 1024 * 1024
    if (logoFile && logoFile.size > MAX_SIZE) return NextResponse.json({ error: 'Logo file too large (max 20MB)' }, { status: 400 })
    if (guidelinesFile && guidelinesFile.size > MAX_SIZE) return NextResponse.json({ error: 'Guidelines file too large (max 20MB)' }, { status: 400 })

    // If guidelines provided as URL, download and create a File-like object
    let guidelinesForAnalysis = guidelinesFile
    if (!guidelinesForAnalysis && guidelinesUrl) {
      try {
        const dlRes = await fetch(guidelinesUrl)
        if (dlRes.ok) {
          const blob = await dlRes.blob()
          const fileName = guidelinesUrl.split('/').pop() || 'guidelines.pdf'
          guidelinesForAnalysis = new File([blob], fileName, { type: blob.type || 'application/pdf' })
        }
      } catch {
        console.log('Could not download guidelines from URL, skipping')
      }
    }

    // Analyze the primary file (prefer guidelines, fallback to logo)
    const primaryFile = guidelinesForAnalysis || logoFile
    if (!primaryFile) {
      return NextResponse.json({ error: 'No analyzable file available' }, { status: 400 })
    }
    const analysis = await analyzeWithGemini(primaryFile)

    // If both files uploaded, also analyze the logo and merge colors
    if (logoFile && guidelinesForAnalysis) {
      try {
        const logoAnalysis = await analyzeWithGemini(logoFile)
        const allColors = [...new Set([...analysis.colors, ...logoAnalysis.colors])].slice(0, 8)
        analysis.colors = allColors
        if (!analysis.logoDescription) analysis.logoDescription = logoAnalysis.logoDescription
      } catch {
        // Logo analysis failed, just use guidelines analysis
      }
    }

    // Upload logo to Supabase Storage if provided
    let logoUrl: string | undefined
    if (logoFile) {
      const ext = logoFile.name.split('.').pop() || 'png'
      const path = `brands/${brandId}/logo.${ext}`
      const bytes = await logoFile.arrayBuffer()
      const { error: uploadErr } = await supabase.storage
        .from('brand-assets')
        .upload(path, bytes, { contentType: logoFile.type, upsert: true })
      if (!uploadErr) {
        const { data: urlData } = supabase.storage.from('brand-assets').getPublicUrl(path)
        logoUrl = urlData.publicUrl
      }
    }

    // Save analysis to brand record
    const updatePayload: Record<string, unknown> = {
      brand_colors: analysis.colors,
      brand_fonts: analysis.fonts,
      tone_notes: `${analysis.tone} ${analysis.styleNotes || ''}`.trim(),
    }
    if (logoUrl) updatePayload.logo_url = logoUrl

    await supabase.from('brands').update(updatePayload).eq('id', brandId)

    return NextResponse.json({ analysis, logoUrl, brandId })
  } catch (e: unknown) {
    console.error('Brand analyze error:', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
