import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60

interface HealthResult {
  service: string
  status: 'healthy' | 'degraded' | 'down'
  responseTime?: number
  error?: string
}

async function checkService(name: string, testFn: () => Promise<boolean>): Promise<HealthResult> {
  const start = Date.now()
  try {
    const ok = await testFn()
    return { service: name, status: ok ? 'healthy' : 'degraded', responseTime: Date.now() - start }
  } catch (e: unknown) {
    return { service: name, status: 'down', responseTime: Date.now() - start, error: e instanceof Error ? e.message : String(e) }
  }
}

export async function GET(req: NextRequest) {
  // Verify cron secret if configured
  const authHeader = req.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: HealthResult[] = await Promise.all([
    // Supabase
    checkService('Supabase', async () => {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY
      if (!url || !key) return false
      const res = await fetch(`${url}/rest/v1/brands?select=id&limit=1`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(5000),
      })
      return res.ok
    }),

    // Anthropic
    checkService('Claude (Anthropic)', async () => {
      if (!process.env.ANTHROPIC_API_KEY) return false
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'content-type': 'application/json',
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 5, messages: [{ role: 'user', content: 'hi' }] }),
        signal: AbortSignal.timeout(10000),
      })
      return res.ok
    }),

    // Gemini
    checkService('Gemini', async () => {
      if (!process.env.GEMINI_API_KEY) return false
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`,
        { signal: AbortSignal.timeout(5000) }
      )
      return res.ok
    }),

    // Apify
    checkService('Apify', async () => {
      if (!process.env.APIFY_API_KEY) return false
      const res = await fetch(
        `https://api.apify.com/v2/users/me?token=${process.env.APIFY_API_KEY}`,
        { signal: AbortSignal.timeout(5000) }
      )
      return res.ok
    }),

    // Remove.bg
    checkService('Remove.bg', async () => {
      return !!process.env.REMOVEBG_API_KEY
    }),
  ])

  const allHealthy = results.every(r => r.status === 'healthy')
  const downServices = results.filter(r => r.status === 'down')

  // If any service is down, send email notification
  if (downServices.length > 0) {
    console.error('=== HEALTH CHECK FAILURES ===')
    downServices.forEach(s => console.error(`${s.service}: ${s.error}`))
    // TODO: Send email to sam@hype10agency.com via a mail service
    // For now, log to Vercel and the status is available via API
  }

  return NextResponse.json({
    status: allHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    results,
    downServices: downServices.map(s => s.service),
  })
}
