import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient as createClient } from '@/lib/supabase-server'

export const maxDuration = 30

// GET usage stats with time window filtering
export async function GET(req: NextRequest) {
  try {
    const supabase = createClient()
    const window = req.nextUrl.searchParams.get('window') || '7d'

    // Calculate date range
    const now = new Date()
    const windowMap: Record<string, number> = {
      '24h': 1, '7d': 7, '30d': 30, '90d': 90,
    }
    const days = windowMap[window] || 7
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)

    // Get usage logs
    const { data: logs } = await supabase
      .from('usage_logs')
      .select('*')
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false })

    if (!logs) return NextResponse.json({ stats: {}, logs: [] })

    // Aggregate by service
    const byService: Record<string, { count: number; tokensIn: number; tokensOut: number; cost: number }> = {}
    const byAction: Record<string, { count: number; cost: number }> = {}
    const byUser: Record<string, { count: number; cost: number; name: string }> = {}
    const byDay: Record<string, { count: number; cost: number }> = {}

    for (const log of logs) {
      // By service
      if (!byService[log.service]) byService[log.service] = { count: 0, tokensIn: 0, tokensOut: 0, cost: 0 }
      byService[log.service].count++
      byService[log.service].tokensIn += log.tokens_in || 0
      byService[log.service].tokensOut += log.tokens_out || 0
      byService[log.service].cost += parseFloat(log.estimated_cost) || 0

      // By action
      if (!byAction[log.action]) byAction[log.action] = { count: 0, cost: 0 }
      byAction[log.action].count++
      byAction[log.action].cost += parseFloat(log.estimated_cost) || 0

      // By user
      const email = log.user_email || 'unknown'
      if (!byUser[email]) byUser[email] = { count: 0, cost: 0, name: log.user_name || email }
      byUser[email].count++
      byUser[email].cost += parseFloat(log.estimated_cost) || 0

      // By day
      const day = new Date(log.created_at).toISOString().split('T')[0]
      if (!byDay[day]) byDay[day] = { count: 0, cost: 0 }
      byDay[day].count++
      byDay[day].cost += parseFloat(log.estimated_cost) || 0
    }

    const totalCost = Object.values(byService).reduce((sum, s) => sum + s.cost, 0)
    const totalRequests = logs.length

    return NextResponse.json({
      window,
      totalRequests,
      totalCost: Math.round(totalCost * 100) / 100,
      byService,
      byAction,
      byUser,
      byDay,
    })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
