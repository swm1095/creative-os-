'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase-client'
import { Creative } from '@/lib/types'

export function useCreatives(brandId: string | undefined) {
  const [creatives, setCreatives] = useState<Creative[]>([])
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const loadCreatives = useCallback(async () => {
    if (!brandId) { setCreatives([]); return }
    setLoading(true)
    const { data } = await supabase
      .from('creatives')
      .select('*')
      .eq('brand_id', brandId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (data) setCreatives(data)
    setLoading(false)
  }, [brandId])

  useEffect(() => { loadCreatives() }, [loadCreatives])

  const addCreatives = useCallback((newCreatives: Creative[]) => {
    setCreatives(prev => [...newCreatives, ...prev])
  }, [])

  const updateCreative = useCallback((id: string, updates: Partial<Creative>) => {
    setCreatives(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c))
  }, [])

  return { creatives, loading, addCreatives, updateCreative, refreshCreatives: loadCreatives }
}
