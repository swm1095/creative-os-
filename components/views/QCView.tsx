'use client'

import { useState } from 'react'
import { QCResult } from '@/lib/types'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

interface QCViewProps {
  imageUrl?: string
  onToast: (msg: string, type: 'success' | 'error' | 'info') => void
}

const statusStyle: Record<string, { icon: string; class: string; pill: string }> = {
  pass: { icon: '✓', class: 'text-green', pill: 'bg-green-light text-green' },
  warning: { icon: '⚠', class: 'text-amber', pill: 'bg-amber-light text-amber' },
  fail: { icon: '✕', class: 'text-red', pill: 'bg-red-light text-red' },
  pending: { icon: '○', class: 'text-text-dim', pill: 'bg-elevated text-text-dim' },
}

export default function QCView({ imageUrl, onToast }: QCViewProps) {
  const [result, setResult] = useState<QCResult | null>(null)
  const [running, setRunning] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [testUrl, setTestUrl] = useState(imageUrl || '')

  const runQC = async () => {
    const url = testUrl || imageUrl
    if (!url) { onToast('Enter an image URL or generate creatives first', 'error'); return }
    setRunning(true)
    setResult(null)
    onToast('Running 3 QC checks via Claude...', 'info')

    try {
      const res = await fetch('/api/qc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: url }),
      })
      const data = await res.json()
      if (data.error) { onToast(`QC error: ${data.error}`, 'error'); setRunning(false); return }
      setResult(data)
      const scoreMap: Record<string, number> = { pass: 33, warning: 20, fail: 5, pending: 0 }
      const score = (scoreMap[data.spelling.status] || 0) + (scoreMap[data.brand.status] || 0) + (scoreMap[data.claims.status] || 0)
      onToast(`All checks complete — score: ${score}/100`, 'success')
    } catch (err: unknown) {
      onToast(`QC failed: ${err instanceof Error ? err.message : String(err)}`, 'error')
    }
    setRunning(false)
  }

  const checks = [
    { key: 'spelling', title: 'Spelling & Grammar', desc: 'Check all visible text for errors' },
    { key: 'brand', title: 'Brand Compliance', desc: 'Visual consistency with brand guidelines' },
    { key: 'claims', title: 'Claim Accuracy', desc: 'Flag unverifiable or exaggerated claims' },
  ] as const

  const scoreMap: Record<string, number> = { pass: 33, warning: 20, fail: 5, pending: 0 }
  const score = result
    ? (scoreMap[result.spelling.status] || 0) + (scoreMap[result.brand.status] || 0) + (scoreMap[result.claims.status] || 0)
    : 0

  return (
    <div className="animate-fadeIn grid grid-cols-[1fr_280px] gap-4">
      {/* Left — Checks */}
      <div className="space-y-3">
        <Card title="Image URL" subtitle="Paste a URL or use a generated image">
          <div className="flex gap-2">
            <input
              className="flex-1 px-3 py-2 text-sm bg-page border border-border rounded focus:border-fulton focus:outline-none"
              placeholder="https://example.com/image.png or data:image/..."
              value={testUrl}
              onChange={e => setTestUrl(e.target.value)}
            />
            <Button onClick={runQC} disabled={running}>
              {running ? <LoadingSpinner size={14} /> : 'Run All QC'}
            </Button>
          </div>
        </Card>

        {checks.map(check => {
          const note = result?.[check.key]
          const status = note?.status || 'pending'
          const style = statusStyle[status]
          return (
            <div key={check.key} className="bg-surface border border-border rounded-lg overflow-hidden">
              <button
                className="w-full px-5 py-4 flex items-center gap-3 text-left hover:bg-elevated/50 transition-colors"
                onClick={() => setExpanded(expanded === check.key ? null : check.key)}
              >
                <span className={`text-lg font-bold ${style.class}`}>{running ? '⏳' : style.icon}</span>
                <div className="flex-1">
                  <div className="text-sm font-bold">{check.title}</div>
                  <div className="text-2xs text-text-dim">{check.desc}</div>
                </div>
                <span className={`text-2xs font-bold px-2 py-0.5 rounded ${style.pill}`}>
                  {running ? 'Running...' : status.charAt(0).toUpperCase() + status.slice(1)}
                </span>
              </button>
              {expanded === check.key && note && (
                <div className="px-5 pb-4 border-t border-border">
                  <div className="pt-3 text-sm text-text-secondary leading-relaxed">
                    <strong>{note.message}</strong>
                    {note.detail && <p className="mt-2 text-text-dim">{note.detail}</p>}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Right — Score */}
      <div className="space-y-4">
        <Card>
          <div className="text-center py-4">
            <div className={`text-5xl font-black ${score >= 90 ? 'text-green' : score >= 60 ? 'text-amber' : score > 0 ? 'text-red' : 'text-text-dim'}`}>
              {result ? score : '—'}
            </div>
            <div className="text-xs text-text-dim mt-1">QC Score out of 100</div>
          </div>
          <div className="border-t border-border pt-3 space-y-2">
            {checks.map(check => {
              const note = result?.[check.key]
              const status = note?.status || 'pending'
              const style = statusStyle[status]
              return (
                <div key={check.key} className="flex items-center justify-between">
                  <span className="text-xs text-text-muted">{check.title}</span>
                  <span className={`text-2xs font-bold px-2 py-0.5 rounded ${style.pill}`}>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </span>
                </div>
              )
            })}
          </div>
          {result && score >= 80 && (
            <Button variant="primary" className="w-full mt-4 justify-center">Approve & Export</Button>
          )}
        </Card>
      </div>
    </div>
  )
}
