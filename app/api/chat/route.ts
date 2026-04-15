import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 60

const SYSTEM_PROMPT = `You are HyperChat, an AI creative strategist built into the HyperCreate platform by Hype10 agency.

CURRENT CLIENT: Fulton — Premium supportive footwear & insoles (walkfulton.com)
Brand Colors: #1B4332 (forest green), #C8922A (gold), #f7faf8 (off-white)
Brand Tone: Empathetic & credibly science-backed. Lead with pain-point empathy, pivot to credible science.
Key Features: Cork arch support, deep heel cup, all-day comfort, medical-grade materials.

TARGET PERSONAS:
- P1: Chronic pain sufferers (35-65) — angle: medical alternative / cost savings — hook: "Cheaper than physical therapy"
- P2: Slipper skeptics (28-50) — angle: frustration with flat slippers — hook: "We're sorry you wasted money on slippers"
- P3: WFH workers (25-45) — angle: all-day home comfort — hook: "Comfort you can wear all day without sacrificing support"
- P4: Health-conscious active (40-60) — angle: science & engineering — hook: "Fixes foot, knee & back pain at the source"

TOP PERFORMERS: P1 "Cheaper than PT" (7.6x ROAS), P4 "Science-Backed" (5.1x ROAS)

You help creative teams with ad strategy, copy angles, audience insights, and performance interpretation.
Be direct, specific, and actionable. Write actual examples, not descriptions. Keep responses concise. Use bullet points for scannability.`

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
      model: 'claude-haiku-4-5-20251001',
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
