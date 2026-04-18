import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient as createClient } from '@/lib/supabase-server'
import { BrandResearch, ResearchPersona } from '@/lib/types'
import { CONTENT_FILTER } from '@/lib/content-filter'

export const maxDuration = 60

// Claude generates structured video prompts from insight + brand context
export async function POST(req: NextRequest) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
    }

    const { brandId, insight, style, platform } = await req.json()
    if (!brandId) return NextResponse.json({ error: 'brandId required' }, { status: 400 })

    const supabase = createClient()
    const { data: brand } = await supabase.from('brands').select('*').eq('id', brandId).single()
    if (!brand?.research) return NextResponse.json({ error: 'Brand research required' }, { status: 400 })

    const research: BrandResearch = brand.research
    const personas = (research.personas || []).slice(0, 4)

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 3000,
      system: `You are a video creative director at Hype10 agency. You generate structured video prompts for AI video generation tools (Seedance 2.0 and Kling v3).

BRAND: ${brand.name}
INDUSTRY: ${research.industry}
PRODUCT: ${research.productCategory}
VOICE: ${research.brandVoice}
${CONTENT_FILTER}

NEVER use emdashes. Use hyphens or commas.

For each video scene, generate a structured prompt with:
- subject: what/who is in the frame
- environment: where the scene takes place
- action: what's happening (movement, interaction)
- camera: specific camera movement (slow zoom, dolly, handheld, pan, static)
- lighting: lighting style (natural, studio, golden hour, soft, dramatic)
- style: visual style matching the requested type
- mood: emotional tone of the scene

Generate 3-4 scenes that tell a cohesive story when played in sequence.
Each scene should be 3-5 seconds of video.

Respond in EXACT JSON format:
{
  "title": "Short concept title",
  "scenes": [
    {
      "sceneNumber": 1,
      "description": "What happens in this scene (1 sentence)",
      "prompt": "Full detailed prompt for the video generation AI",
      "subject": "",
      "environment": "",
      "action": "",
      "camera": "",
      "lighting": "",
      "style": "",
      "mood": "",
      "duration": 5
    }
  ],
  "recommended_model": "seedance or kling",
  "recommended_style": "ugc or cinematic or animated or product",
  "full_prompt": "A single combined prompt if generating as one video instead of scenes"
}`,
      messages: [{
        role: 'user',
        content: `Generate video prompts for ${brand.name}.

${insight ? `INSIGHT TO BASE VIDEO ON:\nTitle: ${insight.title}\nDetail: ${insight.detail}\n${insight.actionable ? `Action: ${insight.actionable}` : ''}\n${insight.copy_examples?.length ? `Customer quotes: ${insight.copy_examples.join(' | ')}` : ''}` : ''}

STYLE: ${style || 'ugc'}
PLATFORM: ${platform || 'TikTok/Reels (9:16)'}

PERSONAS:
${personas.map((p: ResearchPersona, i: number) => `P${i + 1}: ${p.name} - ${p.description || ''} - Hook: ${p.hook || ''}`).join('\n')}

Generate a ${style || 'UGC'}-style video concept with 3-4 scenes. The video should feel authentic and relevant to the insight above.`,
      }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return NextResponse.json({ error: 'Could not parse video prompt' }, { status: 500 })

    try {
      const result = JSON.parse(jsonMatch[0].replace(/,\s*]/g, ']').replace(/,\s*}/g, '}'))
      return NextResponse.json(result)
    } catch {
      return NextResponse.json({ error: 'Invalid JSON from Claude' }, { status: 500 })
    }
  } catch (e: unknown) {
    console.error('Video prompt error:', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
