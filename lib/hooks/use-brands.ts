'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase-client'
import { Brand } from '@/lib/types'

export function useBrands() {
  const [brands, setBrands] = useState<Brand[]>([])
  const [activeBrand, setActiveBrand] = useState<Brand | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const loadBrands = useCallback(async () => {
    const { data, error } = await supabase
      .from('brands')
      .select('*, creatives(count)')
      .order('created_at', { ascending: false })

    if (error) console.error('loadBrands error:', error)

    if (data) {
      const withCount = data.map((b: Brand & { creatives?: { count: number }[] }) => ({
        ...b,
        creative_count: b.creatives?.[0]?.count || 0,
      }))
      setBrands(withCount)
      // Auto-select first brand if none is active, or re-select current one with fresh data
      setActiveBrand(prev => {
        if (!prev && withCount.length > 0) return withCount[0]
        if (prev) {
          const updated = withCount.find((b: Brand) => b.id === prev.id)
          return updated || prev
        }
        return prev
      })
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadBrands() }, [loadBrands])

  const createBrand = useCallback(async (name: string, url?: string, color?: string): Promise<Brand | null> => {
    try {
      const { data, error } = await supabase.from('brands').insert({
        name, url: url || '', color: color || '#2B4EFF',
      }).select().single()

      if (error) {
        console.error('Supabase createBrand error:', error)
        return null
      }
      if (!data) {
        console.error('Supabase createBrand: no data returned')
        return null
      }
      const newBrand = { ...data, creative_count: 0 }
      setBrands(prev => [newBrand, ...prev])
      setActiveBrand(newBrand)
      return newBrand
    } catch (e) {
      console.error('createBrand exception:', e)
      return null
    }
  }, [])

  const updateBrand = useCallback((brandId: string, updates: Partial<Brand>) => {
    setBrands(prev => prev.map(b => b.id === brandId ? { ...b, ...updates } : b))
    if (activeBrand?.id === brandId) {
      setActiveBrand(prev => prev ? { ...prev, ...updates } : prev)
    }
  }, [activeBrand])

  return { brands, activeBrand, setActiveBrand, loading, createBrand, updateBrand, refreshBrands: loadBrands }
}
