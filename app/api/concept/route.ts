import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient as createClient } from '@/lib/supabase-server'
import { CONTENT_FILTER } from '@/lib/content-filter'
import { BrandResearch, ResearchPersona } from '@/lib/types'
import { trackUsage } from '@/lib/usage-tracker'
import { buildMotionContext } from '@/lib/motion'

export const maxDuration = 90

export async function POST(req: NextRequest) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
    }

    const { brandId, conceptType, direction, hookMode, selectedPersonaIndices, selectedThemes, selectedCollections } = await req.json()
    if (!brandId) {
      return NextResponse.json({ error: 'brandId required' }, { status: 400 })
    }

    const supabase = createClient()
    const { data: brand } = await supabase.from('brands').select('*').eq('id', brandId).single()
    if (!brand?.research) {
      return NextResponse.json({ error: 'Brand research required. Run brand research first.' }, { status: 400 })
    }

    const research: BrandResearch = brand.research
    const allPersonas = (research.personas || []).slice(0, 8)
    const personas = selectedPersonaIndices?.length
      ? allPersonas.filter((_: ResearchPersona, i: number) => selectedPersonaIndices.includes(i))
      : allPersonas.slice(0, 4)

    // Build data context from all sources
    const brandContext = buildBrandContext(research, brand.name, personas)
    const motionContext = brand.motion_data ? buildMotionContext(brand.motion_data) : ''
    const listeningContext = await buildListeningContext(supabase, brandId)

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const systemPrompt = conceptType === 'ugc'
      ? buildUGCSystemPrompt(brand.name, research, personas, hookMode, selectedThemes, selectedCollections, direction)
      : buildStaticSystemPrompt(brand.name, research, personas, hookMode, selectedThemes, selectedCollections, direction)

    const userMessage = `Generate ${conceptType === 'ugc' ? 'UGC script concepts' : 'static ad concepts'} for ${brand.name}.

${brandContext}
${motionContext}
${listeningContext}

${direction ? `CREATIVE DIRECTION: ${direction}` : 'Use the best performing angles and pain points from the data above.'}

Generate concepts now.`

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: systemPrompt + '\n' + CONTENT_FILTER,
      messages: [{ role: 'user', content: userMessage }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''

    trackUsage({
      service: 'anthropic', action: 'concept-creator',
      tokensIn: response.usage?.input_tokens || 0,
      tokensOut: response.usage?.output_tokens || 0,
      estimatedCost: ((response.usage?.input_tokens || 0) * 0.000003 + (response.usage?.output_tokens || 0) * 0.000015),
    })

    // Parse the response into structured concepts
    const concepts = parseConceptResponse(text, conceptType)

    return NextResponse.json({ concepts, raw: text })
  } catch (e: unknown) {
    console.error('Concept generation error:', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}

function buildBrandContext(research: BrandResearch, brandName: string, personas: ResearchPersona[]): string {
  const personasText = personas.map((p, i) =>
    `  P${i + 1}: ${p.name} - ${p.description}\n    Pain points: ${p.painPoints?.join(', ')}\n    Motivators: ${p.motivators?.join(', ')}\n    Hook: "${p.hook}"`
  ).join('\n')

  return `BRAND: ${brandName}
Industry: ${research.industry} | Category: ${research.productCategory} | Price: ${research.priceRange}
Brand Voice: ${research.brandVoice}

PERSONAS:
${personasText}

PAIN POINTS: ${(research.painPoints || []).join('; ')}
MOTIVATORS: ${(research.motivators || []).join('; ')}
VALUE PROPS: ${(research.valueProps || []).join('; ')}
KEY PHRASES: ${(research.keyPhrases || []).join(', ')}
AVOID: ${(research.avoidPhrases || []).join(', ')}
COMPETITORS: ${(research.competitors || []).join(', ')}`
}

async function buildListeningContext(supabase: ReturnType<typeof createClient>, brandId: string): Promise<string> {
  try {
    const { data: signals } = await supabase
      .from('brand_signals')
      .select('*')
      .eq('brand_id', brandId)
      .order('created_at', { ascending: false })
      .limit(20)

    if (!signals?.length) return ''

    const signalSummary = signals.slice(0, 10).map(s =>
      `- [${s.source}] ${s.title}: ${(s.content || '').slice(0, 150)}`
    ).join('\n')

    return `\nSOCIAL LISTENING SIGNALS (recent):
${signalSummary}`
  } catch {
    return ''
  }
}

function buildUGCSystemPrompt(
  brandName: string,
  research: BrandResearch,
  personas: ResearchPersona[],
  hookMode: string,
  themes?: string[],
  collections?: string[],
  direction?: string,
): string {
  const hookTarget = hookMode === 'themes'
    ? `Generate one hook per theme: ${(themes || research.messagingThemes || []).join(', ')}`
    : hookMode === 'collections'
    ? `Generate one hook per product collection: ${(collections || []).join(', ')}`
    : `Generate one hook per persona: ${personas.map(p => p.name).join(', ')}`

  return `You are a UGC script writer for Hype10 agency. You create performance-driven UGC concepts that combine brand research, social listening signals, and ad performance data.

GOLDEN RULES:
1. Scripts must sound like a genuine person, NEVER like a sales pitch
2. NEVER use: "introducing", "game-changer", "life-changing", "revolutionize", "transform"
3. Hooks open with specific, relatable moments - not "Hey guys"
4. Include natural speech: pauses, "honestly", "here's the thing"
5. Be specific to the pain point, not generic
6. CTA should feel casual, not commanding
7. NEVER use emdashes or endashes. Use hyphens or commas instead.

STRUCTURE:
- ${hookTarget}
- Each hook must be unique and feel different
- ONE shared body script that works after any hook
- ONE shared CTA
- If Motion performance data is provided, LEAN INTO what's already working (winning formats, hook styles, angles)
- If social listening data is provided, reference real language and pain points people are actually expressing

OUTPUT FORMAT (use exactly):
===HOOK 1===
[Target: persona/theme/collection name]
[The hook script - 2-3 sentences]

===HOOK 2===
[Target: persona/theme/collection name]
[The hook script - 2-3 sentences]

(continue for all hooks)

===BODY===
[The shared body - 4-6 sentences, flows from any hook]

===CTA===
[Casual call to action - 1-2 sentences]

===NOTES===
[Why these angles were chosen based on the data - 2-3 bullet points]`
}

function buildStaticSystemPrompt(
  brandName: string,
  research: BrandResearch,
  personas: ResearchPersona[],
  hookMode: string,
  themes?: string[],
  collections?: string[],
  direction?: string,
): string {
  const hookTarget = hookMode === 'themes'
    ? `Generate one concept per theme: ${(themes || research.messagingThemes || []).join(', ')}`
    : hookMode === 'collections'
    ? `Generate one concept per product collection: ${(collections || []).join(', ')}`
    : `Generate one concept per persona: ${personas.map(p => p.name).join(', ')}`

  return `You are a static ad concept creator for Hype10 agency. You create performance-driven static image concepts that combine brand research, social listening, and ad performance data.

RULES:
1. Headlines must be punchy, specific, and under 8 words
2. Support copy is 1-2 sentences max
3. Each concept needs a clear visual direction
4. NEVER use generic stock photo descriptions - be specific
5. Reference the brand's actual products, features, and benefits
6. NEVER use emdashes or endashes. Use hyphens or commas instead.

STRUCTURE:
- ${hookTarget}
- Each concept should have a different angle/approach
- If Motion data shows winning formats (e.g. "problem/solution static", "testimonial overlay"), lean into those
- If social listening shows real language, use it in headlines

OUTPUT FORMAT (use exactly):
===CONCEPT 1===
[Target: persona/theme/collection name]
Headline: [punchy headline, max 8 words]
Support: [1-2 sentence support copy]
Visual: [specific art direction - layout, imagery, colors, mood]
Format: [recommended format: single image, carousel, before/after, comparison, testimonial overlay, problem/solution]
CTA: [button text]

===CONCEPT 2===
(continue for all concepts)

===NOTES===
[Why these concepts were chosen based on the data - 2-3 bullet points]`
}

interface ParsedConcept {
  id: string
  target: string
  type: 'hook' | 'body' | 'cta' | 'static' | 'notes'
  content: string
  headline?: string
  support?: string
  visual?: string
  format?: string
  cta?: string
}

function parseConceptResponse(text: string, conceptType: string): ParsedConcept[] {
  const concepts: ParsedConcept[] = []
  const sections = text.split(/===([^=]+)===/g).filter(s => s.trim())

  for (let i = 0; i < sections.length - 1; i += 2) {
    const label = sections[i].trim()
    const content = sections[i + 1]?.trim() || ''

    if (label === 'BODY') {
      concepts.push({ id: `body-${Date.now()}`, target: 'Shared', type: 'body', content })
    } else if (label === 'CTA') {
      concepts.push({ id: `cta-${Date.now()}`, target: 'Shared', type: 'cta', content })
    } else if (label === 'NOTES') {
      concepts.push({ id: `notes-${Date.now()}`, target: '', type: 'notes', content })
    } else if (label.startsWith('HOOK')) {
      const targetMatch = content.match(/\[Target:\s*([^\]]+)\]/)
      const target = targetMatch?.[1] || label
      const hookContent = content.replace(/\[Target:[^\]]+\]\n?/, '').trim()
      concepts.push({ id: `hook-${Date.now()}-${i}`, target, type: 'hook', content: hookContent })
    } else if (label.startsWith('CONCEPT')) {
      const targetMatch = content.match(/\[Target:\s*([^\]]+)\]/)
      const target = targetMatch?.[1] || label
      const headlineMatch = content.match(/Headline:\s*(.+)/i)
      const supportMatch = content.match(/Support:\s*(.+)/i)
      const visualMatch = content.match(/Visual:\s*(.+)/i)
      const formatMatch = content.match(/Format:\s*(.+)/i)
      const ctaMatch = content.match(/CTA:\s*(.+)/i)

      concepts.push({
        id: `static-${Date.now()}-${i}`,
        target,
        type: 'static',
        content: content.replace(/\[Target:[^\]]+\]\n?/, '').trim(),
        headline: headlineMatch?.[1]?.trim(),
        support: supportMatch?.[1]?.trim(),
        visual: visualMatch?.[1]?.trim(),
        format: formatMatch?.[1]?.trim(),
        cta: ctaMatch?.[1]?.trim(),
      })
    }
  }

  return concepts
}
