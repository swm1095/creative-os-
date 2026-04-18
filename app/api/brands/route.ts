import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient as createClient } from '@/lib/supabase-server'

export const maxDuration = 30

// GET - list all brands (bypasses RLS via service client)
export async function GET() {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('brands')
      .select('*, creatives(count)')
      .order('name', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const brands = (data || []).map(b => ({
      ...b,
      creative_count: b.creatives?.[0]?.count || 0,
    }))

    return NextResponse.json({ brands })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}

// DELETE - delete a brand
export async function DELETE(req: NextRequest) {
  try {
    const supabase = createClient()
    const { brandId } = await req.json()
    if (!brandId) return NextResponse.json({ error: 'brandId required' }, { status: 400 })

    const { error } = await supabase.from('brands').delete().eq('id', brandId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}

// POST - create or update a brand
export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const body = await req.json()
    const { id, name, url, color, scan_cadence, assigned_to } = body

    // Update if id provided, create otherwise
    if (id) {
      const updates: Record<string, unknown> = {}
      if (name !== undefined) updates.name = name
      if (url !== undefined) updates.url = url
      if (color !== undefined) updates.color = color
      if (scan_cadence !== undefined) updates.scan_cadence = scan_cadence
      if (assigned_to !== undefined) updates.assigned_to = assigned_to
      if (body.research !== undefined) updates.research = body.research
      if (body.competitor_urls !== undefined) updates.competitor_urls = body.competitor_urls

      const { data, error } = await supabase.from('brands').update(updates).eq('id', id).select().single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ brand: { ...data, creative_count: 0 } })
    }

    if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })

    const { data, error } = await supabase
      .from('brands')
      .insert({ name, url: url || '', color: color || '#2B4EFF' })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ brand: { ...data, creative_count: 0 } })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
