import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient as createClient } from '@/lib/supabase-server'
import { composeAllFormats } from '@/lib/compose-ad'

export const maxDuration = 60

// ── Gemini: generate full image (product + scene + everything) ───────────
async function generateWithGemini(prompt: string, referenceImages: string[] = []): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured')

  interface Part { text?: string; inlineData?: { mimeType: string; data: string } }
  const parts: Part[] = []

  for (const img of referenceImages) {
    const match = img.match(/^data:(image\/\w+);base64,(.+)$/)
    if (match) {
      parts.push({ inlineData: { mimeType: match[1], data: match[2] } })
    }
  }
  parts.push({ text: prompt })

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
            contents: [{ parts }],
            generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
          }),
        }
      )
      if (!res.ok) { lastError = `${model}: ${res.status} ${(await res.text()).slice(0, 200)}`; continue }

      const data = await res.json()
      for (const part of (data.candidates?.[0]?.content?.parts || [])) {
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

// ── Build prompt ─────────────────────────────────────────────────────────
function buildPrompt(
  concept: string,
  persona: { name: string; angle: string; hook?: string },
  brandContext: string,
  hasReference: boolean,
  hasProduct: boolean
): string {
  const lines: string[] = []

  if (hasReference && hasProduct) {
    lines.push('I am giving you images. The FIRST is a reference ad - match its exact layout, composition, lighting, and style. The OTHER images are product photos - feature this exact product in the image.')
  } else if (hasReference) {
    lines.push('Edit this image. Keep the same composition, background, camera angle, and lighting.')
  } else if (hasProduct) {
    lines.push('Create a social media ad image featuring the EXACT product shown in my image. Do not change or invent a different product.')
  } else {
    lines.push('Create a social media ad image.')
  }

  lines.push('')
  lines.push(`Target audience: ${persona.name}`)
  lines.push(`Mood/angle: ${persona.angle}`)
  if (brandContext) lines.push(`Brand: ${brandContext}`)
  lines.push('')
  lines.push(`Scene: ${concept}`)
  lines.push('')
  lines.push('Generate a clean product/lifestyle photograph only. Do NOT add any text, headlines, buttons, logos, or typography. The image will be used as a base layer with text added separately in Figma. Focus on composition, lighting, and product placement.')

  return lines.join('\n')
}

// ── Upload to Supabase ───────────────────────────────────────────────────
async function uploadToStorage(supabase: ReturnType<typeof createClient>, base64DataUrl: string, brandId: string): Promise<string> {
  try {
    const base64Data = base64DataUrl.split(',')[1]
    const buffer = Buffer.from(base64Data, 'base64')
    const path = `creatives/${brandId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`
    const { error } = await supabase.storage.from('brand-assets').upload(path, buffer, { contentType: 'image/png', upsert: false })
    if (error) { console.error('Upload error:', JSON.stringify(error)); return base64DataUrl }
    const { data: urlData } = supabase.storage.from('brand-assets').getPublicUrl(path)
    return urlData.publicUrl
  } catch (e) { console.error('Upload exception:', e); return base64DataUrl }
}

// ── Ensure demo brand ────────────────────────────────────────────────────
async function ensureDemoBrand(supabase: ReturnType<typeof createClient>): Promise<string> {
  const { data: existing } = await supabase.from('brands').select('id').eq('name', 'Fulton').limit(1).single()
  if (existing) return existing.id
  const { data: newBrand } = await supabase.from('brands').insert({ name: 'Fulton', color: '#1B4332', url: 'https://walkfulton.com' }).select('id').single()
  return newBrand?.id || 'demo'
}

// ── POST ─────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const body = await req.json()
    const { concept, personas, brandId: rawBrandId, referenceImage, productImages } = body

    if (!concept || !personas?.length) return NextResponse.json({ error: 'Missing concept or personas' }, { status: 400 })
    if (!process.env.GEMINI_API_KEY) return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 })

    const brandId = rawBrandId && rawBrandId !== 'demo' ? rawBrandId : await ensureDemoBrand(supabase)
    const { data: brand } = await supabase.from('brands').select('*').eq('id', brandId).single()

    let brandContext = ''
    if (brand) {
      const parts = []
      if (brand.name) parts.push(`Brand: ${brand.name}`)
      // Use research data if available for richer context
      if (brand.research) {
        if (brand.research.brandVoice) parts.push(`Voice: ${brand.research.brandVoice}`)
        if (brand.research.productCategory) parts.push(`Product: ${brand.research.productCategory}`)
        if (brand.research.valueProps?.length) parts.push(`Value: ${brand.research.valueProps.slice(0, 3).join(', ')}`)
      } else if (brand.tone_notes) {
        parts.push(`Tone: ${brand.tone_notes}`)
      }
      if (brand.brand_colors?.length) parts.push(`Colors: ${brand.brand_colors.join(', ')}`)
      brandContext = parts.join('. ')
    }

    // Collect images: reference first, then products
    const imageInputs: string[] = []
    const hasRef = referenceImage?.startsWith('data:image/')
    const validProducts = (productImages || []).filter((img: string) => img?.startsWith('data:image/')).slice(0, 3)

    if (hasRef) imageInputs.push(referenceImage)
    if (validProducts.length) imageInputs.push(...validProducts)

    const results = []
    for (const persona of personas) {
      try {
        const prompt = buildPrompt(concept, persona, brandContext, !!hasRef, validProducts.length > 0)

        // One Gemini call - full image with product, text, everything
        const imageDataUrl = await generateWithGemini(prompt, imageInputs)

        // Upload to storage
        const imageUrl = await uploadToStorage(supabase, imageDataUrl, brandId)

        // Save to database
        const title = `${persona.name} - ${persona.angle.slice(0, 30)}`
        await supabase.from('creatives').insert({
          brand_id: brandId, title, concept,
          persona: persona.name, angle: persona.angle,
          image_url: imageUrl, format: '9x16', generator: 'gemini',
        })

        results.push({ persona, imageUrl })
      } catch (e: unknown) {
        console.error(`Failed for ${persona.name}:`, e)
        results.push({ persona, imageUrl: '', error: e instanceof Error ? e.message : String(e) })
      }
    }

    return NextResponse.json({ results, brandId })
  } catch (e: unknown) {
    console.error('Generate error:', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
