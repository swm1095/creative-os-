import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient as createClient } from '@/lib/supabase-server'

export const maxDuration = 30

// GET - list saved insights for a brand
export async function GET(req: NextRequest) {
  try {
    const supabase = createClient()
    const brandId = req.nextUrl.searchParams.get('brandId')
    if (!brandId) return NextResponse.json({ error: 'brandId required' }, { status: 400 })

    const { data, error } = await supabase
      .from('saved_insights')
      .select('*')
      .eq('brand_id', brandId)
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ insights: data || [] })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}

// POST - save an insight or analyze reviews
export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const body = await req.json()

    // Amazon review analysis
    if (body.action === 'analyze-reviews') {
      const { productUrls, brandName, brandResearch } = body
      if (!productUrls?.length) return NextResponse.json({ error: 'productUrls required' }, { status: 400 })

      const apiKey = process.env.ANTHROPIC_API_KEY
      if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })

      // Use Claude to analyze the product URLs conceptually
      // (In production, Apify would scrape real reviews first)
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': apiKey, 'content-type': 'application/json', 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1500,
          messages: [{
            role: 'user',
            content: `Analyze Amazon customer reviews for ${brandName} products.

Product URLs: ${productUrls.join(', ')}

Brand context: ${brandResearch ? `Industry: ${brandResearch.industry}, Category: ${brandResearch.productCategory}, Pain points: ${(brandResearch.painPoints || []).join(', ')}` : 'No research available'}

Based on what you know about this brand and typical Amazon reviews for products in this category, provide a realistic review analysis.

Return JSON only:
{
  "sentiment": "Overall sentiment (e.g. Mostly positive - 4.2/5 average)",
  "summary": "2-3 sentence summary of the review landscape",
  "praise": ["thing customers love 1", "thing 2", "thing 3", "thing 4", "thing 5"],
  "complaints": ["complaint 1", "complaint 2", "complaint 3", "complaint 4"],
  "themes": ["theme 1", "theme 2", "theme 3", "theme 4", "theme 5", "theme 6"]
}

Be specific to this product category. No markdown, only JSON.`
          }],
        }),
      })

      if (!res.ok) {
        const err = await res.text()
        throw new Error(`Claude error: ${err.slice(0, 200)}`)
      }

      const data = await res.json()
      const text = data.content?.find((b: { type: string }) => b.type === 'text')?.text || ''
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('Could not parse review analysis')

      return NextResponse.json({ analysis: JSON.parse(jsonMatch[0]) })
    }

    const { brandId, title, detail, insight_type, source_data, notes, priority } = body
    if (!brandId || !title) return NextResponse.json({ error: 'brandId and title required' }, { status: 400 })

    const { data, error } = await supabase.from('saved_insights').insert({
      brand_id: brandId,
      title,
      detail,
      insight_type,
      source_data,
      notes,
      priority: priority || 'medium',
      status: 'idea',
    }).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ insight: data })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}

// PATCH - update an insight
export async function PATCH(req: NextRequest) {
  try {
    const supabase = createClient()
    const body = await req.json()
    const { id, ...updates } = body
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const { data, error } = await supabase.from('saved_insights').update({
      ...updates,
      updated_at: new Date().toISOString(),
    }).eq('id', id).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ insight: data })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}

// DELETE - delete an insight
export async function DELETE(req: NextRequest) {
  try {
    const supabase = createClient()
    const { id } = await req.json()
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const { error } = await supabase.from('saved_insights').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
