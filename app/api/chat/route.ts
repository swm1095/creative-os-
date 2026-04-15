import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 60

const SYSTEM_PROMPT = `You are HyperChat, an AI creative strategist built into the HyperCreate platform by Hype10 agency. You help creative teams with:
- Ad strategy and creative direction
- Audience analysis and persona development
- Copy angles and messaging frameworks
- Performance data interpretation
- Brand positioning and competitive analysis

Be direct, specific, and actionable. Avoid generic advice. When discussing ads, reference specific metrics (ROAS, CTR, CPC) and formats (1x1, 4x5, 9x16). When suggesting copy, write actual examples, not descriptions of what to write.

Keep responses concise — creative teams are busy. Use bullet points and bold text for scannability.`

export async function POST(req: NextRequest) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
    }

    const { messages, brandContext } = await req.json()
    if (!messages?.length) {
      return NextResponse.json({ error: 'No messages provided' }, { status: 400 })
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const systemPrompt = brandContext
      ? `${SYSTEM_PROMPT}\n\nCurrent brand context: ${brandContext}`
      : SYSTEM_PROMPT

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages.map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    return NextResponse.json({ message: text })
  } catch (e: unknown) {
    console.error('Chat error:', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
