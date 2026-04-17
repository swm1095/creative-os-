'use client'

import { useState } from 'react'
import { Brand, BrandResearch } from '@/lib/types'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import SectionHeader from '@/components/ui/SectionHeader'
import FormInput from '@/components/ui/FormInput'
import LoadingSpinner, { LoadingState } from '@/components/ui/LoadingSpinner'
import Pill from '@/components/ui/Pill'
import PageHeader from '@/components/ui/PageHeader'

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
}

export default function BrandResearchView({ brand, onToast, onBrandUpdate, onCreateBrand, onRefreshBrands, onSetActiveBrand, activeTab = 'research', onChangeTab }: BrandResearchViewProps) {
  const [newBrandName, setNewBrandName] = useState('')
  const [newBrandUrl, setNewBrandUrl] = useState('')
  const [researching, setResearching] = useState(false)
  const [research, setResearch] = useState<BrandResearch | null>(brand?.research as BrandResearch || null)
  const [researchingCompetitors, setResearchingCompetitors] = useState(false)
  const [competitorInsights, setCompetitorInsights] = useState<CompetitorInsight[]>(() => {
    const b = brand as Brand & { competitor_research?: CompetitorInsight[] }
    return b?.competitor_research || []
  })
  const [competitorUrls, setCompetitorUrls] = useState<string[]>(brand?.competitor_urls || [])
  const [newCompetitorUrl, setNewCompetitorUrl] = useState('')
  const [savingUrls, setSavingUrls] = useState(false)
  const [showAddPersona, setShowAddPersona] = useState(false)
  const [newPersonaName, setNewPersonaName] = useState('')
  const [newPersonaDesc, setNewPersonaDesc] = useState('')
  const [newPersonaHook, setNewPersonaHook] = useState('')

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
    const newP = { name: newPersonaName, age: '', description: newPersonaDesc, painPoints: [], motivators: [], channels: [], hook: newPersonaHook }
    const updated = { ...research, personas: [...(research.personas || []), newP] }
    try {
      await fetch('/api/brands', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: brand.id, research: updated }) })
      setResearch(updated); onBrandUpdate(brand.id, { research: updated })
      setNewPersonaName(''); setNewPersonaDesc(''); setNewPersonaHook(''); setShowAddPersona(false)
      onToast(`Persona "${newPersonaName}" added`, 'success')
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
    setResearchingCompetitors(true)
    onToast('Mining Reddit for competitor discussions...', 'info')
    try {
      const res = await fetch('/api/competitor-research', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ brandId: brand.id }) })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setCompetitorInsights(data.competitors || [])
      onToast(`${data.competitors?.length || 0} competitors analyzed`, 'success')
      // Scroll to results
      setTimeout(() => document.getElementById('competitor-analysis')?.scrollIntoView({ behavior: 'smooth' }), 200)
    } catch (err: unknown) { onToast(`Failed: ${err instanceof Error ? err.message : String(err)}`, 'error') }
    setResearchingCompetitors(false)
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

      {/* Add new brand */}
      <Card title="Add New Brand" subtitle="Enter a brand name and website - Claude will do deep research automatically" className="mb-6">
        <div className="flex gap-3 items-end">
          <FormInput label="Brand Name" placeholder="e.g. Fulton" value={newBrandName} onChange={e => setNewBrandName(e.target.value)} className="flex-1" />
          <FormInput label="Website URL" placeholder="https://walkfulton.com" value={newBrandUrl} onChange={e => setNewBrandUrl(e.target.value)} className="flex-1" />
          <Button onClick={handleAddBrand} disabled={researching || !newBrandName.trim()}>
            {researching ? <><LoadingSpinner size={14} /> Researching...</> : 'Add + Research'}
          </Button>
        </div>
      </Card>

      {/* AMAZON PRODUCT URL - ALWAYS VISIBLE AT TOP */}
      {brand && (
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
          action={
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={runCompetitorAnalysis} disabled={researchingCompetitors}>
                {researchingCompetitors ? <><LoadingSpinner size={12} /> Analyzing...</> : 'Analyze Competitors'}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => runResearch()} disabled={researching}>
                {researching ? <><LoadingSpinner size={12} /> Running...</> : 'Re-run Research'}
              </Button>
            </div>
          }
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

          {/* TARGET PERSONAS */}
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
          </div>

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
        </div>
      )}
    </div>
  )
}
