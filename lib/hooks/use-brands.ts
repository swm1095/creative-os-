'use client'

import { useState, useEffect, useCallback } from 'react'
import { Brand } from '@/lib/types'

export function useBrands() {
  const [brands, setBrands] = useState<Brand[]>([])
  const [activeBrand, setActiveBrand] = useState<Brand | null>(null)
  const [loading, setLoading] = useState(true)

  const loadBrands = useCallback(async () => {
    try {
      const res = await fetch('/api/brands')
      const data = await res.json()
      if (data.error) { console.error('loadBrands error:', data.error); return }

      const list: Brand[] = data.brands || []
      setBrands(list)
      setActiveBrand(prev => {
        if (!prev && list.length > 0) return list[0]
        if (prev) {
          const updated = list.find(b => b.id === prev.id)
          return updated || prev
        }
        return prev
      })
    } catch (e) {
      console.error('loadBrands exception:', e)
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadBrands() }, [loadBrands])

  const createBrand = useCallback(async (name: string, url?: string, color?: string): Promise<Brand | null> => {
    try {
      const res = await fetch('/api/brands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, url, color }),
      })
      const data = await res.json()
      if (data.error || !data.brand) {
        console.error('createBrand error:', data.error)
        return null
      }
      setBrands(prev => [data.brand, ...prev])
      setActiveBrand(data.brand)
      return data.brand
    } catch (e) {
      console.error('createBrand exception:', e)
      return null
    }
  }, [])

  const updateBrand = useCallback((brandId: string, updates: Partial<Brand>) => {
    setBrands(prev => prev.map(b => b.id === brandId ? { ...b, ...updates } : b))
    setActiveBrand(prev => prev?.id === brandId ? { ...prev, ...updates } : prev)
  }, [])

  return { brands, activeBrand, setActiveBrand, loading, createBrand, updateBrand, refreshBrands: loadBrands }
}
