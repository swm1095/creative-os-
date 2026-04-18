import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient as createClient } from '@/lib/supabase-server'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

const FAL_BASE = 'https://queue.fal.run'

// Submit a lip sync job to fal.ai
async function submitLipSync(videoUrl: string, audioUrl: string): Promise<{ requestId: string; statusUrl: string; responseUrl: string }> {
  const falKey = process.env.FAL_KEY
  if (!falKey) throw new Error('FAL_KEY not configured')

  // Try multiple possible lip sync model endpoints
  const models = [
    { id: 'fal-ai/sync-lipsync', body: { video_url: videoUrl, audio_url: audioUrl } },
    { id: 'fal-ai/lipsync', body: { video_url: videoUrl, audio_url: audioUrl } },
    { id: 'fal-ai/wav2lip', body: { video_url: videoUrl, audio_url: audioUrl } },
  ]

  for (const model of models) {
    try {
      const res = await fetch(`${FAL_BASE}/${model.id}`, {
        method: 'POST',
        headers: {
          'Authorization': `Key ${falKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(model.body),
      })

      if (res.ok) {
        const data = await res.json()
        console.log(`Lip sync submitted via ${model.id}: ${data.request_id}`)
        return {
          requestId: data.request_id,
          statusUrl: data.status_url,
          responseUrl: data.response_url,
        }
      }

      const err = await res.text()
      console.log(`${model.id} failed (${res.status}): ${err.slice(0, 100)}`)
    } catch (e) {
      console.log(`${model.id} error:`, e instanceof Error ? e.message : String(e))
    }
  }

  throw new Error('No lip sync model available on fal.ai. Check your fal.ai account for available models.')
}

// POST - submit lip sync job
export async function POST(req: NextRequest) {
  try {
    const falKey = process.env.FAL_KEY
    if (!falKey) return NextResponse.json({ error: 'FAL_KEY not configured' }, { status: 500 })

    const { videoUrl, audioUrl, brandId, async: asyncMode } = await req.json()

    if (!videoUrl) return NextResponse.json({ error: 'videoUrl required' }, { status: 400 })
    if (!audioUrl) return NextResponse.json({ error: 'audioUrl required' }, { status: 400 })

    console.log('Submitting lip sync job...')
    console.log('Video URL:', videoUrl.slice(0, 100))
    console.log('Audio URL:', audioUrl.slice(0, 100))

    const job = await submitLipSync(videoUrl, audioUrl)

    if (asyncMode) {
      return NextResponse.json({
        responseUrl: job.responseUrl,
        requestId: job.requestId,
        status: 'queued',
      })
    }

    // Sync mode - poll for result
    const maxWaitMs = 240000
    const startTime = Date.now()

    while (Date.now() - startTime < maxWaitMs) {
      await new Promise(r => setTimeout(r, 5000))

      const fetchUrl = `${job.responseUrl}${job.responseUrl.includes('?') ? '&' : '?'}_t=${Date.now()}`
      const res = await fetch(fetchUrl, {
        headers: { 'Authorization': `Key ${falKey}` },
        cache: 'no-store',
      })

      if (res.status === 200) {
        const data = await res.json()
        const videoResult = data.video?.url || data.output?.url || data.url
        if (videoResult) {
          if (brandId) {
            try {
              const supabase = createClient()
              await supabase.from('creatives').insert({
                brand_id: brandId,
                title: `UGC Video (lip synced)`,
                image_url: videoResult,
                format: '9x16',
                generator: 'lipsync',
              })
            } catch { /* silent */ }
          }
          return NextResponse.json({ videoUrl: videoResult })
        }
      }

      if (res.status !== 202) {
        const errData = await res.json().catch(() => ({}))
        if (errData.status === 'FAILED') {
          throw new Error(`Lip sync failed: ${errData.error || 'Unknown error'}`)
        }
      }
    }

    throw new Error('Lip sync timed out after 4 minutes')
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

    const fetchUrl = responseUrl.includes('?')
      ? `${responseUrl}&_t=${Date.now()}`
      : `${responseUrl}?_t=${Date.now()}`

    const res = await fetch(fetchUrl, {
      headers: { 'Authorization': `Key ${falKey}` },
      cache: 'no-store',
    })

    if (res.status === 200) {
      const data = await res.json()
      let videoUrl = data.video?.url || data.output?.url || data.url
      if (!videoUrl) {
        const jsonStr = JSON.stringify(data)
        const urlMatch = jsonStr.match(/https?:\/\/[^"]+\.(mp4|webm|mov)[^"]*/i)
        if (urlMatch) videoUrl = urlMatch[0]
      }
      if (!videoUrl) {
        console.log('Lip sync 200 but no URL:', JSON.stringify(data).slice(0, 500))
      }
      return NextResponse.json(
        { status: 'complete', videoUrl },
        { headers: { 'Cache-Control': 'no-store' } }
      )
    }

    if (res.status === 202) {
      const data = await res.json().catch(() => ({}))
      return NextResponse.json(
        { status: 'processing', queuePosition: data.queue_position },
        { headers: { 'Cache-Control': 'no-store' } }
      )
    }

    return NextResponse.json({ status: 'processing' }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
