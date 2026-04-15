import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase-server'
import { BrandAnalysis } from '@/lib/types'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const BRAND_ANALYSIS_PROMPT = `You are a professional brand strategist analyzing brand assets.
Examine the provided image (logo, brand guidelines, or brand materials).

Extract the following information and respond in this exact JSON format:
{
  "colors": ["#hex1", "#hex2", ...],
  "fonts": ["Font Name 1", "Font Name 2", ...],
  "tone": "2-3 sentence description of the brand's tone, voice, and personality",
  "styleNotes": "2-3 sentence description of the visual style, aesthetic, and design approach",
  "logoDescription": "Brief description of the logo mark if visible"
}

For colors: identify the primary, secondary, and accent colors. Return as hex codes.
For fonts: identify font families used. If unclear, describe the style (e.g., "Clean sans-serif, similar to Helvetica").
Be specific and actionable — creative teams will use this to match the brand in AI-generated ads.`

async function analyzeImageAsBase64(file: File): Promise<BrandAnalysis> {
  const bytes = await file.arrayBuffer()
  const base64 = Buffer.from(bytes).toString('base64')
  const mediaType = (file.type as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp') || 'image/png'

  const response = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: mediaType, data: base64 },
        },
        { type: 'text', text: BRAND_ANALYSIS_PROMPT },
      ],
    }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Could not parse brand analysis response')
  return JSON.parse(jsonMatch[0]) as BrandAnalysis
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
    }

    const formData = await req.formData()
    const brandId = formData.get('brandId') as string
    const logoFile = formData.get('logo') as File | null
    const guidelinesFile = formData.get('guidelines') as File | null

    if (!brandId) return NextResponse.json({ error: 'brandId required' }, { status: 400 })
    if (!logoFile && !guidelinesFile) return NextResponse.json({ error: 'At least one file required' }, { status: 400 })

    // File size limit: 20MB
    const MAX_SIZE = 20 * 1024 * 1024
    if (logoFile && logoFile.size > MAX_SIZE) return NextResponse.json({ error: 'Logo file too large (max 20MB)' }, { status: 400 })
    if (guidelinesFile && guidelinesFile.size > MAX_SIZE) return NextResponse.json({ error: 'Guidelines file too large (max 20MB)' }, { status: 400 })

    // Prefer guidelines for brand analysis if both uploaded; use logo as fallback
    const primaryFile = guidelinesFile || logoFile!

    // For PDFs, we'd need PDF-to-image conversion. For now, we handle image files.
    // If the file is a PDF, return a helpful message.
    if (primaryFile.type === 'application/pdf') {
      return NextResponse.json({
        error: 'PDF brand guides: please export a screenshot/PNG of the key brand guide page and upload that instead. Full PDF parsing coming soon.',
      }, { status: 422 })
    }

    const analysis = await analyzeImageAsBase64(primaryFile)

    // If logo was also uploaded, analyze it separately and merge
    if (logoFile && guidelinesFile) {
      try {
        const logoAnalysis = await analyzeImageAsBase64(logoFile)
        // Merge: use guidelines colors but add logo colors if different
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
      tone_notes: `${analysis.tone} ${analysis.styleNotes}`.trim(),
    }
    if (logoUrl) updatePayload.logo_url = logoUrl

    await supabase.from('brands').update(updatePayload).eq('id', brandId)

    return NextResponse.json({ analysis, logoUrl })
  } catch (e: any) {
    console.error('Brand analyze error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
