import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient as createClient } from '@/lib/supabase-server'
import { CONTENT_FILTER } from '@/lib/content-filter'

export const maxDuration = 300 // 5 minutes for video generation

const FAL_BASE = 'https://queue.fal.run'

type VideoModel = 'seedance' | 'kling'
type VideoStyle = 'ugc' | 'cinematic' | 'animated' | 'product'

interface VideoScene {
  sceneNumber: number
  prompt: string
  duration: number
  camera: string
  style: string
}

// Submit an image-to-video job (creator photo -> animated video)
async function submitImageToVideo(prompt: string, imageUrl: string, aspectRatio: string, duration: number): Promise<{ requestId: string; statusUrl: string; responseUrl: string }> {
  const falKey = process.env.FAL_KEY
  if (!falKey) throw new Error('FAL_KEY not configured')

  const res = await fetch(`${FAL_BASE}/fal-ai/seedance-2/image-to-video`, {
    method: 'POST',
    headers: { 'Authorization': `Key ${falKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, image_url: imageUrl, aspect_ratio: aspectRatio, duration }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Seedance image-to-video failed: ${res.status} ${err.slice(0, 200)}`)
  }

  const data = await res.json()
  return { requestId: data.request_id, statusUrl: data.status_url, responseUrl: data.response_url }
}

// Submit a video generation job to fal.ai
async function submitVideoJob(model: VideoModel, prompt: string, aspectRatio: string, duration: number): Promise<{ requestId: string; statusUrl: string; responseUrl: string }> {
  const falKey = process.env.FAL_KEY
  if (!falKey) throw new Error('FAL_KEY not configured')

  const modelMap: Record<VideoModel, string> = {
    seedance: 'fal-ai/seedance-2',
    kling: 'fal-ai/kling-video/v3/standard/text-to-video',
  }

  const body: Record<string, unknown> = { prompt, aspect_ratio: aspectRatio }

  if (model === 'seedance') {
    body.duration = duration
  } else if (model === 'kling') {
    body.duration = String(duration)
  }

  const res = await fetch(`${FAL_BASE}/${modelMap[model]}`, {
    method: 'POST',
    headers: {
      'Authorization': `Key ${falKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`fal.ai ${model} failed: ${res.status} ${err.slice(0, 200)}`)
  }

  const data = await res.json()
  return {
    requestId: data.request_id,
    statusUrl: data.status_url,
    responseUrl: data.response_url,
  }
}

// Poll for video completion
async function pollForResult(responseUrl: string, maxWaitMs: number = 240000): Promise<{ videoUrl: string }> {
  const falKey = process.env.FAL_KEY
  if (!falKey) throw new Error('FAL_KEY not configured')

  const startTime = Date.now()

  while (Date.now() - startTime < maxWaitMs) {
    await new Promise(r => setTimeout(r, 5000)) // Check every 5 seconds

    const res = await fetch(responseUrl, {
      headers: { 'Authorization': `Key ${falKey}` },
    })

    if (res.status === 200) {
      const data = await res.json()
      // Seedance returns video in data.video.url, Kling in data.video.url
      const videoUrl = data.video?.url || data.output?.url || data.url
      if (videoUrl) return { videoUrl }

      // Check if there's a different structure
      console.log('Video response keys:', Object.keys(data))
      if (data.video) console.log('Video keys:', Object.keys(data.video))

      // Try to find any URL in the response
      const jsonStr = JSON.stringify(data)
      const urlMatch = jsonStr.match(/https?:\/\/[^"]+\.(mp4|webm|mov)[^"]*/i)
      if (urlMatch) return { videoUrl: urlMatch[0] }

      throw new Error('Video generated but could not find URL in response')
    }

    if (res.status === 202) {
      // Still processing
      continue
    }

    // Error
    const errData = await res.json().catch(() => ({}))
    if (errData.status === 'FAILED') {
      throw new Error(`Video generation failed: ${errData.error || 'Unknown error'}`)
    }
  }

  throw new Error('Video generation timed out after 4 minutes')
}

// POST - generate a video
export async function POST(req: NextRequest) {
  try {
    const falKey = process.env.FAL_KEY
    if (!falKey) return NextResponse.json({ error: 'FAL_KEY not configured. Add it in Vercel.' }, { status: 500 })

    const body = await req.json()
    const {
      prompt,
      model = 'seedance' as VideoModel,
      style = 'ugc' as VideoStyle,
      aspectRatio = '9:16',
      duration = 5,
      brandId,
      imageUrl, // Creator photo for image-to-video mode
      scenes, // Optional: pre-broken scenes from Claude
    } = body

    if (!prompt && !scenes?.length) {
      return NextResponse.json({ error: 'prompt or scenes required' }, { status: 400 })
    }

    // Style-specific prompt enhancement
    const stylePrompts: Record<VideoStyle, string> = {
      ugc: 'Shot on iPhone, handheld, natural lighting, authentic feel. Person casually showing or using the product. No text overlays.',
      cinematic: 'Cinematic quality, professional lighting, smooth camera movements, shallow depth of field, high production value. Product hero shot.',
      animated: 'Smooth motion graphics style animation, clean transitions, modern aesthetic, vibrant colors.',
      product: 'Clean product photography in motion, studio lighting, slow rotation or reveal, white or minimal background, focus on product details.',
    }

    const styleKey = style as VideoStyle
    // Only append style keywords - no content filter (video models don't understand text instructions)
    const enhancedPrompt = `${prompt}. ${stylePrompts[styleKey] || ''}`.trim()

    // If scenes provided, generate each scene separately
    if (scenes && scenes.length > 0) {
      const results = []
      for (const scene of scenes as VideoScene[]) {
        try {
          const scenePrompt = `Scene ${scene.sceneNumber}: ${scene.prompt}. Camera: ${scene.camera}. ${stylePrompts[styleKey] || ''}`
          console.log(`Submitting scene ${scene.sceneNumber}...`)
          const job = await submitVideoJob(model as VideoModel, scenePrompt, aspectRatio, scene.duration || 5)
          results.push({ scene: scene.sceneNumber, ...job, status: 'queued' })
        } catch (e: unknown) {
          results.push({ scene: scene.sceneNumber, error: e instanceof Error ? e.message : String(e), status: 'failed' })
        }
      }
      return NextResponse.json({ results, mode: 'multi-scene' })
    }

    // Async mode: submit job and return immediately for client-side polling
    const asyncMode = body.async === true

    // Image-to-video mode (creator photo -> animated video)
    if (imageUrl) {
      console.log(`Image-to-video: Seedance 2.0, ${aspectRatio}, ${duration}s`)
      const job = await submitImageToVideo(enhancedPrompt, imageUrl, aspectRatio, duration)
      console.log(`Job submitted: ${job.requestId}`)

      if (asyncMode) {
        return NextResponse.json({ responseUrl: job.responseUrl, requestId: job.requestId, model: 'seedance', style, aspectRatio, duration, mode: 'image-to-video', status: 'queued' })
      }

      const result = await pollForResult(job.responseUrl)
      console.log('Video URL:', result.videoUrl)

      if (brandId) {
        try {
          const supabase = createClient()
          await supabase.from('creatives').insert({
            brand_id: brandId, title: `UGC Video: ${prompt.slice(0, 50)}`,
            concept: prompt, image_url: result.videoUrl,
            format: aspectRatio.replace(':', 'x'), generator: 'seedance',
          })
        } catch { /* silent */ }
      }

      return NextResponse.json({ videoUrl: result.videoUrl, model: 'seedance', style, aspectRatio, duration, mode: 'image-to-video' })
    }

    // Single video generation
    console.log(`Generating ${model} video: ${style} style, ${aspectRatio}, ${duration}s`)
    const job = await submitVideoJob(model as VideoModel, enhancedPrompt, aspectRatio, duration)
    console.log(`Job submitted: ${job.requestId}`)

    if (asyncMode) {
      return NextResponse.json({ responseUrl: job.responseUrl, requestId: job.requestId, model, style, aspectRatio, duration, status: 'queued' })
    }

    // Poll for result
    const result = await pollForResult(job.responseUrl)
    console.log('Video URL:', result.videoUrl)

    // Save to Supabase if brandId provided
    if (brandId) {
      try {
        const supabase = createClient()
        await supabase.from('creatives').insert({
          brand_id: brandId,
          title: `Video: ${prompt.slice(0, 50)}`,
          concept: prompt,
          image_url: result.videoUrl,
          format: aspectRatio.replace(':', 'x'),
          generator: model,
        })
      } catch { /* silent */ }
    }

    return NextResponse.json({
      videoUrl: result.videoUrl,
      model,
      style,
      aspectRatio,
      duration,
      requestId: job.requestId,
    })
  } catch (e: unknown) {
    console.error('Video generation error:', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}

// GET - check status of a video job
export async function GET(req: NextRequest) {
  try {
    const falKey = process.env.FAL_KEY
    if (!falKey) return NextResponse.json({ error: 'FAL_KEY not configured' }, { status: 500 })

    const responseUrl = req.nextUrl.searchParams.get('responseUrl')
    if (!responseUrl) return NextResponse.json({ error: 'responseUrl required' }, { status: 400 })

    const res = await fetch(responseUrl, {
      headers: { 'Authorization': `Key ${falKey}` },
    })

    if (res.status === 200) {
      const data = await res.json()
      let videoUrl = data.video?.url || data.output?.url || data.url

      // Try regex match for any video URL in response
      if (!videoUrl) {
        const jsonStr = JSON.stringify(data)
        const urlMatch = jsonStr.match(/https?:\/\/[^"]+\.(mp4|webm|mov)[^"]*/i)
        if (urlMatch) videoUrl = urlMatch[0]
      }

      // Log the full response for debugging if no URL found
      if (!videoUrl) {
        console.log('Video response 200 but no URL found. Keys:', Object.keys(data), 'Full:', JSON.stringify(data).slice(0, 500))
        return NextResponse.json({ status: 'complete', videoUrl: null, debug: Object.keys(data) })
      }

      return NextResponse.json({ status: 'complete', videoUrl })
    }

    if (res.status === 202) {
      const data = await res.json().catch(() => ({}))
      return NextResponse.json({ status: 'processing', queuePosition: data.queue_position })
    }

    // Any other status - try to get error info
    const errBody = await res.text().catch(() => '')
    console.log(`Video poll unexpected status ${res.status}:`, errBody.slice(0, 200))
    return NextResponse.json({ status: 'processing' })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
