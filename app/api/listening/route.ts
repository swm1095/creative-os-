import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient as createClient } from '@/lib/supabase-server'
import { SocialSignal, ListeningInsight, BrandResearch } from '@/lib/types'

export const maxDuration = 120

// ── Reddit Search: posts ─────────────────────────────────────────────────
async function searchReddit(query: string, subreddit?: string, limit: number = 15): Promise<SocialSignal[]> {
  try {
    const sub = subreddit ? `r/${subreddit}/` : ''
    const url = `https://www.reddit.com/${sub}search.json?q=${encodeURIComponent(query)}&sort=relevance&t=month&limit=${limit}`
    const res = await fetch(url, { headers: { 'User-Agent': 'HyperCreate/1.0' } })
    if (!res.ok) return []
    const data = await res.json()
    const posts = data?.data?.children || []
    return posts.map((p: { data: { id: string; title: string; selftext: string; permalink: string; score: number; created_utc: number; subreddit: string; num_comments: number } }) => ({
      id: `reddit-${p.data.id}`,
      source: `r/${p.data.subreddit}`,
      title: p.data.title,
      content: (p.data.selftext || '').slice(0, 800),
      url: `https://reddit.com${p.data.permalink}`,
      score: p.data.score,
      date: new Date(p.data.created_utc * 1000).toISOString(),
      sentiment: 'neutral' as const,
      relevance: 0,
    }))
  } catch { return [] }
}

// ── Reddit Search: top comments from high-scoring posts ──────────────────
async function getRedditComments(postUrl: string): Promise<SocialSignal[]> {
  try {
    const res = await fetch(`${postUrl.replace('https://reddit.com', 'https://www.reddit.com')}.json?limit=5&sort=top`, {
      headers: { 'User-Agent': 'HyperCreate/1.0' },
    })
    if (!res.ok) return []
    const data = await res.json()
    const comments = data?.[1]?.data?.children || []
    return comments.slice(0, 3).map((c: { data: { id: string; body: string; score: number; permalink: string; subreddit: string } }) => ({
      id: `reddit-comment-${c.data.id}`,
      source: `r/${c.data.subreddit} (comment)`,
      title: c.data.body?.slice(0, 100) || '',
      content: c.data.body || '',
      url: `https://reddit.com${c.data.permalink}`,
      score: c.data.score,
      date: new Date().toISOString(),
      sentiment: 'neutral' as const,
      relevance: 0,
    })).filter((c: SocialSignal) => c.content.length > 30)
  } catch { return [] }
}

// ── Hacker News search ───────────────────────────────────────────────────
async function searchHackerNews(query: string): Promise<SocialSignal[]> {
  try {
    const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&tags=story&hitsPerPage=10`
    const res = await fetch(url)
    if (!res.ok) return []
    const data = await res.json()
    return (data.hits || []).map((h: { objectID: string; title: string; url?: string; points: number; num_comments: number; created_at: string }) => ({
      id: `hn-${h.objectID}`,
      source: 'HackerNews',
      title: h.title,
      content: `${h.points} points, ${h.num_comments} comments`,
      url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
      score: h.points,
      date: h.created_at,
      sentiment: 'neutral' as const,
      relevance: 0,
    }))
  } catch { return [] }
}

// ── YouTube Search (via RSS - free) ──────────────────────────────────────
async function searchYouTube(query: string): Promise<SocialSignal[]> {
  try {
    // Use YouTube's search RSS feed alternative: search page scraping is complex
    // Use Invidious API as free alternative
    const instances = ['https://invidious.projectsegfau.lt', 'https://invidious.fdn.fr']
    for (const instance of instances) {
      try {
        const url = `${instance}/api/v1/search?q=${encodeURIComponent(query)}&type=video`
        const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
        if (!res.ok) continue
        const data = await res.json()
        return (data || []).slice(0, 8).map((v: { videoId: string; title: string; description: string; viewCount: number; published: number; author: string }) => ({
          id: `yt-${v.videoId}`,
          source: `YouTube (${v.author})`,
          title: v.title,
          content: (v.description || '').slice(0, 300),
          url: `https://youtube.com/watch?v=${v.videoId}`,
          score: v.viewCount || 0,
          date: new Date((v.published || 0) * 1000).toISOString(),
          sentiment: 'neutral' as const,
          relevance: 0,
        }))
      } catch { continue }
    }
    return []
  } catch { return [] }
}

// ── Google Trends suggestions ────────────────────────────────────────────
async function getGoogleTrends(keywords: string[]): Promise<{ keyword: string; trending: boolean; suggestions?: string[] }[]> {
  const results = []
  for (const keyword of keywords.slice(0, 8)) {
    try {
      const url = `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(keyword)}`
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        const suggestions = data[1] || []
        results.push({ keyword, trending: suggestions.length > 3, suggestions: suggestions.slice(0, 5) })
      }
    } catch { /* silent */ }
  }
  return results
}

// ── Track signal history and flag NEW/TRENDING/PERSISTENT ────────────────
async function trackSignals(
  supabase: ReturnType<typeof createClient>,
  brandId: string,
  signals: SocialSignal[]
): Promise<{ signal: SocialSignal; status: 'new' | 'trending' | 'persistent' }[]> {
  if (!signals.length) return []

  // Get existing signals for this brand
  const { data: existing } = await supabase
    .from('brand_signals')
    .select('signal_id, source, appearance_count, first_seen')
    .eq('brand_id', brandId)

  const existingMap = new Map(
    (existing || []).map((e: { signal_id: string; source: string; appearance_count: number; first_seen: string }) =>
      [`${e.signal_id}-${e.source}`, e])
  )

  const tracked = signals.map(signal => {
    const key = `${signal.id}-${signal.source}`
    const prev = existingMap.get(key) as { appearance_count: number; first_seen: string } | undefined
    let status: 'new' | 'trending' | 'persistent' = 'new'
    if (prev) {
      const hoursSinceFirst = (Date.now() - new Date(prev.first_seen).getTime()) / (1000 * 60 * 60)
      if (hoursSinceFirst > 168) status = 'persistent'  // Over a week
      else if (prev.appearance_count >= 2) status = 'trending'
      else status = 'trending'  // Second appearance = trending
    }
    return { signal, status }
  })

  // Upsert signals
  const upsertRows = signals.map(s => ({
    brand_id: brandId,
    signal_id: s.id,
    source: s.source,
    title: s.title,
    content: s.content?.slice(0, 1000),
    url: s.url,
    score: s.score || 0,
    last_seen: new Date().toISOString(),
  }))

  // Insert new ones, update existing
  for (const row of upsertRows) {
    const key = `${row.signal_id}-${row.source}`
    const prev = existingMap.get(key) as { appearance_count: number } | undefined
    if (prev) {
      await supabase.from('brand_signals').update({
        last_seen: row.last_seen,
        score: row.score,
        appearance_count: (prev.appearance_count || 1) + 1,
      }).eq('brand_id', brandId).eq('signal_id', row.signal_id).eq('source', row.source)
    } else {
      await supabase.from('brand_signals').insert(row)
    }
  }

  return tracked
}

// ── Claude analyzes signals and extracts insights ────────────────────────
async function analyzeSignals(
  trackedSignals: { signal: SocialSignal; status: string }[],
  trends: { keyword: string; trending: boolean; suggestions?: string[] }[],
  research: BrandResearch
): Promise<ListeningInsight[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return []

  const client = new Anthropic({ apiKey })

  const signalSummary = trackedSignals.slice(0, 30).map(t =>
    `[${t.signal.source}] ${t.status.toUpperCase()} (${t.signal.score} pts): ${t.signal.title}\n${t.signal.content?.slice(0, 300) || ''}`
  ).join('\n\n')

  const trendSummary = trends.map(t =>
    `"${t.keyword}" - ${t.trending ? 'TRENDING' : 'normal'}${t.suggestions?.length ? ` | ${t.suggestions.join(', ')}` : ''}`
  ).join('\n')

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 3072,
    system: `You are a social listening analyst for Hype10 creative agency. Never use emdashes. Use hyphens or commas instead.

Brand context:
- Industry: ${research.industry || 'Unknown'}
- Product: ${research.productCategory || 'Unknown'}
- Personas: ${(research.personas || []).map(p => p.name).join('; ')}
- Known pain points: ${(research.painPoints || []).slice(0, 5).join(', ')}

Analyze the social signals and trends. Extract 8-12 actionable insights for the creative team.

For each insight:
- type: "trend" (rising topic), "pain_point" (customer frustration), "competitor" (competitor intel), "opportunity" (ad angle), "language" (customer words to steal for copy)
- priority: "high" (act this week), "medium" (act this month), "low" (interesting, not urgent)
- Include a specific actionable recommendation

CRITICAL: For "language" insights, quote actual phrases real customers are using. These become headlines and body copy.

Respond in EXACT JSON format:
{
  "insights": [
    {
      "type": "trend|pain_point|competitor|opportunity|language",
      "title": "Short, punchy insight title",
      "detail": "2-3 sentence explanation with specific examples",
      "signals": ["source names that support this"],
      "actionable": "Specific action the creative team should take",
      "priority": "high|medium|low",
      "copy_examples": ["actual quotes or example copy if relevant"]
    }
  ]
}`,
    messages: [{
      role: 'user',
      content: `SOCIAL SIGNALS (NEW = first time seeing, TRENDING = appearing repeatedly, PERSISTENT = long-standing):\n\n${signalSummary || 'No signals found'}\n\nGOOGLE TRENDS:\n${trendSummary || 'No trend data'}\n\nExtract actionable creative insights.`,
    }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return []

  const parsed = JSON.parse(jsonMatch[0])
  return (parsed.insights || []).map((i: ListeningInsight, idx: number) => ({
    ...i,
    id: `insight-${Date.now()}-${idx}`,
  }))
}

// ── POST handler ─────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { brandId } = await req.json()
    if (!brandId) return NextResponse.json({ error: 'brandId required' }, { status: 400 })

    const { data: brand } = await supabase.from('brands').select('*').eq('id', brandId).single()
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 })

    const research: BrandResearch | null = brand.research
    if (!research) return NextResponse.json({ error: 'Run brand research first' }, { status: 400 })

    const allSignals: SocialSignal[] = []

    // Reddit - subreddits from research
    console.log('Scanning Reddit subreddits...')
    for (const sub of (research.subreddits || []).slice(0, 5)) {
      const results = await searchReddit(research.industry || brand.name, sub, 8)
      allSignals.push(...results)
    }

    // Reddit - general keyword search
    console.log('Scanning Reddit by keywords...')
    for (const keyword of (research.searchKeywords || []).slice(0, 5)) {
      const results = await searchReddit(keyword, undefined, 6)
      allSignals.push(...results)
    }

    // Reddit - top comments from high-scoring posts
    console.log('Pulling Reddit comments...')
    const topPosts = allSignals
      .filter(s => s.source.startsWith('r/') && (s.score || 0) > 20)
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, 5)
    for (const post of topPosts) {
      if (post.url) {
        const comments = await getRedditComments(post.url)
        allSignals.push(...comments)
      }
    }

    // HackerNews
    console.log('Scanning HackerNews...')
    for (const keyword of (research.searchKeywords || []).slice(0, 3)) {
      const results = await searchHackerNews(keyword)
      allSignals.push(...results)
    }

    // YouTube
    console.log('Scanning YouTube...')
    for (const keyword of (research.searchKeywords || []).slice(0, 3)) {
      const results = await searchYouTube(keyword)
      allSignals.push(...results)
    }

    // Dedupe
    const uniqueSignals = Array.from(new Map(allSignals.map(s => [s.id, s])).values())
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, 60)

    // Track history
    const tracked = await trackSignals(supabase, brandId, uniqueSignals)

    // Google Trends
    const trends = await getGoogleTrends(research.searchKeywords || [brand.name])

    // Claude analysis
    const insights = await analyzeSignals(tracked, trends, research)

    // Update brand with full scan results so they persist
    const sourceBreakdown = {
      reddit: uniqueSignals.filter(s => s.source.startsWith('r/')).length,
      hackernews: uniqueSignals.filter(s => s.source === 'HackerNews').length,
      youtube: uniqueSignals.filter(s => s.source.startsWith('YouTube')).length,
    }
    await supabase.from('brands').update({
      last_scanned_at: new Date().toISOString(),
      last_scan_insights: insights,
      last_scan_trends: trends,
      last_scan_sources: sourceBreakdown,
    }).eq('id', brandId)

    return NextResponse.json({
      signals: tracked.map(t => ({ ...t.signal, status: t.status })),
      trends,
      insights,
      signalCount: uniqueSignals.length,
      insightCount: insights.length,
      scannedAt: new Date().toISOString(),
      sourceBreakdown,
    })
  } catch (e: unknown) {
    console.error('Listening error:', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
