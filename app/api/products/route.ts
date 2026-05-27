import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient as createClient } from '@/lib/supabase-server'

export const maxDuration = 60

interface Product {
  id: string
  name: string
  url: string
  price: string
  description: string
  features: string[]
  usps: string[]
  targetUseCase: string
  ingredients?: string[]
  category?: string
  createdAt: string
}

// GET - list products for a brand
export async function GET(req: NextRequest) {
  try {
    const supabase = createClient()
    const brandId = req.nextUrl.searchParams.get('brandId')
    if (!brandId) return NextResponse.json({ error: 'brandId required' }, { status: 400 })

    const { data: brand } = await supabase.from('brands').select('products').eq('id', brandId).single()
    return NextResponse.json({ products: brand?.products || [] })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}

// POST - add a product URL, auto-scrape and build profile
export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { brandId, url } = await req.json()
    if (!brandId || !url) return NextResponse.json({ error: 'brandId and url required' }, { status: 400 })

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })

    // Scrape the product page with Claude
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'content-type': 'application/json', 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1500,
        messages: [{
          role: 'user',
          content: `Analyze this product page URL and create a complete product profile. URL: ${url}

Based on what you know about this product (from the URL structure, brand name, and common product knowledge), create a detailed profile.

Return JSON only:
{
  "name": "Product name",
  "price": "Price if known",
  "description": "2-3 sentence product description",
  "features": ["key feature 1", "key feature 2", "key feature 3", "key feature 4", "key feature 5"],
  "usps": ["unique selling point 1", "unique selling point 2", "unique selling point 3"],
  "targetUseCase": "Who this product is for and when they use it",
  "ingredients": ["ingredient 1", "ingredient 2"] or null if not applicable,
  "category": "Product category (e.g. supplements, skincare, footwear)"
}

Be specific based on the product URL. No markdown, only JSON.`,
        }],
      }),
    })

    if (!res.ok) throw new Error(`Claude error: ${res.status}`)
    const data = await res.json()
    const text = data.content?.find((b: { type: string }) => b.type === 'text')?.text || ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('Could not parse product profile')

    const profile = JSON.parse(jsonMatch[0])
    const product: Product = {
      id: `prod-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: profile.name || 'Unknown Product',
      url,
      price: profile.price || '',
      description: profile.description || '',
      features: profile.features || [],
      usps: profile.usps || [],
      targetUseCase: profile.targetUseCase || '',
      ingredients: profile.ingredients || undefined,
      category: profile.category || '',
      createdAt: new Date().toISOString(),
    }

    // Add to brand's products array
    const { data: brand } = await supabase.from('brands').select('products').eq('id', brandId).single()
    const existing = (brand?.products || []) as Product[]
    const updated = [...existing, product]

    await supabase.from('brands').update({ products: updated }).eq('id', brandId)

    return NextResponse.json({ product })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}

// DELETE - remove a product
export async function DELETE(req: NextRequest) {
  try {
    const supabase = createClient()
    const { brandId, productId } = await req.json()
    if (!brandId || !productId) return NextResponse.json({ error: 'brandId and productId required' }, { status: 400 })

    const { data: brand } = await supabase.from('brands').select('products').eq('id', brandId).single()
    const existing = (brand?.products || []) as Product[]
    const updated = existing.filter(p => p.id !== productId)

    await supabase.from('brands').update({ products: updated }).eq('id', brandId)
    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
