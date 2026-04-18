import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient as createClient } from '@/lib/supabase-server'
import { CONTENT_FILTER } from '@/lib/content-filter'
import { trackUsage } from '@/lib/usage-tracker'
import { BrandResearch, ResearchPersona } from '@/lib/types'

export const maxDuration = 60

const BASE_PROMPT = `You are HyperChat, an AI creative strategist built into the HyperCreate platform by Hype10 agency.

You help creative teams with ad strategy, copy angles, audience insights, and performance interpretation.

FORMATTING RULES - THIS IS CRITICAL:
- Write like a sharp creative director talking to their team, NOT like an AI or developer
- Use plain language, short sentences, no jargon
- Use bullet points with hyphens (-) not asterisks or emdashes
- NEVER use emdashes or endashes anywhere. Use hyphens (-) or commas instead.
- Bold key takeaways by wrapping in **double asterisks**
- Never use markdown code blocks, headers with #, or technical formatting
- Never say "Here's" or "I'd suggest" - just say it directly
- Keep it tight - 3-5 bullet points max per section
- When writing ad copy examples, just write the copy itself, don't label it "Headline:" or "Body:"
- Sound like a person on a Slack thread, not a formal report
${CONTENT_FILTER}`

function buildBrandContext(research: BrandResearch | null, brandName: string): string {
  if (!research) return `\nCURRENT CLIENT: ${brandName} (no deep research yet - ask the user to run brand research for better insights)`

  const personasText = (research.personas || []).map((p: ResearchPersona, i: number) =>
    `  P${i + 1}: ${p.name} - angle: ${p.description} - hook: "${p.hook}"`
  ).join('\n')

  return `
CURRENT CLIENT: ${brandName}
Industry: ${research.industry}
Product Category: ${research.productCategory}
Price Range: ${research.priceRange}

Brand Voice: ${research.brandVoice}

TARGET PERSONAS:
${personasText}

TOP PAIN POINTS: ${(research.painPoints || []).slice(0, 5).join('; ')}
TOP MOTIVATORS: ${(research.motivators || []).slice(0, 5).join('; ')}
COMPETITORS: ${(research.competitors || []).slice(0, 5).join(', ')}
KEY PHRASES: ${(research.keyPhrases || []).slice(0, 5).join(', ')}
AVOID: ${(research.avoidPhrases || []).slice(0, 3).join(', ')}

VALUE PROPS: ${(research.valueProps || []).join('; ')}
`
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
    }

    const { messages, brandId } = await req.json()
    if (!messages?.length) {
      return NextResponse.json({ error: 'No messages provided' }, { status: 400 })
    }

    // Load brand research from Supabase if brandId provided
    let brandContextText = ''
    if (brandId) {
      try {
        const supabase = createClient()
        const { data: brand } = await supabase.from('brands').select('*').eq('id', brandId).single()
        if (brand) {
          brandContextText = buildBrandContext(brand.research, brand.name)
        }
      } catch (e) {
        console.error('Failed to load brand context:', e)
      }
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: BASE_PROMPT + brandContextText,
      messages: messages.map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''

    // Track usage
    trackUsage({
      service: 'anthropic', action: 'chat',
      tokensIn: response.usage?.input_tokens || 0,
      tokensOut: response.usage?.output_tokens || 0,
      estimatedCost: ((response.usage?.input_tokens || 0) * 0.00000025 + (response.usage?.output_tokens || 0) * 0.00000125),
    })

    return NextResponse.json({ message: text })
  } catch (e: unknown) {
    console.error('Chat error:', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
