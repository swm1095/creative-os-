import { NextResponse } from 'next/server'
import { isApifyEnabled } from '@/lib/signal-sources'

export async function GET() {
  return NextResponse.json({
    apifyKeyPresent: !!process.env.APIFY_API_KEY,
    apifyKeyPrefix: process.env.APIFY_API_KEY?.slice(0, 15) || 'NOT SET',
    isEnabled: isApifyEnabled(),
  })
}
