import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient as createClient } from '@/lib/supabase-server'
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
3. Open with a specific, relatable moment. Think: "I was telling my coworker about this the other day because..." not "Hey guys, today I'm reviewing..."
4. Include natural speech patterns: pauses, "um", "honestly", "I don't know", "here's the thing".
5. Be specific to the persona's actual pain point - not generic.
6. The CTA should feel like a casual suggestion, not a command. Think "if you're dealing with this you should check them out" not "click the link below".

INSIGHT CONTEXT: The scripts should tie into this insight:
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

Write 4 UGC scripts, one per persona. Each script needs a DIFFERENT hook style but the body should flow SEAMLESSLY from that hook. The hooks and bodies should feel like different real people, not one template with swapped words.

FORMAT EACH SCRIPT:
- hook: First 3 seconds - a relatable moment specific to THIS persona's pain point
- body: 10-20 seconds - how they discovered/use ${brand.name}, tied to the insight above
- cta: 3-5 seconds - casual suggestion, no hard sell

NEVER use emdashes. Use hyphens or commas.

Respond in this EXACT JSON format:
{
  "scripts": [
    {
      "persona": "persona name",
      "persona_number": 1,
      "hook": "opening 3 seconds, specific relatable moment",
      "body": "10-20 second body, flowing from the hook, authentic",
      "cta": "casual closing suggestion",
      "scene_notes": "quick notes on setting/visuals if helpful"
    }
  ]
}`

    const userMsg = `Write 4 UGC scripts, one for each of these personas:

${personas.map((p: ResearchPersona, i: number) => `
Persona ${i + 1}: ${p.name}
Description: ${p.description || ''}
Pain Points: ${(p.painPoints || []).join(', ')}
Motivators: ${(p.motivators || []).join(', ')}
Hook angle: ${p.hook || ''}
`).join('\n')}

Each script must open with a hook specific to that persona's real life moment, then flow naturally into a genuine recommendation tied to the insight.`

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 3072,
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
