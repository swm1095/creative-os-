'use client'

import { useState, useEffect, useCallback } from 'react'
import { Brand, ToolId, ViewId } from '@/lib/types'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import Pill from '@/components/ui/Pill'

interface SavedInsight {
  id: string
  brand_id: string
  title: string
  detail: string
  insight_type: string
  source_data: { copy_examples?: string[]; actionable?: string; signals?: string[] }
  notes: string
  status: string
  priority: string
  created_at: string
}

interface SavedInsightsViewProps {
  brand: Brand | null
  onToast: (msg: string, type: 'success' | 'error' | 'info') => void
  onNavigate?: (tool: ToolId, view: ViewId) => void
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

export default function SavedInsightsView({ brand, onToast, onNavigate }: SavedInsightsViewProps) {
  const [insights, setInsights] = useState<SavedInsight[]>([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<string>('all')

  const loadInsights = useCallback(async () => {
    if (!brand?.id) return
    setLoading(true)
    try {
      const res = await fetch(`/api/insights?brandId=${brand.id}`)
      const data = await res.json()
      if (data.insights) setInsights(data.insights)
    } catch { /* silent */ }
    setLoading(false)
  }, [brand?.id])

  useEffect(() => { loadInsights() }, [loadInsights])

  const deleteInsight = async (id: string) => {
    if (!confirm('Delete this insight?')) return
    try {
      await fetch('/api/insights', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      setInsights(prev => prev.filter(i => i.id !== id))
      onToast('Insight deleted', 'success')
    } catch { /* silent */ }
  }

  const updateStatus = async (id: string, status: string) => {
    try {
      await fetch('/api/insights', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      })
      setInsights(prev => prev.map(i => i.id === id ? { ...i, status } : i))
    } catch { /* silent */ }
  }

  const generateFromInsight = (insight: SavedInsight, type: 'copy' | 'image') => {
    if (!onNavigate) return
    const brief = `Based on this insight: "${insight.title}"\n\n${insight.detail}${insight.notes ? '\n\nNotes: ' + insight.notes : ''}${insight.source_data?.actionable ? '\n\nAction: ' + insight.source_data.actionable : ''}`
    localStorage.setItem('hc-brief-draft', brief)
    if (type === 'copy') {
      onNavigate('hypercopy', 'copy')
    } else {
      onNavigate('hypeimage', 'generate')
    }
    onToast(`Opening ${type === 'copy' ? 'HyperCopy' : 'HyperImage'} with insight context`, 'info')
  }

  const filtered = filter === 'all' ? insights : insights.filter(i => i.status === filter || i.insight_type === filter)

  if (!brand) {
    return (
      <div className="animate-fadeIn flex flex-col items-center justify-center py-24 text-center">
        <div className="text-5xl mb-4">📁</div>
        <h2 className="text-2xl font-black mb-2">No Brand Selected</h2>
        <p className="text-sm text-text-dim max-w-md">Select a brand from the sidebar to see saved insights.</p>
      </div>
    )
  }

  return (
    <div className="animate-fadeIn">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-black">Saved Insights</h3>
          <p className="text-xs text-text-dim mt-0.5">{insights.length} insights saved for {brand.name}</p>
        </div>
        <div className="flex gap-2">
          {['all', 'idea', 'in-progress', 'used'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-2xs font-bold uppercase tracking-wider rounded transition-colors ${
                filter === f ? 'bg-fulton text-white' : 'bg-surface border border-border text-text-muted hover:text-text-primary'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <LoadingSpinner size={24} />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <div className="text-center py-10">
            <div className="text-3xl mb-3">📂</div>
            <div className="text-sm font-bold mb-1">No saved insights yet</div>
            <div className="text-xs text-text-dim">Go to HyperListening and click "Save to Folder" on any insight</div>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(insight => (
            <Card key={insight.id}>
              <div className="flex items-start gap-3">
                <span className="text-xl mt-0.5">{typeEmoji[insight.insight_type] || '📌'}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-sm font-bold">{insight.title}</span>
                    <Pill variant={priorityColor[insight.priority] || 'gray'}>{insight.priority}</Pill>
                    <span className="text-2xs text-text-dim uppercase tracking-wider">{insight.insight_type?.replace('_', ' ')}</span>
                    <span className="text-2xs text-text-dim">• {new Date(insight.created_at).toLocaleDateString()}</span>
                  </div>
                  <p className="text-xs text-text-muted leading-relaxed mb-2">{insight.detail}</p>
                  {insight.source_data?.copy_examples && insight.source_data.copy_examples.length > 0 && (
                    <div className="mb-2 flex gap-1.5 flex-wrap">
                      {insight.source_data.copy_examples.map((ex: string, j: number) => (
                        <span key={j} className="text-2xs bg-fulton-light text-fulton px-2 py-0.5 rounded italic">&quot;{ex}&quot;</span>
                      ))}
                    </div>
                  )}
                  {insight.notes && (
                    <div className="bg-page border border-border rounded px-3 py-2 mb-2 text-xs text-text-secondary">
                      <span className="text-2xs font-bold text-text-muted uppercase tracking-wider">Notes: </span>
                      {insight.notes}
                    </div>
                  )}

                  <div className="flex gap-2 flex-wrap items-center">
                    <Button size="sm" variant="secondary" onClick={() => generateFromInsight(insight, 'copy')}>
                      ✍ Write Copy
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => generateFromInsight(insight, 'image')}>
                      🖼 Generate Ad
                    </Button>
                    <select
                      value={insight.status}
                      onChange={e => updateStatus(insight.id, e.target.value)}
                      className="px-2.5 py-1.5 bg-page border border-border rounded text-2xs text-text-primary focus:border-fulton focus:outline-none"
                    >
                      <option value="idea">Idea</option>
                      <option value="in-progress">In Progress</option>
                      <option value="used">Used</option>
                      <option value="archived">Archived</option>
                    </select>
                    <button
                      onClick={() => deleteInsight(insight.id)}
                      className="text-2xs text-text-dim hover:text-red px-2 py-1 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
