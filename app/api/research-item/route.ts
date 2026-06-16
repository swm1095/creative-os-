import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 30

// POST - research a theme or product collection
export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })

    const { type, name, brandName, brandIndustry, brandCategory, productUrl } = await req.json()
    if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })

    const prompts: Record<string, string> = {
      theme: `Research this marketing theme/campaign angle for ${brandName || 'a brand'} in the ${brandIndustry || brandCategory || 'consumer'} industry.

Theme: "${name}"

Return JSON only:
{
  "description": "2-3 sentence description of this theme and why it resonates with consumers",
  "targetAudience": "Who this theme appeals to most",
  "keyAngles": ["ad angle 1", "ad angle 2", "ad angle 3"],
  "hookSuggestions": ["hook idea 1", "hook idea 2", "hook idea 3"],
  "trendContext": "What makes this theme relevant right now",
  "contentTypes": ["best content format 1", "best format 2"]
}`,
      collection: `Research this product collection/category for ${brandName || 'a brand'} in the ${brandIndustry || brandCategory || 'consumer'} industry.

Product Collection: "${name}"
${productUrl ? `Product URL: ${productUrl}` : ''}

Return JSON only:
{
  "description": "2-3 sentence description of this product collection and its positioning",
  "keyFeatures": ["feature 1", "feature 2", "feature 3"],
  "usps": ["unique selling point 1", "usp 2", "usp 3"],
  "targetAudience": "Who buys these products",
  "painPoints": ["pain point this collection solves 1", "pain point 2"],
  "hookSuggestions": ["hook idea 1", "hook idea 2", "hook idea 3"],
  "priceRange": "estimated price range if known"
}`,
    }

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'content-type': 'application/json', 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 800,
        messages: [{ role: 'user', content: prompts[type] || prompts.theme }],
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      return NextResponse.json({ error: `Claude error: ${err.slice(0, 200)}` }, { status: res.status })
    }

    const data = await res.json()
    const text = data.content?.find((b: { type: string }) => b.type === 'text')?.text || ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return NextResponse.json({ error: 'Could not parse research' }, { status: 500 })

    return NextResponse.json({ research: JSON.parse(jsonMatch[0]) })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
