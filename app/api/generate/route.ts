import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient as createClient } from '@/lib/supabase-server'
import { composeAd, composeAllFormats } from '@/lib/compose-ad'

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

// ── Build prompt depending on what images are provided ────────────────────
function buildPrompt(
  concept: string,
  persona: { name: string; angle: string; hook?: string },
  brandContext?: string,
  hasReferenceImage?: boolean,
  hasProductImages?: boolean
): string {
  const lines: string[] = []

  if (hasReferenceImage && hasProductImages) {
    lines.push('Edit the first image I provided. Keep the SAME composition, background, camera angle, and lighting. Replace the product with the product shown in the other image(s) I provided. Keep everything else identical.')
  } else if (hasReferenceImage) {
    lines.push('Edit this image. Keep the SAME composition, background, camera angle, and lighting. Make the following adjustments:')
  } else if (hasProductImages) {
    lines.push('Create a product photograph featuring the EXACT product shown in the image I provided. Do not change or invent a different product.')
  } else {
    lines.push('Create a product lifestyle photograph.')
  }

  lines.push('')
  lines.push(`Audience: ${persona.name}`)
  lines.push(`Mood: ${persona.angle}`)

  if (brandContext) {
    lines.push(`Brand: ${brandContext}`)
  }

  if (!hasReferenceImage) {
    lines.push('')
    lines.push(`Scene: ${concept}`)
  }

  lines.push('')
  lines.push('Do NOT add any text, words, logos, or typography. Output only the photograph.')

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

    // Reference image FIRST, then product images
    // Order matters - the prompt tells Gemini "first image is reference, remaining are product"
    const imageInputs: string[] = []
    const hasRef = referenceImage && referenceImage.startsWith('data:image/')
    const validProducts = (productImages || []).filter((img: string) => img?.startsWith('data:image/')).slice(0, 3)
    const hasProducts = validProducts.length > 0

    if (hasRef) {
      imageInputs.push(referenceImage)
      console.log('Reference image: YES, size:', Math.round(referenceImage.length / 1024), 'KB')
    }
    if (hasProducts) {
      imageInputs.push(...validProducts)
      console.log('Product images:', validProducts.length)
    }
    console.log('Total images to Gemini:', imageInputs.length, '| Has ref:', !!hasRef, '| Has products:', hasProducts)

    // Generate one image per persona
    const results = []
    for (const persona of personas) {
      try {
        const prompt = buildPrompt(
          concept,
          persona,
          brandContext,
          !!hasRef,
          hasProducts
        )

        // Step 1: Generate clean image with Gemini (no text)
        const rawImageDataUrl = await generateWithGemini(prompt, imageInputs)

        // Step 2: Composite headline, CTA, and brand name for all 3 formats
        const rawBase64 = rawImageDataUrl.split(',')[1]
        const rawBuffer = Buffer.from(rawBase64, 'base64')

        const composeOptions = {
          imageBuffer: rawBuffer,
          headline: persona.hook || persona.angle,
          cta: 'Shop Now',
          brandName: brand?.name?.toUpperCase() || 'FULTON',
          brandColor: brand?.color || '#1B4332',
        }

        // Generate all three formats
        const allFormats = await composeAllFormats(composeOptions)

        // Upload all formats
        const format9x16 = `data:image/png;base64,${allFormats['9x16'].toString('base64')}`
        const format4x5 = `data:image/png;base64,${allFormats['4x5'].toString('base64')}`
        const format1x1 = `data:image/png;base64,${allFormats['1x1'].toString('base64')}`

        const [imageUrl, image4x5Url, image1x1Url] = await Promise.all([
          uploadToStorage(supabase, format9x16, brandId),
          uploadToStorage(supabase, format4x5, brandId),
          uploadToStorage(supabase, format1x1, brandId),
        ])

        const title = `${persona.name} - ${persona.angle.slice(0, 30)}`
        await supabase.from('creatives').insert({
          brand_id: brandId,
          title,
          concept,
          persona: persona.name,
          angle: persona.angle,
          image_url: imageUrl,
          image_4x5_url: image4x5Url,
          image_1x1_url: image1x1Url,
          format: '9x16',
          generator: 'gemini',
        })

        results.push({
          persona,
          imageUrl,
          formats: {
            '9x16': imageUrl,
            '4x5': image4x5Url,
            '1x1': image1x1Url,
          },
        })
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
