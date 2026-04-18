import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient as createClient } from '@/lib/supabase-server'

export const maxDuration = 120

// GET - list reference images OR get a signed upload URL for large files
export async function GET(req: NextRequest) {
  try {
    const supabase = createClient()
    const action = req.nextUrl.searchParams.get('action')

    // Signed URL for direct-to-Supabase uploads (videos, large files)
    if (action === 'signedUrl') {
      const brandId = req.nextUrl.searchParams.get('brandId') || 'shared'
      const fileName = req.nextUrl.searchParams.get('fileName') || 'file'
      const contentType = req.nextUrl.searchParams.get('contentType') || 'video/mp4'

      const ext = fileName.split('.').pop() || 'mp4'
      const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`
      const path = `reference-images/${brandId}/${safeName}`

      const { data, error } = await supabase.storage
        .from('brand-assets')
        .createSignedUploadUrl(path)

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      const { data: urlData } = supabase.storage.from('brand-assets').getPublicUrl(path)

      return NextResponse.json({
        signedUrl: data.signedUrl,
        token: data.token,
        path,
        publicUrl: urlData.publicUrl,
        contentType,
      })
    }

    // Default: list files
    const brandId = req.nextUrl.searchParams.get('brandId')

    const { data: files, error } = await supabase.storage
      .from('brand-assets')
      .list(`reference-images/${brandId || 'shared'}`, { limit: 100, sortBy: { column: 'created_at', order: 'desc' } })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const images = (files || [])
      .filter(f => !f.name.startsWith('.'))
      .map(f => {
        const path = `reference-images/${brandId || 'shared'}/${f.name}`
        const { data: urlData } = supabase.storage.from('brand-assets').getPublicUrl(path)
        return {
          name: f.name,
          url: urlData.publicUrl,
          size: f.metadata?.size || 0,
          created: f.created_at,
        }
      })

    return NextResponse.json({ images })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}

// POST - upload reference images (small files only, <4.5MB)
// For larger files (videos), use GET ?action=signedUrl then upload directly to Supabase
export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const formData = await req.formData()
    const brandId = formData.get('brandId') as string || 'shared'
    const files = formData.getAll('files') as File[]

    if (!files.length) return NextResponse.json({ error: 'No files provided' }, { status: 400 })

    const uploaded = []
    for (const file of files) {
      const ext = file.name.split('.').pop() || 'png'
      const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`
      const path = `reference-images/${brandId}/${safeName}`
      const bytes = await file.arrayBuffer()

      const { error } = await supabase.storage
        .from('brand-assets')
        .upload(path, bytes, { contentType: file.type, upsert: false })

      if (!error) {
        const { data: urlData } = supabase.storage.from('brand-assets').getPublicUrl(path)
        uploaded.push({ name: file.name, storedName: safeName, url: urlData.publicUrl })
      } else {
        console.error(`Upload failed for ${file.name}:`, error.message)
      }
    }

    return NextResponse.json({ uploaded, count: uploaded.length })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
