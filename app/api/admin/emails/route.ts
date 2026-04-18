import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient as createClient } from '@/lib/supabase-server'

export const maxDuration = 30

// GET - list admin emails
export async function GET() {
  try {
    const supabase = createClient()
    const { data } = await supabase.from('admin_emails').select('*').order('created_at', { ascending: true })
    return NextResponse.json({ emails: data || [] })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}

// POST - add admin email
export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { email, name } = await req.json()
    if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 })

    const { data, error } = await supabase.from('admin_emails').insert({
      email, name: name || email.split('@')[0],
      can_view_usage: true, receives_alerts: true, added_by: 'admin',
    }).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ admin: data })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}

// DELETE - remove admin email
export async function DELETE(req: NextRequest) {
  try {
    const supabase = createClient()
    const { id } = await req.json()
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    await supabase.from('admin_emails').delete().eq('id', id)
    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
