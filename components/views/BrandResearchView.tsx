'use client'

import { useState, useEffect } from 'react'
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
    setReviewAnalysis(null)
  }, [brand?.id])
  const [competitorUrls, setCompetitorUrls] = useState<string[]>(brand?.competitor_urls || [])
  const [newCompetitorUrl, setNewCompetitorUrl] = useState('')
  const [savingUrls, setSavingUrls] = useState(false)
  const [showAddPersona, setShowAddPersona] = useState(false)

  // Amazon reviews
  const [ownProductUrls, setOwnProductUrls] = useState<string[]>((brand as Brand & { own_product_urls?: string[] })?.own_product_urls || [])
  const [newOwnUrl, setNewOwnUrl] = useState('')
  const [scrapingReviews, setScrapingReviews] = useState(false)
  const [reviewAnalysis, setReviewAnalysis] = useState<{ sentiment: string; praise: string[]; complaints: string[]; themes: string[]; summary: string } | null>(null)
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

      {/* AMAZON PRODUCT URL - team only */}
      {brand && !isClient && (
        <Card className="mb-6">
          <div className="text-sm font-bold mb-1">Track Competitor Products on Amazon</div>
          <div className="text-2xs text-text-dim mb-3">Paste Amazon product URLs to mine customer reviews. HyperListening uses these on every scan.</div>
          <div className="flex gap-2 mb-3">
            <input
              type="url"
              placeholder="https://amazon.com/dp/B08XYZ... or full Amazon product URL"
              value={newCompetitorUrl}
              onChange={e => setNewCompetitorUrl(e.target.value)}
              className="flex-1 px-3 py-2.5 bg-page border border-border rounded text-sm text-text-primary focus:border-fulton focus:outline-none"
            />
            <Button
              disabled={!newCompetitorUrl.trim() || savingUrls}
              onClick={async () => {
                if (!newCompetitorUrl.trim()) return
                const urls = [...competitorUrls, newCompetitorUrl.trim()]
                setNewCompetitorUrl('')
                await saveCompetitorUrls(urls)
              }}
            >
              {savingUrls ? 'Saving...' : 'Add + Save'}
            </Button>
          </div>
          {competitorUrls.length > 0 && (
            <div className="space-y-1.5">
              {competitorUrls.map((url, i) => (
                <div key={i} className="flex items-center gap-2 bg-page border border-border rounded px-3 py-1.5">
                  <span className="text-xs text-text-secondary truncate flex-1">{url}</span>
                  <button onClick={async () => { const urls = competitorUrls.filter((_, idx) => idx !== i); await saveCompetitorUrls(urls) }} className="text-text-dim hover:text-red text-xs px-1 shrink-0">remove</button>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

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
          {/* SUMMARY */}
          <Card title="Executive Summary">
            <p className="text-sm text-text-secondary leading-relaxed mb-3">{research.summary}</p>
            <div className="flex gap-2 flex-wrap">
              <Pill variant="blue">{research.industry}</Pill>
              <Pill variant="gray">{research.productCategory}</Pill>
              <Pill variant="green">{research.priceRange}</Pill>
              <Pill variant="gray">{research.targetDemo}</Pill>
            </div>
          </Card>

          {/* BRAND VOICE */}
          <Card title="Brand Voice">
            <p className="text-sm text-text-secondary leading-relaxed">{research.brandVoice}</p>
          </Card>

          {/* KEY PHRASES / AVOID */}
          <div className="flex gap-4">
            <Card title="Key Phrases" className="flex-1">
              <div className="flex flex-wrap gap-1.5">
                {research.keyPhrases?.map((p, i) => <span key={i} className="text-2xs bg-green-light text-green px-2 py-0.5 rounded">{p}</span>)}
              </div>
            </Card>
            <Card title="Avoid" className="flex-1">
              <div className="flex flex-wrap gap-1.5">
                {research.avoidPhrases?.map((p, i) => <span key={i} className="text-2xs bg-red-light text-red px-2 py-0.5 rounded">{p}</span>)}
              </div>
            </Card>
          </div>

          {/* TARGET PERSONAS - hide when in competitor research mode */}
          {initialSection !== 'competitor-analysis' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black">Target Personas</h3>
              <Button variant="ghost" size="sm" onClick={() => setShowAddPersona(!showAddPersona)}>
                {showAddPersona ? 'Cancel' : '+ Add Persona'}
              </Button>
            </div>
            {showAddPersona && (
              <Card className="mb-4">
                <div className="space-y-2">
                  <input type="text" placeholder="Persona name (e.g. Runners, 25-40)" value={newPersonaName} onChange={e => setNewPersonaName(e.target.value)} className="w-full px-3 py-2.5 bg-page border border-border rounded text-sm text-text-primary focus:border-fulton focus:outline-none" autoFocus />
                  <input type="text" placeholder="Description" value={newPersonaDesc} onChange={e => setNewPersonaDesc(e.target.value)} className="w-full px-3 py-2.5 bg-page border border-border rounded text-sm text-text-primary focus:border-fulton focus:outline-none" />
                  <input type="text" placeholder="Ad hook" value={newPersonaHook} onChange={e => setNewPersonaHook(e.target.value)} className="w-full px-3 py-2.5 bg-page border border-border rounded text-sm text-text-primary focus:border-fulton focus:outline-none" />
                  <Button size="sm" className="w-full justify-center" onClick={handleAddPersona} disabled={!newPersonaName.trim()}>Save Persona</Button>
                </div>
              </Card>
            )}
            <div className="space-y-4">
              {research.personas?.map((p, i) => (
                <Card key={i}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xs font-bold text-fulton bg-fulton-light px-2 py-0.5 rounded">P{i + 1}</span>
                    <span className="text-sm font-bold">{p.name}</span>
                  </div>
                  <p className="text-xs text-text-dim mb-3">{p.description}</p>
                  {p.painPoints?.length > 0 && (
                    <div className="mb-2">
                      <span className="text-2xs font-bold text-text-muted uppercase tracking-wider">Pain Points</span>
                      <ul className="mt-1 space-y-0.5 list-disc list-inside">
                        {p.painPoints.map((pp, j) => <li key={j} className="text-xs text-text-dim">{pp}</li>)}
                      </ul>
                    </div>
                  )}
                  {p.motivators?.length > 0 && (
                    <div className="mb-2">
                      <span className="text-2xs font-bold text-text-muted uppercase tracking-wider">Motivators</span>
                      <ul className="mt-1 space-y-0.5 list-disc list-inside">
                        {p.motivators.map((m, j) => <li key={j} className="text-xs text-text-dim">{m}</li>)}
                      </ul>
                    </div>
                  )}
                  {p.hook && (
                    <div className="bg-fulton-light border border-fulton/20 rounded px-3 py-2 mt-2">
                      <span className="text-2xs font-bold text-fulton">Hook: </span>
                      <span className="text-xs text-text-secondary">{p.hook}</span>
                    </div>
                  )}
                </Card>
              ))}
            </div>

            {/* Generate Actions */}
            {research.personas?.length > 0 && (
              <div className="flex gap-2 mt-4">
                <Button onClick={generateUGCScripts} disabled={generatingScripts} variant="secondary" size="sm" className="flex-1 justify-center">
                  {generatingScripts ? <><LoadingSpinner size={14} /> Generating...</> : '🎬 Generate UGC Scripts'}
                </Button>
                <Button onClick={generateHeadlines} disabled={generatingHeadlines} variant="secondary" size="sm" className="flex-1 justify-center">
                  {generatingHeadlines ? <><LoadingSpinner size={14} /> Generating...</> : '📝 Generate Ad Headlines'}
                </Button>
              </div>
            )}
          </div>
          )}

          {/* COMPETITOR ANALYSIS */}
          <div id="competitor-analysis">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black">Competitor Analysis</h3>
              <Button onClick={runCompetitorAnalysis} disabled={researchingCompetitors}>
                {researchingCompetitors ? <><LoadingSpinner size={14} /> Analyzing...</> : 'Run Competitor Analysis'}
              </Button>
            </div>

            {/* Known competitors */}
            <Card className="mb-4">
              <div className="text-sm font-bold mb-2">Known Competitors</div>
              <div className="flex flex-wrap gap-2">
                {research.competitors?.map((c, i) => (
                  <span key={i} className="text-sm font-semibold bg-elevated border border-border px-3 py-1.5 rounded">{c}</span>
                ))}
              </div>
            </Card>

            {researchingCompetitors && (
              <LoadingState size="md" title="Mining Reddit for competitor discussions..." subtitle="Claude is analyzing weaknesses, complaints, and ad opportunities" />
            )}

            {/* Competitor deep analysis results */}
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
                      <div className="mb-4">
                        <div className="text-xs font-bold text-red uppercase tracking-wider mb-2">Their Weaknesses</div>
                        <ul className="space-y-1 list-disc list-inside">
                          {c.weaknesses.map((w, j) => <li key={j} className="text-sm text-text-secondary">{w}</li>)}
                        </ul>
                      </div>
                    )}

                    {c.customerComplaints?.length > 0 && (
                      <div className="mb-4">
                        <div className="text-xs font-bold text-amber uppercase tracking-wider mb-2">Customer Complaints</div>
                        <ul className="space-y-1 list-disc list-inside">
                          {c.customerComplaints.map((cc, j) => <li key={j} className="text-sm text-text-secondary italic">{cc}</li>)}
                        </ul>
                      </div>
                    )}

                    {c.adAngles?.length > 0 && (
                      <div className="mb-4">
                        <div className="text-xs font-bold text-fulton uppercase tracking-wider mb-2">Ad Angles Against Them</div>
                        <ul className="space-y-1 list-disc list-inside">
                          {c.adAngles.map((a, j) => <li key={j} className="text-sm text-text-secondary">{a}</li>)}
                        </ul>
                      </div>
                    )}

                    {c.opportunities?.length > 0 && (
                      <div>
                        <div className="text-xs font-bold text-green uppercase tracking-wider mb-2">Opportunities</div>
                        <ul className="space-y-1 list-disc list-inside">
                          {c.opportunities.map((o, j) => <li key={j} className="text-sm text-text-secondary">{o}</li>)}
                        </ul>
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
                  <div className="text-xs text-text-dim">Click "Run Competitor Analysis" to mine Reddit for competitor weaknesses, customer complaints, and ad angles</div>
                </div>
              </Card>
            )}
          </div>

          {/* AMAZON REVIEWS */}
          <div id="amazon-reviews">
            <h3 className="text-lg font-black mb-4">Amazon Review Tracking</h3>

            <Card className="mb-4">
              <div className="text-sm font-bold mb-2">Your Product URLs</div>
              <div className="text-2xs text-text-dim mb-3">Add your Amazon product pages to track and analyze customer reviews</div>
              <div className="space-y-2 mb-3">
                {ownProductUrls.map((url, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs text-blue flex-1 truncate">{url}</span>
                    <button onClick={() => saveOwnUrls(ownProductUrls.filter((_, idx) => idx !== i))}
                      className="text-2xs text-red hover:underline shrink-0">Remove</button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="url"
                  placeholder="https://www.amazon.com/dp/..."
                  value={newOwnUrl}
                  onChange={e => setNewOwnUrl(e.target.value)}
                  className="flex-1 px-3 py-2 bg-page border border-border rounded text-sm text-text-primary focus:border-fulton focus:outline-none"
                />
                <Button size="sm" disabled={!newOwnUrl.trim()} onClick={() => {
                  if (!newOwnUrl.trim()) return
                  saveOwnUrls([...ownProductUrls, newOwnUrl.trim()])
                  setNewOwnUrl('')
                  onToast('Product URL added', 'success')
                }}>Add</Button>
              </div>
            </Card>

            <Button onClick={scrapeOwnReviews} disabled={scrapingReviews || ownProductUrls.length === 0} className="w-full justify-center mb-4">
              {scrapingReviews ? <><LoadingSpinner size={14} /> Analyzing Reviews...</> : 'Analyze Amazon Reviews'}
            </Button>

            {scrapingReviews && (
              <LoadingState size="md" title="Scraping and analyzing reviews..." subtitle="This may take 30-60 seconds" />
            )}

            {reviewAnalysis && !scrapingReviews && (
              <div className="space-y-3">
                <Card>
                  <div className="text-sm font-bold mb-2">Overall Sentiment</div>
                  <div className="text-sm text-text-secondary">{reviewAnalysis.sentiment}</div>
                </Card>
                <Card>
                  <div className="text-sm font-bold mb-2">Summary</div>
                  <div className="text-sm text-text-secondary leading-relaxed">{reviewAnalysis.summary}</div>
                </Card>
                <div className="grid grid-cols-2 gap-3">
                  <Card>
                    <div className="text-xs font-bold text-green uppercase tracking-wider mb-2">What Customers Love</div>
                    <ul className="space-y-1 list-disc list-inside">
                      {reviewAnalysis.praise?.map((p, i) => <li key={i} className="text-xs text-text-secondary">{p}</li>)}
                    </ul>
                  </Card>
                  <Card>
                    <div className="text-xs font-bold text-red uppercase tracking-wider mb-2">Common Complaints</div>
                    <ul className="space-y-1 list-disc list-inside">
                      {reviewAnalysis.complaints?.map((c, i) => <li key={i} className="text-xs text-text-secondary">{c}</li>)}
                    </ul>
                  </Card>
                </div>
                <Card>
                  <div className="text-xs font-bold text-fulton uppercase tracking-wider mb-2">Trending Themes</div>
                  <div className="flex flex-wrap gap-2">
                    {reviewAnalysis.themes?.map((t, i) => <span key={i} className="text-2xs bg-fulton-light text-fulton px-2 py-0.5 rounded">{t}</span>)}
                  </div>
                </Card>
              </div>
            )}

            {!reviewAnalysis && !scrapingReviews && ownProductUrls.length === 0 && (
              <Card>
                <div className="text-center py-6">
                  <div className="text-2xl mb-2">📦</div>
                  <div className="text-sm font-bold mb-1">No products tracked yet</div>
                  <div className="text-xs text-text-dim">Add your Amazon product URLs above to start tracking reviews</div>
                </div>
              </Card>
            )}
          </div>

          {/* VALUE PROPS - hide in competitor mode */}
          {initialSection !== 'competitor-analysis' && (<>
          {/* VALUE PROPS */}
          <Card title="Value Propositions">
            <ul className="space-y-1.5 list-disc list-inside">
              {research.valueProps?.map((v, i) => <li key={i} className="text-xs text-text-secondary">{v}</li>)}
            </ul>
          </Card>

          {/* PAIN POINTS & MOTIVATORS */}
          <Card title="Customer Pain Points">
            <ul className="space-y-1.5 list-disc list-inside">
              {research.painPoints?.map((p, i) => <li key={i} className="text-xs text-text-secondary">{p}</li>)}
            </ul>
          </Card>

          <Card title="Purchase Motivators">
            <ul className="space-y-1.5 list-disc list-inside">
              {research.motivators?.map((m, i) => <li key={i} className="text-xs text-text-secondary">{m}</li>)}
            </ul>
          </Card>

          <Card title="Common Objections">
            <ul className="space-y-1.5 list-disc list-inside">
              {research.objections?.map((o, i) => <li key={i} className="text-xs text-text-secondary">{o}</li>)}
            </ul>
          </Card>

          {/* LISTENING CONFIG */}
          <Card title="Search Keywords" subtitle="Used by HyperListening for signal scanning">
            <div className="flex flex-wrap gap-1.5">
              {research.searchKeywords?.map((k, i) => <span key={i} className="text-2xs bg-blue-light text-blue px-2 py-0.5 rounded">{k}</span>)}
            </div>
          </Card>

          <Card title="Tracked Subreddits">
            <div className="flex flex-wrap gap-1.5">
              {research.subreddits?.map((s, i) => <span key={i} className="text-2xs bg-elevated border border-border px-2 py-0.5 rounded">r/{s}</span>)}
            </div>
          </Card>
          </>)}
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
