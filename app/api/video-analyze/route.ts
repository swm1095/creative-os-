import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60

// POST - analyze a reference video with Gemini and generate a recreation prompt
export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 })

    const { videoUrl, style, brandContext } = await req.json()
    if (!videoUrl) return NextResponse.json({ error: 'videoUrl required' }, { status: 400 })

    // Download the video and convert to base64 for Gemini
    const videoRes = await fetch(videoUrl)
    if (!videoRes.ok) throw new Error(`Could not fetch video: ${videoRes.status}`)

    const videoBuffer = await videoRes.arrayBuffer()
    const base64Video = Buffer.from(videoBuffer).toString('base64')

    // Determine MIME type from URL
    const ext = videoUrl.split('.').pop()?.split('?')[0]?.toLowerCase() || 'mp4'
    const mimeType = ext === 'mov' ? 'video/quicktime' : 'video/mp4'

    const promptText = `You are a video production analyst for a creative agency. Analyze this reference video and write a detailed video generation prompt that AI video generators (Seedance 2.0, Kling v3) can use to recreate the same style.

Write a single, detailed prompt paragraph that captures:
- The exact camera work (movement type, angle, speed)
- Lighting setup (natural, studio, golden hour, etc.)
- Color grade and mood
- Subject positioning and action
- Background/environment details
- Pacing and transitions
- Production quality level

${style ? `Target style: ${style}` : ''}
${brandContext ? `Brand context: ${brandContext}` : ''}

Keep it under 150 words. Write it like a director's shot description.
Do NOT use emdashes. Use commas or hyphens instead.
Write ONLY the prompt, nothing else. No labels, no explanations, no intro - just the prompt text.`

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  inlineData: {
                    mimeType,
                    data: base64Video,
                  },
                },
                { text: promptText },
              ],
            },
          ],
          generationConfig: {
            maxOutputTokens: 500,
            temperature: 0.7,
          },
        }),
      }
    )

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Gemini API error: ${res.status} ${err.slice(0, 300)}`)
    }

    const data = await res.json()
    const prompt = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim()

    if (!prompt) throw new Error('No prompt generated from video analysis')

    return NextResponse.json({ prompt })
  } catch (e: unknown) {
    console.error('Video analysis error:', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
