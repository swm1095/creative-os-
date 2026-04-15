'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase-client'
import { Brand, Creative, Job, GenerateResult, QCResult, BrandAnalysis } from '@/lib/types'
import Sidebar from '@/components/Sidebar'
import Gallery from '@/components/Gallery'
import GeneratePanel from '@/components/GeneratePanel'
import ResizeViewer from '@/components/ResizeViewer'
import QCPanel from '@/components/QCPanel'
import BrandUpload from '@/components/BrandUpload'
import IntegrationsView from '@/components/IntegrationsView'

export default function DashboardPage() {
  const supabase = createClient()

  const [userEmail, setUserEmail] = useState('')
  const [brands, setBrands] = useState<Brand[]>([])
  const [activeBrand, setActiveBrand] = useState<Brand | null>(null)
  const [creatives, setCreatives] = useState<Creative[]>([])
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)

  const [view, setView] = useState<'gallery' | 'integrations'>('gallery')
  const [showGenerate, setShowGenerate] = useState(false)
  const [showResize, setShowResize] = useState<Creative | null>(null)
  const [showQC, setShowQC] = useState<Creative | null>(null)
  const [showBrandUpload, setShowBrandUpload] = useState(false)

  const DEMO_USER_ID = '00000000-0000-0000-0000-000000000000'

  // Load user and brands
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUserEmail(user?.email || 'demo@hype10agency.com')

      const { data: brandsData } = await supabase
        .from('brands')
        .select('*, creatives(count)')
        .order('created_at', { ascending: false })

      if (brandsData) {
        const withCount = brandsData.map(b => ({
          ...b,
          creative_count: b.creatives?.[0]?.count || 0,
        }))
        setBrands(withCount)
        if (withCount.length > 0) setActiveBrand(withCount[0])
      }
      setLoading(false)
    }
    init()
  }, [])

  // Load creatives when brand changes
  useEffect(() => {
    if (!activeBrand) { setCreatives([]); setJobs([]); return }
    const loadBrandData = async () => {
      const [cRes, jRes] = await Promise.all([
        supabase.from('creatives').select('*').eq('brand_id', activeBrand.id).order('created_at', { ascending: false }).limit(50),
        supabase.from('jobs').select('*').eq('brand_id', activeBrand.id).order('created_at', { ascending: false }).limit(20),
      ])
      if (cRes.data) setCreatives(cRes.data)
      if (jRes.data) setJobs(jRes.data)
    }
    loadBrandData()
  }, [activeBrand])

  const handleBrandSelect = (brand: Brand) => {
    setActiveBrand(brand)
    setView('gallery')
  }

  const handleCreateBrand = async (name: string, url: string): Promise<Brand> => {
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase.from('brands').insert({
      name, url, user_id: user?.id || DEMO_USER_ID, color: '#2B4EFF'
    }).select().single()
    if (error) throw new Error(error.message)
    const newBrand = { ...data, creative_count: 0 }
    setBrands(prev => [newBrand, ...prev])
    setActiveBrand(newBrand)
    return newBrand
  }

  const handleGenerateComplete = (results: GenerateResult[]) => {
    // Add generated creatives to gallery
    const newCreatives: Creative[] = results
      .filter(r => r.imageUrl)
      .map(r => ({
        id: crypto.randomUUID(),
        brand_id: activeBrand!.id,
        user_id: '',
        title: `${r.persona.name} — ${r.persona.angle.slice(0, 30)}`,
        concept: '',
        persona: r.persona.name,
        angle: r.persona.angle,
        image_url: r.imageUrl,
        format: '1x1',
        generator: 'ideogram',
        qc_spelling: 'pending',
        qc_brand: 'pending',
        qc_claims: 'pending',
        created_at: new Date().toISOString(),
      }))
    setCreatives(prev => [...newCreatives, ...prev])
    setShowGenerate(false)
  }

  const handleQCComplete = (result: QCResult, creativeId: string) => {
    setCreatives(prev => prev.map(c =>
      c.id === creativeId ? {
        ...c,
        qc_spelling: result.spelling.status,
        qc_brand: result.brand.status,
        qc_claims: result.claims.status,
        qc_notes: [result.spelling, result.brand, result.claims],
      } : c
    ))
  }

  const handleBrandAnalysis = (analysis: BrandAnalysis, brandId: string) => {
    setBrands(prev => prev.map(b => b.id === brandId ? {
      ...b,
      brand_colors: analysis.colors,
      brand_fonts: analysis.fonts,
      tone_notes: analysis.tone,
    } : b))
    if (activeBrand?.id === brandId) {
      setActiveBrand(prev => prev ? {
        ...prev,
        brand_colors: analysis.colors,
        brand_fonts: analysis.fonts,
        tone_notes: analysis.tone,
      } : prev)
    }
    setShowBrandUpload(false)
  }

  const handleCreativeClick = (creative: Creative) => {
    // Open a context menu or action panel
    // For now: right-click would be ideal, but we'll show a quick action bar
    setShowQC(creative)
  }

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--gray-50)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--blue)', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 12px' }}/>
          <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>Loading CreativeOS...</div>
        </div>
      </div>
    )
  }

  return (
    <>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
        {/* Sidebar */}
        <Sidebar
          brands={brands}
          activeBrandId={activeBrand?.id || null}
          activeView={view}
          userEmail={userEmail}
          onBrandSelect={handleBrandSelect}
          onViewChange={setView}
          onAddBrand={() => setShowBrandUpload(true)}
        />

        {/* Main area */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {view === 'gallery' ? (
            <Gallery
              brand={activeBrand}
              creatives={creatives}
              jobs={jobs}
              onGenerate={() => activeBrand ? setShowGenerate(true) : setShowBrandUpload(true)}
              onCreativeClick={handleCreativeClick}
            />
          ) : (
            <IntegrationsView/>
          )}
        </div>
      </div>

      {/* Overlays */}
      {showGenerate && activeBrand && (
        <GeneratePanel
          brand={activeBrand}
          onClose={() => setShowGenerate(false)}
          onComplete={handleGenerateComplete}
        />
      )}

      {showResize && (
        <ResizeViewer
          creative={showResize}
          onClose={() => setShowResize(null)}
        />
      )}

      {showQC && (
        <div>
          {/* Quick action bar above QC panel */}
          <div style={{
            position: 'fixed', bottom: 0, left: 220, right: 0, zIndex: 350,
            background: 'white', borderTop: '1px solid var(--border)',
            padding: '10px 24px', display: 'flex', alignItems: 'center', gap: 12
          }}>
            <img src={showQC.image_url} alt="" style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--border)' }}/>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{showQC.title}</div>
            </div>
            <button className="btn-ghost" onClick={() => { setShowQC(null); setShowResize(showQC) }}>↔ Resize</button>
            <button className="btn-primary" onClick={() => {}}>Run QC</button>
            <button onClick={() => setShowQC(null)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--gray-500)' }}>×</button>
          </div>
          <QCPanel
            creative={showQC}
            onClose={() => setShowQC(null)}
            onQCComplete={handleQCComplete}
          />
        </div>
      )}

      {showBrandUpload && (
        <BrandUpload
          brand={activeBrand}
          onClose={() => setShowBrandUpload(false)}
          onAnalysisComplete={handleBrandAnalysis}
          onCreateBrand={handleCreateBrand}
        />
      )}
    </>
  )
}
