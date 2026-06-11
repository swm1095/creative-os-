import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 30

// POST - refine a piece of text with feedback
export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })

    const { text, feedback } = await req.json()
    if (!text || !feedback) return NextResponse.json({ error: 'text and feedback required' }, { status: 400 })

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'content-type': 'application/json', 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        messages: [{
          role: 'user',
          content: `Here is the current text:\n\n"${text}"\n\nApply this feedback: ${feedback}\n\nReturn ONLY the refined text. No quotes, no labels, no explanation. Just the updated text.`,
        }],
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      return NextResponse.json({ error: `Claude error: ${err.slice(0, 200)}` }, { status: res.status })
    }

    const data = await res.json()
    const refined = data.content?.find((b: { type: string }) => b.type === 'text')?.text?.trim() || ''

    return NextResponse.json({ refined })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
