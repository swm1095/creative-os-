import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient as createClient } from '@/lib/supabase-server'

export const maxDuration = 30

// GET - list all users (admin only)
export async function GET() {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('client_users')
      .select('id, username, name, email, role, brand_id, last_login, created_at')
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ users: data || [] })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}

// POST - create a new user (admin only)
export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { username, password, name, email, role, brand_id } = await req.json()

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password required' }, { status: 400 })
    }

    // Check if username already exists
    const { data: existing } = await supabase
      .from('client_users')
      .select('id')
      .eq('username', username)
      .single()

    if (existing) {
      return NextResponse.json({ error: 'Username already exists' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('client_users')
      .insert({
        username,
        password_hash: password, // TODO: bcrypt hash
        name: name || username,
        email: email || '',
        role: role || 'client',
        brand_id: brand_id || null,
      })
      .select('id, username, name, email, role, brand_id, created_at')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ user: data })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}

// DELETE - delete a user
export async function DELETE(req: NextRequest) {
  try {
    const supabase = createClient()
    const { id } = await req.json()
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const { error } = await supabase.from('client_users').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
