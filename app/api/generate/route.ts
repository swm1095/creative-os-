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

  lines.push('Create a professional advertising creative image for a direct-to-consumer brand.')
  lines.push('')

  // Persona-specific direction
  lines.push(`TARGET PERSONA: ${persona.name}`)
  lines.push(`AD ANGLE: ${persona.angle}`)
  if (persona.hook) lines.push(`HOOK/MESSAGE: ${persona.hook}`)
  lines.push('')

  // Brand context
  if (brandContext) {
    lines.push(`BRAND CONTEXT: ${brandContext}`)
    lines.push('')
  }

  // Creative direction
  lines.push(`CREATIVE BRIEF: ${concept}`)
  lines.push('')

  // Reference image instructions
  if (hasReferenceImage) {
    lines.push('REFERENCE IMAGE: I have provided a reference image. Match its visual style, composition, lighting, and mood as closely as possible. Adapt the content to fit the persona and brand above, but keep the aesthetic consistent with the reference.')
    lines.push('')
  }

  // Product image instructions
  if (hasProductImages) {
    lines.push('PRODUCT IMAGES: I have provided product photos. Feature this exact product prominently in the generated image. Show the actual product, do not create a generic or different product. The product should be the hero of the image.')
    lines.push('')
  }

  lines.push('REQUIREMENTS:')
  lines.push('- The image must feel tailored to the specific persona above, not generic')
  lines.push('- Professional quality suitable for paid social media advertising')
  lines.push('- Clean composition, natural lighting, clear visual hierarchy')
  lines.push('- Do NOT include any text, copy, logos, or watermarks in the image')
  lines.push('- The image should evoke the emotion and lifestyle of the target persona')

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
    if (referenceImage) imageInputs.push(referenceImage)
    if (productImages?.length) {
      // Add up to 3 product images to avoid hitting size limits
      imageInputs.push(...productImages.slice(0, 3))
    }

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
