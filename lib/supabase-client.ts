import { createClient as createSupabaseClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://fpwsjhawqcstqsujgqjg.supabase.co'
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZwd3NqaGF3cWNzdHFzdWpncWpnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyMTA1NzgsImV4cCI6MjA5MTc4NjU3OH0.v7RJbPNSsMjtCw2WfbaOevBMwIWPneLgVoh9cH_dYq4'

export function createClient() {
  return createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY)
}
