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

// POST - save an insight
export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const body = await req.json()
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
