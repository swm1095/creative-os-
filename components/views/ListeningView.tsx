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
  const [scanCadence, setScanCadence] = useState<string>(brand?.scan_cadence || 'daily')
  const [savingInsight, setSavingInsight] = useState<string | null>(null)
  const [showAddUrl, setShowAddUrl] = useState(false)
  const [newUrl, setNewUrl] = useState('')
  const [generatingUGC, setGeneratingUGC] = useState<string | null>(null)
  const [ugcScripts, setUgcScripts] = useState<UGCScriptFramework | null>(null)
  const [ugcInsightTitle, setUgcInsightTitle] = useState('')
  const [showUgcModal, setShowUgcModal] = useState(false)
  // Editable copies of UGC script content
  const [editableHooks, setEditableHooks] = useState<string[]>([])
  const [editableBody, setEditableBody] = useState('')
  const [editableCta, setEditableCta] = useState('')
  const [savingScript, setSavingScript] = useState(false)
  const [scriptFeedback, setScriptFeedback] = useState('')
  const [refiningScript, setRefiningScript] = useState(false)
  const [scriptFeedbackHistory, setScriptFeedbackHistory] = useState<{ role: 'user' | 'ai'; text: string }[]>([])

  // Hook mode for UGC generation
  const [showHookModeSelector, setShowHookModeSelector] = useState(false)
  const [pendingInsight, setPendingInsight] = useState<EnrichedInsight | null>(null)
  const [listeningHookMode, setListeningHookMode] = useState<'personas' | 'themes' | 'products'>('personas')
  const brandThemes: string[] = (brand as Brand & { themes?: string[] })?.themes || []
  const brandProducts: { id: string; name: string }[] = (brand as Brand & { products?: { id: string; name: string }[] })?.products || []
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set())
  const [generatingVideoPrompt, setGeneratingVideoPrompt] = useState<string | null>(null)
  const [videoPromptData, setVideoPromptData] = useState<{ title: string; scenes: Array<{ sceneNumber: number; description: string; prompt: string; camera: string; duration: number }>; full_prompt: string; recommended_model: string; recommended_style: string } | null>(null)
  const [showVideoModal, setShowVideoModal] = useState(false)

  const hasResearch = brand?.research_completed || !!brand?.research

  useEffect(() => {
    setScanCadence(brand?.scan_cadence || 'daily')
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
    // Close any open modals when brand changes
    setShowUgcModal(false)
    setShowVideoModal(false)
    setUgcScripts(null)
    setGeneratingUGC(null)
    setGeneratingVideoPrompt(null)
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

  const startUGCGeneration = (insight: EnrichedInsight) => {
    if (!brand?.id) { onToast('No brand selected', 'error'); return }
    setPendingInsight(insight)
    setUgcInsightTitle(insight.title)
    // Default select all items for the current mode
    const personas = brand.research?.personas || []
    if (listeningHookMode === 'personas') setSelectedItems(new Set(personas.map((_, i) => i)))
    else if (listeningHookMode === 'themes') setSelectedItems(new Set(brandThemes.map((_, i) => i)))
    else if (listeningHookMode === 'products') setSelectedItems(new Set(brandProducts.map((_, i) => i)))
    setShowHookModeSelector(true)
  }

  const generateUGCScripts = async (insight: EnrichedInsight) => {
    if (!brand?.id) { onToast('No brand selected', 'error'); return }
    setShowHookModeSelector(false)
    setGeneratingUGC(insight.id)

    const selected = [...selectedItems]
    let themesParam: string[] | undefined
    let personaIndices: number[] | undefined
    let productNames: string[] | undefined

    if (listeningHookMode === 'themes') {
      themesParam = brandThemes.filter((_, i) => selected.includes(i))
      if (!themesParam.length) { onToast('Select at least one theme', 'error'); setGeneratingUGC(null); return }
    } else if (listeningHookMode === 'products') {
      productNames = brandProducts.filter((_, i) => selected.includes(i)).map(p => p.name)
      if (!productNames.length) { onToast('Select at least one product', 'error'); setGeneratingUGC(null); return }
      // Use product names as themes
      themesParam = productNames
    } else {
      personaIndices = selected
      if (!personaIndices.length) { onToast('Select at least one persona', 'error'); setGeneratingUGC(null); return }
    }

    onToast(`Generating UGC scripts based on "${insight.title}"...`, 'info')
    try {
      const res = await fetch('/api/ugc-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandId: brand.id, insight,
          selectedPersonaIndices: personaIndices,
          themes: themesParam,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setUgcScripts(data)
      setEditableHooks(data.hooks?.map((h: { hook: string }) => h.hook) || [])
      setEditableBody(data.body || '')
      setEditableCta(data.cta || '')
      setShowUgcModal(true)
      onToast(`${data.hooks?.length || 0} hooks + shared body ready`, 'success')
    } catch (err: unknown) {
      onToast(`UGC generation failed: ${err instanceof Error ? err.message : String(err)}`, 'error')
    }
    setGeneratingUGC(null)
  }

  const generateVideoPrompt = async (insight: EnrichedInsight) => {
    if (!brand?.id) { onToast('No brand selected', 'error'); return }
    setGeneratingVideoPrompt(insight.id)
    onToast(`Generating video concept from "${insight.title}"...`, 'info')
    try {
      const res = await fetch('/api/video-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandId: brand.id, insight, style: 'ugc' }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setVideoPromptData(data)
      setShowVideoModal(true)
      onToast(`Video concept ready - ${data.scenes?.length || 0} scenes`, 'success')
    } catch (err: unknown) {
      onToast(`Failed: ${err instanceof Error ? err.message : String(err)}`, 'error')
    }
    setGeneratingVideoPrompt(null)
  }

  const generateFromInsight = (insight: EnrichedInsight, type: 'copy' | 'image') => {
    if (!onNavigate) return
    const brief = `Based on this insight: "${insight.title}"\n\n${insight.detail}\n\nAction: ${insight.actionable}${insight.copy_examples?.length ? '\n\nExample phrases: ' + insight.copy_examples.join(' | ') : ''}`
    localStorage.setItem('hc-brief-draft', brief)
    onNavigate('hypercopy', 'copy')
    onToast(`Opening HyperCopy with brief from "${insight.title}"`, 'info')
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
          <div className="flex items-center gap-2">
            {/* Product filter */}
            {((brand as Brand & { products?: { id: string; name: string }[] })?.products || []).length > 0 && (
              <select
                className="px-3 py-2 bg-page border border-border rounded text-xs text-text-primary focus:border-fulton focus:outline-none"
                defaultValue="all"
              >
                <option value="all">All Products</option>
                {((brand as Brand & { products?: { id: string; name: string }[] })?.products || []).map((p: { id: string; name: string }) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            )}
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
          </div>
        ) : undefined}
      />

      {/* Keyword editor */}
      {!isClient && brand?.research && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xs font-bold uppercase tracking-wider text-text-muted">Keywords</span>
            <span className="text-2xs text-text-dim">({brand.research.searchKeywords?.length || 0} tracked)</span>
          </div>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {(brand.research.searchKeywords || []).map((k, i) => (
              <span key={i} className="text-2xs bg-blue-light text-blue px-2 py-1 rounded flex items-center gap-1.5">
                {k}
                <button onClick={() => {
                  if (!brand.research) return
                  const updated = (brand.research.searchKeywords || []).filter((_, idx) => idx !== i)
                  if (onBrandUpdate) onBrandUpdate(brand.id, { research: { ...brand.research, searchKeywords: updated } })
                  onToast('Keyword removed', 'info')
                }} className="text-blue/60 hover:text-blue">x</button>
              </span>
            ))}
            <form onSubmit={e => {
              e.preventDefault()
              const input = (e.target as HTMLFormElement).elements.namedItem('keyword') as HTMLInputElement
              const val = input.value.trim()
              if (!val || !brand.research) return
              const updated = [...(brand.research.searchKeywords || []), val]
              if (onBrandUpdate) onBrandUpdate(brand.id, { research: { ...brand.research, searchKeywords: updated } })
              input.value = ''
              onToast('Keyword added', 'success')
            }} className="flex gap-1">
              <input name="keyword" type="text" placeholder="+ Add keyword" className="px-2 py-0.5 bg-page border border-border rounded text-2xs text-text-primary focus:border-blue focus:outline-none w-28" />
            </form>
          </div>
          {/* Subreddits */}
          <div className="flex flex-wrap gap-1.5">
            {(brand.research.subreddits || []).map((s, i) => (
              <span key={i} className="text-2xs bg-elevated border border-border px-2 py-1 rounded flex items-center gap-1.5">
                r/{s}
                <button onClick={() => {
                  if (!brand.research) return
                  const updated = (brand.research.subreddits || []).filter((_, idx) => idx !== i)
                  if (onBrandUpdate) onBrandUpdate(brand.id, { research: { ...brand.research, subreddits: updated } })
                  onToast('Subreddit removed', 'info')
                }} className="text-text-dim hover:text-red">x</button>
              </span>
            ))}
            <form onSubmit={e => {
              e.preventDefault()
              const input = (e.target as HTMLFormElement).elements.namedItem('subreddit') as HTMLInputElement
              const val = input.value.trim().replace('r/', '')
              if (!val || !brand.research) return
              const updated = [...(brand.research.subreddits || []), val]
              if (onBrandUpdate) onBrandUpdate(brand.id, { research: { ...brand.research, subreddits: updated } })
              input.value = ''
              onToast('Subreddit added', 'success')
            }} className="flex gap-1">
              <input name="subreddit" type="text" placeholder="+ Add subreddit" className="px-2 py-0.5 bg-page border border-border rounded text-2xs text-text-primary focus:border-blue focus:outline-none w-28" />
            </form>
          </div>
        </div>
      )}

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
          <div className="mb-6">
            {insights.length > 0 ? (
            <>
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

                        {insight.actionable && (
                          <div className="bg-fulton-light border border-fulton/20 rounded px-3 py-2 mb-2">
                            <span className="text-2xs font-bold text-fulton uppercase tracking-wider">Action: </span>
                            <span className="text-xs text-text-secondary">{insight.actionable}</span>
                          </div>
                        )}

                        {/* Action buttons */}
                        <div className="flex gap-2 flex-wrap">
                          <Button size="sm" onClick={() => startUGCGeneration(insight)} disabled={generatingUGC === insight.id}>
                            {generatingUGC === insight.id ? <><LoadingSpinner size={12} /> Generating...</> : '🎬 UGC Scripts'}
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => generateFromInsight(insight, 'copy')}>
                            ✍ Copy
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => saveInsight(insight)} disabled={savingInsight === insight.id}>
                            {savingInsight === insight.id ? 'Saving...' : '📁 Save'}
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
            </>
            ) : hasRun ? (
              <Card className="mb-4">
                <div className="text-center py-6">
                  <div className="text-2xl mb-2">🔍</div>
                  <div className="text-sm font-bold mb-1">No actionable insights found</div>
                  <div className="text-xs text-text-dim mb-3">Claude couldn't extract strong insights from the current signals. This usually means:</div>
                  <ul className="text-xs text-text-dim space-y-1 text-left max-w-md mx-auto">
                    <li>- Reddit and YouTube returned 0 signals (blocked on Vercel)</li>
                    <li>- The signals found weren't specific enough to this brand's product category</li>
                    <li>- Try adding more specific search keywords in Brand Research</li>
                    <li>- Try adding competitor product URLs for Amazon review mining</li>
                  </ul>
                  <Button size="sm" className="mt-4" onClick={runListening} disabled={loading}>Rescan</Button>
                </div>
              </Card>
            ) : null}
          </div>

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

      {/* Hook Mode Selector */}
      <Modal open={showHookModeSelector} onClose={() => setShowHookModeSelector(false)}
        title="Generate UGC Script" subtitle={`From: "${ugcInsightTitle}"`} maxWidth="max-w-md">
        <div className="space-y-4">
          <div>
            <div className="text-2xs font-bold text-text-muted uppercase tracking-wider mb-2">Generate Hooks By</div>
            <div className="flex bg-elevated rounded overflow-hidden border border-border">
              {(['personas', 'themes', 'products'] as const).map(mode => (
                <button key={mode} onClick={() => {
                  setListeningHookMode(mode)
                  const items = mode === 'personas' ? (brand?.research?.personas || []) : mode === 'themes' ? brandThemes : brandProducts
                  setSelectedItems(new Set(items.map((_, i) => i)))
                }} className={`flex-1 px-3 py-2 text-xs font-bold transition-all capitalize ${listeningHookMode === mode ? 'bg-fulton text-white' : 'text-text-dim'}`}>
                  {mode}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-2xs text-text-dim">Click to toggle - one hook per selected item</span>
              <button onClick={() => {
                const items = listeningHookMode === 'personas' ? (brand?.research?.personas || []) : listeningHookMode === 'themes' ? brandThemes : brandProducts
                if (selectedItems.size === items.length) setSelectedItems(new Set())
                else setSelectedItems(new Set(items.map((_, i) => i)))
              }} className="text-2xs text-fulton hover:underline">
                {(() => { const items = listeningHookMode === 'personas' ? (brand?.research?.personas || []) : listeningHookMode === 'themes' ? brandThemes : brandProducts; return selectedItems.size === items.length ? 'Deselect All' : 'Select All' })()}
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {listeningHookMode === 'personas' && (brand?.research?.personas || []).map((p, i) => (
                <button key={i} onClick={() => { const next = new Set(selectedItems); if (next.has(i)) next.delete(i); else next.add(i); setSelectedItems(next) }}
                  className={`text-2xs px-2 py-1 rounded font-bold transition-all ${selectedItems.has(i) ? 'bg-fulton-light text-fulton border border-fulton/30' : 'bg-elevated text-text-dim border border-border line-through'}`}>
                  P{i + 1}: {p.name}
                </button>
              ))}
              {listeningHookMode === 'themes' && brandThemes.map((t, i) => (
                <button key={i} onClick={() => { const next = new Set(selectedItems); if (next.has(i)) next.delete(i); else next.add(i); setSelectedItems(next) }}
                  className={`text-2xs px-2 py-1 rounded font-bold transition-all ${selectedItems.has(i) ? 'bg-blue-light text-blue border border-blue/30' : 'bg-elevated text-text-dim border border-border line-through'}`}>
                  {t}
                </button>
              ))}
              {listeningHookMode === 'products' && brandProducts.map((p, i) => (
                <button key={i} onClick={() => { const next = new Set(selectedItems); if (next.has(i)) next.delete(i); else next.add(i); setSelectedItems(next) }}
                  className={`text-2xs px-2 py-1 rounded font-bold transition-all ${selectedItems.has(i) ? 'bg-green/10 text-green border border-green/30' : 'bg-elevated text-text-dim border border-border line-through'}`}>
                  {p.name}
                </button>
              ))}
            </div>
            {listeningHookMode === 'themes' && brandThemes.length === 0 && (
              <div className="text-2xs text-text-dim mt-2">No themes added yet. Add themes in HyperCopy settings.</div>
            )}
            {listeningHookMode === 'products' && brandProducts.length === 0 && (
              <div className="text-2xs text-text-dim mt-2">No products added yet. Add products in Brand Research.</div>
            )}
          </div>

          <Button className="w-full justify-center" disabled={selectedItems.size === 0}
            onClick={() => { if (pendingInsight) generateUGCScripts(pendingInsight) }}>
            Generate {selectedItems.size} Hook{selectedItems.size !== 1 ? 's' : ''} + Body Script
          </Button>
        </div>
      </Modal>

      {/* UGC Scripts Modal */}
      <Modal
        open={showUgcModal}
        onClose={() => setShowUgcModal(false)}
        title="UGC Script"
        subtitle={ugcInsightTitle ? `Based on "${ugcInsightTitle}" - edit any text, then save or copy` : undefined}
        maxWidth="max-w-3xl"
      >
        {ugcScripts ? (
          <div className="space-y-4">
            {/* SAVE BANNER */}
            <div className="bg-fulton/10 border border-fulton/30 rounded-lg p-4 flex items-center justify-between">
              <div>
                <div className="text-sm font-bold text-fulton">Save this script to {brand?.name}</div>
                <div className="text-2xs text-text-dim">Edit text directly + use feedback inputs to refine with AI</div>
              </div>
              <Button
                disabled={savingScript}
                onClick={async () => {
                  if (!brand?.id) return
                  setSavingScript(true)
                  const fullScript = `HOOKS:\n${ugcScripts.hooks.map((h, i) => `P${h.persona_number} (${h.persona}): "${editableHooks[i] || h.hook}"`).join('\n')}\n\nBODY:\n${editableBody}${editableCta ? `\n\n${editableCta}` : ''}`
                  try {
                    await fetch('/api/insights', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ brandId: brand.id, title: `UGC Script: ${ugcInsightTitle}`, detail: fullScript, insight_type: 'ugc-script', priority: 'high' }),
                    })
                    onToast('UGC script saved to Insights', 'success')
                  } catch { onToast('Save failed', 'error') }
                  setSavingScript(false)
                }}
              >
                {savingScript ? <><LoadingSpinner size={14} /> Saving...</> : 'Save Script'}
              </Button>
            </div>

            {/* Each hook with its own feedback */}
            {ugcScripts.hooks.map((h, i) => (
              <div key={i} className="bg-page border border-border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xs font-bold text-fulton bg-fulton-light px-2 py-0.5 rounded">P{h.persona_number}</span>
                  <span className="text-2xs text-text-dim">{h.persona}</span>
                  <span className="text-2xs text-text-dim ml-auto">Hook {i + 1}</span>
                </div>
                <textarea
                  value={editableHooks[i] || ''}
                  onChange={e => { const next = [...editableHooks]; next[i] = e.target.value; setEditableHooks(next) }}
                  className="w-full text-sm text-text-secondary leading-relaxed italic bg-transparent border border-border rounded p-2 focus:border-fulton focus:outline-none resize-y min-h-[40px] mb-2"
                  rows={2}
                />
                <div className="flex gap-1.5">
                  <input type="text" placeholder={`Refine hook ${i + 1}: e.g. more punchy, different opening...`}
                    className="flex-1 px-2.5 py-1.5 bg-elevated border border-border rounded text-xs text-text-primary focus:border-fulton focus:outline-none"
                    onKeyDown={async e => {
                      if (e.key !== 'Enter') return
                      const input = e.target as HTMLInputElement
                      const feedback = input.value.trim()
                      if (!feedback) return
                      input.value = ''; input.disabled = true
                      try {
                        const res = await fetch('/api/refine', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ text: editableHooks[i] || h.hook, feedback }) })
                        const data = await res.json()
                        if (data.refined) { const next = [...editableHooks]; next[i] = data.refined; setEditableHooks(next); onToast(`Hook ${i + 1} refined`, 'success') }
                      } catch { onToast('Refine failed', 'error') }
                      input.disabled = false
                    }} />
                  <button onClick={() => { navigator.clipboard.writeText(editableHooks[i] || h.hook); onToast('Hook copied', 'success') }}
                    className="text-2xs text-text-dim hover:text-text-primary px-2 shrink-0">Copy</button>
                </div>
              </div>
            ))}

            {/* Body + CTA merged with feedback */}
            <div className="bg-page border border-border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold text-text-muted uppercase tracking-wider">Body + CTA</span>
                <span className="text-2xs text-text-dim">3-25 seconds</span>
              </div>
              <textarea
                value={`${editableBody}${editableCta ? `\n\n${editableCta}` : ''}`}
                onChange={e => { setEditableBody(e.target.value); setEditableCta('') }}
                className="w-full text-sm text-text-secondary leading-relaxed bg-transparent border border-border rounded p-3 focus:border-fulton focus:outline-none resize-y min-h-[100px] mb-2"
                rows={5}
              />
              <div className="flex gap-1.5">
                <input type="text" placeholder="Refine body: e.g. more conversational, add social proof..."
                  className="flex-1 px-2.5 py-1.5 bg-elevated border border-border rounded text-xs text-text-primary focus:border-fulton focus:outline-none"
                  onKeyDown={async e => {
                    if (e.key !== 'Enter') return
                    const input = e.target as HTMLInputElement
                    const feedback = input.value.trim()
                    if (!feedback || !brand?.id) return
                    input.value = ''; input.disabled = true
                    try {
                      const res = await fetch('/api/refine', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ text: `${editableBody}${editableCta ? `\n\n${editableCta}` : ''}`, feedback }) })
                      const data = await res.json()
                      if (data.refined) { setEditableBody(data.refined); setEditableCta(''); onToast('Body refined', 'success') }
                    } catch { onToast('Refine failed', 'error') }
                    input.disabled = false
                  }} />
                <button onClick={() => { navigator.clipboard.writeText(`${editableBody}${editableCta ? `\n\n${editableCta}` : ''}`); onToast('Body copied', 'success') }}
                  className="text-2xs text-text-dim hover:text-text-primary px-2 shrink-0">Copy</button>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1 justify-center" onClick={() => {
                const all = `HOOKS:\n${ugcScripts.hooks.map((h, i) => `P${h.persona_number} (${h.persona}): "${editableHooks[i] || h.hook}"`).join('\n')}\n\nBODY:\n${editableBody}${editableCta ? `\n\n${editableCta}` : ''}`
                navigator.clipboard.writeText(all)
                onToast('All scripts copied', 'success')
              }}>Copy All</Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-text-dim">No scripts generated</div>
        )}
      </Modal>

      {/* Video Prompt Modal */}
      <Modal
        open={showVideoModal}
        onClose={() => setShowVideoModal(false)}
        title="Video Concept"
        subtitle={videoPromptData?.title || 'AI-generated video scenes'}
        maxWidth="max-w-3xl"
      >
        {videoPromptData ? (
          <div className="space-y-4">
            {/* Recommendation */}
            <div className="flex gap-2 mb-2">
              <span className="text-2xs bg-blue-light text-blue px-2 py-0.5 rounded font-bold">
                Model: {videoPromptData.recommended_model === 'seedance' ? 'Seedance 2.0' : 'Kling v3'}
              </span>
              <span className="text-2xs bg-blue-light text-blue px-2 py-0.5 rounded font-bold">
                Style: {videoPromptData.recommended_style}
              </span>
            </div>

            {/* Scenes */}
            {videoPromptData.scenes?.map((scene, i) => (
              <div key={i} className="bg-page border border-border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xs font-bold text-blue bg-blue-light px-2 py-0.5 rounded">
                    Scene {scene.sceneNumber}
                  </span>
                  <span className="text-2xs text-text-dim">{scene.duration}s</span>
                  <span className="text-2xs text-text-dim">{scene.camera}</span>
                </div>
                <p className="text-sm text-text-secondary mb-2">{scene.description}</p>
                <div className="bg-elevated border border-border rounded px-3 py-2">
                  <div className="text-2xs font-bold text-text-muted uppercase tracking-wider mb-1">Video Prompt</div>
                  <p className="text-xs text-text-dim leading-relaxed">{scene.prompt}</p>
                </div>
              </div>
            ))}

            {/* Full prompt for single-video generation */}
            {videoPromptData.full_prompt && (
              <div className="bg-page border border-border rounded-lg p-4">
                <div className="text-2xs font-bold text-text-muted uppercase tracking-wider mb-2">Full Combined Prompt</div>
                <p className="text-sm text-text-secondary leading-relaxed mb-3">{videoPromptData.full_prompt}</p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      // Store prompt and navigate to HyperVideo
                      localStorage.setItem('hc-video-prompt', videoPromptData.full_prompt)
                      localStorage.setItem('hc-video-model', videoPromptData.recommended_model || 'seedance')
                      localStorage.setItem('hc-video-style', videoPromptData.recommended_style || 'ugc')
                      setShowVideoModal(false)
                      if (onNavigate) onNavigate('hypervideo', 'video')
                      onToast('Prompt loaded into HyperVideo', 'info')
                    }}
                  >
                    Open in HyperVideo
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      navigator.clipboard.writeText(videoPromptData.full_prompt)
                      onToast('Full prompt copied', 'success')
                    }}
                  >
                    Copy Prompt
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-text-dim">No video concept generated</div>
        )}
      </Modal>
    </div>
  )
}
