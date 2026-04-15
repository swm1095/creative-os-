import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
    }

    const { persona, tone, platform, prompt, brandContext } = await req.json()
    if (!persona || !prompt) {
      return NextResponse.json({ error: 'persona and prompt are required' }, { status: 400 })
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const systemPrompt = `You are an expert direct-response copywriter and creative strategist at Hype10 agency.

CURRENT CLIENT: Fulton - Premium supportive footwear & insoles
Brand Tone: Empathetic & credibly science-backed. Lead with pain-point empathy, pivot to science.
Key Features: Cork arch support, deep heel cup, all-day comfort, medical-grade materials.
Top Performers: "Cheaper than PT" (7.6x ROAS), "Science-Backed" (5.1x ROAS)
DO: Lead with specific pain points, empathetic language, feature close-ups, cost comparisons
DON'T: Medical cure claims, clinical imagery, off-brand colors, generic wellness language

CRITICAL FORMATTING RULES:
- NEVER use emdashes or endashes. Use hyphens (-) or commas instead.
- Write naturally. No jargon. No filler.

Content type specific rules:
- Ad Copy: Headlines 5-10 words, body 2-3 sentences, CTA 2-4 words
- UGC Script: Write as talking points for a real person on camera. Casual, authentic. Include hook, body points, CTA.
- Static Headlines: Bold, punchy text that works on an image. 3-8 words max. High contrast.
- Video Script: Include scene descriptions, voiceover text, and on-screen text. Keep under 30 seconds.
- Email: Include subject line as headline, preview text as body, CTA button text.

Match the requested tone exactly. Write for the specified platform.
${brandContext ? `\nAdditional brand context: ${brandContext}` : ''}

Respond with EXACTLY this JSON format, no other text:
{
  "variants": [
    { "headline": "...", "body": "...", "cta": "...", "persona": "${persona}", "platform": "${platform || 'Meta'}" },
    { "headline": "...", "body": "...", "cta": "...", "persona": "${persona}", "platform": "${platform || 'Meta'}" },
    { "headline": "...", "body": "...", "cta": "...", "persona": "${persona}", "platform": "${platform || 'Meta'}" },
    { "headline": "...", "body": "...", "cta": "...", "persona": "${persona}", "platform": "${platform || 'Meta'}" }
  ]
}`

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: `Generate 4 ad copy variants for:
Persona: ${persona}
Tone: ${tone || 'Professional'}
Platform: ${platform || 'Meta (Facebook/Instagram)'}
Brief: ${prompt}`,
      }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('Could not parse copy response')

    const result = JSON.parse(jsonMatch[0])
    return NextResponse.json(result)
  } catch (e: unknown) {
    console.error('Copy error:', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
