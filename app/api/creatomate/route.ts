import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

// ──────────────────────────────────────────────────────────────────────────
// POST /api/creatomate
//
// Renders final ad creatives using Creatomate's template engine.
// Takes a generated/processed image and renders it into formatted ad outputs
// at 1×1 (1080×1080), 4×5 (1080×1350), and 9×16 (1080×1920).
//
// Body:
//   imageUrl    — the source image (from Kling/Ideogram/Stability, bg removed)
//   templateId  — Creatomate template ID (set up in your Creatomate dashboard)
//   modifications — key/value pairs to fill the template (headline, logo, etc.)
//   formats     — array of '1x1' | '4x5' | '9x16' to render
//
// Returns: { renders: { format, url, id }[] }
// ──────────────────────────────────────────────────────────────────────────

// Default template IDs — replace with your actual Creatomate template IDs
const DEFAULT_TEMPLATES: Record<string, string> = {
  '1x1':  process.env.CREATOMATE_TEMPLATE_1x1  || '',
  '4x5':  process.env.CREATOMATE_TEMPLATE_4x5  || '',
  '9x16': process.env.CREATOMATE_TEMPLATE_9x16 || '',
}

interface RenderRequest {
  imageUrl: string
  logoUrl?: string
  headline?: string
  subheadline?: string
  cta?: string
  brandColor?: string
  templateIds?: Record<string, string>  // override default templates
  formats?: string[]
  modifications?: Record<string, unknown>  // custom template vars
}

interface CreatomateRender {
  id: string
  status: string
  url?: string
  snapshot_url?: string
}

async function submitRender(
  apiKey: string,
  templateId: string,
  modifications: Record<string, unknown>
): Promise<string> {
  const res = await fetch('https://api.creatomate.com/v1/renders', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      template_id: templateId,
      modifications,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Creatomate render failed: ${err.slice(0, 200)}`)
  }

  const renders: CreatomateRender[] = await res.json()
  const render = renders[0]
  if (!render?.id) throw new Error('No render ID returned from Creatomate')
  return render.id
}

async function pollRender(apiKey: string, renderId: string): Promise<string> {
  const maxAttempts = 30  // 150 seconds max
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 5000))

    const res = await fetch(`https://api.creatomate.com/v1/renders/${renderId}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    })

    if (!res.ok) continue

    const render: CreatomateRender = await res.json()
    if (render.status === 'succeeded' && render.url) return render.url
    if (render.status === 'failed') throw new Error(`Creatomate render ${renderId} failed`)
    // pending | planned | rendering → keep polling
  }
  throw new Error('Creatomate render timed out')
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const apiKey = process.env.CREATOMATE_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'CREATOMATE_API_KEY not configured' }, { status: 500 })

    const body: RenderRequest = await req.json()
    const {
      imageUrl, logoUrl, headline, subheadline, cta, brandColor,
      templateIds, formats = ['1x1', '4x5', '9x16'], modifications = {}
    } = body

    if (!imageUrl) return NextResponse.json({ error: 'imageUrl required' }, { status: 400 })

    const templates = { ...DEFAULT_TEMPLATES, ...templateIds }
    const renders: { format: string; url: string; id: string }[] = []
    const errors: string[] = []

    // Build the modifications object for the Creatomate template
    // These variable names must match your template's element names in Creatomate
    const templateMods: Record<string, unknown> = {
      ...modifications,
      'Background-Image.source': imageUrl,
    }
    if (logoUrl)       templateMods['Logo.source']       = logoUrl
    if (headline)      templateMods['Headline.text']     = headline
    if (subheadline)   templateMods['Subheadline.text']  = subheadline
    if (cta)           templateMods['CTA.text']          = cta
    if (brandColor)    templateMods['Accent.fill_color'] = brandColor

    // Submit all format renders in parallel
    const renderJobs = await Promise.allSettled(
      formats.map(async (format) => {
        const templateId = templates[format]
        if (!templateId) {
          throw new Error(`No template ID configured for format ${format}. Set CREATOMATE_TEMPLATE_${format.replace('x','x').toUpperCase()} or pass templateIds.`)
        }
        const renderId = await submitRender(apiKey, templateId, templateMods)
        return { format, renderId }
      })
    )

    // Poll all renders
    await Promise.allSettled(
      renderJobs.map(async (job) => {
        if (job.status === 'rejected') {
          errors.push(job.reason?.message || 'Render submission failed')
          return
        }
        const { format, renderId } = job.value
        try {
          const url = await pollRender(apiKey, renderId)
          renders.push({ format, url, id: renderId })
        } catch (e: any) {
          errors.push(`${format}: ${e.message}`)
        }
      })
    )

    return NextResponse.json({
      renders,
      errors: errors.length ? errors : undefined,
    })
  } catch (e: any) {
    console.error('Creatomate error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// GET /api/creatomate?renderId=xxx — check render status
export async function GET(req: NextRequest) {
  const renderId = req.nextUrl.searchParams.get('renderId')
  if (!renderId) return NextResponse.json({ error: 'renderId required' }, { status: 400 })

  const apiKey = process.env.CREATOMATE_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'CREATOMATE_API_KEY not configured' }, { status: 500 })

  const res = await fetch(`https://api.creatomate.com/v1/renders/${renderId}`, {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  })

  if (!res.ok) return NextResponse.json({ error: `Render not found` }, { status: 404 })
  return NextResponse.json(await res.json())
}
