import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient as createClient } from '@/lib/supabase-server'
import { SocialSignal, ListeningInsight, BrandResearch } from '@/lib/types'
import { CONTENT_FILTER, RELEVANCE_FILTER } from '@/lib/content-filter'
import {
  searchRedditDeep,
  getRedditCommentsDeep,
  getSubredditTop,
  searchHackerNews,
  searchYouTubeDeep,
  getYouTubeComments,
  getGoogleTrendsDeep,
  getGooglePeopleAlsoAsk,
  searchGoogleNews,
  searchApifyReddit,
  searchApifyTikTok,
  searchApifyAmazon,
  searchApifyTwitter,
  searchApifyInstagram,
  searchApifyTrustpilot,
  searchNewsApiAi,
  searchCurrentsApi,
  isApifyEnabled,
} from '@/lib/signal-sources'

export const maxDuration = 180 // 3 minutes for deep scans

// ── Track signal history and flag NEW/TRENDING/PERSISTENT ────────────────
async function trackSignals(
  supabase: ReturnType<typeof createClient>,
  brandId: string,
  signals: SocialSignal[]
): Promise<{ signal: SocialSignal; status: 'new' | 'trending' | 'persistent' }[]> {
  if (!signals.length) return []

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
      if (hoursSinceFirst > 168) status = 'persistent'
      else if (prev.appearance_count >= 2) status = 'trending'
      else status = 'trending'
    }
    return { signal, status }
  })

  // Upsert signals
  for (const row of signals) {
    const key = `${row.id}-${row.source}`
    const prev = existingMap.get(key) as { appearance_count: number } | undefined
    const dbRow = {
      brand_id: brandId,
      signal_id: row.id,
      source: row.source,
      title: row.title,
      content: row.content?.slice(0, 1500),
      url: row.url,
      score: row.score || 0,
      last_seen: new Date().toISOString(),
    }
    if (prev) {
      await supabase.from('brand_signals').update({
        last_seen: dbRow.last_seen,
        score: dbRow.score,
        appearance_count: (prev.appearance_count || 1) + 1,
      }).eq('brand_id', brandId).eq('signal_id', row.id).eq('source', row.source)
    } else {
      await supabase.from('brand_signals').insert(dbRow)
    }
  }

  return tracked
}

// ── PASS 1: Extract raw themes from signals ──────────────────────────────
async function extractThemes(
  client: Anthropic,
  signals: SocialSignal[],
  research: BrandResearch
): Promise<string> {
  const signalText = signals.slice(0, 40).map(s =>
    `[${s.source}] (${s.score}pts): ${s.title}\n${s.content?.slice(0, 300) || ''}`
  ).join('\n\n')

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2000,
    system: `You are a social research analyst. Extract raw themes from the signals below.
Brand context: ${research.industry || 'Unknown'}, personas: ${(research.personas || []).map(p => p.name).join('; ')}.
Focus on: recurring pain points, customer language patterns, emerging trends, competitor mentions, unmet needs.
Do not synthesize yet - just list the themes you see with supporting quotes.
Never use emdashes. Use hyphens.
${CONTENT_FILTER}
${RELEVANCE_FILTER}`,
    messages: [{
      role: 'user',
      content: `Analyze these signals and list the top 15-20 raw themes you see. For each theme include 1-2 actual quotes from the data that support it.\n\n${signalText}`,
    }],
  })

  return response.content[0].type === 'text' ? response.content[0].text : ''
}

// ── PASS 2: Identify patterns across themes ──────────────────────────────
async function identifyPatterns(
  client: Anthropic,
  themes: string,
  trends: { keyword: string; trending: boolean; suggestions: string[] }[],
  research: BrandResearch
): Promise<string> {
  const trendText = trends.map(t => `"${t.keyword}" - ${t.trending ? 'TRENDING' : 'normal'} | ${t.suggestions.join(', ')}`).join('\n')

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    system: `You are a creative strategist. Look across the themes and trends below and identify higher-order patterns.
Brand: ${research.industry || 'Unknown'}
Personas: ${(research.personas || []).map(p => `${p.name} (pain: ${(p.painPoints || []).slice(0, 2).join(', ')})`).join('; ')}

Look for:
- Patterns across multiple themes (not just one-offs)
- Cross-validated signals (multiple sources mention same thing)
- Gaps between what customers say vs what brands offer
- Emerging language shifts
${CONTENT_FILTER}
${RELEVANCE_FILTER}
- Competitor vulnerabilities

Never use emdashes.`,
    messages: [{
      role: 'user',
      content: `THEMES FROM SIGNALS:\n${themes}\n\nGOOGLE TRENDS:\n${trendText}\n\nIdentify 8-12 higher-order patterns across these themes. For each, note which themes support it and what makes it significant.`,
    }],
  })

  return response.content[0].type === 'text' ? response.content[0].text : ''
}

// ── PASS 3: Convert patterns into actionable creative insights ───────────
async function buildCreativeInsights(
  client: Anthropic,
  patterns: string,
  research: BrandResearch,
  brandName: string
): Promise<ListeningInsight[]> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 3000,
    system: `You are the Head of Creative at Hype10 agency. Convert the patterns below into actionable creative insights for ${brandName}.

Brand context:
- Industry: ${research.industry}
- Personas: ${(research.personas || []).map(p => p.name).join(', ')}
- Competitors: ${(research.competitors || []).slice(0, 5).join(', ')}

GOLDEN RULES:
- Every insight must be ACTIONABLE for a creative team this week
- Every insight must tie to a specific persona or pain point (never generic)
- Quote real customer language verbatim when relevant (these become ad copy)
- Prioritize by creative opportunity, not interestingness
- Never use emdashes
${CONTENT_FILTER}
${RELEVANCE_FILTER}

For each insight:
- type: "trend" | "pain_point" | "competitor" | "opportunity" | "language"
- priority: "high" (act this week) | "medium" (this month) | "low" (monitor)
- title: 5-10 word punchy insight title
- detail: 2-3 sentences explaining what you see
- actionable: SPECIFIC action the creative team should take (not vague "consider doing X")
- copy_examples: actual phrases/quotes customers are using that could become ad copy
- signals: which sources support this

Return 10-15 insights in JSON format:
{
  "insights": [
    {
      "type": "...",
      "title": "...",
      "detail": "...",
      "signals": ["..."],
      "actionable": "...",
      "priority": "...",
      "copy_examples": ["..."]
    }
  ]
}`,
    messages: [{
      role: 'user',
      content: `PATTERNS:\n${patterns}\n\nConvert to 10-15 actionable creative insights for ${brandName}. Prioritize by creative value.`,
    }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    console.error('Pass 3: No JSON found in response')
    return []
  }

  try {
    const parsed = JSON.parse(jsonMatch[0])
    return (parsed.insights || []).map((i: ListeningInsight, idx: number) => ({
      ...i,
      id: `insight-${Date.now()}-${idx}`,
    }))
  } catch (e) {
    console.error('Pass 3: JSON parse failed, attempting repair')
    // Try to fix common JSON issues (trailing commas, unescaped quotes)
    try {
      const cleaned = jsonMatch[0]
        .replace(/,\s*]/g, ']')  // trailing commas in arrays
        .replace(/,\s*}/g, '}')  // trailing commas in objects
      const parsed = JSON.parse(cleaned)
      return (parsed.insights || []).map((i: ListeningInsight, idx: number) => ({
        ...i,
        id: `insight-${Date.now()}-${idx}`,
      }))
    } catch {
      console.error('Pass 3: JSON repair also failed:', e)
      return []
    }
  }
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

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
    const apifyOn = isApifyEnabled()
    console.log('APIFY_API_KEY present:', !!process.env.APIFY_API_KEY, '| apifyOn:', apifyOn)
    const allSignals: SocialSignal[] = []

    console.log('=== Deep scan starting ===')

    // ── Reddit: keyword search + subreddit top + comments ──
    console.log('Reddit: keyword search...')
    for (const keyword of (research.searchKeywords || []).slice(0, 4)) {
      const results = await searchRedditDeep(keyword, undefined, 10)
      allSignals.push(...results)
    }

    console.log('Reddit: subreddit search...')
    for (const sub of (research.subreddits || []).slice(0, 4)) {
      const keywordResults = await searchRedditDeep(research.industry || brand.name, sub, 8)
      allSignals.push(...keywordResults)
      // Also get top of month from the subreddit
      const topResults = await getSubredditTop(sub, 8)
      allSignals.push(...topResults)
    }

    // Pull comments from high-scoring posts
    console.log('Reddit: comment mining...')
    const topPosts = allSignals
      .filter(s => s.source.startsWith('r/') && !s.source.includes('comment') && (s.score || 0) > 10)
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, 8)
    for (const post of topPosts) {
      if (post.url) {
        const comments = await getRedditCommentsDeep(post.url, 10)
        allSignals.push(...comments)
      }
    }

    // ── HackerNews ──
    console.log('HackerNews...')
    for (const keyword of (research.searchKeywords || []).slice(0, 3)) {
      const results = await searchHackerNews(keyword)
      allSignals.push(...results)
    }

    // ── YouTube: videos + comments from top ones ──
    console.log('YouTube: videos + comments...')
    for (const keyword of (research.searchKeywords || []).slice(0, 3)) {
      const { videos, topVideoIds } = await searchYouTubeDeep(keyword)
      allSignals.push(...videos)
      for (const vid of topVideoIds) {
        const comments = await getYouTubeComments(vid)
        allSignals.push(...comments)
      }
    }

    // ── Google News (free, no API key) ──
    // Use specific compound queries to avoid generic results
    console.log('Google News...')
    const topKeyword = (research.searchKeywords || [])[0] || brand.name
    const newsQuery = `"${brand.name}" ${research.productCategory || research.industry || ''}`
    const newsPromises = [
      searchGoogleNews(newsQuery, 5),
    ]
    const newsResults = await Promise.allSettled(newsPromises)
    for (const result of newsResults) {
      if (result.status === 'fulfilled') allSignals.push(...result.value)
    }

    // ── NewsAPI.ai + Currents API ──
    // Use compound queries with brand + category for relevance
    console.log('NewsAPI.ai + Currents...')
    const extraNewsPromises = [
      searchNewsApiAi(`"${brand.name}" ${research.productCategory || ''}`, 5),
      searchCurrentsApi(`${brand.name} ${research.productCategory || ''}`, 5),
    ]
    const extraNewsResults = await Promise.allSettled(extraNewsPromises)
    for (const result of extraNewsResults) {
      if (result.status === 'fulfilled') allSignals.push(...result.value)
    }

    // ── Google People Also Ask (free) ──
    console.log('Google People Also Ask...')
    const paaData = await getGooglePeopleAlsoAsk(research.productCategory || brand.name)
    // Convert questions to signals
    for (const q of paaData.questions) {
      allSignals.push({
        id: `paa-${Buffer.from(q).toString('base64').slice(0, 15)}`,
        source: 'Google PAA',
        title: q,
        content: `People are searching: "${q}" - this is a real consumer question about ${research.productCategory || brand.name}`,
        url: `https://google.com/search?q=${encodeURIComponent(q)}`,
        score: 30,
        date: new Date().toISOString(),
        sentiment: 'neutral' as const,
        relevance: 0,
      })
    }

    // ── Apify sources (flips on when APIFY_API_KEY set) ──
    if (apifyOn) {
      console.log('=== APIFY ENABLED - running scrapers in parallel ===')
      const apifyPromises: Promise<SocialSignal[]>[] = []

      // TikTok - top keyword
      if (topKeyword) apifyPromises.push(searchApifyTikTok(topKeyword))

      // Reddit - top keyword
      if (topKeyword) apifyPromises.push(searchApifyReddit(topKeyword))

      // Instagram - top keyword + brand name
      if (topKeyword) apifyPromises.push(searchApifyInstagram(topKeyword))
      apifyPromises.push(searchApifyInstagram(brand.name.replace(/\s+/g, '')))

      // Amazon - competitor URLs
      const competitorUrls: string[] = brand.competitor_urls || []
      for (const url of competitorUrls.slice(0, 2)) {
        apifyPromises.push(searchApifyAmazon(url))
      }

      // Amazon - own product URLs
      const ownUrls: string[] = brand.own_product_urls || []
      for (const url of ownUrls.slice(0, 2)) {
        apifyPromises.push(searchApifyAmazon(url))
      }

      // Trustpilot - brand domain
      if (brand.url) {
        apifyPromises.push(searchApifyTrustpilot(brand.url))
      }

      // Twitter/X - top keyword
      if (topKeyword) apifyPromises.push(searchApifyTwitter(topKeyword))

      // Run all in parallel
      const apifyResults = await Promise.allSettled(apifyPromises)
      for (const result of apifyResults) {
        if (result.status === 'fulfilled') {
          allSignals.push(...result.value)
          console.log(`Apify: got ${result.value.length} signals`)
        } else {
          console.error('Apify scraper failed:', result.reason)
        }
      }
    }

    // ── FRESHNESS FILTER: only keep signals from the last 7 days ──
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000
    const now = Date.now()
    const freshSignals = allSignals.filter(s => {
      if (!s.date) return true // keep signals without dates (we can't filter them)
      const signalDate = new Date(s.date).getTime()
      return (now - signalDate) < SEVEN_DAYS_MS
    })
    console.log(`Freshness filter: ${allSignals.length} -> ${freshSignals.length} (within 7 days)`)

    // ── RELEVANCE FILTER: strict matching against brand context ──
    const relevantSubreddits = new Set((research.subreddits || []).map(s => s.toLowerCase()))
    const brandKeywords = (research.searchKeywords || []).map(k => k.toLowerCase())
    const brandIndustry = (research.industry || '').toLowerCase()
    const productCategory = (research.productCategory || '').toLowerCase()
    const painPoints = (research.painPoints || []).map(p => p.toLowerCase())
    const personas = (research.personas || []).map(p => p.name.toLowerCase())

    const filteredSignals = freshSignals.filter(s => {
      const title = (s.title || '').toLowerCase()
      const content = (s.content || '').toLowerCase()
      const combined = `${title} ${content}`
      const source = (s.source || '').toLowerCase()

      // Always keep signals from research-specified subreddits
      if (source.startsWith('r/')) {
        const sub = source.replace('r/', '').replace(' (comment)', '').toLowerCase()
        if (relevantSubreddits.has(sub)) return true
      }

      // Score relevance: must match at least one strong signal
      let relevanceScore = 0

      // Direct keyword match (strongest)
      if (brandKeywords.some(k => combined.includes(k))) relevanceScore += 3

      // Industry/category match
      if (brandIndustry && combined.includes(brandIndustry)) relevanceScore += 2
      if (productCategory && combined.includes(productCategory)) relevanceScore += 2

      // Pain point match
      if (painPoints.some(p => combined.includes(p))) relevanceScore += 2

      // Persona-relevant terms
      if (personas.some(p => combined.includes(p))) relevanceScore += 1

      // Brand name mention (exact match, not partial)
      const brandLower = brand.name.toLowerCase()
      if (combined.includes(brandLower) && (
        combined.includes(` ${brandLower} `) || combined.includes(`${brandLower} `) || combined.startsWith(brandLower)
      )) relevanceScore += 3

      // News sources need higher threshold (too much noise otherwise)
      const isNews = source.startsWith('news') || source.includes('currents') || source.includes('newsapi')
      const threshold = isNews ? 4 : 2

      return relevanceScore >= threshold
    })
    console.log(`Relevance filter: ${freshSignals.length} -> ${filteredSignals.length}`)

    // Dedupe by similar content (not just ID)
    const seen = new Set<string>()
    const dedupedSignals = filteredSignals.filter(s => {
      const key = (s.title || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 50)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    // Sort by: freshness first, then engagement
    const uniqueSignals = Array.from(new Map(dedupedSignals.map(s => [s.id, s])).values())
      .sort((a, b) => {
        // Fresh + high engagement first
        const aDate = a.date ? new Date(a.date).getTime() : 0
        const bDate = b.date ? new Date(b.date).getTime() : 0
        const aFreshness = aDate / (now / 100) // normalize
        const bFreshness = bDate / (now / 100)
        const aScore = (a.score || 0) + aFreshness * 10
        const bScore = (b.score || 0) + bFreshness * 10
        return bScore - aScore
      })
      .slice(0, 80)

    console.log(`Total signals: ${uniqueSignals.length}`)

    // Track history
    const tracked = await trackSignals(supabase, brandId, uniqueSignals)

    // Google Trends
    console.log('Google Trends...')
    const trends = await getGoogleTrendsDeep(research.searchKeywords || [brand.name])

    // ── Claude analysis (single reliable pass) ──
    let insights: ListeningInsight[] = []
    try {
      console.log('Analyzing signals with Claude...')
      const signalText = uniqueSignals.slice(0, 25).map(s =>
        `[${s.source}] (${s.score || 0} pts): ${s.title}\n${(s.content || '').slice(0, 250)}`
      ).join('\n\n')

      const trendText = trends.map(t =>
        `"${t.keyword}" - ${t.trending ? 'TRENDING' : 'normal'}`
      ).join('\n')

      let competitorContext = ''
      if (brand.competitor_research && Array.isArray(brand.competitor_research)) {
        competitorContext = '\nCOMPETITOR INTEL: ' +
          (brand.competitor_research as Array<{ name: string; weaknesses?: string[] }>)
            .map(c => `${c.name} weaknesses: ${(c.weaknesses || []).slice(0, 2).join('; ')}`)
            .join(' | ')
      }

      const response = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 4000,
        system: `You are the Head of Creative at Hype10 agency analyzing social signals for ${brand.name}.

Brand: ${research.industry} | ${research.productCategory} | ${research.priceRange || ''}
Target personas: ${(research.personas || []).map(p => `${p.name} (${p.description || ''})`).join('; ')}
Pain points: ${(research.painPoints || []).slice(0, 5).join(', ')}
${competitorContext}

CRITICAL RULES:
- ONLY include insights directly relevant to ${research.productCategory || research.industry || brand.name}
- NEVER include generic wellness/lifestyle insights that could apply to any brand
- Every insight must connect to a specific persona or pain point from the brand research
- If a signal is about a different product category, SKIP IT completely
- Prioritize signals that reveal what customers are ACTUALLY saying about this type of product
- Quote real customer language verbatim - these become ad copy
- Every insight must be actionable for a creative team THIS WEEK
- Never use emdashes. Use hyphens or commas.
${CONTENT_FILTER}

Return ONLY valid JSON (no markdown, no text before or after):
{"insights":[{"type":"trend","title":"Short title","detail":"2-3 sentences","signals":["source1"],"actionable":"Specific action for creative team","priority":"high","copy_examples":["actual customer quote"]}]}

Types: trend, pain_point, competitor, opportunity, language
Priorities: high (act this week), medium (this month), low (monitor)`,
        messages: [{
          role: 'user',
          content: `SIGNALS:\n${signalText}\n\nTRENDS:\n${trendText}`,
        }],
      })

      const text = response.content[0].type === 'text' ? response.content[0].text : ''
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0].replace(/,\s*]/g, ']').replace(/,\s*}/g, '}'))
          insights = (parsed.insights || []).map((i: ListeningInsight, idx: number) => ({
            ...i,
            id: `insight-${Date.now()}-${idx}`,
          }))
        } catch (e) {
          console.error('JSON parse failed:', e)
        }
      }
      console.log('Insights generated:', insights.length)
    } catch (analysisErr) {
      console.error('Claude analysis failed:', analysisErr)
    }

    // Source breakdown for UI
    const sourceBreakdown = {
      reddit: uniqueSignals.filter(s => s.source.startsWith('r/') && !s.source.includes('comment')).length,
      'reddit comments': uniqueSignals.filter(s => s.source.includes('comment') && s.source.startsWith('r/')).length,
      hackernews: uniqueSignals.filter(s => s.source === 'HackerNews').length,
      youtube: uniqueSignals.filter(s => s.source.startsWith('YouTube') && !s.source.includes('comment')).length,
      'yt comments': uniqueSignals.filter(s => s.source === 'YouTube comment').length,
      news: uniqueSignals.filter(s => s.source.startsWith('News')).length,
      'google paa': uniqueSignals.filter(s => s.source === 'Google PAA').length,
      ...(apifyOn ? {
        tiktok: uniqueSignals.filter(s => s.source === 'TikTok').length,
        instagram: uniqueSignals.filter(s => s.source.startsWith('Instagram')).length,
        amazon: uniqueSignals.filter(s => s.source === 'Amazon Review').length,
        trustpilot: uniqueSignals.filter(s => s.source === 'Trustpilot').length,
      } : {}),
    }

    // Cache on brand record
    await supabase.from('brands').update({
      last_scanned_at: new Date().toISOString(),
      last_scan_insights: insights,
      last_scan_trends: trends,
      last_scan_sources: sourceBreakdown,
    }).eq('id', brandId)

    console.log('=== Deep scan complete ===')

    return NextResponse.json({
      signals: tracked.map(t => ({ ...t.signal, status: t.status })),
      trends,
      insights,
      signalCount: uniqueSignals.length,
      insightCount: insights.length,
      scannedAt: new Date().toISOString(),
      sourceBreakdown,
      apifyEnabled: apifyOn,
    })
  } catch (e: unknown) {
    console.error('Listening error:', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
