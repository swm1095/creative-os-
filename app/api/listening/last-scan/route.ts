import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient as createClient } from '@/lib/supabase-server'

export const maxDuration = 30

// Load the last scan results for a brand (from brand_signals + last cached insights on brand record)
export async function GET(req: NextRequest) {
  try {
    const supabase = createClient()
    const brandId = req.nextUrl.searchParams.get('brandId')
    if (!brandId) return NextResponse.json({ error: 'brandId required' }, { status: 400 })

    const { data: brand } = await supabase.from('brands').select('last_scanned_at, last_scan_insights, last_scan_trends, last_scan_sources').eq('id', brandId).single()

    const { data: signals } = await supabase
      .from('brand_signals')
      .select('*')
      .eq('brand_id', brandId)
      .order('last_seen', { ascending: false })
      .limit(50)

    return NextResponse.json({
      scannedAt: brand?.last_scanned_at,
      insights: brand?.last_scan_insights || [],
      trends: brand?.last_scan_trends || [],
      sourceBreakdown: brand?.last_scan_sources || {},
      signals: (signals || []).map(s => ({
        id: s.signal_id,
        source: s.source,
        title: s.title,
        content: s.content,
        url: s.url,
        score: s.score,
        date: s.last_seen,
      })),
    })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
