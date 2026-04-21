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
Be specific and actionable - creative teams will use this to match the brand in AI-generated ads.
Respond ONLY with the JSON object, no markdown, no explanation.`

// Analyze with Claude (handles PDFs natively)
async function analyzeWithClaude(fileData: string, mimeType: string): Promise<BrandAnalysis> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured')

  const mediaType = mimeType === 'application/pdf' ? 'application/pdf'
    : mimeType.startsWith('image/') ? mimeType
    : 'image/png'

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'content-type': 'application/json',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          {
            type: mediaType === 'application/pdf' ? 'document' : 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: fileData,
            },
          },
          { type: 'text', text: BRAND_ANALYSIS_PROMPT },
        ],
      }],
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Claude API error: ${res.status} ${err.slice(0, 200)}`)
  }

  const data = await res.json()
  const text = data.content?.find((b: { type: string }) => b.type === 'text')?.text || ''

  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Could not parse brand analysis response')
  return JSON.parse(jsonMatch[0]) as BrandAnalysis
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
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

    // If guidelines provided as URL, download it
    let guidelinesData: string | null = null
    let guidelinesMime = 'application/pdf'
    if (guidelinesUrl) {
      try {
        const dlRes = await fetch(guidelinesUrl)
        if (dlRes.ok) {
          const buf = await dlRes.arrayBuffer()
          guidelinesData = Buffer.from(buf).toString('base64')
          guidelinesMime = dlRes.headers.get('content-type') || 'application/pdf'
        }
      } catch {
        console.log('Could not download guidelines from URL')
      }
    } else if (guidelinesFile) {
      const buf = await guidelinesFile.arrayBuffer()
      guidelinesData = Buffer.from(buf).toString('base64')
      guidelinesMime = guidelinesFile.type || 'application/pdf'
    }

    // Get logo data
    let logoData: string | null = null
    let logoMime = 'image/png'
    if (logoFile) {
      const buf = await logoFile.arrayBuffer()
      logoData = Buffer.from(buf).toString('base64')
      logoMime = logoFile.type || 'image/png'
    }

    // Analyze primary file (prefer guidelines, fallback to logo)
    const primaryData = guidelinesData || logoData
    const primaryMime = guidelinesData ? guidelinesMime : logoMime
    if (!primaryData) {
      return NextResponse.json({ error: 'No analyzable file available' }, { status: 400 })
    }

    console.log(`Analyzing brand with Claude: ${primaryMime}, size: ${primaryData.length} chars base64`)
    const analysis = await analyzeWithClaude(primaryData, primaryMime)

    // If both files exist, also analyze the logo and merge colors
    if (logoData && guidelinesData) {
      try {
        const logoAnalysis = await analyzeWithClaude(logoData, logoMime)
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
