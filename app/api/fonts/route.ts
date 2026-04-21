import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

let cachedFonts: string[] | null = null

// GET - list Google Fonts
export async function GET() {
  try {
    if (cachedFonts) return NextResponse.json({ fonts: cachedFonts })

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) return NextResponse.json({ fonts: [] })

    const res = await fetch(`https://www.googleapis.com/webfonts/v1/webfonts?key=${apiKey}&sort=popularity`)
    if (!res.ok) {
      console.log(`Google Fonts API error: ${res.status}`)
      return NextResponse.json({ fonts: [] })
    }

    const data = await res.json()
    const fonts = (data.items || []).map((f: { family: string }) => f.family)
    cachedFonts = fonts

    return NextResponse.json({ fonts })
  } catch {
    return NextResponse.json({ fonts: [] })
  }
}
