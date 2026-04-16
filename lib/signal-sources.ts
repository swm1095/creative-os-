// Unified signal collection from all sources
// Designed for easy extension - drop in Apify when ready

import { SocialSignal } from './types'

interface RedditPost {
  data: {
    id: string
    title: string
    selftext: string
    permalink: string
    score: number
    created_utc: number
    subreddit: string
    num_comments: number
    url?: string
  }
}

interface RedditComment {
  data: {
    id: string
    body: string
    score: number
    permalink: string
    subreddit: string
    author: string
  }
}

// ── Reddit: deep post + comment mining ───────────────────────────────────
export async function searchRedditDeep(query: string, subreddit?: string, limit: number = 25): Promise<SocialSignal[]> {
  try {
    const sub = subreddit ? `r/${subreddit}/` : ''
    const url = `https://www.reddit.com/${sub}search.json?q=${encodeURIComponent(query)}&sort=top&t=month&limit=${limit}`
    const res = await fetch(url, { headers: { 'User-Agent': 'HyperCreate/1.0' } })
    if (!res.ok) return []
    const data = await res.json()
    const posts: RedditPost[] = data?.data?.children || []
    return posts.map((p) => ({
      id: `reddit-${p.data.id}`,
      source: `r/${p.data.subreddit}`,
      title: p.data.title,
      content: (p.data.selftext || '').slice(0, 1000),
      url: `https://reddit.com${p.data.permalink}`,
      score: p.data.score,
      date: new Date(p.data.created_utc * 1000).toISOString(),
      sentiment: 'neutral' as const,
      relevance: 0,
    }))
  } catch { return [] }
}

// Get top comments for a post (where customer language lives)
export async function getRedditCommentsDeep(postUrl: string, limit: number = 10): Promise<SocialSignal[]> {
  try {
    const cleanUrl = postUrl.replace('https://reddit.com', 'https://www.reddit.com')
    const res = await fetch(`${cleanUrl}.json?limit=${limit}&sort=top`, {
      headers: { 'User-Agent': 'HyperCreate/1.0' },
    })
    if (!res.ok) return []
    const data = await res.json()
    const comments: RedditComment[] = data?.[1]?.data?.children || []
    return comments
      .filter(c => c.data.body && c.data.body.length > 40 && !c.data.body.includes('[deleted]') && !c.data.body.includes('[removed]'))
      .slice(0, 8)
      .map((c) => ({
        id: `reddit-comment-${c.data.id}`,
        source: `r/${c.data.subreddit} (comment)`,
        title: c.data.body.slice(0, 150),
        content: c.data.body.slice(0, 1500),
        url: `https://reddit.com${c.data.permalink}`,
        score: c.data.score,
        date: new Date().toISOString(),
        sentiment: 'neutral' as const,
        relevance: 0,
      }))
  } catch { return [] }
}

// Top of all time from a specific subreddit (evergreen conversations)
export async function getSubredditTop(subreddit: string, limit: number = 15): Promise<SocialSignal[]> {
  try {
    const res = await fetch(`https://www.reddit.com/r/${subreddit}/top.json?t=month&limit=${limit}`, {
      headers: { 'User-Agent': 'HyperCreate/1.0' },
    })
    if (!res.ok) return []
    const data = await res.json()
    const posts: RedditPost[] = data?.data?.children || []
    return posts.map((p) => ({
      id: `reddit-${p.data.id}`,
      source: `r/${p.data.subreddit}`,
      title: p.data.title,
      content: (p.data.selftext || '').slice(0, 1000),
      url: `https://reddit.com${p.data.permalink}`,
      score: p.data.score,
      date: new Date(p.data.created_utc * 1000).toISOString(),
      sentiment: 'neutral' as const,
      relevance: 0,
    }))
  } catch { return [] }
}

// ── HackerNews deep search ───────────────────────────────────────────────
interface HNHit {
  objectID: string
  title: string
  story_text?: string
  url?: string
  points: number
  num_comments: number
  created_at: string
}

export async function searchHackerNews(query: string): Promise<SocialSignal[]> {
  try {
    const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&tags=story&hitsPerPage=10`
    const res = await fetch(url)
    if (!res.ok) return []
    const data = await res.json()
    return (data.hits || []).map((h: HNHit) => ({
      id: `hn-${h.objectID}`,
      source: 'HackerNews',
      title: h.title,
      content: (h.story_text || `${h.points} points, ${h.num_comments} comments`).slice(0, 500),
      url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
      score: h.points,
      date: h.created_at,
      sentiment: 'neutral' as const,
      relevance: 0,
    }))
  } catch { return [] }
}

// ── YouTube search + top comments via Invidious ──────────────────────────
interface InvidVideo {
  videoId: string
  title: string
  description: string
  viewCount: number
  published: number
  author: string
}

interface InvidComment {
  commentId: string
  author: string
  content: string
  likeCount: number
}

const INVIDIOUS_INSTANCES = [
  'https://invidious.projectsegfau.lt',
  'https://invidious.fdn.fr',
  'https://yewtu.be',
]

export async function searchYouTubeDeep(query: string): Promise<{ videos: SocialSignal[]; topVideoIds: string[] }> {
  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      const url = `${instance}/api/v1/search?q=${encodeURIComponent(query)}&type=video&sort_by=upload_date`
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
      if (!res.ok) continue
      const data: InvidVideo[] = await res.json()
      const videos = (data || []).slice(0, 10).map((v) => ({
        id: `yt-${v.videoId}`,
        source: `YouTube (${v.author})`,
        title: v.title,
        content: (v.description || '').slice(0, 500),
        url: `https://youtube.com/watch?v=${v.videoId}`,
        score: v.viewCount || 0,
        date: new Date((v.published || 0) * 1000).toISOString(),
        sentiment: 'neutral' as const,
        relevance: 0,
      }))
      // Pull IDs of top 3 by views for comment mining
      const topVideoIds = [...(data || [])].sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0)).slice(0, 3).map(v => v.videoId)
      return { videos, topVideoIds }
    } catch { continue }
  }
  return { videos: [], topVideoIds: [] }
}

export async function getYouTubeComments(videoId: string): Promise<SocialSignal[]> {
  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      const res = await fetch(`${instance}/api/v1/comments/${videoId}?sort_by=top`, {
        signal: AbortSignal.timeout(5000),
      })
      if (!res.ok) continue
      const data = await res.json()
      const comments: InvidComment[] = data?.comments || []
      return comments
        .filter(c => c.content && c.content.length > 40)
        .slice(0, 5)
        .map((c) => ({
          id: `yt-comment-${c.commentId}`,
          source: `YouTube comment`,
          title: c.content.slice(0, 150),
          content: c.content.slice(0, 1000),
          url: `https://youtube.com/watch?v=${videoId}`,
          score: c.likeCount || 0,
          date: new Date().toISOString(),
          sentiment: 'neutral' as const,
          relevance: 0,
        }))
    } catch { continue }
  }
  return []
}

// ── Google Trends (unofficial) ───────────────────────────────────────────
export async function getGoogleTrendsDeep(keywords: string[]): Promise<{ keyword: string; trending: boolean; suggestions: string[] }[]> {
  const results = []
  for (const keyword of keywords.slice(0, 10)) {
    try {
      const url = `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(keyword)}`
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) })
      if (res.ok) {
        const data = await res.json()
        const suggestions = data[1] || []
        results.push({ keyword, trending: suggestions.length > 3, suggestions: suggestions.slice(0, 8) })
      }
    } catch { /* silent */ }
  }
  return results
}

// ── Apify integration ─────────────────────────────────────────────────────
// Uses Apify's actor-based scrapers. Each call runs an actor synchronously
// and returns the dataset items. Actor IDs are Apify Store actors.

const APIFY_BASE = 'https://api.apify.com/v2'

interface ApifyDatasetItem {
  [key: string]: unknown
}

async function runApifyActor(actorId: string, input: Record<string, unknown>, timeout: number = 60): Promise<ApifyDatasetItem[]> {
  const apiKey = process.env.APIFY_API_KEY
  if (!apiKey) return []

  try {
    // Run actor synchronously - gets dataset items directly
    const url = `${APIFY_BASE}/acts/${actorId}/run-sync-get-dataset-items?token=${apiKey}&timeout=${timeout}&memory=512`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout((timeout + 5) * 1000),
    })
    if (!res.ok) {
      console.error(`Apify ${actorId} failed:`, res.status, (await res.text()).slice(0, 200))
      return []
    }
    return await res.json()
  } catch (e) {
    console.error(`Apify ${actorId} exception:`, e)
    return []
  }
}

// Reddit scraper (trudax/reddit-scraper-lite)
export async function searchApifyReddit(query: string, limit: number = 20): Promise<SocialSignal[]> {
  const items = await runApifyActor('trudax~reddit-scraper-lite', {
    searches: [query],
    type: 'posts',
    sort: 'top',
    time: 'month',
    maxItems: limit,
    proxy: { useApifyProxy: true },
  }, 90)

  if (!Array.isArray(items)) return []
  return (items as Array<{ id?: string; parsedId?: string; title?: string; body?: string; url?: string; upVotes?: number; createdAt?: string; communityName?: string; parsedCommunityName?: string }>)
    .filter(item => item && (item.id || item.parsedId))
    .slice(0, limit)
    .map(item => ({
      id: `apify-reddit-${item.parsedId || item.id}`,
      source: `r/${item.parsedCommunityName || item.communityName?.replace('r/', '') || 'reddit'}`,
      title: item.title || '',
      content: (item.body || '').slice(0, 1000),
      url: item.url || '',
      score: item.upVotes || 0,
      date: item.createdAt || new Date().toISOString(),
      sentiment: 'neutral' as const,
      relevance: 0,
    }))
}

// TikTok scraper (clockworks/tiktok-scraper)
export async function searchApifyTikTok(query: string, limit: number = 15): Promise<SocialSignal[]> {
  const items = await runApifyActor('clockworks~tiktok-scraper', {
    hashtags: [query.replace(/\s+/g, '')],
    resultsPerPage: limit,
    shouldDownloadCovers: false,
    shouldDownloadVideos: false,
    proxyCountryCode: 'US',
  }, 90)

  if (!Array.isArray(items)) return []
  return (items as Array<{ id?: string; text?: string; webVideoUrl?: string; playCount?: number; diggCount?: number; createTimeISO?: string; authorMeta?: { name?: string } }>)
    .filter(item => item && item.id)
    .slice(0, limit)
    .map(item => ({
      id: `apify-tiktok-${item.id}`,
      source: 'TikTok',
      title: (item.text || '').slice(0, 150),
      content: (item.text || '').slice(0, 1000),
      url: item.webVideoUrl,
      score: item.playCount || item.diggCount || 0,
      date: item.createTimeISO || new Date().toISOString(),
      sentiment: 'neutral' as const,
      relevance: 0,
    }))
}

// Amazon review scraper - uses direct product URLs saved on brand record
export async function searchApifyAmazon(productUrl: string, limit: number = 15): Promise<SocialSignal[]> {
  if (!process.env.APIFY_API_KEY || !productUrl) return []

  const items = await runApifyActor('junglee~amazon-reviews-scraper', {
    productUrls: [{ url: productUrl }],
    maxReviews: limit,
    sort: 'helpful',
    proxyConfiguration: { useApifyProxy: true },
  }, 120)

  if (!Array.isArray(items)) return []
  return items
    .filter(item => item && (item.title || item.text || item.reviewBody))
    .slice(0, limit)
    .map((item, i) => ({
      id: `apify-amazon-${item.id || item.reviewId || i}-${Date.now()}`,
      source: 'Amazon Review',
      title: (item.title || item.reviewTitle || 'Amazon Review').toString().slice(0, 150),
      content: (item.text || item.reviewBody || item.body || '').toString().slice(0, 1500),
      url: (item.url || item.reviewUrl || productUrl).toString(),
      score: Math.round(((item.ratingScore || item.stars || item.rating || 3) as number) * 20),
      date: (item.date || item.reviewDate || new Date().toISOString()).toString(),
      sentiment: ((item.ratingScore || item.stars || item.rating || 3) as number) < 3 ? 'negative' as const : 'positive' as const,
      relevance: 0,
    }))
}

// Twitter/X scraper - DISABLED: X aggressively blocks scrapers
// TODO: Re-enable if Apify releases a working X scraper
export async function searchApifyTwitter(_query: string): Promise<SocialSignal[]> {
  if (!process.env.APIFY_API_KEY) return []
  console.log('Apify Twitter: Skipped (X is blocking scrapers)')
  return []
}

export function isApifyEnabled(): boolean {
  return !!process.env.APIFY_API_KEY
}
