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
      .order('created_at', { ascending: false })

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

// POST - create a brand
export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { name, url, color } = await req.json()
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
