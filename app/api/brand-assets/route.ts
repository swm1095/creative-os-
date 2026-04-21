import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient as createClient } from '@/lib/supabase-server'

export const maxDuration = 30

// GET - list all assets for a brand
export async function GET(req: NextRequest) {
  try {
    const supabase = createClient()
    const brandId = req.nextUrl.searchParams.get('brandId')

    if (!brandId) {
      return NextResponse.json({ error: 'brandId required' }, { status: 400 })
    }

    const { data: files, error } = await supabase.storage
      .from('brand-assets')
      .list(`brands/${brandId}/assets`, { limit: 100, sortBy: { column: 'created_at', order: 'desc' } })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const assets = (files || [])
      .filter(f => !f.name.startsWith('.'))
      .map(f => {
        const { data: urlData } = supabase.storage.from('brand-assets').getPublicUrl(`brands/${brandId}/assets/${f.name}`)
        return {
          name: f.name,
          url: urlData.publicUrl,
          size: f.metadata?.size || 0,
          created: f.created_at,
        }
      })

    return NextResponse.json({ assets })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}

// POST - upload assets for a brand
export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const formData = await req.formData()
    const brandId = formData.get('brandId') as string

    if (!brandId || brandId === 'demo') {
      // Auto-create brand if needed
      const { data: existing } = await supabase.from('brands').select('id').eq('name', 'Fulton').limit(1).single()
      const finalBrandId = existing?.id
      if (!finalBrandId) {
        const { data: newBrand } = await supabase.from('brands').insert({ name: 'Fulton', color: '#1B4332' }).select('id').single()
        if (!newBrand) return NextResponse.json({ error: 'Could not create brand' }, { status: 500 })
      }
    }

    const files = formData.getAll('files') as File[]
    if (!files.length) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 })
    }

    const uploaded = []
    for (const file of files) {
      const ext = file.name.split('.').pop() || 'png'
      const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`
      const path = `brands/${brandId}/assets/${safeName}`
      const bytes = await file.arrayBuffer()

      const { error } = await supabase.storage
        .from('brand-assets')
        .upload(path, bytes, { contentType: file.type, upsert: false })

      if (!error) {
        const { data: urlData } = supabase.storage.from('brand-assets').getPublicUrl(path)
        uploaded.push({
          name: file.name,
          storedName: safeName,
          url: urlData.publicUrl,
          size: file.size,
        })
      }
    }

    return NextResponse.json({ uploaded, count: uploaded.length })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}

// DELETE - remove an asset
export async function DELETE(req: NextRequest) {
  try {
    const supabase = createClient()
    const { brandId, fileName } = await req.json()

    if (!brandId || !fileName) {
      return NextResponse.json({ error: 'brandId and fileName required' }, { status: 400 })
    }

    const path = `brands/${brandId}/assets/${fileName}`
    const { error } = await supabase.storage.from('brand-assets').remove([path])

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
