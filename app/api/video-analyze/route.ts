import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60

// POST - analyze a reference video and generate a recreation prompt
export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })

    const { videoUrl, style, brandContext } = await req.json()
    if (!videoUrl) return NextResponse.json({ error: 'videoUrl required' }, { status: 400 })

    const systemPrompt = `You are a video production analyst for a creative agency. You analyze reference videos and write detailed prompts that AI video generators (Seedance 2.0, Kling v3) can use to recreate the same style.

Your output should be a single, detailed video generation prompt - NOT a breakdown or analysis. Write it as one continuous prompt paragraph that captures:
- The exact camera work (movement type, angle, speed)
- Lighting setup (natural, studio, golden hour, etc.)
- Color grade and mood
- Subject positioning and action
- Background/environment details
- Pacing and transitions
- Production quality level

Keep it under 150 words. Write it like a director's shot description.
Do NOT use emdashes. Use commas or hyphens instead.`

    const userMessage = `Analyze this reference video and write a detailed video generation prompt that would recreate its style, camera work, lighting, and production quality.

${style ? `Target style: ${style}` : ''}
${brandContext ? `Brand context: ${brandContext}` : ''}

Write ONLY the prompt, nothing else. No labels, no explanations - just the prompt text.`

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'content-type': 'application/json',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'document',
                source: { type: 'url', url: videoUrl },
              },
              { type: 'text', text: userMessage },
            ],
          },
        ],
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Claude API error: ${res.status} ${err.slice(0, 300)}`)
    }

    const data = await res.json()
    const prompt = (data.content || [])
      .filter((b: { type: string }) => b.type === 'text')
      .map((b: { type: string; text: string }) => b.text)
      .join('')
      .trim()

    return NextResponse.json({ prompt })
  } catch (e: unknown) {
    console.error('Video analysis error:', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
