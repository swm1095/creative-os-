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

type ResearchTab = 'overview' | 'personas' | 'competitors' | 'keywords'

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
  const [activeSection, setActiveSection] = useState<ResearchTab>('overview')
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
      const res = await fetch('/api/brand-research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandId, websiteUrl: url, brandName: name }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setResearch(data.research)
      if (data.brandId) {
        onBrandUpdate(data.brandId, { research: data.research, research_completed: true, name, url: url || '' })
        if (onSetActiveBrand) {
          onSetActiveBrand({ id: data.brandId, name, url: url || '', color: '#2B4EFF', research: data.research, research_completed: true, created_at: new Date().toISOString(), creative_count: 0 })
        }
      }
      if (onRefreshBrands) await onRefreshBrands()
      onToast(`Research complete - ${data.research.personas?.length || 0} personas, ${data.research.searchKeywords?.length || 0} keywords`, 'success')
    } catch (err: unknown) {
      onToast(`Research failed: ${err instanceof Error ? err.message : String(err)}`, 'error')
    }
    setResearching(false)
  }

  const handleAddBrand = async () => {
    if (!newBrandName.trim()) { onToast('Enter a brand name', 'error'); return }
    try {
      const name = newBrandName; const url = newBrandUrl
      setNewBrandName(''); setNewBrandUrl('')
      await runResearch(undefined, url, name)
    } catch (err: unknown) {
      onToast(`Failed: ${err instanceof Error ? err.message : String(err)}`, 'error')
    }
  }

  const handleAddPersona = async () => {
    if (!brand?.id || !newPersonaName.trim() || !research) return
    const newPersona = { name: newPersonaName, age: '', description: newPersonaDesc, painPoints: [], motivators: [], channels: [], hook: newPersonaHook }
    const updatedResearch = { ...research, personas: [...(research.personas || []), newPersona] }
    try {
      await fetch('/api/brands', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: brand.id, research: updatedResearch }) })
      setResearch(updatedResearch)
      onBrandUpdate(brand.id, { research: updatedResearch })
      setNewPersonaName(''); setNewPersonaDesc(''); setNewPersonaHook(''); setShowAddPersona(false)
      onToast(`Persona "${newPersonaName}" added`, 'success')
    } catch (err: unknown) { onToast(`Failed: ${err instanceof Error ? err.message : String(err)}`, 'error') }
  }

  const saveCompetitorUrls = async () => {
    if (!brand?.id) return
    setSavingUrls(true)
    try {
      await fetch('/api/brands', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: brand.id, competitor_urls: competitorUrls }) })
      onBrandUpdate(brand.id, { competitor_urls: competitorUrls })
      onToast(`${competitorUrls.length} product URLs saved`, 'success')
    } catch (err: unknown) { onToast(`Failed: ${err instanceof Error ? err.message : String(err)}`, 'error') }
    setSavingUrls(false)
  }

  const sectionTabs: { id: ResearchTab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'personas', label: `Personas (${research?.personas?.length || 0})` },
    { id: 'competitors', label: 'Competitors & Products' },
    { id: 'keywords', label: 'Keywords & Phrases' },
  ]

  return (
    <div className="animate-fadeIn">
      {/* Top tab bar - research vs saved insights */}
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

      {/* Brand research header */}
      {brand && research && (
        <PageHeader
          title={`${brand.name} - Brand Research`}
          subtitle={`Researched ${research.researchDate ? new Date(research.researchDate).toLocaleDateString() : 'recently'}`}
          action={
            <Button variant="secondary" onClick={() => runResearch()} disabled={researching}>
              {researching ? <><LoadingSpinner size={14} /> Researching...</> : 'Re-run Research'}
            </Button>
          }
        />
      )}

      {researching && <LoadingState size="lg" title="Claude is analyzing the brand..." subtitle="Scraping website, identifying competitors, building personas" />}

      {research && !researching && (
        <>
          {/* Section tabs */}
          <div className="flex gap-1 mb-6 border-b border-border">
            {sectionTabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveSection(tab.id)}
                className={`px-4 py-2.5 text-xs font-bold border-b-2 -mb-px transition-colors ${
                  activeSection === tab.id ? 'border-fulton text-fulton' : 'border-transparent text-text-dim hover:text-text-primary'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* OVERVIEW TAB */}
          {activeSection === 'overview' && (
            <div className="grid grid-cols-2 gap-4">
              <Card title="Executive Summary">
                <p className="text-sm text-text-secondary leading-relaxed mb-3">{research.summary}</p>
                <div className="flex gap-2 flex-wrap">
                  <Pill variant="blue">{research.industry}</Pill>
                  <Pill variant="gray">{research.productCategory}</Pill>
                  <Pill variant="green">{research.priceRange}</Pill>
                </div>
              </Card>
              <Card title="Brand Voice">
                <p className="text-sm text-text-secondary leading-relaxed mb-3">{research.brandVoice}</p>
              </Card>
              <Card title="Value Propositions">
                <ul className="space-y-1.5">
                  {research.valueProps?.map((v, i) => <li key={i} className="text-xs text-text-secondary">- {v}</li>)}
                </ul>
              </Card>
              <Card title="Differentiators">
                <ul className="space-y-1.5">
                  {research.differentiators?.map((d, i) => <li key={i} className="text-xs text-text-secondary">- {d}</li>)}
                </ul>
              </Card>
              <Card title="Customer Pain Points">
                <ul className="space-y-1.5">
                  {research.painPoints?.map((p, i) => <li key={i} className="text-xs text-text-secondary">- {p}</li>)}
                </ul>
              </Card>
              <Card title="Purchase Motivators">
                <ul className="space-y-1.5">
                  {research.motivators?.map((m, i) => <li key={i} className="text-xs text-text-secondary">- {m}</li>)}
                </ul>
              </Card>
            </div>
          )}

          {/* PERSONAS TAB */}
          {activeSection === 'personas' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <SectionHeader title="Target Personas" subtitle={`${research.personas?.length || 0} identified`} />
                <Button variant="ghost" size="sm" onClick={() => setShowAddPersona(!showAddPersona)}>
                  {showAddPersona ? 'Cancel' : '+ Add Persona'}
                </Button>
              </div>
              {showAddPersona && (
                <Card className="mb-4">
                  <div className="space-y-2">
                    <input type="text" placeholder="Persona name (e.g. Runners, 25-40)" value={newPersonaName} onChange={e => setNewPersonaName(e.target.value)} className="w-full px-3 py-2 bg-page border border-border rounded text-sm text-text-primary focus:border-fulton focus:outline-none" autoFocus />
                    <input type="text" placeholder="Description" value={newPersonaDesc} onChange={e => setNewPersonaDesc(e.target.value)} className="w-full px-3 py-2 bg-page border border-border rounded text-sm text-text-primary focus:border-fulton focus:outline-none" />
                    <input type="text" placeholder="Ad hook" value={newPersonaHook} onChange={e => setNewPersonaHook(e.target.value)} className="w-full px-3 py-2 bg-page border border-border rounded text-sm text-text-primary focus:border-fulton focus:outline-none" />
                    <Button size="sm" className="w-full justify-center" onClick={handleAddPersona} disabled={!newPersonaName.trim()}>Save Persona</Button>
                  </div>
                </Card>
              )}
              <div className="grid grid-cols-2 gap-4">
                {research.personas?.map((p, i) => (
                  <Card key={i}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xs font-bold text-fulton bg-fulton-light px-2 py-0.5 rounded">P{i + 1}</span>
                      <span className="text-sm font-bold">{p.name}</span>
                    </div>
                    <p className="text-xs text-text-dim mb-2">{p.description}</p>
                    <div className="grid grid-cols-2 gap-2 text-2xs">
                      <div><span className="font-bold text-text-muted uppercase tracking-wider">Pain Points</span><ul className="mt-1 space-y-0.5">{p.painPoints?.map((pp, j) => <li key={j} className="text-text-dim">- {pp}</li>)}</ul></div>
                      <div><span className="font-bold text-text-muted uppercase tracking-wider">Motivators</span><ul className="mt-1 space-y-0.5">{p.motivators?.map((m, j) => <li key={j} className="text-text-dim">- {m}</li>)}</ul></div>
                    </div>
                    {p.hook && (
                      <div className="bg-fulton-light border border-fulton/20 rounded px-2.5 py-1.5 mt-2">
                        <span className="text-2xs font-bold text-fulton">Hook: </span>
                        <span className="text-xs text-text-secondary">{p.hook}</span>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
              <Card title="Common Objections" className="mt-4">
                <ul className="space-y-1.5">
                  {research.objections?.map((o, i) => <li key={i} className="text-xs text-text-secondary">- {o}</li>)}
                </ul>
              </Card>
            </div>
          )}

          {/* COMPETITORS TAB */}
          {activeSection === 'competitors' && (
            <div className="space-y-4">
              {/* Competitor names */}
              <Card title="Known Competitors">
                <div className="flex flex-wrap gap-2 mb-3">
                  {research.competitors?.map((c, i) => (
                    <span key={i} className="text-xs font-semibold bg-elevated border border-border px-2.5 py-1 rounded">{c}</span>
                  ))}
                </div>
                <Button size="sm" variant="secondary" className="w-full justify-center" disabled={researchingCompetitors} onClick={async () => {
                  if (!brand?.id) return
                  setResearchingCompetitors(true)
                  onToast('Mining Reddit for competitor discussions...', 'info')
                  try {
                    const res = await fetch('/api/competitor-research', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ brandId: brand.id }) })
                    const data = await res.json()
                    if (data.error) throw new Error(data.error)
                    setCompetitorInsights(data.competitors || [])
                    onToast(`${data.competitors?.length || 0} competitors analyzed`, 'success')
                  } catch (err: unknown) { onToast(`Failed: ${err instanceof Error ? err.message : String(err)}`, 'error') }
                  setResearchingCompetitors(false)
                }}>
                  {researchingCompetitors ? <><LoadingSpinner size={12} /> Analyzing...</> : 'Deep Analyze Competitors'}
                </Button>
              </Card>

              {/* Competitor deep analysis results */}
              {competitorInsights.length > 0 && (
                <div className="space-y-3">
                  <SectionHeader title="Competitor Analysis" subtitle="Weaknesses and ad angles from Reddit discussions" />
                  {competitorInsights.map((c, i) => (
                    <Card key={i}>
                      <div className="text-sm font-bold mb-1">{c.name}</div>
                      <div className="text-2xs text-text-dim mb-3">{c.positioning}</div>
                      <div className="grid grid-cols-2 gap-4">
                        {c.weaknesses?.length > 0 && (
                          <div>
                            <div className="text-2xs font-bold text-red uppercase tracking-wider mb-1">Weaknesses</div>
                            <ul className="space-y-0.5">{c.weaknesses.slice(0, 4).map((w, j) => <li key={j} className="text-2xs text-text-secondary">- {w}</li>)}</ul>
                          </div>
                        )}
                        {c.adAngles?.length > 0 && (
                          <div>
                            <div className="text-2xs font-bold text-fulton uppercase tracking-wider mb-1">Ad Angles</div>
                            <ul className="space-y-0.5">{c.adAngles.slice(0, 4).map((a, j) => <li key={j} className="text-2xs text-text-secondary">- {a}</li>)}</ul>
                          </div>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              )}

              {/* Amazon product URLs */}
              <Card title="Amazon Product URLs" subtitle="Paste competitor product links - HyperListening will mine reviews automatically">
                {competitorUrls.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {competitorUrls.map((url, i) => (
                      <div key={i} className="flex items-center gap-2 bg-page border border-border rounded px-3 py-2">
                        <span className="text-2xs font-bold text-fulton bg-fulton-light px-1.5 py-0.5 rounded shrink-0">#{i+1}</span>
                        <span className="text-xs text-text-secondary truncate flex-1">{url}</span>
                        <button onClick={() => setCompetitorUrls(prev => prev.filter((_, idx) => idx !== i))} className="text-text-dim hover:text-red text-xs px-1 shrink-0">x</button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2 mb-3">
                  <input type="url" placeholder="https://amazon.com/dp/ASIN or full product URL" value={newCompetitorUrl} onChange={e => setNewCompetitorUrl(e.target.value)} className="flex-1 px-3 py-2.5 bg-page border border-border rounded text-sm text-text-primary focus:border-fulton focus:outline-none" />
                  <Button size="sm" variant="ghost" disabled={!newCompetitorUrl.trim()} onClick={() => { if (!newCompetitorUrl.trim()) return; setCompetitorUrls(prev => [...prev, newCompetitorUrl.trim()]); setNewCompetitorUrl('') }}>Add</Button>
                </div>
                {competitorUrls.length > 0 && (
                  <Button size="sm" className="w-full justify-center" disabled={savingUrls || !brand?.id} onClick={saveCompetitorUrls}>
                    {savingUrls ? <><LoadingSpinner size={12} /> Saving...</> : `Save ${competitorUrls.length} URLs`}
                  </Button>
                )}
              </Card>
            </div>
          )}

          {/* KEYWORDS TAB */}
          {activeSection === 'keywords' && (
            <div className="grid grid-cols-2 gap-4">
              <Card title="Key Phrases">
                <div className="flex flex-wrap gap-1.5">
                  {research.keyPhrases?.map((p, i) => (
                    <span key={i} className="text-2xs bg-green-light text-green px-2 py-0.5 rounded">{p}</span>
                  ))}
                </div>
              </Card>
              <Card title="Phrases to Avoid">
                <div className="flex flex-wrap gap-1.5">
                  {research.avoidPhrases?.map((p, i) => (
                    <span key={i} className="text-2xs bg-red-light text-red px-2 py-0.5 rounded">{p}</span>
                  ))}
                </div>
              </Card>
              <Card title="Search Keywords" subtitle="Used by HyperListening for signal scanning">
                <div className="flex flex-wrap gap-1.5">
                  {research.searchKeywords?.map((k, i) => (
                    <span key={i} className="text-2xs bg-blue-light text-blue px-2 py-0.5 rounded">{k}</span>
                  ))}
                </div>
              </Card>
              <Card title="Subreddits">
                <div className="flex flex-wrap gap-1.5">
                  {research.subreddits?.map((s, i) => (
                    <span key={i} className="text-2xs bg-elevated border border-border px-2 py-0.5 rounded">r/{s}</span>
                  ))}
                </div>
              </Card>
              <Card title="Hashtags">
                <div className="flex flex-wrap gap-1.5">
                  {research.hashTags?.map((h, i) => (
                    <span key={i} className="text-2xs bg-elevated border border-border px-2 py-0.5 rounded">#{h}</span>
                  ))}
                </div>
              </Card>
              <Card title="Messaging Themes">
                <ul className="space-y-1.5">
                  {research.messagingThemes?.map((t, i) => <li key={i} className="text-xs text-text-secondary">- {t}</li>)}
                </ul>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  )
}
