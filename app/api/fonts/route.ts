import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Popular Google Fonts fallback (if API fails)
const POPULAR_FONTS = [
  'Inter', 'Roboto', 'Open Sans', 'Montserrat', 'Lato', 'Poppins', 'Oswald',
  'Raleway', 'Nunito', 'Ubuntu', 'Playfair Display', 'Merriweather', 'PT Sans',
  'Rubik', 'Work Sans', 'Archivo', 'Archivo Black', 'Archivo Narrow',
  'Barlow', 'Barlow Condensed', 'DM Sans', 'DM Serif Display', 'Manrope',
  'Plus Jakarta Sans', 'Space Grotesk', 'Sora', 'Outfit', 'Lexend',
  'Bebas Neue', 'Anton', 'Impact', 'League Spartan', 'Fjalla One',
  'Kanit', 'Mukta', 'Titillium Web', 'Quicksand', 'Cabin',
  'Source Sans 3', 'Source Serif 4', 'Noto Sans', 'Noto Serif',
  'IBM Plex Sans', 'IBM Plex Serif', 'IBM Plex Mono',
  'Bitter', 'Libre Baskerville', 'Crimson Text', 'EB Garamond', 'Cormorant Garamond',
  'Josefin Sans', 'Jost', 'Karla', 'Mulish', 'Exo 2',
  'Heebo', 'Overpass', 'Urbanist', 'Red Hat Display', 'Albert Sans',
  'Figtree', 'Geist', 'Bricolage Grotesque', 'Instrument Sans',
  'Clash Display', 'General Sans', 'Satoshi', 'Cabinet Grotesk',
  'Neue Montreal', 'Switzer', 'Zodiak', 'Erode', 'Synonym',
  'Helvetica', 'Arial', 'Georgia', 'Times New Roman', 'Verdana',
  'Futura', 'Avenir', 'Proxima Nova', 'Gotham', 'Brandon Grotesque',
  'Garamond', 'Bodoni', 'Didot', 'Baskerville', 'Century Gothic',
  'Franklin Gothic', 'Trade Gothic', 'Univers', 'Frutiger', 'Myriad Pro',
]

let cachedFonts: string[] | null = null

// GET - list Google Fonts
export async function GET() {
  try {
    if (cachedFonts) return NextResponse.json({ fonts: cachedFonts })

    const apiKey = process.env.GEMINI_API_KEY
    if (apiKey) {
      try {
        const res = await fetch(`https://www.googleapis.com/webfonts/v1/webfonts?key=${apiKey}&sort=popularity`)
        if (res.ok) {
          const data = await res.json()
          const fonts = (data.items || []).map((f: { family: string }) => f.family)
          if (fonts.length > 0) {
            cachedFonts = fonts
            return NextResponse.json({ fonts })
          }
        } else {
          const err = await res.text()
          console.log(`Google Fonts API failed (${res.status}): ${err.slice(0, 200)}`)
        }
      } catch (e) {
        console.log('Google Fonts API error:', e)
      }
    }

    // Fallback to curated list
    cachedFonts = POPULAR_FONTS
    return NextResponse.json({ fonts: POPULAR_FONTS })
  } catch {
    return NextResponse.json({ fonts: POPULAR_FONTS })
  }
}
