import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient as createClient } from '@/lib/supabase-server'

export const maxDuration = 300

const FAL_BASE = 'https://queue.fal.run'

// Submit a lip sync job to fal.ai
async function submitLipSync(videoUrl: string, audioUrl: string): Promise<{ requestId: string; statusUrl: string; responseUrl: string }> {
  const falKey = process.env.FAL_KEY
  if (!falKey) throw new Error('FAL_KEY not configured')

  // Try the lipsync endpoint first
  const res = await fetch(`${FAL_BASE}/fal-ai/lipsync`, {
    method: 'POST',
    headers: {
      'Authorization': `Key ${falKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      video_url: videoUrl,
      audio_url: audioUrl,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`fal.ai lipsync failed: ${res.status} ${err.slice(0, 200)}`)
  }

  const data = await res.json()
  return {
    requestId: data.request_id,
    statusUrl: data.status_url,
    responseUrl: data.response_url,
  }
}

// Poll for lip sync completion
async function pollForResult(responseUrl: string, maxWaitMs: number = 240000): Promise<{ videoUrl: string }> {
  const falKey = process.env.FAL_KEY
  if (!falKey) throw new Error('FAL_KEY not configured')

  const startTime = Date.now()

  while (Date.now() - startTime < maxWaitMs) {
    await new Promise(r => setTimeout(r, 5000))

    const res = await fetch(responseUrl, {
      headers: { 'Authorization': `Key ${falKey}` },
    })

    if (res.status === 200) {
      const data = await res.json()
      const videoUrl = data.video?.url || data.output?.url || data.url
      if (videoUrl) return { videoUrl }

      // Try to find any URL in the response
      const jsonStr = JSON.stringify(data)
      const urlMatch = jsonStr.match(/https?:\/\/[^"]+\.(mp4|webm|mov)[^"]*/i)
      if (urlMatch) return { videoUrl: urlMatch[0] }

      throw new Error('Lip sync completed but could not find video URL in response')
    }

    if (res.status === 202) continue

    const errData = await res.json().catch(() => ({}))
    if (errData.status === 'FAILED') {
      throw new Error(`Lip sync failed: ${errData.error || 'Unknown error'}`)
    }
  }

  throw new Error('Lip sync timed out after 4 minutes')
}

// POST - submit lip sync job (can run synchronously or async)
export async function POST(req: NextRequest) {
  try {
    const falKey = process.env.FAL_KEY
    if (!falKey) return NextResponse.json({ error: 'FAL_KEY not configured' }, { status: 500 })

    const { videoUrl, audioUrl, brandId, async: asyncMode } = await req.json()

    if (!videoUrl) return NextResponse.json({ error: 'videoUrl required' }, { status: 400 })
    if (!audioUrl) return NextResponse.json({ error: 'audioUrl required' }, { status: 400 })

    console.log('Submitting lip sync job...')
    const job = await submitLipSync(videoUrl, audioUrl)
    console.log(`Lip sync job submitted: ${job.requestId}`)

    // Async mode: return job info for client-side polling
    if (asyncMode) {
      return NextResponse.json({
        responseUrl: job.responseUrl,
        requestId: job.requestId,
        status: 'queued',
      })
    }

    // Sync mode: poll and wait
    const result = await pollForResult(job.responseUrl)
    console.log('Lip sync complete:', result.videoUrl)

    // Save to Supabase if brandId provided
    if (brandId) {
      try {
        const supabase = createClient()
        await supabase.from('creatives').insert({
          brand_id: brandId,
          title: `UGC Video (lip synced)`,
          image_url: result.videoUrl,
          format: '9x16',
          generator: 'lipsync',
        })
      } catch { /* silent */ }
    }

    return NextResponse.json({ videoUrl: result.videoUrl })
  } catch (e: unknown) {
    console.error('Lip sync error:', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}

// GET - check status of a lip sync job
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
      if (!videoUrl) {
        const jsonStr = JSON.stringify(data)
        const urlMatch = jsonStr.match(/https?:\/\/[^"]+\.(mp4|webm|mov)[^"]*/i)
        if (urlMatch) videoUrl = urlMatch[0]
      }
      return NextResponse.json({ status: 'complete', videoUrl })
    }

    if (res.status === 202) {
      const data = await res.json().catch(() => ({}))
      return NextResponse.json({ status: 'processing', queuePosition: data.queue_position })
    }

    return NextResponse.json({ status: 'unknown' })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
