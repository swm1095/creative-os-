'use client'

import { useState, useEffect, useRef } from 'react'
import { Brand, BrandResearch } from '@/lib/types'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import SectionHeader from '@/components/ui/SectionHeader'
import FormInput from '@/components/ui/FormInput'
import LoadingSpinner, { LoadingState } from '@/components/ui/LoadingSpinner'
import Pill from '@/components/ui/Pill'
import PageHeader from '@/components/ui/PageHeader'
import Modal from '@/components/ui/Modal'

interface CompetitorInsight {
  name: string
  positioning: string
  strengths: string[]
  weaknesses: string[]
  customerComplaints: string[]
  opportunities: string[]
  adAngles: string[]
}

interface BrandResearchViewProps {
  brand: Brand | null
  onToast: (msg: string, type: 'success' | 'error' | 'info') => void
  onBrandUpdate: (brandId: string, updates: Partial<Brand>) => void
  onCreateBrand: (name: string, url?: string) => Promise<Brand | null>
  onRefreshBrands?: () => Promise<void>
  onSetActiveBrand?: (brand: Brand) => void
  activeTab?: 'research' | 'saved-insights'
  onChangeTab?: (tab: 'research' | 'saved-insights') => void
  addBackgroundTask?: (type: 'research' | 'competitor-analysis' | 'scan' | 'generate' | 'ugc-scripts', brandId: string, brandName: string, message: string, fn: (signal: AbortSignal) => Promise<unknown>) => string
  isClient?: boolean
  initialSection?: string
}

export default function BrandResearchView({ brand, onToast, onBrandUpdate, onCreateBrand, onRefreshBrands, onSetActiveBrand, activeTab = 'research', onChangeTab, addBackgroundTask, isClient, initialSection }: BrandResearchViewProps) {
  const [newBrandName, setNewBrandName] = useState('')
  const [newBrandUrl, setNewBrandUrl] = useState('')
  const [researching, setResearching] = useState(false)
  const [research, setResearch] = useState<BrandResearch | null>(brand?.research as BrandResearch || null)
  const [researchingCompetitors, setResearchingCompetitors] = useState(false)
  const [competitorInsights, setCompetitorInsights] = useState<CompetitorInsight[]>(() => {
    const b = brand as Brand & { competitor_research?: CompetitorInsight[] }
    return b?.competitor_research || []
  })

  // Scroll to section if specified
  useEffect(() => {
    if (initialSection) {
      setTimeout(() => {
        document.getElementById(initialSection)?.scrollIntoView({ behavior: 'smooth' })
      }, 300)
    }
  }, [initialSection])

  // Sync local state when brand changes
  useEffect(() => {
    setResearch(brand?.research as BrandResearch || null)
    const b = brand as Brand & { competitor_research?: CompetitorInsight[] }
    setCompetitorInsights(b?.competitor_research || [])
    setCompetitorUrls(brand?.competitor_urls || [])
    setOwnProductUrls((brand as Brand & { own_product_urls?: string[] })?.own_product_urls || [])
    setProducts((brand as Brand & { products?: ProductProfile[] })?.products || [])
    setReviewAnalysis(null)
    setReviewUploadAnalysis(null)
    // Load stored review count
    if (brand?.id) {
      fetch(`/api/reviews?brandId=${brand.id}`).then(r => r.json()).then(data => {
        setStoredReviewCount(data.reviews?.length || 0)
      }).catch(() => {})
    }
  }, [brand?.id])
  const [competitorUrls, setCompetitorUrls] = useState<string[]>(brand?.competitor_urls || [])
  const [newCompetitor, setNewCompetitor] = useState('')
  const [newCompetitorUrl, setNewCompetitorUrl] = useState('')
  const [savingUrls, setSavingUrls] = useState(false)
  const [showAddPersona, setShowAddPersona] = useState(false)

  // Amazon reviews
  const [ownProductUrls, setOwnProductUrls] = useState<string[]>((brand as Brand & { own_product_urls?: string[] })?.own_product_urls || [])
  const [newOwnUrl, setNewOwnUrl] = useState('')

  // Products
  interface ProductProfile { id: string; name: string; url: string; price: string; description: string; features: string[]; usps: string[]; targetUseCase: string; category?: string }
  const [products, setProducts] = useState<ProductProfile[]>((brand as Brand & { products?: ProductProfile[] })?.products || [])
  const [addingProduct, setAddingProduct] = useState(false)
  const [scrapingReviews, setScrapingReviews] = useState(false)
  const [reviewAnalysis, setReviewAnalysis] = useState<{ sentiment: string; praise: string[]; complaints: string[]; themes: string[]; summary: string } | null>(null)

  // Customer reviews upload
  const [uploadingReviews, setUploadingReviews] = useState(false)
  const [storedReviewCount, setStoredReviewCount] = useState(0)
  const [reviewUploadAnalysis, setReviewUploadAnalysis] = useState<{ top_phrases?: string[]; pain_points?: string[]; praise?: string[]; themes?: string[]; sentiment?: string } | null>(null)
  const [pastedReviewText, setPastedReviewText] = useState('')
  const reviewFileRef = useRef<HTMLInputElement>(null)
  const [newPersonaName, setNewPersonaName] = useState('')
  const [newPersonaDesc, setNewPersonaDesc] = useState('')
  const [newPersonaHook, setNewPersonaHook] = useState('')

  // UGC Scripts + Headlines generation
  const [generatingScripts, setGeneratingScripts] = useState(false)
  const [generatingHeadlines, setGeneratingHeadlines] = useState(false)
  const [ugcScripts, setUgcScripts] = useState<{ hooks: { persona: string; persona_number: number; hook: string }[]; body: string; cta: string } | null>(null)
  const [headlines, setHeadlines] = useState<{ persona: string; headlines: string[] }[]>([])
  const [showScriptsModal, setShowScriptsModal] = useState(false)
  const [showHeadlinesModal, setShowHeadlinesModal] = useState(false)

  const generateUGCScripts = async () => {
    if (!brand?.id || !research?.personas?.length) { onToast('Brand research with personas required', 'error'); return }
    setGeneratingScripts(true)
    onToast('Generating UGC scripts from brand research...', 'info')
    try {
      const res = await fetch('/api/ugc-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandId: brand.id,
          insight: {
            title: `${brand.name} brand overview`,
            summary: research.summary || `${brand.name} is a ${research.industry} brand in ${research.productCategory}`,
            painPoints: research.painPoints?.slice(0, 3) || [],
            motivators: research.motivators?.slice(0, 3) || [],
          },
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setUgcScripts(data)
      setShowScriptsModal(true)
      onToast(`${data.hooks?.length || 0} UGC script hooks generated`, 'success')
    } catch (err: unknown) {
      onToast(`Script generation failed: ${err instanceof Error ? err.message : String(err)}`, 'error')
    }
    setGeneratingScripts(false)
  }

  const generateHeadlines = async () => {
    if (!brand?.id || !research?.personas?.length) { onToast('Brand research with personas required', 'error'); return }
    setGeneratingHeadlines(true)
    onToast('Generating static ad headlines...', 'info')
    try {
      const res = await fetch('/api/design', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate-copy',
          brandName: brand.name,
          brandResearch: research,
          persona: research.personas.map(p => p.name).join(', '),
          angle: 'Problem/Solution',
          referenceAnalysis: null,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      const result = research.personas.map((p, i) => ({
        persona: p.name,
        headlines: [
          ...(data.copy?.hooks || []),
          ...(data.copy?.subheadlines || []),
        ].slice(i * 2, i * 2 + 4),
      }))
      setHeadlines(result)
      setShowHeadlinesModal(true)
      onToast('Headlines generated', 'success')
    } catch (err: unknown) {
      onToast(`Headline generation failed: ${err instanceof Error ? err.message : String(err)}`, 'error')
    }
    setGeneratingHeadlines(false)
  }

  const saveOwnUrls = async (urls: string[]) => {
    setOwnProductUrls(urls)
    if (brand?.id) {
      try {
        await fetch('/api/brands', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: brand.id, own_product_urls: urls }),
        })
      } catch { /* silent */ }
    }
  }

  const scrapeOwnReviews = async () => {
    if (!brand?.id || ownProductUrls.length === 0) { onToast('Add at least one product URL', 'error'); return }
    setScrapingReviews(true)
    onToast('Scraping Amazon reviews and analyzing with Claude...', 'info')
    try {
      const res = await fetch('/api/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'analyze-reviews',
          brandId: brand.id,
          brandName: brand.name,
          productUrls: ownProductUrls,
          brandResearch: research,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setReviewAnalysis(data.analysis)
      onToast('Review analysis complete', 'success')
    } catch (err: unknown) {
      onToast(`Review scraping failed: ${err instanceof Error ? err.message : String(err)}`, 'error')
    }
    setScrapingReviews(false)
  }

  const runResearch = async (targetBrandId?: string, targetUrl?: string, targetName?: string) => {
    const brandId = targetBrandId || brand?.id
    const url = targetUrl || brand?.url || ''
    const name = targetName || brand?.name || ''
    if (!name) { onToast('Brand name is required', 'error'); return }
    setResearching(true)
    onToast(`Claude is researching ${name}... (30 sec)`, 'info')
    try {
      const res = await fetch('/api/brand-research', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ brandId, websiteUrl: url, brandName: name }) })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setResearch(data.research)
      if (data.brandId) {
        onBrandUpdate(data.brandId, { research: data.research, research_completed: true, name, url: url || '' })
        if (onSetActiveBrand) onSetActiveBrand({ id: data.brandId, name, url: url || '', color: '#2B4EFF', research: data.research, research_completed: true, created_at: new Date().toISOString(), creative_count: 0 })
      }
      if (onRefreshBrands) await onRefreshBrands()
      onToast(`Research complete`, 'success')
    } catch (err: unknown) { onToast(`Research failed: ${err instanceof Error ? err.message : String(err)}`, 'error') }
    setResearching(false)
  }

  const handleAddBrand = async () => {
    if (!newBrandName.trim()) { onToast('Enter a brand name', 'error'); return }
    const name = newBrandName; const url = newBrandUrl
    setNewBrandName(''); setNewBrandUrl('')
    await runResearch(undefined, url, name)
  }

  const handleAddPersona = async () => {
    if (!brand?.id || !newPersonaName.trim() || !research) return
    const savedName = newPersonaName
    const newP = { name: newPersonaName, age: '', description: newPersonaDesc, painPoints: [], motivators: [], channels: [], hook: newPersonaHook }
    const updated = { ...research, personas: [...(research.personas || []), newP] }
    try {
      await fetch('/api/brands', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: brand.id, research: updated }) })
      setResearch(updated); onBrandUpdate(brand.id, { research: updated })
      setNewPersonaName(''); setNewPersonaDesc(''); setNewPersonaHook(''); setShowAddPersona(false)
      onToast(`Persona "${savedName}" added`, 'success')
    } catch (err: unknown) { onToast(`Failed: ${err instanceof Error ? err.message : String(err)}`, 'error') }
  }

  const saveCompetitorUrls = async (urls: string[]) => {
    if (!brand?.id) return
    setSavingUrls(true)
    try {
      await fetch('/api/brands', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: brand.id, competitor_urls: urls }) })
      setCompetitorUrls(urls); onBrandUpdate(brand.id, { competitor_urls: urls })
      onToast(`${urls.length} product URLs saved`, 'success')
    } catch (err: unknown) { onToast(`Failed: ${err instanceof Error ? err.message : String(err)}`, 'error') }
    setSavingUrls(false)
  }

  const runCompetitorAnalysis = async () => {
    if (!brand?.id) return

    const doAnalysis = async () => {
      setResearchingCompetitors(true)
      try {
        const res = await fetch('/api/competitor-research', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ brandId: brand.id }) })
        const data = await res.json()
        if (data.error) throw new Error(data.error)
        setCompetitorInsights(data.competitors || [])
        onToast(`${data.competitors?.length || 0} competitors analyzed`, 'success')
        setTimeout(() => document.getElementById('competitor-analysis')?.scrollIntoView({ behavior: 'smooth' }), 200)
        return data
      } catch (err: unknown) {
        onToast(`Failed: ${err instanceof Error ? err.message : String(err)}`, 'error')
        throw err
      } finally {
        setResearchingCompetitors(false)
      }
    }

    if (addBackgroundTask) {
      addBackgroundTask('competitor-analysis', brand.id, brand.name, 'Analyzing competitors', doAnalysis)
      onToast('Competitor analysis running in background - you can navigate freely', 'info')
    } else {
      await doAnalysis()
    }
  }

  return (
    <div className="animate-fadeIn">
      {/* Top tabs */}
      {onChangeTab && (
        <div className="flex items-center gap-1 mb-6 border-b border-border">
          <button onClick={() => onChangeTab('research')} className={`px-4 py-2.5 text-sm font-bold border-b-2 -mb-px transition-colors ${activeTab === 'research' ? 'border-fulton text-fulton' : 'border-transparent text-text-dim hover:text-text-primary'}`}>Brand Research</button>
          <button onClick={() => onChangeTab('saved-insights')} className={`px-4 py-2.5 text-sm font-bold border-b-2 -mb-px transition-colors ${activeTab === 'saved-insights' ? 'border-fulton text-fulton' : 'border-transparent text-text-dim hover:text-text-primary'}`}>Saved Insights</button>
        </div>
      )}

      {/* Add new brand - team only */}
      {!isClient && <Card title="Add New Brand" subtitle="Enter a brand name and website - Claude will do deep research automatically" className="mb-6">
        <div className="flex gap-3 items-end">
          <FormInput label="Brand Name" placeholder="e.g. Fulton" value={newBrandName} onChange={e => setNewBrandName(e.target.value)} className="flex-1" />
          <FormInput label="Website URL" placeholder="https://walkfulton.com" value={newBrandUrl} onChange={e => setNewBrandUrl(e.target.value)} className="flex-1" />
          <Button onClick={handleAddBrand} disabled={researching || !newBrandName.trim()}>
            {researching ? <><LoadingSpinner size={14} /> Researching...</> : 'Add + Research'}
          </Button>
        </div>
      </Card>}

      {/* Brand header */}
      {brand && research && (
        <PageHeader
          title={`${brand.name}`}
          subtitle={`Researched ${research.researchDate ? new Date(research.researchDate).toLocaleDateString() : 'recently'}`}
          action={!isClient ? (
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={runCompetitorAnalysis} disabled={researchingCompetitors}>
                {researchingCompetitors ? <><LoadingSpinner size={12} /> Analyzing...</> : 'Analyze Competitors'}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => runResearch()} disabled={researching}>
                {researching ? <><LoadingSpinner size={12} /> Running...</> : 'Re-run Research'}
              </Button>
            </div>
          ) : undefined}
        />
      )}

      {researching && <LoadingState size="lg" title="Claude is analyzing the brand..." subtitle="Scraping website, identifying competitors, building personas" />}

      {research && !researching && (
        <div className="space-y-6">

          {/* EXECUTIVE SUMMARY */}
          {initialSection !== 'competitor-analysis' && (
          <Card>
            <p className="text-sm text-text-secondary leading-relaxed mb-3">{research.summary}</p>
            <div className="flex gap-2 flex-wrap">
              <Pill variant="blue">{research.industry}</Pill>
              <Pill variant="gray">{research.productCategory}</Pill>
              <Pill variant="green">{research.priceRange}</Pill>
              <Pill variant="gray">{research.targetDemo}</Pill>
            </div>
          </Card>
          )}

          {/* TWO COLUMN LAYOUT */}
          {initialSection !== 'competitor-analysis' && (
          <div className="grid grid-cols-[1fr_320px] gap-4">

            {/* LEFT COLUMN - Actionable */}
            <div className="space-y-6">

              {/* PERSONAS */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-black">Target Personas</h3>
                  <Button variant="ghost" size="sm" onClick={() => setShowAddPersona(!showAddPersona)}>{showAddPersona ? 'Cancel' : '+ Add Persona'}</Button>
                </div>
                {showAddPersona && (
                  <Card className="mb-3">
                    <div className="space-y-2">
                      <input type="text" placeholder="Persona name" value={newPersonaName} onChange={e => setNewPersonaName(e.target.value)} className="w-full px-3 py-2 bg-page border border-border rounded text-sm text-text-primary focus:border-fulton focus:outline-none" autoFocus />
                      <input type="text" placeholder="Description" value={newPersonaDesc} onChange={e => setNewPersonaDesc(e.target.value)} className="w-full px-3 py-2 bg-page border border-border rounded text-sm text-text-primary focus:border-fulton focus:outline-none" />
                      <input type="text" placeholder="Ad hook angle" value={newPersonaHook} onChange={e => setNewPersonaHook(e.target.value)} className="w-full px-3 py-2 bg-page border border-border rounded text-sm text-text-primary focus:border-fulton focus:outline-none" />
                      <Button size="sm" className="w-full justify-center" onClick={handleAddPersona} disabled={!newPersonaName.trim()}>Save Persona</Button>
                    </div>
                  </Card>
                )}
                <div className="space-y-3">
                  {research.personas?.map((p, i) => (
                    <Card key={i} className="relative group">
                      <div className="flex items-start gap-3">
                        <span className="text-2xs font-bold text-fulton bg-fulton-light px-2 py-0.5 rounded shrink-0 mt-1">P{i + 1}</span>
                        <div className="flex-1">
                          <input type="text" value={p.name} onChange={e => { if (!brand?.research) return; const u = [...brand.research.personas]; u[i] = { ...u[i], name: e.target.value }; onBrandUpdate(brand.id, { research: { ...brand.research, personas: u } }) }}
                            className="w-full text-sm font-bold bg-transparent focus:outline-none focus:bg-elevated rounded px-1 -ml-1" />
                          <textarea value={p.description || ''} onChange={e => { if (!brand?.research) return; const u = [...brand.research.personas]; u[i] = { ...u[i], description: e.target.value }; onBrandUpdate(brand.id, { research: { ...brand.research, personas: u } }) }}
                            placeholder="Description..." className="w-full text-xs text-text-dim bg-transparent focus:outline-none focus:bg-elevated rounded px-1 -ml-1 resize-none" rows={2} />
                          {p.hook && (
                            <div className="bg-fulton-light border border-fulton/20 rounded px-2.5 py-1.5 mt-1 mb-2">
                              <span className="text-2xs font-bold text-fulton">Hook: </span>
                              <input type="text" value={p.hook} onChange={e => { if (!brand?.research) return; const u = [...brand.research.personas]; u[i] = { ...u[i], hook: e.target.value }; onBrandUpdate(brand.id, { research: { ...brand.research, personas: u } }) }}
                                className="text-xs text-text-secondary bg-transparent focus:outline-none w-full" />
                            </div>
                          )}
                          <div className="flex gap-2">
                            <Button size="sm" variant="secondary" onClick={() => { localStorage.setItem('hc-brief-draft', `Persona: ${p.name}. ${p.description || ''}. Hook: ${p.hook || ''}`); onToast('Brief loaded - go to HyperCopy', 'success') }}>✍ Copy</Button>
                            <Button size="sm" variant="secondary" onClick={() => generateUGCScripts()}>🎬 Script</Button>
                            <Button size="sm" variant="secondary" onClick={() => generateHeadlines()}>📝 Headlines</Button>
                          </div>
                        </div>
                        {!isClient && <button onClick={() => { if (!brand?.research) return; onBrandUpdate(brand.id, { research: { ...brand.research, personas: brand.research.personas.filter((_, idx) => idx !== i) } }); onToast('Removed', 'info') }}
                          className="text-red text-xs opacity-0 group-hover:opacity-100 shrink-0">x</button>}
                      </div>
                    </Card>
                  ))}
                </div>
                {research.personas?.length > 0 && (
                  <div className="flex gap-2 mt-3">
                    <Button onClick={generateUGCScripts} disabled={generatingScripts} variant="secondary" size="sm" className="flex-1 justify-center">
                      {generatingScripts ? <><LoadingSpinner size={14} /> Generating...</> : '🎬 All UGC Scripts'}
                    </Button>
                    <Button onClick={generateHeadlines} disabled={generatingHeadlines} variant="secondary" size="sm" className="flex-1 justify-center">
                      {generatingHeadlines ? <><LoadingSpinner size={14} /> Generating...</> : '📝 All Headlines'}
                    </Button>
                  </div>
                )}
              </div>

              {/* PAIN POINTS + MOTIVATORS */}
              <div className="grid grid-cols-2 gap-3">
                <Card>
                  <div className="text-xs font-bold text-red uppercase tracking-wider mb-2">Pain Points</div>
                  <ul className="space-y-1 list-disc list-inside mb-3">
                    {research.painPoints?.map((p, i) => <li key={i} className="text-xs text-text-secondary">{p}</li>)}
                  </ul>
                  <Button size="sm" variant="ghost" className="w-full justify-center" onClick={() => { localStorage.setItem('hc-brief-draft', `Pain points:\n${(research.painPoints || []).join('\n')}`); onToast('Pain points loaded as brief', 'success') }}>✍ Write Copy</Button>
                </Card>
                <Card>
                  <div className="text-xs font-bold text-green uppercase tracking-wider mb-2">Motivators</div>
                  <ul className="space-y-1 list-disc list-inside mb-3">
                    {research.motivators?.map((m, i) => <li key={i} className="text-xs text-text-secondary">{m}</li>)}
                  </ul>
                  <Button size="sm" variant="ghost" className="w-full justify-center" onClick={() => { localStorage.setItem('hc-brief-draft', `Motivators:\n${(research.motivators || []).join('\n')}`); onToast('Motivators loaded as brief', 'success') }}>✍ Write Copy</Button>
                </Card>
              </div>

              {/* CUSTOMER REVIEWS */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-black">Customer Reviews</h3>
                  {storedReviewCount > 0 && <span className="text-2xs bg-green/10 text-green px-2 py-1 rounded font-bold">{storedReviewCount} stored</span>}
                </div>
                <Card className="mb-3">
                  <input ref={reviewFileRef} type="file" accept=".csv,.tsv,.txt,.xlsx" style={{ display: 'none' }}
                    onChange={async (e) => {
                      const file = e.target.files?.[0]; if (!file || !brand?.id) return; setUploadingReviews(true)
                      try { const fd = new FormData(); fd.append('brandId', brand.id); fd.append('file', file)
                        const res = await fetch('/api/reviews', { method: 'POST', body: fd }); const data = await res.json()
                        if (data.error) throw new Error(data.error); setStoredReviewCount(data.total || 0)
                        if (data.analysis) setReviewUploadAnalysis(data.analysis); onToast(`${data.count} reviews uploaded`, 'success')
                      } catch (err: unknown) { onToast(`Failed: ${err instanceof Error ? err.message : String(err)}`, 'error') }
                      setUploadingReviews(false); if (reviewFileRef.current) reviewFileRef.current.value = ''
                    }} />
                  <div className="flex gap-2 mb-2">
                    <Button size="sm" onClick={() => reviewFileRef.current?.click()} disabled={uploadingReviews}>
                      {uploadingReviews ? <><LoadingSpinner size={14} /> Uploading...</> : 'Upload CSV / Text'}
                    </Button>
                    {storedReviewCount > 0 && <Button size="sm" variant="ghost" onClick={async () => {
                      if (!brand?.id || !confirm('Clear all?')) return
                      await fetch('/api/reviews', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ brandId: brand.id }) })
                      setStoredReviewCount(0); setReviewUploadAnalysis(null); onToast('Cleared', 'info')
                    }}>Clear</Button>}
                  </div>
                  <textarea value={pastedReviewText} onChange={e => setPastedReviewText(e.target.value)}
                    placeholder="Or paste reviews here (one per line)..."
                    className="w-full px-3 py-2 bg-page border border-border rounded text-xs text-text-primary focus:border-fulton focus:outline-none resize-y min-h-[50px]" rows={2} />
                  {pastedReviewText.trim() && <Button size="sm" className="mt-2" onClick={async () => {
                    if (!brand?.id) return; setUploadingReviews(true)
                    try { const fd = new FormData(); fd.append('brandId', brand.id); fd.append('text', pastedReviewText)
                      const res = await fetch('/api/reviews', { method: 'POST', body: fd }); const data = await res.json()
                      if (data.error) throw new Error(data.error); setStoredReviewCount(data.total || 0)
                      if (data.analysis) setReviewUploadAnalysis(data.analysis); setPastedReviewText(''); onToast(`${data.count} reviews added`, 'success')
                    } catch (err: unknown) { onToast(`Failed: ${err instanceof Error ? err.message : String(err)}`, 'error') }
                    setUploadingReviews(false)
                  }}>Save Reviews</Button>}
                </Card>
                {reviewUploadAnalysis?.top_phrases?.length ? (
                  <Card className="mb-3">
                    <div className="text-xs font-bold text-fulton uppercase tracking-wider mb-2">Top Customer Phrases</div>
                    {reviewUploadAnalysis.top_phrases.map((p, i) => (
                      <div key={i} className="flex items-center justify-between bg-page border border-border rounded px-3 py-2 mb-1">
                        <span className="text-sm italic text-text-secondary">&quot;{p}&quot;</span>
                        <button onClick={() => { navigator.clipboard.writeText(p); onToast('Copied', 'success') }} className="text-2xs text-text-dim hover:text-text-primary shrink-0">Copy</button>
                      </div>
                    ))}
                  </Card>
                ) : null}
              </div>

              {/* PRODUCT PAGES */}
              {/* PRODUCTS */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-black">Products</h3>
                  <span className="text-2xs text-text-dim">{products.length} product{products.length !== 1 ? 's' : ''}</span>
                </div>

                {/* Existing products */}
                {products.map(p => (
                  <Card key={p.id} className="mb-3 relative group">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded bg-fulton-light flex items-center justify-center text-fulton text-xs font-bold shrink-0">{p.name.charAt(0)}</div>
                      <div className="flex-1">
                        <div className="text-sm font-bold">{p.name}</div>
                        {p.price && <div className="text-xs text-green font-bold">{p.price}</div>}
                        <div className="text-xs text-text-dim mt-1">{p.description}</div>
                        {p.features.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {p.features.slice(0, 4).map((f, i) => <span key={i} className="text-2xs bg-elevated border border-border px-1.5 py-0.5 rounded">{f}</span>)}
                          </div>
                        )}
                        {p.usps.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {p.usps.map((u, i) => <span key={i} className="text-2xs bg-fulton-light text-fulton px-1.5 py-0.5 rounded">{u}</span>)}
                          </div>
                        )}
                        <div className="flex gap-2 mt-2">
                          <Button size="sm" variant="secondary" onClick={() => { localStorage.setItem('hc-brief-draft', `Product: ${p.name}. ${p.description}. Features: ${p.features.join(', ')}. USPs: ${p.usps.join(', ')}`); onToast('Product brief loaded', 'success') }}>✍ Copy</Button>
                          <Button size="sm" variant="secondary" onClick={() => generateUGCScripts()}>🎬 Script</Button>
                        </div>
                      </div>
                      <button onClick={async () => {
                        if (!brand?.id) return
                        await fetch('/api/products', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ brandId: brand.id, productId: p.id }) })
                        setProducts(prev => prev.filter(pr => pr.id !== p.id))
                        onToast('Product removed', 'info')
                      }} className="text-red text-xs opacity-0 group-hover:opacity-100 shrink-0">x</button>
                    </div>
                  </Card>
                ))}

                {/* Add product */}
                <Card>
                  <div className="text-sm font-bold mb-1">Add Product</div>
                  <div className="text-2xs text-text-dim mb-3">Paste any product page URL - Amazon, Shopify, brand website. Claude will auto-build a full product profile.</div>
                  <div className="flex gap-2">
                    <input type="url" placeholder="https://amazon.com/dp/... or any product page" value={newOwnUrl} onChange={e => setNewOwnUrl(e.target.value)}
                      className="flex-1 px-3 py-2 bg-page border border-border rounded text-sm text-text-primary focus:border-fulton focus:outline-none" />
                    <Button size="sm" disabled={!newOwnUrl.trim() || addingProduct} onClick={async () => {
                      if (!brand?.id || !newOwnUrl.trim()) return
                      setAddingProduct(true)
                      onToast('Building product profile...', 'info')
                      try {
                        const res = await fetch('/api/products', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ brandId: brand.id, url: newOwnUrl.trim() }) })
                        const data = await res.json()
                        if (data.error) throw new Error(data.error)
                        setProducts(prev => [...prev, data.product])
                        setNewOwnUrl('')
                        // Also save as product URL for listening
                        saveOwnUrls([...ownProductUrls, newOwnUrl.trim()])
                        onToast(`${data.product.name} profile created`, 'success')
                      } catch (err: unknown) { onToast(`Failed: ${err instanceof Error ? err.message : String(err)}`, 'error') }
                      setAddingProduct(false)
                    }}>{addingProduct ? <><LoadingSpinner size={14} /> Building...</> : 'Add Product'}</Button>
                  </div>
                </Card>
              </div>

            </div>
            {/* END LEFT COLUMN */}

            {/* RIGHT COLUMN - Reference */}
            <div className="space-y-4">
              <Card>
                <div className="text-xs font-bold text-text-muted uppercase tracking-wider mb-2">Brand Voice</div>
                <p className="text-sm text-text-secondary leading-relaxed">{research.brandVoice}</p>
              </Card>
              <Card>
                <div className="text-xs font-bold text-green uppercase tracking-wider mb-2">Key Phrases</div>
                <div className="flex flex-wrap gap-1.5">{research.keyPhrases?.map((p, i) => <span key={i} className="text-2xs bg-green-light text-green px-2 py-0.5 rounded">{p}</span>)}</div>
              </Card>
              <Card>
                <div className="text-xs font-bold text-red uppercase tracking-wider mb-2">Avoid</div>
                <div className="flex flex-wrap gap-1.5">{research.avoidPhrases?.map((p, i) => <span key={i} className="text-2xs bg-red-light text-red px-2 py-0.5 rounded">{p}</span>)}</div>
              </Card>
              <Card>
                <div className="text-xs font-bold text-text-muted uppercase tracking-wider mb-2">Value Props</div>
                <ul className="space-y-1 list-disc list-inside">{research.valueProps?.map((v, i) => <li key={i} className="text-xs text-text-secondary">{v}</li>)}</ul>
              </Card>
              <Card>
                <div className="text-xs font-bold text-text-muted uppercase tracking-wider mb-2">Objections</div>
                <ul className="space-y-1 list-disc list-inside">{research.objections?.map((o, i) => <li key={i} className="text-xs text-text-secondary">{o}</li>)}</ul>
              </Card>
              <Card>
                <div className="text-xs font-bold text-text-muted uppercase tracking-wider mb-2">Search Keywords</div>
                <div className="flex flex-wrap gap-1.5">{research.searchKeywords?.map((k, i) => <span key={i} className="text-2xs bg-blue-light text-blue px-2 py-0.5 rounded">{k}</span>)}</div>
              </Card>
              <Card>
                <div className="text-xs font-bold text-text-muted uppercase tracking-wider mb-2">Subreddits</div>
                <div className="flex flex-wrap gap-1.5">{research.subreddits?.map((s, i) => <span key={i} className="text-2xs bg-elevated border border-border px-2 py-0.5 rounded">r/{s}</span>)}</div>
              </Card>
            </div>
            {/* END RIGHT COLUMN */}

          </div>
          )}

          {/* COMPETITOR SECTION */}
          <div id="competitor-analysis">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black">Competitor Research</h3>
              <Button onClick={runCompetitorAnalysis} disabled={researchingCompetitors}>
                {researchingCompetitors ? <><LoadingSpinner size={14} /> Analyzing...</> : 'Run Deep Analysis'}
              </Button>
            </div>

            {/* Add competitors */}
            <Card className="mb-4">
              <div className="text-sm font-bold mb-1">Add Competitors</div>
              <div className="text-2xs text-text-dim mb-3">Add competitor brand names and websites. Claude will research their positioning, weaknesses, and customer complaints.</div>

              {/* Existing competitors */}
              {(research.competitors?.length || 0) > 0 && (
                <div className="space-y-2 mb-4">
                  {research.competitors?.map((c, i) => (
                    <div key={i} className="flex items-center gap-2 bg-page border border-border rounded px-3 py-2">
                      <span className="text-2xs font-bold text-red bg-red-light px-1.5 py-0.5 rounded">vs</span>
                      <span className="text-sm font-bold flex-1">{c}</span>
                      <button onClick={() => {
                        if (!brand?.research) return
                        const updated = (research.competitors || []).filter((_, idx) => idx !== i)
                        onBrandUpdate(brand.id, { research: { ...brand.research, competitors: updated } })
                      }} className="text-2xs text-red hover:underline shrink-0">Remove</button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add new competitor */}
              <div className="flex gap-2 mb-2">
                <input type="text" placeholder="Competitor name" value={newCompetitor} onChange={e => setNewCompetitor(e.target.value)}
                  className="flex-1 px-3 py-2 bg-page border border-border rounded text-sm text-text-primary focus:border-fulton focus:outline-none"
                  onKeyDown={e => { if (e.key === 'Enter' && newCompetitor.trim()) {
                    if (!brand?.research) return
                    const updated = [...(research.competitors || []), newCompetitor.trim()]
                    onBrandUpdate(brand.id, { research: { ...brand.research, competitors: updated } })
                    setNewCompetitor(''); onToast('Competitor added', 'success')
                  }}} />
                <Button size="sm" disabled={!newCompetitor.trim()} onClick={() => {
                  if (!brand?.research || !newCompetitor.trim()) return
                  const updated = [...(research.competitors || []), newCompetitor.trim()]
                  onBrandUpdate(brand.id, { research: { ...brand.research, competitors: updated } })
                  setNewCompetitor(''); onToast('Competitor added', 'success')
                }}>Add</Button>
              </div>

              {/* Competitor product URLs */}
              <div className="mt-4 pt-3 border-t border-border">
                <div className="text-sm font-bold mb-1">Competitor Product URLs</div>
                <div className="text-2xs text-text-dim mb-3">Add competitor product pages to mine their customer reviews</div>
                {competitorUrls.length > 0 && (
                  <div className="space-y-1.5 mb-3">
                    {competitorUrls.map((url, i) => (
                      <div key={i} className="flex items-center gap-2 bg-page border border-border rounded px-3 py-1.5">
                        <span className="text-xs text-text-secondary truncate flex-1">{url}</span>
                        <button onClick={async () => { await saveCompetitorUrls(competitorUrls.filter((_, idx) => idx !== i)) }} className="text-2xs text-red shrink-0">Remove</button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <input type="url" placeholder="https://amazon.com/dp/... or competitor product page" value={newCompetitorUrl} onChange={e => setNewCompetitorUrl(e.target.value)}
                    className="flex-1 px-3 py-2 bg-page border border-border rounded text-sm text-text-primary focus:border-fulton focus:outline-none" />
                  <Button size="sm" disabled={!newCompetitorUrl.trim() || savingUrls} onClick={async () => {
                    if (!newCompetitorUrl.trim()) return
                    await saveCompetitorUrls([...competitorUrls, newCompetitorUrl.trim()])
                    setNewCompetitorUrl('')
                  }}>{savingUrls ? 'Saving...' : 'Add'}</Button>
                </div>
              </div>
            </Card>

            {/* Loading state */}
            {researchingCompetitors && <LoadingState size="md" title="Mining Reddit for competitor discussions..." subtitle="Claude is analyzing weaknesses, complaints, and ad opportunities" />}

            {/* Competitor analysis results */}
            {competitorInsights.length > 0 && !researchingCompetitors && (
              <div className="space-y-4">
                {competitorInsights.map((c, i) => (
                  <Card key={i}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xs font-bold bg-red-light text-red px-2 py-0.5 rounded">vs</span>
                      <span className="text-sm font-bold">{c.name}</span>
                    </div>
                    <p className="text-sm text-text-dim mb-3">{c.positioning}</p>
                    {c.weaknesses?.length > 0 && (
                      <div className="mb-3">
                        <div className="text-xs font-bold text-red uppercase tracking-wider mb-2">Their Weaknesses</div>
                        <ul className="space-y-1 list-disc list-inside">{c.weaknesses.map((w, j) => <li key={j} className="text-sm text-text-secondary">{w}</li>)}</ul>
                      </div>
                    )}
                    {c.customerComplaints?.length > 0 && (
                      <div className="mb-3">
                        <div className="text-xs font-bold text-amber uppercase tracking-wider mb-2">Customer Complaints</div>
                        <ul className="space-y-1 list-disc list-inside">{c.customerComplaints.map((cc, j) => <li key={j} className="text-sm text-text-secondary italic">{cc}</li>)}</ul>
                      </div>
                    )}
                    {c.adAngles?.length > 0 && (
                      <div className="mb-3">
                        <div className="text-xs font-bold text-fulton uppercase tracking-wider mb-2">Ad Angles Against Them</div>
                        <ul className="space-y-1 list-disc list-inside">{c.adAngles.map((a, j) => <li key={j} className="text-sm text-text-secondary">{a}</li>)}</ul>
                      </div>
                    )}
                    {c.opportunities?.length > 0 && (
                      <div>
                        <div className="text-xs font-bold text-green uppercase tracking-wider mb-2">Opportunities</div>
                        <ul className="space-y-1 list-disc list-inside">{c.opportunities.map((o, j) => <li key={j} className="text-sm text-text-secondary">{o}</li>)}</ul>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}

            {competitorInsights.length === 0 && !researchingCompetitors && (
              <Card>
                <div className="text-center py-8">
                  <div className="text-2xl mb-2">⚔️</div>
                  <div className="text-sm font-bold mb-1">No competitor analysis yet</div>
                  <div className="text-xs text-text-dim">Add competitors above and click "Run Deep Analysis" to mine their weaknesses, customer complaints, and ad angles</div>
                </div>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* UGC Scripts Modal */}
      <Modal open={showScriptsModal} onClose={() => setShowScriptsModal(false)} title="UGC Scripts" subtitle={`Generated from ${brand?.name} brand research`} maxWidth="max-w-3xl">
        {ugcScripts && (
          <div className="space-y-5">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs font-bold text-text-muted uppercase tracking-wider">Hook Options (pick one)</div>
                <span className="text-2xs text-text-dim">0-3 sec</span>
              </div>
              <div className="space-y-2">
                {ugcScripts.hooks.map((h, i) => (
                  <div key={i} className="bg-page border border-border rounded-lg p-4 hover:border-fulton/40 transition-colors">
                    <div className="flex items-start gap-3">
                      <span className="text-2xs font-bold text-fulton bg-fulton-light px-2 py-0.5 rounded shrink-0 mt-0.5">P{h.persona_number}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-2xs text-text-dim mb-1">{h.persona}</div>
                        <div className="text-sm text-text-secondary leading-relaxed italic">&quot;{h.hook}&quot;</div>
                      </div>
                      <button onClick={() => { navigator.clipboard.writeText(`${h.hook}\n\n${ugcScripts.body}\n\n${ugcScripts.cta}`); onToast(`P${h.persona_number} script copied`, 'success') }}
                        className="text-2xs text-text-dim hover:text-text-primary shrink-0">Copy</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs font-bold text-text-muted uppercase tracking-wider">Body (shared)</div>
                <span className="text-2xs text-text-dim">3-20 sec</span>
              </div>
              <div className="bg-fulton-light border border-fulton/20 rounded-lg p-4 text-sm text-text-secondary leading-relaxed">{ugcScripts.body}</div>
            </div>
            <div>
              <div className="text-xs font-bold text-text-muted uppercase tracking-wider mb-2">CTA</div>
              <div className="bg-fulton-light border border-fulton/20 rounded-lg p-4 text-sm font-bold text-text-secondary">{ugcScripts.cta}</div>
            </div>
            <Button onClick={() => { navigator.clipboard.writeText(`HOOKS:\n${ugcScripts.hooks.map(h => `P${h.persona_number}: ${h.hook}`).join('\n')}\n\nBODY:\n${ugcScripts.body}\n\nCTA:\n${ugcScripts.cta}`); onToast('All scripts copied', 'success') }}
              className="w-full justify-center">Copy All Scripts</Button>
          </div>
        )}
      </Modal>

      {/* Headlines Modal */}
      <Modal open={showHeadlinesModal} onClose={() => setShowHeadlinesModal(false)} title="Ad Headlines" subtitle={`Generated from ${brand?.name} brand research`} maxWidth="max-w-2xl">
        <div className="space-y-4">
          {headlines.map((group, i) => (
            <div key={i} className="bg-page border border-border rounded-lg p-4">
              <div className="text-2xs font-bold text-fulton uppercase tracking-wider mb-2">{group.persona}</div>
              <div className="space-y-2">
                {group.headlines.map((h, j) => (
                  <div key={j} className="flex items-center justify-between gap-2">
                    <div className="text-sm font-bold text-text-primary">{h}</div>
                    <button onClick={() => { navigator.clipboard.writeText(h); onToast('Headline copied', 'success') }}
                      className="text-2xs text-text-dim hover:text-text-primary shrink-0">Copy</button>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {headlines.length > 0 && (
            <Button onClick={() => { navigator.clipboard.writeText(headlines.map(g => `${g.persona}:\n${g.headlines.join('\n')}`).join('\n\n')); onToast('All headlines copied', 'success') }}
              className="w-full justify-center">Copy All Headlines</Button>
          )}
        </div>
      </Modal>
    </div>
  )
}
