import { NextRequest, NextResponse } from 'next/server'
import { SheetsImportResult, PersonaInput } from '@/lib/types'

// Expected column names (case-insensitive, flexible matching)
const PERSONA_COLS = ['persona', 'name', 'audience', 'target']
const ANGLE_COLS   = ['angle', 'approach', 'strategy', 'direction', 'creative angle']
const HOOK_COLS    = ['hook', 'headline', 'copy', 'message', 'tagline', 'cta']

function findColumn(headers: string[], candidates: string[]): number {
  return headers.findIndex(h =>
    candidates.some(c => h.toLowerCase().trim().includes(c))
  )
}

function parseCSV(text: string): string[][] {
  const lines = text.trim().split(/\r?\n/)
  return lines.map(line => {
    const cells: string[] = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        inQuotes = !inQuotes
      } else if (ch === ',' && !inQuotes) {
        cells.push(current.trim())
        current = ''
      } else {
        current += ch
      }
    }
    cells.push(current.trim())
    return cells
  })
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json()
    if (!url?.trim()) return NextResponse.json({ error: 'URL required' }, { status: 400 })

    // Validate it's a Google Sheets URL
    if (!url.includes('docs.google.com') && !url.includes('spreadsheets')) {
      return NextResponse.json({
        error: 'Please provide a Google Sheets published CSV URL. Go to File → Share → Publish to web → CSV.'
      }, { status: 400 })
    }

    // Ensure it has CSV output format
    let csvUrl = url
    if (!csvUrl.includes('output=csv')) {
      csvUrl = csvUrl.includes('?') ? csvUrl + '&output=csv' : csvUrl + '?output=csv'
    }

    const res = await fetch(csvUrl, {
      headers: { 'Accept': 'text/csv,text/plain,*/*' },
      next: { revalidate: 60 },
    })

    if (!res.ok) {
      return NextResponse.json({
        error: `Could not fetch sheet (${res.status}). Make sure it's published: File → Share → Publish to web → CSV.`
      }, { status: 400 })
    }

    const text = await res.text()
    if (!text.trim()) return NextResponse.json({ error: 'Sheet appears to be empty.' }, { status: 400 })

    const rows = parseCSV(text)
    if (rows.length < 2) return NextResponse.json({ error: 'Sheet has no data rows.' }, { status: 400 })

    const headers = rows[0].map(h => h.toLowerCase())
    const dataRows = rows.slice(1)

    const personaCol = findColumn(headers, PERSONA_COLS)
    const angleCol   = findColumn(headers, ANGLE_COLS)
    const hookCol    = findColumn(headers, HOOK_COLS)

    if (personaCol === -1 && angleCol === -1) {
      return NextResponse.json({
        error: `Could not find persona or angle columns. Found columns: ${headers.join(', ')}. Expected columns like: persona, angle, hook.`,
        foundHeaders: headers,
      }, { status: 400 })
    }

    const personas: PersonaInput[] = dataRows
      .filter(row => row.some(cell => cell.trim()))
      .map(row => ({
        name:  personaCol !== -1 ? row[personaCol] || '' : 'Persona',
        angle: angleCol   !== -1 ? row[angleCol]   || '' : row[1] || '',
        hook:  hookCol    !== -1 ? row[hookCol]     || '' : undefined,
      }))
      .filter(p => p.name || p.angle)

    const result: SheetsImportResult = {
      personas,
      source: csvUrl,
      rowCount: dataRows.length,
    }

    return NextResponse.json(result)
  } catch (e: any) {
    console.error('Sheets import error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
