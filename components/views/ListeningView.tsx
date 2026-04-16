'use client'

import { useState } from 'react'
import { Brand, SocialSignal, ListeningInsight } from '@/lib/types'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import SectionHeader from '@/components/ui/SectionHeader'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import Pill from '@/components/ui/Pill'

interface ListeningViewProps {
  brand: Brand | null
  onToast: (msg: string, type: 'success' | 'error' | 'info') => void
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

export default function ListeningView({ brand, onToast }: ListeningViewProps) {
  const [signals, setSignals] = useState<SocialSignal[]>([])
  const [insights, setInsights] = useState<ListeningInsight[]>([])
  const [trends, setTrends] = useState<{ keyword: string; trending: boolean; suggestions?: string[] }[]>([])
  const [loading, setLoading] = useState(false)
  const [hasRun, setHasRun] = useState(false)

  const hasResearch = brand?.research_completed

  const runListening = async () => {
    if (!brand?.id) { onToast('No brand selected', 'error'); return }
    if (!hasResearch) { onToast('Run brand research first - go to Brand Kit and add the website URL', 'error'); return }

    setLoading(true)
    onToast('Scanning Reddit and Google Trends...', 'info')

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
      setHasRun(true)
      onToast(`Found ${data.signalCount} signals, extracted ${data.insightCount} insights`, 'success')
    } catch (err: unknown) {
      onToast(`Listening failed: ${err instanceof Error ? err.message : String(err)}`, 'error')
    }
    setLoading(false)
  }

  if (!hasResearch) {
    return (
      <div className="animate-fadeIn flex flex-col items-center justify-center py-24 text-center">
        <div className="text-5xl mb-4">👂</div>
        <h2 className="text-2xl font-black mb-2">HyperListening</h2>
        <p className="text-sm text-text-dim max-w-md mb-6">
          Social listening requires brand research first. Go to Brand Kit, add your brand's website URL, and run the deep research. Then come back here.
        </p>
        <Pill variant="amber">Brand research required</Pill>
      </div>
    )
  }

  return (
    <div className="animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-black">Social Listening</h3>
          <p className="text-xs text-text-dim mt-0.5">
            {brand?.research?.searchKeywords?.length || 0} keywords tracked across Reddit and Google Trends
          </p>
        </div>
        <Button onClick={runListening} disabled={loading}>
          {loading ? <><LoadingSpinner size={16} /> Scanning...</> : hasRun ? 'Refresh Signals' : 'Scan Now'}
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <LoadingSpinner size={32} />
            <div className="text-sm text-text-dim mt-4">Scanning Reddit and Google Trends...</div>
            <div className="text-2xs text-text-dim mt-1">Claude is analyzing signals for actionable insights</div>
          </div>
        </div>
      ) : !hasRun ? (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card>
            <div className="text-center py-6">
              <div className="text-2xl mb-2">🔍</div>
              <div className="text-sm font-bold mb-1">Reddit</div>
              <div className="text-2xs text-text-dim">
                Tracking: {brand?.research?.subreddits?.slice(0, 3).map(s => `r/${s}`).join(', ')}
              </div>
            </div>
          </Card>
          <Card>
            <div className="text-center py-6">
              <div className="text-2xl mb-2">📊</div>
              <div className="text-sm font-bold mb-1">Google Trends</div>
              <div className="text-2xs text-text-dim">
                Keywords: {brand?.research?.searchKeywords?.slice(0, 3).join(', ')}
              </div>
            </div>
          </Card>
          <Card>
            <div className="text-center py-6">
              <div className="text-2xl mb-2">🤖</div>
              <div className="text-sm font-bold mb-1">Claude Analysis</div>
              <div className="text-2xs text-text-dim">Extracts actionable creative insights</div>
            </div>
          </Card>
        </div>
      ) : (
        <>
          {/* Insights */}
          {insights.length > 0 && (
            <div className="mb-6">
              <SectionHeader title="Actionable Insights" subtitle={`${insights.length} insights from Claude`} />
              <div className="space-y-3">
                {insights.map((insight, i) => (
                  <Card key={insight.id || i}>
                    <div className="flex items-start gap-3">
                      <span className="text-xl mt-0.5">{typeEmoji[insight.type] || '📌'}</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-bold">{insight.title}</span>
                          <Pill variant={priorityColor[insight.priority] || 'gray'}>{insight.priority}</Pill>
                          <span className="text-2xs text-text-dim uppercase tracking-wider">{insight.type.replace('_', ' ')}</span>
                        </div>
                        <p className="text-xs text-text-muted leading-relaxed mb-2">{insight.detail}</p>
                        <div className="bg-fulton-light border border-fulton/20 rounded px-3 py-2">
                          <span className="text-2xs font-bold text-fulton uppercase tracking-wider">Action: </span>
                          <span className="text-xs text-text-secondary">{insight.actionable}</span>
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
              <div className="grid grid-cols-5 gap-2">
                {trends.map((t, i) => (
                  <Card key={i}>
                    <div className="text-center py-2">
                      <div className="text-xs font-bold truncate mb-1">{t.keyword}</div>
                      <Pill variant={t.trending ? 'green' : 'gray'}>{t.trending ? 'Trending' : 'Normal'}</Pill>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Raw Signals */}
          {signals.length > 0 && (
            <div>
              <SectionHeader title="Signal Feed" subtitle={`${signals.length} recent posts from Reddit`} />
              <div className="space-y-2">
                {signals.slice(0, 15).map((signal, i) => (
                  <div
                    key={signal.id || i}
                    className="flex items-start gap-3 px-4 py-3 bg-surface border border-border rounded-lg hover:border-text-subtle transition-colors cursor-pointer"
                    onClick={() => signal.url && window.open(signal.url, '_blank')}
                  >
                    <span className="text-2xs font-bold text-fulton bg-fulton-light px-1.5 py-0.5 rounded shrink-0 mt-0.5">
                      {signal.source}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate">{signal.title}</div>
                      {signal.content && (
                        <div className="text-2xs text-text-dim mt-0.5 line-clamp-2">{signal.content}</div>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs font-bold text-text-muted">{signal.score || 0}</div>
                      <div className="text-2xs text-text-dim">votes</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
