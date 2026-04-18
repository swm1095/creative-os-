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

  // Send email notification if any service is down or if this is the 6 AM check
  const resendKey = process.env.RESEND_API_KEY
  if (resendKey && (downServices.length > 0 || req.nextUrl.searchParams.get('morning') === 'true')) {
    try {
      // Get admin emails
      const { createClient } = await import('@supabase/supabase-js')
      const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '')
      const { data: admins } = await supabase.from('admin_emails').select('email').eq('receives_alerts', true)
      const recipients = (admins || []).map(a => a.email).filter(Boolean)

      if (recipients.length > 0) {
        const statusEmoji = allHealthy ? '✅' : '🚨'
        const subject = allHealthy
          ? `${statusEmoji} HyperCreate Morning Check - All Systems Healthy`
          : `${statusEmoji} HyperCreate Alert - ${downServices.length} Service${downServices.length > 1 ? 's' : ''} Down`

        const html = `
          <div style="font-family: Inter, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
            <div style="background: #080e1a; color: #fff; padding: 24px; border-radius: 12px;">
              <h2 style="margin: 0 0 16px; font-size: 18px;">${statusEmoji} HyperCreate Health Check</h2>
              <p style="color: #8890b0; font-size: 13px; margin: 0 0 20px;">${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} ET</p>
              ${results.map(r => `
                <div style="display: flex; align-items: center; padding: 10px 0; border-top: 1px solid #1e2d44;">
                  <span style="font-size: 16px; margin-right: 10px;">${r.status === 'healthy' ? '✅' : r.status === 'degraded' ? '⚠️' : '❌'}</span>
                  <span style="flex: 1; font-size: 14px; font-weight: 600;">${r.service}</span>
                  <span style="font-size: 12px; color: ${r.status === 'healthy' ? '#34d399' : '#f87171'};">${r.status}${r.responseTime ? ` (${r.responseTime}ms)` : ''}</span>
                </div>
              `).join('')}
              ${downServices.length > 0 ? `<p style="color: #f87171; font-size: 13px; margin-top: 16px;">Action required: ${downServices.map(s => s.service).join(', ')} need attention.</p>` : ''}
            </div>
            <p style="text-align: center; color: #6c7086; font-size: 11px; margin-top: 16px;">HyperCreate by Hype10</p>
          </div>
        `

        for (const to of recipients) {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ from: 'HyperCreate <onboarding@resend.dev>', to, subject, html }),
          })
        }
        console.log(`Health check email sent to ${recipients.length} admins`)
      }
    } catch (emailErr) {
      console.error('Failed to send health check email:', emailErr)
    }
  }

  return NextResponse.json({
    status: allHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    results,
    downServices: downServices.map(s => s.service),
  })
}
