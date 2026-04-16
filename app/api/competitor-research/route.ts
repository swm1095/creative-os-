import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient as createClient } from '@/lib/supabase-server'
import { BrandResearch } from '@/lib/types'
import { searchRedditDeep, getRedditCommentsDeep } from '@/lib/signal-sources'

export const maxDuration = 120

interface CompetitorInsight {
  name: string
  positioning: string
  strengths: string[]
  weaknesses: string[]
  customerComplaints: string[]
  opportunities: string[]
  adAngles: string[]
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
    }

    const { brandId } = await req.json()
    if (!brandId) return NextResponse.json({ error: 'brandId required' }, { status: 400 })

    const supabase = createClient()
    const { data: brand } = await supabase.from('brands').select('*').eq('id', brandId).single()
    if (!brand?.research) {
      return NextResponse.json({ error: 'Brand research required first' }, { status: 400 })
    }

    const research: BrandResearch = brand.research
    const competitors = (research.competitors || []).slice(0, 5)
    if (!competitors.length) return NextResponse.json({ competitors: [] })

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    // For each competitor, mine Reddit for mentions/complaints
    const competitorData: { name: string; signals: { title: string; content: string; score: number }[] }[] = []

    for (const competitor of competitors) {
      const signals = await searchRedditDeep(competitor, undefined, 10)
      // Pull comments from top posts mentioning this competitor
      const topPost = signals.sort((a, b) => (b.score || 0) - (a.score || 0))[0]
      const comments = topPost?.url ? await getRedditCommentsDeep(topPost.url, 5) : []

      competitorData.push({
        name: competitor,
        signals: [...signals, ...comments].slice(0, 15).map(s => ({
          title: s.title,
          content: s.content || '',
          score: s.score || 0,
        })),
      })
    }

    // Claude analyzes each competitor
    const signalText = competitorData.map(c =>
      `=== ${c.name} ===\n${c.signals.map(s => `[${s.score}pts] ${s.title}\n${s.content.slice(0, 400)}`).join('\n\n')}`
    ).join('\n\n\n')

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      system: `You are a competitive intelligence analyst at Hype10 agency.

Brand we're fighting for: ${brand.name}
Our industry: ${research.industry}
Our personas: ${(research.personas || []).map(p => p.name).join(', ')}
Our value props: ${(research.valueProps || []).join('; ')}

For each competitor below, analyze the Reddit discussions and extract:
- positioning (how they're perceived)
- strengths (what customers praise)
- weaknesses (complaints, gaps)
- customerComplaints (actual verbatim quotes if possible)
- opportunities (gaps ${brand.name} could exploit)
- adAngles (specific angles we could run against them)

Focus on finding WEAKNESSES we can attack. Quote real customer language verbatim. Never use emdashes.

Respond in JSON:
{
  "competitors": [
    {
      "name": "...",
      "positioning": "...",
      "strengths": ["..."],
      "weaknesses": ["..."],
      "customerComplaints": ["..."],
      "opportunities": ["..."],
      "adAngles": ["..."]
    }
  ]
}`,
      messages: [{
        role: 'user',
        content: `Analyze these competitors:\n\n${signalText}`,
      }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return NextResponse.json({ error: 'Could not parse response' }, { status: 500 })

    const parsed: { competitors: CompetitorInsight[] } = JSON.parse(jsonMatch[0])

    // Save to brand record
    await supabase.from('brands').update({
      competitor_research: parsed.competitors,
      competitor_research_date: new Date().toISOString(),
    }).eq('id', brandId)

    return NextResponse.json(parsed)
  } catch (e: unknown) {
    console.error('Competitor research error:', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
