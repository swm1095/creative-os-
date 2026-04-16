import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient as createClient } from '@/lib/supabase-server'
import { composeAd, composeAllFormats } from '@/lib/compose-ad'

export const maxDuration = 120

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

// ── Claude QC Review - checks generated image against inputs ─────────────
async function reviewWithClaude(
  generatedImageBase64: string,
  referenceImageBase64: string | undefined,
  persona: { name: string; angle: string; hook?: string },
  prompt: string
): Promise<{ pass: boolean; feedback: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return { pass: true, feedback: '' } // skip QC if no key

  const client = new Anthropic({ apiKey })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const content: any[] = []

  // Add reference image if available
  if (referenceImageBase64) {
    const refMatch = referenceImageBase64.match(/^data:(image\/\w+);base64,(.+)$/)
    if (refMatch) {
      content.push({ type: 'text', text: 'REFERENCE IMAGE (the generated image should match this composition and style):' })
      content.push({ type: 'image', source: { type: 'base64', media_type: refMatch[1], data: refMatch[2] } })
    }
  }

  // Add generated image
  const genMatch = generatedImageBase64.match(/^data:(image\/\w+);base64,(.+)$/)
  if (!genMatch) return { pass: true, feedback: '' }

  content.push({ type: 'text', text: 'GENERATED IMAGE (review this against the criteria below):' })
  content.push({ type: 'image', source: { type: 'base64', media_type: genMatch[1], data: genMatch[2] } })

  content.push({
    type: 'text',
    text: `Review this generated ad image. Check ALL of the following:

1. REFERENCE MATCH: ${referenceImageBase64 ? 'Does it match the reference image composition, layout, background, and style? Be strict.' : 'No reference provided - skip this check.'}
2. PROMPT ADHERENCE: The prompt was: "${prompt}" - does the image match this description?
3. PERSONA FIT: Target persona is "${persona.name}" with angle "${persona.angle}" and hook "${persona.hook || 'none'}". Does the image feel appropriate for this audience?
4. HALLUCINATIONS: Is the product realistic? Any weird artifacts, extra fingers, distorted text, impossible physics, or AI glitches?
5. QUALITY: Is it professional enough for a paid social media ad?

Respond in this EXACT JSON format:
{
  "pass": true or false,
  "issues": ["list of specific issues found"],
  "feedback": "Specific instructions to fix the issues. Be direct and actionable."
}

Be strict. If there are ANY issues with reference matching, hallucinations, or quality, fail it.`,
  })

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{ role: 'user', content }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return { pass: true, feedback: '' }

    const result = JSON.parse(jsonMatch[0])
    console.log('QC Review:', result.pass ? 'PASS' : 'FAIL', result.issues?.length || 0, 'issues')
    return {
      pass: !!result.pass,
      feedback: result.feedback || '',
    }
  } catch (e) {
    console.error('QC review error:', e)
    return { pass: true, feedback: '' } // don't block on QC errors
  }
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
        const MAX_QC_PASSES = 3
        let rawImageDataUrl = ''
        let currentPrompt = buildPrompt(concept, persona, brandContext, !!hasRef, hasProducts)
        let currentImageInputs = [...imageInputs]

        // Multi-pass QC loop: generate, review, regenerate if needed
        for (let pass = 1; pass <= MAX_QC_PASSES; pass++) {
          console.log(`Pass ${pass}/${MAX_QC_PASSES} for ${persona.name}`)

          // Generate image
          rawImageDataUrl = await generateWithGemini(currentPrompt, currentImageInputs)

          // Skip QC on last pass (use whatever we got)
          if (pass === MAX_QC_PASSES) {
            console.log(`Pass ${pass}: Final pass, accepting result`)
            break
          }

          // Claude QC review
          const review = await reviewWithClaude(
            rawImageDataUrl,
            hasRef ? referenceImage : undefined,
            persona,
            concept
          )

          if (review.pass) {
            console.log(`Pass ${pass}: QC PASSED`)
            break
          }

          // QC failed - regenerate with Claude's feedback
          console.log(`Pass ${pass}: QC FAILED, regenerating with feedback: ${review.feedback.slice(0, 100)}`)
          currentPrompt = buildPrompt(concept, persona, brandContext, !!hasRef, hasProducts)
            + `\n\nCRITICAL FIXES NEEDED:\n${review.feedback}`

          // Use the failed image as reference for the next attempt so Gemini can see what to fix
          currentImageInputs = [rawImageDataUrl, ...imageInputs.slice(hasRef ? 1 : 0)]
        }

        // Composite headline, CTA, and brand name for all 3 formats
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
