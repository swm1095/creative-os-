import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key || url === 'https://placeholder.supabase.co') {
    // Return a dummy client that won't crash but won't work
    // This only happens during local builds without env vars
    return createBrowserClient(
      'https://fpwsjhawqcstqsujgqjg.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZwd3NqaGF3cWNzdHFzdWpncWpnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyMTA1NzgsImV4cCI6MjA5MTc4NjU3OH0.v7RJbPNSsMjtCw2WfbaOevBMwIWPneLgVoh9cH_dYq4'
    )
  }

  return createBrowserClient(url, key)
}
