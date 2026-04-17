import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient as createClient } from '@/lib/supabase-server'

export const maxDuration = 30

// Simple username/password login for clients
// Hype10 team uses Google OAuth (handled by Supabase Auth)
export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { username, password } = await req.json()

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password required' }, { status: 400 })
    }

    // Check the client_users table
    const { data: user, error } = await supabase
      .from('client_users')
      .select('*')
      .eq('username', username)
      .eq('password_hash', password) // TODO: Use proper bcrypt hashing
      .single()

    if (error || !user) {
      return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 })
    }

    // Return user info (no JWT for now, just session info)
    return NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role, // 'admin' | 'team' | 'client'
        email: user.email,
        brand_id: user.brand_id,
      }
    })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
