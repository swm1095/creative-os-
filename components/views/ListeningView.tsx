'use client'

import { useState, useEffect } from 'react'
import { Brand, SocialSignal, ListeningInsight, ToolId, ViewId } from '@/lib/types'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import SectionHeader from '@/components/ui/SectionHeader'
import LoadingSpinner, { LoadingState } from '@/components/ui/LoadingSpinner'
import Pill from '@/components/ui/Pill'
import EmptyState from '@/components/ui/EmptyState'
import PageHeader from '@/components/ui/PageHeader'
import Modal from '@/components/ui/Modal'

interface ListeningViewProps {
  brand: Brand | null
  onToast: (msg: string, type: 'success' | 'error' | 'info') => void
  onNavigate?: (tool: ToolId, view: ViewId, context?: Record<string, unknown>) => void
  onBrandUpdate?: (brandId: string, updates: Partial<Brand>) => void
  addBackgroundTask?: (type: 'research' | 'competitor-analysis' | 'scan' | 'generate' | 'ugc-scripts', brandId: string, brandName: string, message: string, fn: (signal: AbortSignal) => Promise<unknown>) => string
  isClient?: boolean
}

const priorityColor: Record<string, 'green' | 'amber' | 'red'> = {
  high: 'red',
  medium: 'amber',
  low: 'green',
}

const typeEmoji: Record<string, string> = {
  trend: '📈',
  pain_point: '😣',
  competitor: '⚔️',
  opportunity: '💡',
  language: '💬',
}

const statusStyles: Record<string, { bg: string; text: string; label: string }> = {
  new: { bg: 'bg-green-light', text: 'text-green', label: 'NEW' },
  trending: { bg: 'bg-fulton-gold-light', text: 'text-fulton-gold', label: 'TRENDING' },
  persistent: { bg: 'bg-blue-light', text: 'text-blue', label: 'PERSISTENT' },
}

interface EnrichedInsight extends ListeningInsight {
  copy_examples?: string[]
}

interface TrackedSignal extends SocialSignal {
  status?: 'new' | 'trending' | 'persistent'
}

interface UGCHook {
  persona: string
  persona_number: number
  hook: string
}

interface UGCScriptFramework {
  hooks: UGCHook[]
  body: string
  cta: string
  scene_notes?: string
}

export default function ListeningView({ brand, onToast, onNavigate, onBrandUpdate, addBackgroundTask, isClient }: ListeningViewProps) {
  const [signals, setSignals] = useState<TrackedSignal[]>([])
  const [insights, setInsights] = useState<EnrichedInsight[]>([])
  const [trends, setTrends] = useState<{ keyword: string; trending: boolean; suggestions?: string[] }[]>([])
  const [sourceBreakdown, setSourceBreakdown] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(false)
  const [hasRun, setHasRun] = useState(false)
  const [scanCadence, setScanCadence] = useState<string>(brand?.scan_cadence || 'manual')
  const [savingInsight, setSavingInsight] = useState<string | null>(null)
  const [showAddUrl, setShowAddUrl] = useState(false)
  const [newUrl, setNewUrl] = useState('')
  const [generatingUGC, setGeneratingUGC] = useState<string | null>(null)
  const [ugcScripts, setUgcScripts] = useState<UGCScriptFramework | null>(null)
  const [ugcInsightTitle, setUgcInsightTitle] = useState('')
  const [showUgcModal, setShowUgcModal] = useState(false)

  const hasResearch = brand?.research_completed || !!brand?.research

  useEffect(() => {
    setScanCadence(brand?.scan_cadence || 'manual')
  }, [brand?.id, brand?.scan_cadence])

  // Load previous scan results when brand changes
  useEffect(() => {
    if (!brand?.id) {
      setSignals([])
      setInsights([])
      setTrends([])
      setSourceBreakdown({})
      setHasRun(false)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/listening/last-scan?brandId=${brand.id}`)
        const data = await res.json()
        if (cancelled) return
        if (data.insights?.length || data.signals?.length) {
          setInsights(data.insights || [])
          setSignals(data.signals || [])
          setTrends(data.trends || [])
          setSourceBreakdown(data.sourceBreakdown || {})
          setHasRun(true)
        }
      } catch { /* silent */ }
    })()
    return () => { cancelled = true }
  }, [brand?.id])

  const runListening = async () => {
    if (!brand?.id) { onToast('No brand selected', 'error'); return }
    if (!hasResearch) { onToast('Run brand research first', 'error'); return }

    const doScan = async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/listening', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ brandId: brand.id }),
        })
        const data = await res.json()
        if (data.error) throw new Error(data.error)

        setSignals(data.signals || [])
        setInsights(data.insights || [])
        setTrends(data.trends || [])
        setSourceBreakdown(data.sourceBreakdown || {})
        setHasRun(true)
        if (onBrandUpdate && brand) {
          onBrandUpdate(brand.id, { last_scanned_at: data.scannedAt })
        }
        onToast(`Scan complete: ${data.signalCount} signals, ${data.insightCount} insights`, 'success')
        return data
      } catch (err: unknown) {
        onToast(`Scan failed: ${err instanceof Error ? err.message : String(err)}`, 'error')
        throw err
      } finally {
        setLoading(false)
      }
    }

    if (addBackgroundTask) {
      addBackgroundTask('scan', brand.id, brand.name, 'Scanning signals', doScan)
      onToast('Scan running in background - you can navigate freely', 'info')
    } else {
      await doScan()
    }
  }

  const saveInsight = async (insight: EnrichedInsight) => {
    if (!brand?.id) return
    setSavingInsight(insight.id)
    try {
      const res = await fetch('/api/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandId: brand.id,
          title: insight.title,
          detail: insight.detail,
          insight_type: insight.type,
          source_data: insight,
          priority: insight.priority,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      onToast(`Saved "${insight.title}" to Insights folder`, 'success')
    } catch (err: unknown) {
      onToast(`Save failed: ${err instanceof Error ? err.message : String(err)}`, 'error')
    }
    setSavingInsight(null)
  }

  const generateUGCScripts = async (insight: EnrichedInsight) => {
    if (!brand?.id) { onToast('No brand selected', 'error'); return }
    if (!brand.research?.personas?.length) {
      onToast('Brand research required with at least 1 persona', 'error')
      return
    }
    setGeneratingUGC(insight.id)
    setUgcInsightTitle(insight.title)
    onToast(`Generating 4 UGC scripts based on "${insight.title}"...`, 'info')
    try {
      const res = await fetch('/api/ugc-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandId: brand.id, insight }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setUgcScripts(data)
      setShowUgcModal(true)
      onToast(`${data.hooks?.length || 0} hooks + shared body ready`, 'success')
    } catch (err: unknown) {
      onToast(`UGC generation failed: ${err instanceof Error ? err.message : String(err)}`, 'error')
    }
    setGeneratingUGC(null)
  }

  const generateFromInsight = (insight: EnrichedInsight, type: 'copy' | 'image') => {
    if (!onNavigate) return
    const brief = `Based on this insight: "${insight.title}"\n\n${insight.detail}\n\nAction: ${insight.actionable}${insight.copy_examples?.length ? '\n\nExample phrases: ' + insight.copy_examples.join(' | ') : ''}`
    localStorage.setItem('hc-brief-draft', brief)
    if (type === 'copy') {
      onNavigate('hypercopy', 'copy')
      onToast(`Opening HyperCopy with brief from "${insight.title}"`, 'info')
    } else {
      onNavigate('hypeimage', 'generate')
      onToast(`Opening HyperImage with context from "${insight.title}"`, 'info')
    }
  }

  const updateCadence = async (cadence: string) => {
    if (!brand?.id) return
    setScanCadence(cadence)
    try {
      await fetch('/api/brands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: brand.id, scan_cadence: cadence }),
      })
      if (onBrandUpdate) onBrandUpdate(brand.id, { scan_cadence: cadence })
      onToast(`Scan cadence set to ${cadence}`, 'success')
    } catch { /* silent */ }
  }

  if (!hasResearch) {
    return (
      <div className="animate-fadeIn">
        <EmptyState
          emoji="👂"
          title="HyperListening"
          subtitle="Social listening requires brand research first. Go to Brand Research, add your brand, and run the deep research. Then come back here."
          size="lg"
        />
      </div>
    )
  }

  const lastScanned = brand?.last_scanned_at
    ? new Date(brand.last_scanned_at)
    : null
  const hoursAgo = lastScanned ? Math.floor((Date.now() - lastScanned.getTime()) / (1000 * 60 * 60)) : null

  return (
    <div className="animate-fadeIn">
      <PageHeader
        title="Social Listening"
        subtitle={`${hoursAgo !== null ? `Last scanned ${hoursAgo}h ago` : 'Never scanned'} · ${brand?.research?.searchKeywords?.length || 0} keywords tracked`}
        action={!isClient ? (
          <>
            <select
              value={scanCadence}
              onChange={e => updateCadence(e.target.value)}
              className="px-3 py-2 bg-page border border-border rounded text-xs text-text-primary focus:border-fulton focus:outline-none"
            >
              <option value="manual">Manual</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
            <Button onClick={runListening} disabled={loading}>
              {loading ? <><LoadingSpinner size={14} /> Scanning...</> : hasRun ? 'Rescan' : 'Scan Now'}
            </Button>
          </>
        ) : undefined}
      />

      {loading ? (
        <LoadingState
          size="lg"
          title="Scanning Reddit, HackerNews, YouTube, Google Trends..."
          subtitle="Claude is analyzing signals for actionable insights"
        />
      ) : !hasRun ? (
        <div className="grid grid-cols-4 gap-3 mb-6">
          <Card>
            <div className="text-center py-4">
              <div className="text-2xl mb-1">🔍</div>
              <div className="text-xs font-bold">Reddit</div>
              <div className="text-2xs text-text-dim">Posts + Comments</div>
            </div>
          </Card>
          <Card>
            <div className="text-center py-4">
              <div className="text-2xl mb-1">💻</div>
              <div className="text-xs font-bold">HackerNews</div>
              <div className="text-2xs text-text-dim">Tech discussions</div>
            </div>
          </Card>
          <Card>
            <div className="text-center py-4">
              <div className="text-2xl mb-1">📺</div>
              <div className="text-xs font-bold">YouTube</div>
              <div className="text-2xs text-text-dim">Video trends</div>
            </div>
          </Card>
          <Card>
            <div className="text-center py-4">
              <div className="text-2xl mb-1">📊</div>
              <div className="text-xs font-bold">Google Trends</div>
              <div className="text-2xs text-text-dim">Keyword interest</div>
            </div>
          </Card>
        </div>
      ) : (
        <>
          {/* Amazon product URL bar - team only */}
          {!isClient && <div className="flex gap-2 mb-4 items-center">
            <span className="text-2xs font-bold text-text-muted uppercase tracking-wider shrink-0">Amazon ({brand?.competitor_urls?.length || 0})</span>
            <input
              type="url"
              placeholder="Paste Amazon product URL to track competitor reviews..."
              value={newUrl}
              onChange={e => setNewUrl(e.target.value)}
              className="flex-1 px-3 py-2 bg-surface border border-border rounded text-xs text-text-primary focus:border-fulton focus:outline-none"
            />
            <Button
              size="sm"
              disabled={!newUrl.trim() || !brand?.id}
              onClick={async () => {
                if (!brand?.id || !newUrl.trim()) return
                const urls = [...(brand.competitor_urls || []), newUrl.trim()]
                try {
                  await fetch('/api/brands', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: brand.id, competitor_urls: urls }) })
                  if (onBrandUpdate) onBrandUpdate(brand.id, { competitor_urls: urls })
                  setNewUrl('')
                  onToast('Product URL saved', 'success')
                } catch { onToast('Failed to save URL', 'error') }
              }}
            >
              Add + Save
            </Button>
          </div>}

          {/* Source breakdown */}
          <div className="flex gap-2 mb-4 text-2xs">
            <Pill variant="gray">Reddit: {sourceBreakdown.reddit || 0}</Pill>
            <Pill variant="gray">HackerNews: {sourceBreakdown.hackernews || 0}</Pill>
            <Pill variant="gray">YouTube: {sourceBreakdown.youtube || 0}</Pill>
            <Pill variant="gray">Trends: {trends.length}</Pill>
          </div>

          {/* Insights */}
          {insights.length > 0 && (
            <div className="mb-6">
              <SectionHeader title="Actionable Insights" subtitle={`${insights.length} insights extracted by Claude`} />
              <div className="space-y-3">
                {insights.map((insight, i) => (
                  <Card key={insight.id || i}>
                    <div className="flex items-start gap-3">
                      <span className="text-xl mt-0.5">{typeEmoji[insight.type] || '📌'}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-sm font-bold">{insight.title}</span>
                          <Pill variant={priorityColor[insight.priority] || 'gray'}>{insight.priority}</Pill>
                          <span className="text-2xs text-text-dim uppercase tracking-wider">{insight.type.replace('_', ' ')}</span>
                        </div>
                        <p className="text-xs text-text-muted leading-relaxed mb-2">{insight.detail}</p>

                        {insight.copy_examples && insight.copy_examples.length > 0 && (
                          <div className="mb-2 flex gap-1.5 flex-wrap">
                            {insight.copy_examples.map((ex, j) => (
                              <span key={j} className="text-2xs bg-fulton-light text-fulton px-2 py-0.5 rounded italic">"{ex}"</span>
                            ))}
                          </div>
                        )}

                        <div className="bg-fulton-light border border-fulton/20 rounded px-3 py-2 mb-2">
                          <span className="text-2xs font-bold text-fulton uppercase tracking-wider">Action: </span>
                          <span className="text-xs text-text-secondary">{insight.actionable}</span>
                        </div>

                        {/* Action buttons */}
                        <div className="flex gap-2 flex-wrap">
                          <Button size="sm" onClick={() => generateUGCScripts(insight)} disabled={generatingUGC === insight.id}>
                            {generatingUGC === insight.id ? <><LoadingSpinner size={12} /> Generating...</> : '🎬 Generate UGC Scripts'}
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => generateFromInsight(insight, 'copy')}>
                            ✍ Generate Copy
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => generateFromInsight(insight, 'image')}>
                            🖼 Generate Ad
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => saveInsight(insight)} disabled={savingInsight === insight.id}>
                            {savingInsight === insight.id ? 'Saving...' : '📁 Save to Folder'}
                          </Button>
                        </div>

                        {insight.signals?.length > 0 && (
                          <div className="flex gap-1.5 mt-2 flex-wrap">
                            {insight.signals.map((s, j) => (
                              <span key={j} className="text-2xs text-text-dim bg-elevated px-1.5 py-0.5 rounded">{s}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Trends */}
          {trends.length > 0 && (
            <div className="mb-6">
              <SectionHeader title="Google Trends" subtitle="Keyword search interest" />
              <div className="grid grid-cols-4 gap-2">
                {trends.map((t, i) => (
                  <Card key={i}>
                    <div className="text-center py-2">
                      <div className="text-xs font-bold truncate mb-1">{t.keyword}</div>
                      <Pill variant={t.trending ? 'green' : 'gray'}>{t.trending ? 'Trending' : 'Normal'}</Pill>
                      {t.suggestions && t.suggestions.length > 0 && (
                        <div className="text-2xs text-text-dim mt-1 truncate">
                          {t.suggestions[0]}
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Raw Signals */}
          {signals.length > 0 && (
            <div>
              <SectionHeader title="Signal Feed" subtitle={`${signals.length} posts from ${Object.keys(sourceBreakdown).length} sources`} />
              <div className="space-y-2">
                {signals.slice(0, 25).map((signal, i) => {
                  const statusStyle = signal.status ? statusStyles[signal.status] : null
                  return (
                    <div
                      key={signal.id || i}
                      className="flex items-start gap-3 px-4 py-3 bg-surface border border-border rounded-lg hover:border-text-subtle transition-colors cursor-pointer"
                      onClick={() => signal.url && window.open(signal.url, '_blank')}
                    >
                      <div className="flex flex-col gap-1 shrink-0">
                        <span className="text-2xs font-bold text-fulton bg-fulton-light px-1.5 py-0.5 rounded whitespace-nowrap">
                          {signal.source}
                        </span>
                        {statusStyle && (
                          <span className={`text-2xs font-bold ${statusStyle.bg} ${statusStyle.text} px-1.5 py-0.5 rounded text-center`}>
                            {statusStyle.label}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold truncate">{signal.title}</div>
                        {signal.content && (
                          <div className="text-2xs text-text-dim mt-0.5 line-clamp-2">{signal.content}</div>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs font-bold text-text-muted">{signal.score || 0}</div>
                        <div className="text-2xs text-text-dim">score</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* UGC Scripts Modal */}
      <Modal
        open={showUgcModal}
        onClose={() => setShowUgcModal(false)}
        title="UGC Script"
        subtitle={ugcInsightTitle ? `Based on "${ugcInsightTitle}" - pick any hook, same body works for all` : undefined}
        maxWidth="max-w-3xl"
      >
        {ugcScripts ? (
          <div className="space-y-5">
            {/* Hook Options */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs font-bold text-text-muted uppercase tracking-wider">Hook Options (pick one)</div>
                <span className="text-2xs text-text-dim">0-3 sec</span>
              </div>
              <div className="space-y-2">
                {ugcScripts.hooks.map((h, i) => (
                  <div key={i} className="bg-page border border-border rounded-lg p-4 hover:border-fulton/40 transition-colors">
                    <div className="flex items-start gap-3">
                      <span className="text-2xs font-bold text-fulton bg-fulton-light px-2 py-0.5 rounded shrink-0 mt-0.5">
                        P{h.persona_number}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-2xs text-text-dim mb-1">{h.persona}</div>
                        <div className="text-sm text-text-secondary leading-relaxed italic">&quot;{h.hook}&quot;</div>
                      </div>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(`${h.hook}\n\n${ugcScripts.body}\n\n${ugcScripts.cta}`)
                          onToast(`Persona ${h.persona_number} script copied`, 'success')
                        }}
                        className="text-2xs text-text-dim hover:text-text-primary shrink-0"
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Shared Body */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs font-bold text-text-muted uppercase tracking-wider">Body (shared for all hooks)</div>
                <span className="text-2xs text-text-dim">3-20 sec</span>
              </div>
              <div className="bg-fulton-light border border-fulton/20 rounded-lg p-4 text-sm text-text-secondary leading-relaxed">
                {ugcScripts.body}
              </div>
            </div>

            {/* Shared CTA */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs font-bold text-text-muted uppercase tracking-wider">CTA</div>
                <span className="text-2xs text-text-dim">20-25 sec</span>
              </div>
              <div className="bg-page border border-border rounded-lg p-4 text-sm text-text-secondary leading-relaxed italic">
                &quot;{ugcScripts.cta}&quot;
              </div>
            </div>

            {ugcScripts.scene_notes && (
              <div className="bg-elevated border border-border rounded-lg p-4">
                <div className="text-xs font-bold text-text-muted uppercase tracking-wider mb-2">Scene Notes</div>
                <div className="text-xs text-text-dim">{ugcScripts.scene_notes}</div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-text-dim">No scripts generated</div>
        )}
      </Modal>
    </div>
  )
}
