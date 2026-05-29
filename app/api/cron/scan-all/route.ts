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

    // Scan every brand with research completed (daily at 5 AM ET)
    for (const brand of brands) {
      try {
        console.log(`Scanning ${brand.name}...`)
        const listeningUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://creative-os-topaz.vercel.app'}/api/listening`
        // Fire and don't wait - each scan runs independently
        fetch(listeningUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ brandId: brand.id }),
        }).catch(e => console.error(`Scan ${brand.name} failed:`, e))
        scannedBrands.push(brand.name)
        // Stagger by 5 seconds to avoid rate limits
        await new Promise(r => setTimeout(r, 5000))
      } catch (e) {
        console.error(`Failed to start scan for ${brand.name}:`, e)
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
