import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient as createClient } from '@/lib/supabase-server'

export const maxDuration = 60

// ── Gemini Image Generation ───────────────────────────────────────────────
async function generateWithGemini(prompt: string, aspectRatio: string = '1:1'): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured')

  // Try multiple model names in case one is unavailable
  const models = ['gemini-2.5-flash-image', 'gemini-3.1-flash-image-preview', 'gemini-3-pro-image-preview']
  let lastError = ''

  for (const model of models) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseModalities: ['TEXT', 'IMAGE'],
            },
          }),
        }
      )

      if (!res.ok) {
        const errText = await res.text()
        lastError = `${model}: ${res.status} ${errText}`
        continue
      }

      const data = await res.json()

      // Find the image part in the response
      const parts = data.candidates?.[0]?.content?.parts || []
      for (const part of parts) {
        if (part.inlineData?.mimeType?.startsWith('image/')) {
          return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`
        }
      }

      lastError = `${model}: No image in response`
    } catch (e: unknown) {
      lastError = `${model}: ${e instanceof Error ? e.message : String(e)}`
    }
  }

  throw new Error(`Image generation failed: ${lastError}`)
}

// ── Build a creative prompt from brand + persona context ──────────────────
function buildPrompt(concept: string, persona: { name: string; angle: string; hook?: string }, brandContext?: string): string {
  let prompt = `Create a professional advertising creative image for a direct-to-consumer brand.\n\n`
  prompt += `Campaign concept: ${concept}\n`
  prompt += `Target persona: ${persona.name}\n`
  prompt += `Angle: ${persona.angle}\n`
  if (persona.hook) prompt += `Hook: ${persona.hook}\n`
  if (brandContext) prompt += `\nBrand context: ${brandContext}\n`
  prompt += `\nThe image should be a polished, high-quality ad creative suitable for social media advertising. `
  prompt += `Clean composition, professional lighting, and clear visual hierarchy. `
  prompt += `Do NOT include any text or copy in the image — the image should work as a standalone visual.`
  return prompt
}

// ── Upload base64 image to Supabase Storage ──────────────────────────────
async function uploadToStorage(
  supabase: ReturnType<typeof createClient>,
  base64DataUrl: string,
  brandId: string
): Promise<string> {
  try {
    const base64Data = base64DataUrl.split(',')[1]
    const buffer = Buffer.from(base64Data, 'base64')
    const path = `creatives/${brandId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`

    const { error } = await supabase.storage
      .from('brand-assets')
      .upload(path, buffer, { contentType: 'image/png', upsert: false })

    if (error) {
      console.error('Storage upload error:', error)
      return base64DataUrl // fallback to data URL
    }

    const { data: urlData } = supabase.storage.from('brand-assets').getPublicUrl(path)
    return urlData.publicUrl
  } catch {
    return base64DataUrl // fallback to data URL
  }
}

// ── Ensure a demo brand exists ───────────────────────────────────────────
async function ensureDemoBrand(supabase: ReturnType<typeof createClient>): Promise<string> {
  const { data: existing } = await supabase
    .from('brands')
    .select('id')
    .eq('name', 'Fulton')
    .limit(1)
    .single()

  if (existing) return existing.id

  const { data: newBrand } = await supabase
    .from('brands')
    .insert({ name: 'Fulton', color: '#1B4332', url: 'https://walkfulton.com' })
    .select('id')
    .single()

  return newBrand?.id || 'demo'
}

// ── POST handler ─────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()

    const body = await req.json()
    const { concept, personas, aspectRatio = '1x1', brandId: rawBrandId } = body

    if (!concept || !personas?.length) {
      return NextResponse.json({ error: 'Missing concept or personas' }, { status: 400 })
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'GEMINI_API_KEY not configured. Add it in Vercel environment variables.' }, { status: 500 })
    }

    // Ensure brand exists
    const brandId = rawBrandId && rawBrandId !== 'demo'
      ? rawBrandId
      : await ensureDemoBrand(supabase)

    // Load brand context for prompt enrichment
    let brandContext = ''
    const { data: brand } = await supabase.from('brands').select('*').eq('id', brandId).single()
    if (brand) {
      const parts = []
      if (brand.name) parts.push(`Brand: ${brand.name}`)
      if (brand.tone_notes) parts.push(`Tone: ${brand.tone_notes}`)
      if (brand.brand_colors?.length) parts.push(`Colors: ${brand.brand_colors.join(', ')}`)
      brandContext = parts.join('. ')
    }

    // Generate one image per persona
    const results = []
    for (const persona of personas) {
      try {
        const prompt = buildPrompt(concept, persona, brandContext)
        const imageDataUrl = await generateWithGemini(prompt, aspectRatio)

        // Upload to storage for a persistent URL
        const imageUrl = await uploadToStorage(supabase, imageDataUrl, brandId)

        // Save to database
        const title = `${concept.slice(0, 40)} — ${persona.name}`
        await supabase.from('creatives').insert({
          brand_id: brandId,
          title,
          concept,
          persona: persona.name,
          angle: persona.angle,
          image_url: imageUrl,
          format: aspectRatio,
          generator: 'gemini',
        })

        results.push({ persona, imageUrl })
      } catch (e: unknown) {
        console.error(`Generation failed for ${persona.name}:`, e)
        results.push({ persona, imageUrl: '', error: e instanceof Error ? e.message : String(e) })
      }
    }

    return NextResponse.json({ results, brandId })
  } catch (e: unknown) {
    console.error('Generate error:', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
