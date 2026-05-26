import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient as createClient } from '@/lib/supabase-server'

export const maxDuration = 60

// GET - get stored reviews for a brand
export async function GET(req: NextRequest) {
  try {
    const supabase = createClient()
    const brandId = req.nextUrl.searchParams.get('brandId')
    if (!brandId) return NextResponse.json({ error: 'brandId required' }, { status: 400 })

    const { data: brand } = await supabase.from('brands').select('customer_reviews').eq('id', brandId).single()
    return NextResponse.json({ reviews: brand?.customer_reviews || [] })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}

// POST - upload and parse reviews from CSV/text
export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const formData = await req.formData()
    const brandId = formData.get('brandId') as string
    const file = formData.get('file') as File | null
    const pastedText = formData.get('text') as string | null

    if (!brandId) return NextResponse.json({ error: 'brandId required' }, { status: 400 })
    if (!file && !pastedText) return NextResponse.json({ error: 'file or text required' }, { status: 400 })

    let reviews: { text: string; rating?: number; source?: string; date?: string }[] = []

    if (file) {
      const text = await file.text()
      const fileName = file.name.toLowerCase()

      if (fileName.endsWith('.csv')) {
        // Parse CSV - handle common formats
        const lines = text.split('\n').filter(l => l.trim())
        const header = lines[0]?.toLowerCase() || ''

        // Detect column positions
        const cols = header.split(',').map(c => c.trim().replace(/"/g, ''))
        const textCol = cols.findIndex(c => ['review', 'text', 'body', 'content', 'comment', 'feedback', 'review_body', 'review_text'].includes(c))
        const ratingCol = cols.findIndex(c => ['rating', 'stars', 'score', 'star_rating'].includes(c))
        const sourceCol = cols.findIndex(c => ['source', 'platform', 'channel'].includes(c))
        const dateCol = cols.findIndex(c => ['date', 'created', 'timestamp', 'review_date'].includes(c))

        for (let i = 1; i < lines.length; i++) {
          // Simple CSV parsing (handles quoted fields)
          const fields = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g)?.map(f => f.replace(/^"|"$/g, '')) || lines[i].split(',')

          const reviewText = textCol >= 0 ? fields[textCol] : fields[0]
          if (!reviewText || reviewText.trim().length < 10) continue

          reviews.push({
            text: reviewText.trim(),
            rating: ratingCol >= 0 ? parseFloat(fields[ratingCol]) || undefined : undefined,
            source: sourceCol >= 0 ? fields[sourceCol]?.trim() : 'CSV Upload',
            date: dateCol >= 0 ? fields[dateCol]?.trim() : undefined,
          })
        }
      } else if (fileName.endsWith('.txt') || fileName.endsWith('.tsv')) {
        // Plain text - each line or paragraph is a review
        const chunks = text.includes('\n\n')
          ? text.split('\n\n').filter(c => c.trim().length > 10)
          : text.split('\n').filter(l => l.trim().length > 10)

        reviews = chunks.map(c => ({
          text: c.trim(),
          source: 'Text Upload',
        }))
      } else {
        // Try to parse as plain text
        const lines = text.split('\n').filter(l => l.trim().length > 10)
        reviews = lines.map(l => ({ text: l.trim(), source: 'File Upload' }))
      }
    } else if (pastedText) {
      // Pasted text - split by double newline or single newline
      const chunks = pastedText.includes('\n\n')
        ? pastedText.split('\n\n').filter(c => c.trim().length > 10)
        : pastedText.split('\n').filter(l => l.trim().length > 10)

      reviews = chunks.map(c => ({
        text: c.trim(),
        source: 'Manual Entry',
      }))
    }

    if (reviews.length === 0) {
      return NextResponse.json({ error: 'No reviews found in the uploaded file. Make sure reviews are at least 10 characters each.' }, { status: 400 })
    }

    // Get existing reviews and merge
    const { data: brand } = await supabase.from('brands').select('customer_reviews').eq('id', brandId).single()
    const existing = (brand?.customer_reviews || []) as typeof reviews
    const merged = [...existing, ...reviews]

    // Save to brand record
    await supabase.from('brands').update({ customer_reviews: merged }).eq('id', brandId)

    // Also analyze the reviews with Claude for key themes
    let analysis = null
    if (process.env.ANTHROPIC_API_KEY && reviews.length >= 3) {
      try {
        const sampleReviews = reviews.slice(0, 30).map(r => `${r.rating ? `[${r.rating}/5] ` : ''}${r.text}`).join('\n\n')
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'content-type': 'application/json', 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 1000,
            messages: [{ role: 'user', content: `Analyze these ${reviews.length} customer reviews and extract:\n\n${sampleReviews}\n\nReturn JSON only:\n{"top_phrases": ["exact customer phrases that could become ad copy"], "pain_points": ["what they complain about"], "praise": ["what they love"], "themes": ["recurring themes"], "sentiment": "overall sentiment summary"}` }],
          }),
        })
        if (res.ok) {
          const data = await res.json()
          const text = data.content?.find((b: { type: string }) => b.type === 'text')?.text || ''
          const jsonMatch = text.match(/\{[\s\S]*\}/)
          if (jsonMatch) analysis = JSON.parse(jsonMatch[0])
        }
      } catch { /* silent */ }
    }

    return NextResponse.json({ count: reviews.length, total: merged.length, analysis })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}

// DELETE - clear reviews for a brand
export async function DELETE(req: NextRequest) {
  try {
    const supabase = createClient()
    const { brandId } = await req.json()
    if (!brandId) return NextResponse.json({ error: 'brandId required' }, { status: 400 })

    await supabase.from('brands').update({ customer_reviews: [] }).eq('id', brandId)
    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
