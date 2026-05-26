'use client'

import { useState, useEffect } from 'react'
import { ToolId, ViewId, Brand } from '@/lib/types'
import SectionHeader from '@/components/ui/SectionHeader'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Pill from '@/components/ui/Pill'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

interface HubViewProps {
  onNavigate: (tool: ToolId, view: ViewId) => void
  brands?: Brand[]
  activeBrand?: Brand | null
  onSetActiveBrand?: (brand: Brand) => void
}

interface BrandInsight {
  brandId: string
  brandName: string
  brandColor: string
  insights: { id: string; type: string; title: string; detail: string; priority: string; actionable: string; copy_examples?: string[] }[]
  scannedAt: string
}

export default function HubView({ onNavigate, brands = [], activeBrand, onSetActiveBrand }: HubViewProps) {
  const [allInsights, setAllInsights] = useState<BrandInsight[]>([])
  const [loading, setLoading] = useState(true)
  const [staleBrands, setStaleBrands] = useState<Brand[]>([])

  // Load latest insights from all brands
  useEffect(() => {
    const loadInsights = async () => {
      setLoading(true)
      const results: BrandInsight[] = []
      const stale: Brand[] = []

      for (const brand of brands) {
        const lastScanned = brand.last_scanned_at ? new Date(brand.last_scanned_at) : null
        const daysSinceScan = lastScanned ? (Date.now() - lastScanned.getTime()) / (1000 * 60 * 60 * 24) : Infinity

        if (daysSinceScan > 7) stale.push(brand)

        const insights = (brand as Brand & { last_scan_insights?: BrandInsight['insights'] }).last_scan_insights
        if (insights?.length) {
          results.push({
            brandId: brand.id,
            brandName: brand.name,
            brandColor: brand.color,
            insights: insights.slice(0, 5),
            scannedAt: brand.last_scanned_at || '',
          })
        }
      }

      setAllInsights(results)
      setStaleBrands(stale)
      setLoading(false)
    }

    if (brands.length) loadInsights()
    else setLoading(false)
  }, [brands])

  // Flatten and sort all insights by priority
  const topInsights = allInsights
    .flatMap(b => b.insights.map(i => ({ ...i, brandName: b.brandName, brandColor: b.brandColor, brandId: b.brandId, scannedAt: b.scannedAt })))
    .sort((a, b) => {
      const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 }
      return (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2)
    })
    .slice(0, 15)

  const highPriority = topInsights.filter(i => i.priority === 'high')
  const mediumPriority = topInsights.filter(i => i.priority === 'medium')

  const timeAgo = (date: string) => {
    if (!date) return 'never'
    const hours = (Date.now() - new Date(date).getTime()) / (1000 * 60 * 60)
    if (hours < 1) return 'just now'
    if (hours < 24) return `${Math.floor(hours)}h ago`
    return `${Math.floor(hours / 24)}d ago`
  }

  return (
    <div className="animate-fadeIn">
      {/* Stale brands warning */}
      {staleBrands.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-3 mb-4">
          <div className="text-xs font-bold text-amber-400 mb-1">Brands need attention</div>
          <div className="flex flex-wrap gap-2">
            {staleBrands.map(b => (
              <button key={b.id} onClick={() => { onSetActiveBrand?.(b); onNavigate('hyperlistening', 'listening') }}
                className="text-xs bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded hover:bg-amber-500/20 transition-colors text-amber-300">
                {b.name} - {b.last_scanned_at ? `scanned ${timeAgo(b.last_scanned_at)}` : 'never scanned'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-4 gap-3.5 mb-6">
        <Card className="text-center py-4">
          <div className="text-2xl font-black">{brands.length}</div>
          <div className="text-2xs text-text-dim mt-1">Active Brands</div>
        </Card>
        <Card className="text-center py-4">
          <div className="text-2xl font-black text-blue">{highPriority.length}</div>
          <div className="text-2xs text-text-dim mt-1">High Priority Insights</div>
        </Card>
        <Card className="text-center py-4">
          <div className="text-2xl font-black">{allInsights.reduce((acc, b) => acc + b.insights.length, 0)}</div>
          <div className="text-2xs text-text-dim mt-1">Total Insights</div>
        </Card>
        <Card className="text-center py-4">
          <div className="text-2xl font-black text-green">{brands.filter(b => b.last_scanned_at && (Date.now() - new Date(b.last_scanned_at).getTime()) < 7 * 24 * 60 * 60 * 1000).length}</div>
          <div className="text-2xs text-text-dim mt-1">Brands Scanned This Week</div>
        </Card>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner size={24} />
          <span className="text-sm text-text-dim ml-3">Loading insights across all brands...</span>
        </div>
      )}

      {/* High Priority - Act This Week */}
      {highPriority.length > 0 && (
        <>
          <SectionHeader title="Act This Week" subtitle="High priority insights across all brands" action={<Pill variant="red">Urgent</Pill>} />
          <div className="space-y-2 mb-8">
            {highPriority.map((insight, i) => (
              <Card key={i} className="hover:border-red/30 transition-colors">
                <div className="flex items-start gap-4">
                  <div className="w-2 h-2 rounded-full mt-2 shrink-0" style={{ background: insight.brandColor }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-2xs font-bold text-text-dim">{insight.brandName}</span>
                      <Pill variant={insight.type === 'pain_point' ? 'red' : insight.type === 'opportunity' ? 'green' : insight.type === 'competitor' ? 'gray' : 'blue'}>
                        {insight.type.replace('_', ' ')}
                      </Pill>
                      <span className="text-2xs text-text-dim ml-auto">{timeAgo(insight.scannedAt)}</span>
                    </div>
                    <div className="text-sm font-bold mb-1">{insight.title}</div>
                    <div className="text-xs text-text-dim mb-2">{insight.detail}</div>
                    {insight.copy_examples?.length ? (
                      <div className="text-xs italic text-text-muted mb-2">&quot;{insight.copy_examples[0]}&quot;</div>
                    ) : null}
                    <div className="text-xs text-blue mb-2">{insight.actionable}</div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => {
                        const brand = brands.find(b => b.id === insight.brandId)
                        if (brand) onSetActiveBrand?.(brand)
                        localStorage.setItem('hc-brief-draft', `${insight.title}: ${insight.detail}`)
                        onNavigate('hypercopy', 'copy')
                      }}>Create Copy</Button>
                      <Button size="sm" variant="secondary" onClick={() => {
                        const brand = brands.find(b => b.id === insight.brandId)
                        if (brand) onSetActiveBrand?.(brand)
                        onNavigate('hyperlistening', 'listening')
                      }}>View Signals</Button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Medium Priority - This Month */}
      {mediumPriority.length > 0 && (
        <>
          <SectionHeader title="On the Radar" subtitle="Medium priority - monitor and plan" />
          <div className="grid grid-cols-2 gap-3 mb-8">
            {mediumPriority.map((insight, i) => (
              <button key={i} onClick={() => {
                  const brand = brands.find(b => b.id === insight.brandId)
                  if (brand) onSetActiveBrand?.(brand)
                  onNavigate('hyperlistening', 'listening')
                }} className="text-left w-full bg-surface border border-border rounded-lg p-4 hover:border-blue/30 transition-colors cursor-pointer">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: insight.brandColor }} />
                  <span className="text-2xs font-bold text-text-dim">{insight.brandName}</span>
                  <Pill variant="gray">{insight.type.replace('_', ' ')}</Pill>
                </div>
                <div className="text-sm font-bold mb-1">{insight.title}</div>
                <div className="text-2xs text-text-dim line-clamp-2">{insight.detail}</div>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Brand Overview */}
      <SectionHeader title="Brand Status" subtitle="Research and scanning health" />
      <div className="grid grid-cols-3 gap-3 mb-6">
        {brands.map(b => {
          const hasResearch = !!b.research
          const lastScan = b.last_scanned_at ? timeAgo(b.last_scanned_at) : 'never'
          const insightCount = ((b as Brand & { last_scan_insights?: unknown[] }).last_scan_insights || []).length
          const personaCount = b.research?.personas?.length || 0
          return (
            <button key={b.id} onClick={() => { onSetActiveBrand?.(b); onNavigate('hyperresearch', 'brand-research') }}
              className="text-left w-full bg-surface border border-border rounded-lg p-4 hover:border-blue/30 transition-colors cursor-pointer">
              <div className="flex items-center gap-2 mb-2">
                {b.logo_url ? (
                  <img src={b.logo_url} alt="" className="w-6 h-6 rounded object-contain bg-white" />
                ) : (
                  <div className="w-6 h-6 rounded flex items-center justify-center text-2xs font-black text-white" style={{ background: b.color }}>{b.name.charAt(0)}</div>
                )}
                <span className="text-sm font-bold">{b.name}</span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-2xs">
                  <span className="text-text-dim">Research</span>
                  <span className={hasResearch ? 'text-green' : 'text-red'}>{hasResearch ? 'Complete' : 'Missing'}</span>
                </div>
                <div className="flex justify-between text-2xs">
                  <span className="text-text-dim">Last scan</span>
                  <span className="text-text-muted">{lastScan}</span>
                </div>
                <div className="flex justify-between text-2xs">
                  <span className="text-text-dim">Insights</span>
                  <span className="text-text-muted">{insightCount}</span>
                </div>
                <div className="flex justify-between text-2xs">
                  <span className="text-text-dim">Personas</span>
                  <span className="text-text-muted">{personaCount}</span>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* Empty state */}
      {!loading && brands.length === 0 && (
        <Card className="text-center py-12">
          <div className="text-4xl mb-3">🚀</div>
          <div className="text-lg font-bold mb-1">Welcome to HyperCreate</div>
          <div className="text-sm text-text-dim mb-4">Add your first brand to get started with social listening and research</div>
        </Card>
      )}

      {!loading && brands.length > 0 && topInsights.length === 0 && (
        <Card className="text-center py-8">
          <div className="text-2xl mb-2">👂</div>
          <div className="text-sm font-bold mb-1">No insights yet</div>
          <div className="text-xs text-text-dim">Run a social listening scan on any brand to start seeing insights here</div>
        </Card>
      )}
    </div>
  )
}
