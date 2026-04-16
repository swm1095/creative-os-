'use client'

import { useState } from 'react'
import { Brand, BrandResearch } from '@/lib/types'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import SectionHeader from '@/components/ui/SectionHeader'
import FormInput from '@/components/ui/FormInput'
import LoadingSpinner, { LoadingState } from '@/components/ui/LoadingSpinner'
import Pill from '@/components/ui/Pill'

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

  const runResearch = async (targetBrandId?: string, targetUrl?: string, targetName?: string) => {
    const brandId = targetBrandId || brand?.id
    const url = targetUrl || brand?.url || ''
    const name = targetName || brand?.name || ''

    if (!name) { onToast('Brand name is required', 'error'); return }

    setResearching(true)
    onToast(`Claude is researching ${name}... This takes about 30 seconds.`, 'info')

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
        // Set as active brand
        if (onSetActiveBrand) {
          onSetActiveBrand({
            id: data.brandId,
            name,
            url: url || '',
            color: '#2B4EFF',
            research: data.research,
            research_completed: true,
            created_at: new Date().toISOString(),
            creative_count: 0,
          })
        }
      }
      // Refresh the brands list so sidebar shows the new brand
      if (onRefreshBrands) await onRefreshBrands()
      onToast(`Research complete for ${name} - ${data.research.personas?.length || 0} personas, ${data.research.searchKeywords?.length || 0} keywords identified`, 'success')
    } catch (err: unknown) {
      onToast(`Research failed: ${err instanceof Error ? err.message : String(err)}`, 'error')
    }
    setResearching(false)
  }

  const handleAddBrand = async () => {
    if (!newBrandName.trim()) { onToast('Enter a brand name', 'error'); return }
    try {
      const name = newBrandName
      const url = newBrandUrl
      setNewBrandName('')
      setNewBrandUrl('')
      // The API handles brand creation server-side with service client (bypasses RLS)
      await runResearch(undefined, url, name)
    } catch (err: unknown) {
      onToast(`Failed: ${err instanceof Error ? err.message : String(err)}`, 'error')
      console.error('Add brand error:', err)
    }
  }

  return (
    <div className="animate-fadeIn">
      {/* Tab bar - switch between Brand Research and Saved Insights */}
      {onChangeTab && (
        <div className="flex items-center gap-1 mb-6 border-b border-border">
          <button
            onClick={() => onChangeTab('research')}
            className={`px-4 py-2.5 text-sm font-bold border-b-2 -mb-px transition-colors ${
              activeTab === 'research' ? 'border-fulton text-fulton' : 'border-transparent text-text-dim hover:text-text-primary'
            }`}
          >
            Brand Research
          </button>
          <button
            onClick={() => onChangeTab('saved-insights')}
            className={`px-4 py-2.5 text-sm font-bold border-b-2 -mb-px transition-colors ${
              activeTab === 'saved-insights' ? 'border-fulton text-fulton' : 'border-transparent text-text-dim hover:text-text-primary'
            }`}
          >
            📁 Saved Insights
          </button>
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

      {/* Current brand research status */}
      {brand && (
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-black">{brand.name} - Brand Research</h3>
            <p className="text-xs text-text-dim mt-0.5">
              {research ? `Researched ${new Date(research.researchDate).toLocaleDateString()}` : 'Not yet researched'}
            </p>
          </div>
          <Button variant="secondary" onClick={() => runResearch()} disabled={researching}>
            {researching ? <><LoadingSpinner size={14} /> Researching...</> : research ? 'Re-run Research' : 'Run Research'}
          </Button>
        </div>
      )}

      {researching && (
        <LoadingState
          size="lg"
          title="Claude is analyzing the brand..."
          subtitle="Scraping website, identifying competitors, building personas"
        />
      )}

      {research && !researching && (
        <div className="grid grid-cols-[1fr_1fr] gap-4">
          {/* Left column */}
          <div className="space-y-4">
            {/* Summary */}
            <Card title="Executive Summary">
              <p className="text-sm text-text-secondary leading-relaxed">{research.summary}</p>
              <div className="flex gap-2 mt-3 flex-wrap">
                <Pill variant="blue">{research.industry}</Pill>
                <Pill variant="gray">{research.productCategory}</Pill>
                <Pill variant="green">{research.priceRange}</Pill>
              </div>
            </Card>

            {/* Personas */}
            <div>
              <SectionHeader title="Target Personas" subtitle={`${research.personas?.length || 0} identified`} />
              <div className="space-y-3">
                {research.personas?.map((persona, i) => (
                  <Card key={i}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xs font-bold text-fulton bg-fulton-light px-2 py-0.5 rounded">P{i + 1}</span>
                      <span className="text-sm font-bold">{persona.name}</span>
                    </div>
                    <p className="text-xs text-text-dim mb-2">{persona.description}</p>
                    <div className="grid grid-cols-2 gap-2 text-2xs">
                      <div>
                        <span className="font-bold text-text-muted uppercase tracking-wider">Pain Points</span>
                        <ul className="mt-1 space-y-0.5">
                          {persona.painPoints?.map((p, j) => <li key={j} className="text-text-dim">- {p}</li>)}
                        </ul>
                      </div>
                      <div>
                        <span className="font-bold text-text-muted uppercase tracking-wider">Motivators</span>
                        <ul className="mt-1 space-y-0.5">
                          {persona.motivators?.map((m, j) => <li key={j} className="text-text-dim">- {m}</li>)}
                        </ul>
                      </div>
                    </div>
                    <div className="mt-2 bg-fulton-light border border-fulton/20 rounded px-3 py-1.5">
                      <span className="text-2xs font-bold text-fulton">Hook: </span>
                      <span className="text-xs text-text-secondary">{persona.hook}</span>
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            {/* Pain Points & Motivators */}
            <div className="grid grid-cols-2 gap-3">
              <Card title="Customer Pain Points">
                <ul className="space-y-1.5">
                  {research.painPoints?.map((p, i) => (
                    <li key={i} className="text-xs text-text-secondary">- {p}</li>
                  ))}
                </ul>
              </Card>
              <Card title="Purchase Motivators">
                <ul className="space-y-1.5">
                  {research.motivators?.map((m, i) => (
                    <li key={i} className="text-xs text-text-secondary">- {m}</li>
                  ))}
                </ul>
              </Card>
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-4">
            {/* Brand Voice */}
            <Card title="Brand Voice">
              <p className="text-sm text-text-secondary leading-relaxed mb-3">{research.brandVoice}</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-2xs font-bold text-green uppercase tracking-wider">Key Phrases</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {research.keyPhrases?.map((p, i) => (
                      <span key={i} className="text-2xs bg-green-light text-green px-1.5 py-0.5 rounded">{p}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="text-2xs font-bold text-red uppercase tracking-wider">Avoid</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {research.avoidPhrases?.map((p, i) => (
                      <span key={i} className="text-2xs bg-red-light text-red px-1.5 py-0.5 rounded">{p}</span>
                    ))}
                  </div>
                </div>
              </div>
            </Card>

            {/* Competitors */}
            <Card title="Competitors">
              <div className="flex flex-wrap gap-2 mb-3">
                {research.competitors?.map((c, i) => (
                  <span key={i} className="text-xs font-semibold bg-elevated border border-border px-2.5 py-1 rounded">{c}</span>
                ))}
              </div>
              <Button
                size="sm"
                variant="secondary"
                className="w-full justify-center"
                disabled={researchingCompetitors}
                onClick={async () => {
                  if (!brand?.id) return
                  setResearchingCompetitors(true)
                  onToast('Analyzing competitors... mining Reddit for complaints and opportunities', 'info')
                  try {
                    const res = await fetch('/api/competitor-research', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ brandId: brand.id }),
                    })
                    const data = await res.json()
                    if (data.error) throw new Error(data.error)
                    setCompetitorInsights(data.competitors || [])
                    onToast(`Deep analysis complete - ${data.competitors?.length || 0} competitors analyzed`, 'success')
                  } catch (err: unknown) {
                    onToast(`Failed: ${err instanceof Error ? err.message : String(err)}`, 'error')
                  }
                  setResearchingCompetitors(false)
                }}
              >
                {researchingCompetitors ? <><LoadingSpinner size={12} /> Analyzing...</> : '🔍 Deep Analyze Competitors'}
              </Button>

              {/* Competitor insights */}
              {competitorInsights.length > 0 && (
                <div className="mt-4 space-y-3">
                  {competitorInsights.map((c, i) => (
                    <div key={i} className="bg-page border border-border rounded-lg p-3">
                      <div className="text-sm font-bold mb-1">{c.name}</div>
                      <div className="text-2xs text-text-dim mb-2">{c.positioning}</div>
                      {c.weaknesses?.length > 0 && (
                        <div className="mb-2">
                          <div className="text-2xs font-bold text-red uppercase tracking-wider mb-1">Weaknesses</div>
                          <ul className="space-y-0.5">
                            {c.weaknesses.slice(0, 3).map((w, j) => <li key={j} className="text-2xs text-text-secondary">- {w}</li>)}
                          </ul>
                        </div>
                      )}
                      {c.adAngles?.length > 0 && (
                        <div>
                          <div className="text-2xs font-bold text-fulton uppercase tracking-wider mb-1">Ad Angles Against Them</div>
                          <ul className="space-y-0.5">
                            {c.adAngles.slice(0, 3).map((a, j) => <li key={j} className="text-2xs text-text-secondary">- {a}</li>)}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Value Props */}
            <Card title="Value Propositions">
              <ul className="space-y-1.5">
                {research.valueProps?.map((v, i) => (
                  <li key={i} className="text-xs text-text-secondary">- {v}</li>
                ))}
              </ul>
            </Card>

            {/* Social Listening Config */}
            <Card title="Social Listening Keywords" subtitle="Auto-generated for HyperListening">
              <div className="mb-3">
                <span className="text-2xs font-bold text-text-muted uppercase tracking-wider">Search Keywords</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {research.searchKeywords?.map((k, i) => (
                    <span key={i} className="text-2xs bg-blue-light text-blue px-1.5 py-0.5 rounded">{k}</span>
                  ))}
                </div>
              </div>
              <div className="mb-3">
                <span className="text-2xs font-bold text-text-muted uppercase tracking-wider">Subreddits</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {research.subreddits?.map((s, i) => (
                    <span key={i} className="text-2xs bg-elevated border border-border px-1.5 py-0.5 rounded">r/{s}</span>
                  ))}
                </div>
              </div>
              <div>
                <span className="text-2xs font-bold text-text-muted uppercase tracking-wider">Hashtags</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {research.hashTags?.map((h, i) => (
                    <span key={i} className="text-2xs bg-elevated border border-border px-1.5 py-0.5 rounded">#{h}</span>
                  ))}
                </div>
              </div>
            </Card>

            {/* Objections */}
            <Card title="Common Objections">
              <ul className="space-y-1.5">
                {research.objections?.map((o, i) => (
                  <li key={i} className="text-xs text-text-secondary">- {o}</li>
                ))}
              </ul>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
