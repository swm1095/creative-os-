import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient as createClient } from '@/lib/supabase-server'
import { SocialSignal, ListeningInsight, BrandResearch } from '@/lib/types'

export const maxDuration = 120

// ── Reddit Search (free, no API key needed) ──────────────────────────────
async function searchReddit(query: string, subreddit?: string, limit: number = 10): Promise<SocialSignal[]> {
  try {
    const sub = subreddit ? `r/${subreddit}/` : ''
    const url = `https://www.reddit.com/${sub}search.json?q=${encodeURIComponent(query)}&sort=relevance&t=month&limit=${limit}`

    const res = await fetch(url, {
      headers: { 'User-Agent': 'HyperCreate/1.0' },
    })
    if (!res.ok) return []

    const data = await res.json()
    const posts = data?.data?.children || []

    return posts.map((post: { data: { id: string; title: string; selftext: string; permalink: string; score: number; created_utc: number; subreddit: string } }) => ({
      id: post.data.id,
      source: `r/${post.data.subreddit}`,
      title: post.data.title,
      content: (post.data.selftext || '').slice(0, 500),
      url: `https://reddit.com${post.data.permalink}`,
      score: post.data.score,
      date: new Date(post.data.created_utc * 1000).toISOString(),
      sentiment: 'neutral' as const,
      relevance: 0,
    }))
  } catch (e) {
    console.error('Reddit search error:', e)
    return []
  }
}

// ── Google Trends (via suggestion API, free) ─────────────────────────────
async function getGoogleTrends(keywords: string[]): Promise<{ keyword: string; trending: boolean }[]> {
  const results = []
  for (const keyword of keywords.slice(0, 5)) {
    try {
      const url = `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(keyword)}`
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        const suggestions = data[1] || []
        results.push({
          keyword,
          trending: suggestions.length > 3,
          suggestions: suggestions.slice(0, 5),
        })
      }
    } catch { /* silent */ }
  }
  return results
}

// ── Claude analyzes signals and extracts insights ────────────────────────
async function analyzeSignals(
  signals: SocialSignal[],
  trends: { keyword: string; trending: boolean; suggestions?: string[] }[],
  research: BrandResearch
): Promise<ListeningInsight[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return []

  const client = new Anthropic({ apiKey })

  const signalSummary = signals.slice(0, 20).map(s =>
    `[${s.source}] (score: ${s.score}) ${s.title}\n${s.content.slice(0, 200)}`
  ).join('\n\n')

  const trendSummary = trends.map(t =>
    `"${t.keyword}" - ${t.trending ? 'TRENDING' : 'normal'}${t.suggestions?.length ? ` (related: ${t.suggestions.join(', ')})` : ''}`
  ).join('\n')

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    system: `You are a social listening analyst for a creative agency. Never use emdashes. Use hyphens or commas instead.

Brand context:
- Name: ${research.industry || 'Unknown'}
- Industry: ${research.industry || 'Unknown'}
- Personas: ${research.personas?.map(p => p.name).join(', ') || 'Unknown'}
- Pain points: ${research.painPoints?.join(', ') || 'Unknown'}

Analyze the social signals and trends below. Extract actionable insights for the creative team.

Respond in this EXACT JSON format:
{
  "insights": [
    {
      "type": "trend" | "pain_point" | "competitor" | "opportunity" | "language",
      "title": "Short, punchy insight title",
      "detail": "2-3 sentence explanation with specific data points",
      "signals": ["list of signal sources that support this"],
      "actionable": "Specific action the creative team should take",
      "priority": "high" | "medium" | "low"
    }
  ]
}

Generate 5-8 insights. Prioritize things the creative team can act on immediately - new ad angles, copy hooks, trending topics to capitalize on, competitor weaknesses, language patterns from real customers.`,
    messages: [{
      role: 'user',
      content: `REDDIT SIGNALS:\n${signalSummary || 'No Reddit signals found'}\n\nGOOGLE TRENDS:\n${trendSummary || 'No trend data'}\n\nExtract actionable creative insights.`,
    }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return []

  const parsed = JSON.parse(jsonMatch[0])
  return (parsed.insights || []).map((insight: ListeningInsight, i: number) => ({
    ...insight,
    id: `insight-${Date.now()}-${i}`,
  }))
}

// ── POST handler ─────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { brandId } = await req.json()

    if (!brandId) return NextResponse.json({ error: 'brandId required' }, { status: 400 })

    // Load brand research
    const { data: brand } = await supabase.from('brands').select('*').eq('id', brandId).single()
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 })

    const research: BrandResearch | null = brand.research
    if (!research) {
      return NextResponse.json({ error: 'Brand research not completed. Run brand research first.' }, { status: 400 })
    }

    // Pull signals from Reddit using research-generated keywords
    const allSignals: SocialSignal[] = []

    // Search general keywords
    for (const keyword of (research.searchKeywords || []).slice(0, 5)) {
      const results = await searchReddit(keyword)
      allSignals.push(...results)
    }

    // Search specific subreddits
    for (const sub of (research.subreddits || []).slice(0, 3)) {
      const results = await searchReddit(research.industry || brand.name, sub, 5)
      allSignals.push(...results)
    }

    // Deduplicate by ID
    const uniqueSignals = Array.from(new Map(allSignals.map(s => [s.id, s])).values())
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, 30)

    // Get Google Trends data
    const trends = await getGoogleTrends(research.searchKeywords || [brand.name])

    // Claude analyzes everything
    const insights = await analyzeSignals(uniqueSignals, trends, research)

    return NextResponse.json({
      signals: uniqueSignals,
      trends,
      insights,
      signalCount: uniqueSignals.length,
      insightCount: insights.length,
    })
  } catch (e: unknown) {
    console.error('Listening error:', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
