import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient as createClient } from '@/lib/supabase-server'

export const maxDuration = 30

// GET - list creators (optionally filtered by brand)
export async function GET(req: NextRequest) {
  try {
    const supabase = createClient()
    const brandId = req.nextUrl.searchParams.get('brandId')

    let query = supabase.from('creators').select('*').order('created_at', { ascending: true })
    if (brandId) query = query.eq('brand_id', brandId)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ creators: data || [] })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}

// POST - create a creator
export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const body = await req.json()
    const { name, specialty, email, address, portfolio_url, color, brand_id, ig_handle, gender, demo, deliverables, tracker_link, website } = body
    if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })

    const { data, error } = await supabase.from('creators').insert({
      name, specialty, email, address, portfolio_url, website,
      color: color || '#2138ff',
      brand_id: brand_id || null,
      ig_handle, gender, demo,
      deliverables: deliverables || 0,
      tracker_link,
    }).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ creator: data })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}

// DELETE - delete a creator
export async function DELETE(req: NextRequest) {
  try {
    const supabase = createClient()
    const { id } = await req.json()
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const { error } = await supabase.from('creators').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}

// PATCH - update a creator
export async function PATCH(req: NextRequest) {
  try {
    const supabase = createClient()
    const body = await req.json()
    const { id, ...updates } = body
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const { data, error } = await supabase.from('creators').update({
      ...updates,
      updated_at: new Date().toISOString(),
    }).eq('id', id).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ creator: data })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
