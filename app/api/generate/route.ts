import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient as createClient } from '@/lib/supabase-server'
import { GenerateRequest, GenerateResult } from '@/lib/types'

// ── Aspect ratio maps ──────────────────────────────────────────────────────
const IDEOGRAM_RATIO: Record<string, string> = {
  '1x1': 'ASPECT_1_1', '4x5': 'ASPECT_4_5', '9x16': 'ASPECT_9_16',
}
const KLING_RATIO: Record<string, string> = {
  '1x1': '1:1', '4x5': '3:4', '9x16': '9:16',
}
const STABILITY_RATIO: Record<string, string> = {
  '1x1': '1:1', '4x5': '4:5', '9x16': '9:16',
}

// ──────────────────────────────────────────────────────────────────────────
// Kling AI — primary generator (text-to-image + image-to-image)
// Auth: JWT generated from API key + secret
// Flow: POST task → poll until complete
// ──────────────────────────────────────────────────────────────────────────
function buildKlingJWT(apiKey: string, apiSecret: string): string {
  // Kling uses a simple JWT: header.payload.signature
  const now = Math.floor(Date.now() / 1000)
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({
    iss: apiKey, exp: now + 1800, nbf: now - 5
  })).toString('base64url')

  // HMAC-SHA256 signature using Node.js crypto
  const crypto = require('crypto')
  const signature = crypto
    .createHmac('sha256', apiSecret)
    .update(`${header}.${payload}`)
    .digest('base64url')

  return `${header}.${payload}.${signature}`
}

async function generateWithKling(prompt: string, aspectRatio: string, imageToImageUrl?: string): Promise<string> {
  const apiKey = process.env.KLING_API_KEY
  const apiSecret = process.env.KLING_API_SECRET
  if (!apiKey || !apiSecret) throw new Error('KLING_API_KEY and KLING_API_SECRET are required')

  const jwt = buildKlingJWT(apiKey, apiSecret)
  const ratio = KLING_RATIO[aspectRatio] || '1:1'

  // Submit generation task
  const endpoint = imageToImageUrl
    ? 'https://api.klingai.com/v1/images/generations/image2image'
    : 'https://api.klingai.com/v1/images/generations'

  const body: Record<string, unknown> = {
    model_name: 'kling-v1-5',
    prompt,
    negative_prompt: 'blurry, low quality, distorted, watermark, text errors',
    image_count: 1,
    aspect_ratio: ratio,
    cfg_scale: 0.5,
  }
  if (imageToImageUrl) {
    body.image_reference = imageToImageUrl
    body.image_fidelity = 0.5
  }

  const taskRes = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${jwt}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!taskRes.ok) {
    const err = await taskRes.text()
    throw new Error(`Kling AI task creation failed: ${err.slice(0, 200)}`)
  }

  const taskData = await taskRes.json()
  const taskId = taskData.data?.task_id
  if (!taskId) throw new Error('No task ID returned from Kling AI')

  // Poll for result (max 120 seconds)
  const maxAttempts = 24
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise(r => setTimeout(r, 5000))

    const pollRes = await fetch(`https://api.klingai.com/v1/images/generations/${taskId}`, {
      headers: { 'Authorization': `Bearer ${jwt}` },
    })

    if (!pollRes.ok) continue

    const pollData = await pollRes.json()
    const status = pollData.data?.task_status

    if (status === 'succeed') {
      const imageUrl = pollData.data?.task_result?.images?.[0]?.url
      if (!imageUrl) throw new Error('Kling AI returned no image URL')
      return imageUrl
    }
    if (status === 'failed') {
      throw new Error(`Kling AI generation failed: ${pollData.data?.task_status_msg || 'Unknown error'}`)
    }
    // status: 'processing' | 'submitted' → keep polling
  }

  throw new Error('Kling AI generation timed out after 120 seconds')
}

// ──────────────────────────────────────────────────────────────────────────
// Ideogram — text-in-image specialist
// Best for: ad creatives with overlaid copy, typography-heavy ads
// ──────────────────────────────────────────────────────────────────────────
async function generateWithIdeogram(prompt: string, aspectRatio: string): Promise<string> {
  const apiKey = process.env.IDEOGRAM_API_KEY
  if (!apiKey) throw new Error('IDEOGRAM_API_KEY not configured')

  const res = await fetch('https://api.ideogram.ai/generate', {
    method: 'POST',
    headers: { 'Api-Key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image_request: {
        prompt,
        aspect_ratio: IDEOGRAM_RATIO[aspectRatio] || 'ASPECT_1_1',
        model: 'V_2',
        magic_prompt_option: 'AUTO',
      },
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Ideogram error: ${err.slice(0, 200)}`)
  }

  const data = await res.json()
  const imageUrl = data.data?.[0]?.url
  if (!imageUrl) throw new Error('No image URL in Ideogram response')
  return imageUrl
}

// ──────────────────────────────────────────────────────────────────────────
// Stability AI — batch generation + inpainting
// Best for: product shots, high-volume batch runs
// ──────────────────────────────────────────────────────────────────────────
async function generateWithStability(prompt: string, aspectRatio: string): Promise<string> {
  const apiKey = process.env.STABILITY_AI_KEY
  if (!apiKey) throw new Error('STABILITY_AI_KEY not configured')

  const formData = new FormData()
  formData.append('prompt', prompt)
  formData.append('aspect_ratio', STABILITY_RATIO[aspectRatio] || '1:1')
  formData.append('output_format', 'png')
  formData.append('model', 'sd3-large')

  const res = await fetch('https://api.stability.ai/v2beta/stable-image/generate/sd3', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Accept': 'application/json',
    },
    body: formData,
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Stability AI error: ${err.slice(0, 200)}`)
  }

  const data = await res.json()

  // Stability returns base64 — we need to return a usable URL
  // In production this would be uploaded to Supabase Storage
  // Here we return a data URL for immediate display
  const b64 = data.image
  if (!b64) throw new Error('No image data in Stability AI response')
  return `data:image/png;base64,${b64}`
}

// ──────────────────────────────────────────────────────────────────────────
// Generator router — picks the right API based on request
// ──────────────────────────────────────────────────────────────────────────
async function generate(
  generator: string,
  prompt: string,
  aspectRatio: string,
  sourceImageUrl?: string
): Promise<string> {
  switch (generator) {
    case 'kling':
      return generateWithKling(prompt, aspectRatio, sourceImageUrl)
    case 'ideogram':
      return generateWithIdeogram(prompt, aspectRatio)
    case 'stability':
      return generateWithStability(prompt, aspectRatio)
    default:
      // Fallback chain: Kling → Ideogram → Stability
      if (process.env.KLING_API_KEY && process.env.KLING_API_SECRET) {
        return generateWithKling(prompt, aspectRatio, sourceImageUrl)
      }
      if (process.env.IDEOGRAM_API_KEY) {
        return generateWithIdeogram(prompt, aspectRatio)
      }
      if (process.env.STABILITY_AI_KEY) {
        return generateWithStability(prompt, aspectRatio)
      }
      throw new Error('No image generation API configured. Add KLING_API_KEY, IDEOGRAM_API_KEY, or STABILITY_AI_KEY.')
  }
}

// ──────────────────────────────────────────────────────────────────────────
// POST /api/generate
// ──────────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()

    const body: GenerateRequest & {
      sourceImageUrl?: string  // for image-to-image (Kling)
      runRemoveBg?: boolean    // auto background removal
    } = await req.json()

    const { concept, personas, aspectRatio, generator, brandId, sourceImageUrl } = body
    if (!concept || !personas?.length || !brandId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Load brand context for prompt enrichment
    const { data: brand } = await supabase.from('brands').select('*').eq('id', brandId).single()

    const results: GenerateResult[] = []
    const errors: string[] = []

    for (const persona of personas) {
      // Build enriched prompt with brand context + persona
      const brandCtx  = brand?.tone_notes ? `Brand style: ${brand.tone_notes}. ` : ''
      const colorCtx  = brand?.brand_colors?.length ? `Brand colors: ${brand.brand_colors.slice(0,3).join(', ')}. ` : ''

      const prompt = [
        `Professional advertising creative for ${brand?.name || 'a brand'}.`,
        `Campaign: ${concept}.`,
        `Persona: ${persona.name}.`,
        `Angle: ${persona.angle}.`,
        persona.hook ? `Key message: "${persona.hook}".` : '',
        brandCtx + colorCtx,
        'High production value, clean composition, striking visual, ready for social media.',
      ].filter(Boolean).join(' ')

      try {
        let imageUrl = await generate(generator, prompt, aspectRatio, sourceImageUrl)

        // Optional: auto-run Remove.bg on the result
        if (body.runRemoveBg && process.env.REMOVEBG_API_KEY && imageUrl.startsWith('http')) {
          try {
            const removeRes = await fetch('/api/removebg', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ imageUrl }),
            })
            if (removeRes.ok) {
              const removeData = await removeRes.json()
              if (removeData.resultUrl) imageUrl = removeData.resultUrl
            }
          } catch { /* non-fatal — use original image */ }
        }

        // Save creative to database
        const title = `${concept.slice(0, 40)} — ${persona.name}`
        await supabase.from('creatives').insert({
          brand_id: brandId,
          user_id: '00000000-0000-0000-0000-000000000000',
          title,
          concept,
          persona: persona.name,
          angle: persona.angle,
          image_url: imageUrl,
          format: aspectRatio,
          generator,
          qc_spelling: 'pending',
          qc_brand: 'pending',
          qc_claims: 'pending',
        })

        results.push({ persona, imageUrl })
      } catch (genErr: any) {
        console.error(`Generation failed for persona ${persona.name}:`, genErr)
        errors.push(`${persona.name}: ${genErr.message}`)
        results.push({ persona, imageUrl: '' })
      }
    }

    return NextResponse.json({ results, errors: errors.length ? errors : undefined })
  } catch (e: any) {
    console.error('Generate error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
