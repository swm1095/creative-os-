import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient as createClient } from '@/lib/supabase-server'
import { BrandResearch } from '@/lib/types'

export const maxDuration = 60

function buildBrandContext(research: BrandResearch | null, brandName: string): string {
  if (!research) return `\nBrand: ${brandName} (no research yet, use general best practices)`

  return `
CURRENT CLIENT: ${brandName}
Industry: ${research.industry}
Brand Voice: ${research.brandVoice}

Pain Points: ${(research.painPoints || []).slice(0, 5).join('; ')}
Motivators: ${(research.motivators || []).slice(0, 5).join('; ')}
Value Props: ${(research.valueProps || []).join('; ')}
Key Phrases: ${(research.keyPhrases || []).slice(0, 5).join(', ')}
Avoid: ${(research.avoidPhrases || []).slice(0, 5).join(', ')}
`
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
    }

    const { persona, tone, platform, prompt, brandId } = await req.json()
    if (!persona || !prompt) {
      return NextResponse.json({ error: 'persona and prompt are required' }, { status: 400 })
    }

    // Load brand research from Supabase
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

    const systemPrompt = `You are an expert direct-response copywriter and creative strategist at Hype10 agency.
${brandContextText}
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
