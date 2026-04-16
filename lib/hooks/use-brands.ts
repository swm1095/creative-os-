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
    const { data } = await supabase
      .from('brands')
      .select('*, creatives(count)')
      .order('created_at', { ascending: false })

    if (data) {
      const withCount = data.map((b: Brand & { creatives?: { count: number }[] }) => ({
        ...b,
        creative_count: b.creatives?.[0]?.count || 0,
      }))
      setBrands(withCount)
      if (!activeBrand && withCount.length > 0) {
        setActiveBrand(withCount[0])
      }
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
