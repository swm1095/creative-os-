import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient as createClient } from '@/lib/supabase-server'

export const maxDuration = 60

interface ImagePart {
  inlineData: { mimeType: string; data: string }
}

interface TextPart {
  text: string
}

type Part = ImagePart | TextPart

// ── Gemini Image Generation with optional reference images ───────────────
async function generateWithGemini(prompt: string, referenceImages: string[] = []): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured')

  // Build parts array: reference images first, then the text prompt
  const parts: Part[] = []

  // Add reference/product images as inline data
  for (const imgDataUrl of referenceImages) {
    const match = imgDataUrl.match(/^data:(image\/\w+);base64,(.+)$/)
    if (match) {
      parts.push({
        inlineData: {
          mimeType: match[1],
          data: match[2],
        },
      })
    }
  }

  // Add the text prompt last
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
            generationConfig: {
              responseModalities: ['TEXT', 'IMAGE'],
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
      const responseParts = data.candidates?.[0]?.content?.parts || []
      for (const part of responseParts) {
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

// ── Build a detailed prompt from brand + persona context ─────────────────
function buildPrompt(
  concept: string,
  persona: { name: string; angle: string; hook?: string },
  brandContext?: string,
  hasReferenceImage?: boolean,
  hasProductImages?: boolean
): string {
  const lines: string[] = []

  lines.push('Generate a social media ad creative image.')
  lines.push('')

  if (hasReferenceImage) {
    lines.push('IMPORTANT: I attached a reference image. Copy its exact layout, style, colors, and composition. Recreate it with the details below.')
    lines.push('')
  }

  if (hasProductImages) {
    lines.push('IMPORTANT: I attached product photos. Use this EXACT product in the image. Do not invent a different product.')
    lines.push('')
  }

  lines.push(`HEADLINE TEXT ON IMAGE: "${persona.hook || persona.angle}"`)
  lines.push(`CTA BUTTON TEXT: "Shop Now"`)
  lines.push(`PERSONA: ${persona.name}`)
  lines.push(`ANGLE: ${persona.angle}`)
  lines.push('')

  if (brandContext) {
    lines.push(`BRAND: ${brandContext}`)
    lines.push('')
  }

  lines.push(`SCENE: ${concept}`)
  lines.push('')
  lines.push('The image MUST include readable text. Put the headline text prominently on the image. Include a CTA button. Make it look like a real paid social ad. Professional quality, clean typography.')

  return lines.join('\n')
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
      return base64DataUrl
    }

    const { data: urlData } = supabase.storage.from('brand-assets').getPublicUrl(path)
    return urlData.publicUrl
  } catch {
    return base64DataUrl
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
    const {
      concept,
      personas,
      aspectRatio = '1x1',
      brandId: rawBrandId,
      referenceImage,    // base64 data URL of reference image
      productImages,     // array of base64 data URLs of product images
    } = body

    if (!concept || !personas?.length) {
      return NextResponse.json({ error: 'Missing concept or personas' }, { status: 400 })
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 })
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
      if (brand.brand_colors?.length) parts.push(`Brand colors: ${brand.brand_colors.join(', ')}`)
      if (brand.brand_fonts?.length) parts.push(`Brand fonts: ${brand.brand_fonts.join(', ')}`)
      brandContext = parts.join('. ')
    }

    // Collect all reference images to send to Gemini
    const imageInputs: string[] = []
    if (referenceImage && referenceImage.startsWith('data:image/')) {
      imageInputs.push(referenceImage)
      console.log('Reference image included, size:', Math.round(referenceImage.length / 1024), 'KB')
    }
    if (productImages?.length) {
      const validProducts = productImages.filter((img: string) => img?.startsWith('data:image/')).slice(0, 3)
      imageInputs.push(...validProducts)
      console.log('Product images included:', validProducts.length)
    }
    console.log('Total images being sent to Gemini:', imageInputs.length)

    // Generate one image per persona
    const results = []
    for (const persona of personas) {
      try {
        const prompt = buildPrompt(
          concept,
          persona,
          brandContext,
          !!referenceImage,
          !!productImages?.length
        )
        const imageDataUrl = await generateWithGemini(prompt, imageInputs)
        const imageUrl = await uploadToStorage(supabase, imageDataUrl, brandId)

        const title = `${persona.name} - ${persona.angle.slice(0, 30)}`
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
