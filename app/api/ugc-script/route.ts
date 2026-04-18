import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient as createClient } from '@/lib/supabase-server'
import { CONTENT_FILTER } from '@/lib/content-filter'
import { BrandResearch, ResearchPersona } from '@/lib/types'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
    }

    const { brandId, insight } = await req.json()
    if (!brandId || !insight) {
      return NextResponse.json({ error: 'brandId and insight required' }, { status: 400 })
    }

    const supabase = createClient()
    const { data: brand } = await supabase.from('brands').select('*').eq('id', brandId).single()
    if (!brand?.research) {
      return NextResponse.json({ error: 'Brand research required. Run brand research first.' }, { status: 400 })
    }

    const research: BrandResearch = brand.research
    const personas = (research.personas || []).slice(0, 4)
    if (!personas.length) {
      return NextResponse.json({ error: 'No personas found in brand research' }, { status: 400 })
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const systemPrompt = `You are a UGC script writer for Hype10 agency. You write scripts that sound like REAL people, NOT ads.

GOLDEN NON-NEGOTIABLE RULES:

1. Scripts must sound like a genuine friend recommending something, NEVER like a sales pitch.
2. NEVER use these phrases: "introducing", "game-changer", "life-changing", "revolutionize", "transform your life".
3. Hooks must open with a specific, relatable moment. Think: "I was telling my coworker about this the other day because..." not "Hey guys, today I'm reviewing..."
4. Include natural speech patterns: pauses, "um", "honestly", "I don't know", "here's the thing".
5. Be specific to the persona's actual pain point - not generic.
6. The CTA should feel like a casual suggestion, not a command.

CRITICAL STRUCTURE:
- Generate 4 DIFFERENT HOOKS, one per persona. Each hook must be unique to that persona's real life moment and pain point. No repetitive openings.
- Generate ONE SHARED BODY script that flows seamlessly from ANY of the 4 hooks. The body explains how the person discovered ${brand.name}, their experience with it, and what changed.
- Generate ONE SHARED CTA.
- The body should NOT reference a specific persona - it should be universal enough to work after any of the 4 hooks.

INSIGHT CONTEXT: Scripts should tie into this insight:
Title: ${insight.title}
Detail: ${insight.detail}
${insight.actionable ? `Action: ${insight.actionable}` : ''}
${insight.copy_examples?.length ? `Real phrases to reference: ${insight.copy_examples.join(' | ')}` : ''}

BRAND CONTEXT:
Brand: ${brand.name}
Voice: ${research.brandVoice}
Product: ${research.productCategory}
Key phrases: ${(research.keyPhrases || []).slice(0, 5).join(', ')}
Avoid: ${(research.avoidPhrases || []).slice(0, 3).join(', ')}

NEVER use emdashes. Use hyphens or commas.
${CONTENT_FILTER}

Respond in this EXACT JSON format:
{
  "hooks": [
    { "persona": "persona 1 name", "persona_number": 1, "hook": "specific opening moment for this persona, 3-5 seconds" },
    { "persona": "persona 2 name", "persona_number": 2, "hook": "different angle for this persona" },
    { "persona": "persona 3 name", "persona_number": 3, "hook": "another different angle" },
    { "persona": "persona 4 name", "persona_number": 4, "hook": "another different angle" }
  ],
  "body": "Shared body script that flows from any hook. 15-20 seconds. How they discovered the product, their experience, what changed. Universal, not persona-specific.",
  "cta": "Shared casual CTA. 3-5 seconds.",
  "scene_notes": "Quick visual/setting suggestions for filming"
}`

    const userMsg = `Write a UGC script framework based on these 4 personas:

${personas.map((p: ResearchPersona, i: number) => `
Persona ${i + 1}: ${p.name}
Description: ${p.description || ''}
Pain Points: ${(p.painPoints || []).join(', ')}
Motivators: ${(p.motivators || []).join(', ')}
Angle: ${p.hook || ''}
`).join('\n')}

Generate:
- 4 unique hooks (one per persona, each opening with THEIR specific real-life moment/pain point)
- ONE shared body that flows from any of the hooks
- ONE shared CTA
- Scene notes

The 4 hooks should feel like different people, but the body should be universal enough to continue from any of them.`

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMsg }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('Could not parse scripts response')

    const result = JSON.parse(jsonMatch[0])
    return NextResponse.json(result)
  } catch (e: unknown) {
    console.error('UGC script error:', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
