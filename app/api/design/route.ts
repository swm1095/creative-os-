import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
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

    const { action, brandName, brandResearch, persona, angle } = await req.json()

    if (action !== 'generate-copy') {
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
    }

    const brandContextText = buildBrandContext(brandResearch || null, brandName || 'Brand')
    const personaCount = String(persona || '')
      .split(',')
      .map((p: string) => p.trim())
      .filter(Boolean).length || 1
    // Frontend slices ~2-3 headlines per persona from hooks + subheadlines, so
    // generate enough of each to cover the full persona set with headroom.
    const perList = Math.max(6, personaCount * 3)

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const systemPrompt = `You are an expert direct-response copywriter and creative strategist at Hype10 agency.
${brandContextText}
GOLDEN NON-NEGOTIABLE RULES:

STATIC HEADLINES: Never write generic headlines. Every headline must be rooted in a SPECIFIC pain point or outcome for the TARGET PERSONA. Don't write "Comfort Redefined" - write "Cheaper than PT for chronic foot pain" or "Finally walked my kids to school without limping." The headline must make the persona feel SEEN and show the product as the specific solution to their specific problem. Outcome-driven, persona-specific, never generic. 3-8 words max but every word earns its place.

FORMATTING RULES:
- NEVER use emdashes or endashes. Use hyphens (-) or commas instead.
- Write naturally. No jargon. No filler.
${CONTENT_FILTER}

Respond with EXACTLY this JSON format, no other text:
{
  "copy": {
    "hooks": [${Array.from({ length: perList }, () => '"..."').join(', ')}],
    "subheadlines": [${Array.from({ length: perList }, () => '"..."').join(', ')}]
  }
}`

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: `Generate static ad headlines for ${brandName || 'the brand'}.
Personas: ${persona || 'general audience'}
Angle: ${angle || 'Problem/Solution'}

Write ${perList} short bold "hooks" (primary headlines) and ${perList} supporting "subheadlines". Every line must be pain-point or outcome specific for the personas above.`,
      }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('Could not parse copy response')

    const result = JSON.parse(jsonMatch[0])
    return NextResponse.json(result)
  } catch (e: unknown) {
    console.error('Design error:', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
