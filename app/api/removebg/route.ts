import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient as createClient } from '@/lib/supabase-server'

// ──────────────────────────────────────────────────────────────────────────
// POST /api/removebg
//
// Removes the background from a product image using the Remove.bg API.
// Runs automatically in the pipeline before Creatomate templating.
//
// Body: { imageUrl: string } OR multipart form with `image` file
// Returns: { resultUrl: string, creditBalance: number }
// ──────────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()

    const apiKey = process.env.REMOVEBG_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'REMOVEBG_API_KEY not configured' }, { status: 500 })

    const contentType = req.headers.get('content-type') || ''
    let formData: FormData

    if (contentType.includes('application/json')) {
      // URL-based removal (most common in pipeline)
      const { imageUrl } = await req.json()
      if (!imageUrl) return NextResponse.json({ error: 'imageUrl required' }, { status: 400 })

      formData = new FormData()
      formData.append('image_url', imageUrl)
      formData.append('size', 'auto')
      formData.append('type', 'auto')        // auto-detect: product, person, car, etc.
      formData.append('format', 'png')       // always PNG for transparency
    } else {
      // File upload — pass through
      formData = await req.formData()
      formData.append('size', 'auto')
      formData.append('type', 'auto')
      formData.append('format', 'png')
    }

    const res = await fetch('https://api.remove.bg/v1.0/removebg', {
      method: 'POST',
      headers: {
        'X-Api-Key': apiKey,
      },
      body: formData,
    })

    if (!res.ok) {
      const errJson = await res.json().catch(() => null)
      const errText = errJson?.errors?.[0]?.title || `Remove.bg error ${res.status}`
      return NextResponse.json({ error: errText }, { status: res.status })
    }

    // Remove.bg returns the PNG directly in the response body
    const resultBuffer = await res.arrayBuffer()
    const creditBalance = res.headers.get('X-Credits-Charged')

    // Upload the transparent PNG to Supabase Storage
    const fileName = `removebg/demo/${Date.now()}.png`
    const { error: uploadErr } = await supabase.storage
      .from('brand-assets')
      .upload(fileName, resultBuffer, { contentType: 'image/png', upsert: false })

    if (uploadErr) {
      // If upload fails, return base64 as fallback
      const base64 = Buffer.from(resultBuffer).toString('base64')
      return NextResponse.json({
        resultUrl: `data:image/png;base64,${base64}`,
        creditBalance: Number(creditBalance) || 0,
        stored: false,
      })
    }

    const { data: urlData } = supabase.storage.from('brand-assets').getPublicUrl(fileName)
    return NextResponse.json({
      resultUrl: urlData.publicUrl,
      creditBalance: Number(creditBalance) || 0,
      stored: true,
    })
  } catch (e: any) {
    console.error('Remove.bg error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
