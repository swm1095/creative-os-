import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient as createClient } from '@/lib/supabase-server'

export const maxDuration = 300 // 5 minutes

// Vercel cron job - scans all brands based on their cadence
export async function GET(req: NextRequest) {
  // Verify cron secret if configured
  const authHeader = req.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createClient()
    const now = new Date()

    // Get all brands with research completed
    const { data: brands } = await supabase
      .from('brands')
      .select('id, name, scan_cadence, last_scanned_at, research_completed')
      .eq('research_completed', true)

    if (!brands) return NextResponse.json({ scanned: 0 })

    const scannedBrands: string[] = []

    for (const brand of brands) {
      // Skip manual brands
      if (!brand.scan_cadence || brand.scan_cadence === 'manual') continue

      const lastScanned = brand.last_scanned_at ? new Date(brand.last_scanned_at) : null
      const hoursSinceLastScan = lastScanned
        ? (now.getTime() - lastScanned.getTime()) / (1000 * 60 * 60)
        : Infinity

      // Check if scan is due
      const scanDue =
        (brand.scan_cadence === 'daily' && hoursSinceLastScan >= 23) ||
        (brand.scan_cadence === 'weekly' && hoursSinceLastScan >= 167)

      if (!scanDue) continue

      // Trigger scan via the listening endpoint
      try {
        const listeningUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://creative-os-topaz.vercel.app'}/api/listening`
        await fetch(listeningUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ brandId: brand.id }),
        })
        scannedBrands.push(brand.name)
      } catch (e) {
        console.error(`Failed to scan ${brand.name}:`, e)
      }
    }

    return NextResponse.json({
      scanned: scannedBrands.length,
      brands: scannedBrands,
      timestamp: now.toISOString(),
    })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
