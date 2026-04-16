import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient as createClient } from '@/lib/supabase-server'
import { composeAllFormats } from '@/lib/compose-ad'
import { removeBackground, compositeProductOnBackground, generateBackground } from '@/lib/image-pipeline'

export const maxDuration = 120

// ── Claude QC Review ─────────────────────────────────────────────────────
async function reviewWithClaude(
  generatedImageBase64: string,
  referenceImageBase64: string | undefined,
  persona: { name: string; angle: string; hook?: string },
  prompt: string
): Promise<{ pass: boolean; feedback: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return { pass: true, feedback: '' }

  try {
    const client = new Anthropic({ apiKey })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const content: any[] = []

    if (referenceImageBase64) {
      const refMatch = referenceImageBase64.match(/^data:(image\/\w+);base64,(.+)$/)
      if (refMatch) {
        content.push({ type: 'text', text: 'REFERENCE IMAGE:' })
        content.push({ type: 'image', source: { type: 'base64', media_type: refMatch[1], data: refMatch[2] } })
      }
    }

    const genMatch = generatedImageBase64.match(/^data:(image\/\w+);base64,(.+)$/)
    if (!genMatch) return { pass: true, feedback: '' }

    content.push({ type: 'text', text: 'GENERATED IMAGE:' })
    content.push({ type: 'image', source: { type: 'base64', media_type: genMatch[1], data: genMatch[2] } })

    content.push({
      type: 'text',
      text: `Review this ad image. Check:
1. ${referenceImageBase64 ? 'Does the background/scene match the reference style?' : 'Skip reference check.'}
2. Is the product clearly visible and not distorted?
3. Any AI artifacts or hallucinations?
4. Professional quality for paid social ads?
5. Appropriate mood for persona: "${persona.name}" - "${persona.angle}"

Respond in JSON: {"pass": true/false, "feedback": "specific fix instructions"}
Be strict on product distortion and artifacts. Backgrounds can be creative.`,
    })

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      messages: [{ role: 'user', content }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return { pass: true, feedback: '' }
    const result = JSON.parse(jsonMatch[0])
    console.log('QC:', result.pass ? 'PASS' : 'FAIL')
    return { pass: !!result.pass, feedback: result.feedback || '' }
  } catch (e) {
    console.error('QC error:', e)
    return { pass: true, feedback: '' }
  }
}

// ── Build background prompt ──────────────────────────────────────────────
function buildBackgroundPrompt(
  concept: string,
  persona: { name: string; angle: string; hook?: string },
  brandContext?: string,
  hasReference?: boolean
): string {
  const lines: string[] = []

  if (hasReference) {
    lines.push('Edit this image. Keep the same style, colors, lighting, and mood. Adjust the scene to fit the description below.')
  } else {
    lines.push('Generate a background scene for a product advertisement. The product will be composited on top separately, so leave a clear area in the center-bottom of the image for product placement.')
  }

  lines.push('')
  lines.push(`Scene: ${concept}`)
  lines.push(`Mood for audience "${persona.name}": ${persona.angle}`)
  if (brandContext) lines.push(`Brand: ${brandContext}`)
  lines.push('')
  lines.push('Requirements:')
  lines.push('- Clean, uncluttered composition with space for a product in the lower center')
  lines.push('- Professional advertising quality, natural lighting')
  lines.push('- Do NOT include any products, shoes, or objects in the center - leave that area open')
  lines.push('- Do NOT add any text, logos, or typography')
  lines.push('- Soft, slightly blurred background works well for product ads')

  return lines.join('\n')
}

// ── Upload to Supabase Storage ───────────────────────────────────────────
async function uploadToStorage(
  supabase: ReturnType<typeof createClient>,
  base64DataUrl: string,
  brandId: string
): Promise<string> {
  try {
    const base64Data = base64DataUrl.split(',')[1]
    const buffer = Buffer.from(base64Data, 'base64')
    const path = `creatives/${brandId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`
    const { error } = await supabase.storage.from('brand-assets').upload(path, buffer, { contentType: 'image/png', upsert: false })
    if (error) { console.error('Upload error:', JSON.stringify(error)); return base64DataUrl }
    const { data: urlData } = supabase.storage.from('brand-assets').getPublicUrl(path)
    console.log('Uploaded to:', urlData.publicUrl)
    return urlData.publicUrl
  } catch (e) { console.error('Upload exception:', e); return base64DataUrl }
}

// ── Ensure demo brand exists ─────────────────────────────────────────────
async function ensureDemoBrand(supabase: ReturnType<typeof createClient>): Promise<string> {
  const { data: existing } = await supabase.from('brands').select('id').eq('name', 'Fulton').limit(1).single()
  if (existing) return existing.id
  const { data: newBrand } = await supabase.from('brands').insert({ name: 'Fulton', color: '#1B4332', url: 'https://walkfulton.com' }).select('id').single()
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
      brandId: rawBrandId,
      referenceImage,
      productImages,
    } = body

    if (!concept || !personas?.length) {
      return NextResponse.json({ error: 'Missing concept or personas' }, { status: 400 })
    }
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 })
    }

    const brandId = rawBrandId && rawBrandId !== 'demo' ? rawBrandId : await ensureDemoBrand(supabase)
    const { data: brand } = await supabase.from('brands').select('*').eq('id', brandId).single()

    let brandContext = ''
    if (brand) {
      const parts = []
      if (brand.name) parts.push(`Brand: ${brand.name}`)
      if (brand.tone_notes) parts.push(`Tone: ${brand.tone_notes}`)
      if (brand.brand_colors?.length) parts.push(`Colors: ${brand.brand_colors.join(', ')}`)
      brandContext = parts.join('. ')
    }

    const hasRef = referenceImage?.startsWith('data:image/')
    const validProducts = (productImages || []).filter((img: string) => img?.startsWith('data:image/')).slice(0, 3)
    const hasProducts = validProducts.length > 0
    const hasRemoveBg = !!process.env.REMOVEBG_API_KEY

    console.log('Pipeline:', hasRef ? 'REF' : 'NO-REF', '|', hasProducts ? `${validProducts.length} products` : 'NO-PRODUCTS', '|', hasRemoveBg ? 'REMOVEBG' : 'NO-REMOVEBG')

    const results = []
    for (const persona of personas) {
      try {
        const MAX_PASSES = 3
        let finalImageBuffer: Buffer | null = null

        for (let pass = 1; pass <= MAX_PASSES; pass++) {
          console.log(`Pass ${pass}/${MAX_PASSES} for ${persona.name}`)

          let backgroundPrompt = buildBackgroundPrompt(concept, persona, brandContext, !!hasRef)
          if (pass > 1 && finalImageBuffer) {
            backgroundPrompt += '\n\nPREVIOUS ATTEMPT HAD ISSUES. Try a different composition.'
          }

          // Step 1: Generate background scene
          const bgDataUrl = await generateBackground(backgroundPrompt, hasRef ? referenceImage : undefined)
          const bgBuffer = Buffer.from(bgDataUrl.split(',')[1], 'base64')

          if (hasProducts && hasRemoveBg) {
            // Step 2: Remove background from first product image
            const productCutout = await removeBackground(validProducts[0])

            // Step 3: Composite product onto background
            finalImageBuffer = await compositeProductOnBackground(bgBuffer, productCutout)
          } else if (hasProducts) {
            // No Remove.bg - just use the background (product won't be composited)
            console.log('Skipping product composite - no REMOVEBG_API_KEY')
            finalImageBuffer = bgBuffer
          } else {
            // No product images - just use the generated background
            finalImageBuffer = bgBuffer
          }

          // Step 4: QC check (skip on last pass)
          if (pass < MAX_PASSES) {
            const checkDataUrl = `data:image/png;base64,${finalImageBuffer.toString('base64')}`
            const review = await reviewWithClaude(checkDataUrl, hasRef ? referenceImage : undefined, persona, concept)
            if (review.pass) {
              console.log(`Pass ${pass}: QC PASSED`)
              break
            }
            console.log(`Pass ${pass}: QC FAILED - ${review.feedback.slice(0, 100)}`)
          }
        }

        if (!finalImageBuffer) throw new Error('No image generated')

        // Step 5: Compose text overlays for all 3 formats
        const allFormats = await composeAllFormats({
          imageBuffer: finalImageBuffer,
          headline: persona.hook || persona.angle,
          cta: 'Shop Now',
          brandName: brand?.name?.toUpperCase() || 'FULTON',
          brandColor: brand?.color || '#1B4332',
        })

        // Upload all formats
        const [imageUrl, image4x5Url, image1x1Url] = await Promise.all([
          uploadToStorage(supabase, `data:image/png;base64,${allFormats['9x16'].toString('base64')}`, brandId),
          uploadToStorage(supabase, `data:image/png;base64,${allFormats['4x5'].toString('base64')}`, brandId),
          uploadToStorage(supabase, `data:image/png;base64,${allFormats['1x1'].toString('base64')}`, brandId),
        ])

        const title = `${persona.name} - ${persona.angle.slice(0, 30)}`
        await supabase.from('creatives').insert({
          brand_id: brandId, title, concept,
          persona: persona.name, angle: persona.angle,
          image_url: imageUrl, image_4x5_url: image4x5Url, image_1x1_url: image1x1Url,
          format: '9x16', generator: 'gemini',
        })

        results.push({
          persona, imageUrl,
          formats: { '9x16': imageUrl, '4x5': image4x5Url, '1x1': image1x1Url },
        })
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
