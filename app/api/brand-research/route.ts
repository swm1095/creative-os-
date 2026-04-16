import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient as createClient } from '@/lib/supabase-server'
import { BrandResearch } from '@/lib/types'

export const maxDuration = 120

const RESEARCH_PROMPT = `You are an expert brand strategist and market researcher. Analyze the provided website content and build a comprehensive brand profile.

IMPORTANT RULES:
- Never use emdashes. Use hyphens (-) or commas instead.
- Be specific and actionable, not generic
- Base everything on what you can actually see/infer from the website
- If something isn't clear from the website, make a smart inference based on the product category

Respond in this EXACT JSON format with no other text:
{
  "industry": "specific industry (e.g. 'Supportive Footwear' not just 'Retail')",
  "productCategory": "main product type",
  "priceRange": "approximate price range (e.g. '$80-120')",
  "targetDemo": "primary demographic (age, gender, lifestyle)",
  "valueProps": ["3-5 core value propositions"],
  "differentiators": ["3-5 things that make this brand unique vs competitors"],
  "competitors": ["5-8 direct and indirect competitor brand names"],
  "personas": [
    {
      "name": "Persona name with age range (e.g. 'Chronic Pain Sufferers, 35-65')",
      "age": "age range",
      "description": "1-2 sentence description",
      "painPoints": ["3 specific pain points this persona has"],
      "motivators": ["3 things that would make them buy"],
      "channels": ["where they spend time online"],
      "hook": "one punchy ad hook for this persona"
    }
  ],
  "painPoints": ["5-8 customer pain points the brand solves"],
  "motivators": ["5-8 purchase motivators"],
  "objections": ["5 common objections or hesitations"],
  "brandVoice": "2-3 sentence description of how the brand talks",
  "messagingThemes": ["5 recurring messaging themes"],
  "keyPhrases": ["5-8 phrases the brand uses or should use"],
  "avoidPhrases": ["5 phrases to avoid based on brand positioning"],
  "searchKeywords": ["10-15 keywords for social listening and trend monitoring"],
  "subreddits": ["5-10 relevant subreddit names without r/ prefix"],
  "hashTags": ["10 relevant hashtags without # prefix"],
  "summary": "3-4 sentence executive summary of the brand"
}

Generate 4 distinct personas that represent different audience segments. Make them specific enough to write targeted ad copy for each one.`

export async function POST(req: NextRequest) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
    }

    const supabase = createClient()
    const { brandId, websiteUrl, brandName } = await req.json()

    if (!websiteUrl && !brandName) {
      return NextResponse.json({ error: 'websiteUrl or brandName required' }, { status: 400 })
    }

    // Fetch website content if URL provided
    let websiteContent = ''
    if (websiteUrl) {
      try {
        const res = await fetch(websiteUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; HyperCreate/1.0)' },
        })
        if (res.ok) {
          const html = await res.text()
          // Strip HTML tags, keep text content
          websiteContent = html
            .replace(/<script[\s\S]*?<\/script>/gi, '')
            .replace(/<style[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 15000) // Cap at 15k chars to stay within token limits
        }
      } catch (e) {
        console.error('Website fetch failed:', e)
      }
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const userMessage = websiteContent
      ? `Analyze this brand's website and build a complete brand profile.\n\nBrand name: ${brandName || 'Unknown'}\nWebsite URL: ${websiteUrl}\n\nWebsite content:\n${websiteContent}`
      : `Build a brand profile based on what you know about this brand.\n\nBrand name: ${brandName}\n${websiteUrl ? `Website: ${websiteUrl}` : ''}`

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: RESEARCH_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Could not parse research response' }, { status: 500 })
    }

    const research: BrandResearch = {
      ...JSON.parse(jsonMatch[0]),
      websiteUrl: websiteUrl || '',
      researchDate: new Date().toISOString(),
    }

    // Save to brand record if brandId provided
    if (brandId && brandId !== 'demo') {
      await supabase.from('brands').update({
        research: research,
        research_completed: true,
        tone_notes: research.brandVoice,
      }).eq('id', brandId)
    }

    return NextResponse.json({ research, brandId })
  } catch (e: unknown) {
    console.error('Brand research error:', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
