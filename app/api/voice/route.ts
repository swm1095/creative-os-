import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60

const ELEVENLABS_BASE = 'https://api.elevenlabs.io/v1'

// GET - list available voices
export async function GET(req: NextRequest) {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'ELEVENLABS_API_KEY not configured. Add it in Vercel.' }, { status: 500 })

    const action = req.nextUrl.searchParams.get('action')

    if (action === 'voices') {
      const res = await fetch(`${ELEVENLABS_BASE}/voices`, {
        headers: { 'xi-api-key': apiKey },
      })
      if (!res.ok) {
        const err = await res.text()
        return NextResponse.json({ error: `ElevenLabs error: ${err.slice(0, 200)}` }, { status: res.status })
      }
      const data = await res.json()
      const voices = (data.voices || []).map((v: { voice_id: string; name: string; category: string; labels?: Record<string, string> }) => ({
        voice_id: v.voice_id,
        name: v.name,
        category: v.category || 'custom',
        accent: v.labels?.accent || '',
        gender: v.labels?.gender || '',
      }))
      return NextResponse.json({ voices })
    }

    return NextResponse.json({ error: 'action param required (voices)' }, { status: 400 })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}

// POST - generate speech from text
export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'ELEVENLABS_API_KEY not configured. Add it in Vercel.' }, { status: 500 })

    const body = await req.json()
    const { text, voiceId, stability, similarityBoost, style, speed, speakerBoost } = body

    if (!text) return NextResponse.json({ error: 'text required' }, { status: 400 })
    if (!voiceId) return NextResponse.json({ error: 'voiceId required' }, { status: 400 })

    const res = await fetch(`${ELEVENLABS_BASE}/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: stability ?? 0.5,
          similarity_boost: similarityBoost ?? 0.75,
          style: style ?? 0.5,
          use_speaker_boost: speakerBoost !== false,
          speed: speed ?? 1.0,
        },
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      return NextResponse.json({ error: `ElevenLabs TTS failed: ${err.slice(0, 200)}` }, { status: res.status })
    }

    // Return the audio as a blob URL via base64
    const audioBuffer = await res.arrayBuffer()
    const base64 = Buffer.from(audioBuffer).toString('base64')
    const audioUrl = `data:audio/mpeg;base64,${base64}`

    return NextResponse.json({ audioUrl, duration: text.split(' ').length / 2.5 })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
