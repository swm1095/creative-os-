import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient as createClient } from '@/lib/supabase-server'
import { CONTENT_FILTER } from '@/lib/content-filter'
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
    if (!prompt) {
      return NextResponse.json({ error: 'prompt is required' }, { status: 400 })
    }
    if (!brandId) {
      return NextResponse.json({ error: 'Select a brand first' }, { status: 400 })
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
GOLDEN NON-NEGOTIABLE RULES:

1. UGC SCRIPTS (CRITICAL): Write like a real person casually recommending something to a friend. NEVER sound like a sales script. NEVER use marketing speak. Think: "I was telling my coworker about this the other day because she has the same foot thing I did..." not "Introducing the revolutionary new..." Casual, specific, human, messy on purpose. Include natural pauses, uncertainty, real-life context. The viewer should feel like they're watching a TikTok from a normal person, not an ad.

2. HEADLINES (CRITICAL): Never write generic headlines. Every headline must be rooted in a SPECIFIC pain point or outcome for the TARGET PERSONA. Don't write "Comfort Redefined" - write "Cheaper than PT for chronic foot pain" or "Finally walked my kids to school without limping." The headline must make the persona feel SEEN and show the product as the specific solution to their specific problem. Generic = confusing. Specific pain or outcome = conversion.

3. STATIC HEADLINES: Same rule as headlines - outcome-driven, persona-specific, never generic. Must address their actual problem and show the product as the solution. 3-8 words max but every word earns its place.

FORMATTING RULES:
- NEVER use emdashes or endashes. Use hyphens (-) or commas instead.
- Write naturally. No jargon. No filler.

Content type specific:
- Ad Copy: Headlines 5-10 words (pain/outcome specific), body 2-3 sentences, CTA 2-4 words
- UGC Script: First-person casual, specific scenarios, natural speech patterns. Open with a relatable moment, explain the before/after personally, suggest checking it out. NEVER use phrases like "introducing", "game-changer", "life-changing", "revolutionize".
- Static Headlines: Bold, pain-point specific, outcome-focused, 3-8 words max.

Match the requested tone exactly. Write for the specified platform.
${CONTENT_FILTER}

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
