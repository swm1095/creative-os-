'use client'

import { useState } from 'react'
import { Creative, QCResult, QCStatus } from '@/lib/types'

interface QCPanelProps {
  creative: Creative
  onClose: () => void
  onQCComplete: (result: QCResult, creativeId: string) => void
}

const CHECKS = [
  {
    key: 'spelling' as const,
    label: 'Spelling & Grammar',
    icon: '📝',
    desc: 'Scans all visible text for typos, grammar errors, and misspellings.',
  },
  {
    key: 'brand' as const,
    label: 'Brand Compliance',
    icon: '🎨',
    desc: 'Verifies colors, fonts, and style match your uploaded brand guidelines.',
  },
  {
    key: 'claims' as const,
    label: 'Claim Accuracy',
    icon: '🔍',
    desc: 'Flags potentially false, exaggerated, or unverifiable factual claims.',
  },
]

function statusColor(s: QCStatus): string {
  return s === 'pass' ? 'var(--green)' : s === 'fail' ? 'var(--red)' : s === 'warning' ? 'var(--amber)' : 'var(--gray-300)'
}
function statusBg(s: QCStatus): string {
  return s === 'pass' ? 'var(--green-light)' : s === 'fail' ? 'var(--red-light)' : s === 'warning' ? 'var(--amber-light)' : 'var(--gray-100)'
}
function statusLabel(s: QCStatus): string {
  return s === 'pass' ? '✓ Pass' : s === 'fail' ? '✗ Fail' : s === 'warning' ? '⚠ Warning' : '— Pending'
}

export default function QCPanel({ creative, onClose, onQCComplete }: QCPanelProps) {
  const [loading, setLoading] = useState(false)
  const [runningCheck, setRunningCheck] = useState<string | null>(null)
  const [result, setResult] = useState<QCResult | null>(null)
  const [error, setError] = useState('')

  const runQC = async () => {
    setError('')
    setLoading(true)
    setResult(null)

    const checks = ['spelling', 'brand', 'claims']
    for (const check of checks) {
      setRunningCheck(check)
      await new Promise(r => setTimeout(r, 200)) // visual stagger
    }

    try {
      const res = await fetch('/api/qc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: creative.image_url,
          brandId: creative.brand_id,
          creativeId: creative.id,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'QC failed')
      setResult(data)
      onQCComplete(data, creative.id)
    } catch (e: any) {
      setError(e.message)
    }
    setRunningCheck(null)
    setLoading(false)
  }

  const runSingleCheck = async (checkKey: 'spelling' | 'brand' | 'claims') => {
    setError('')
    setRunningCheck(checkKey)
    try {
      const res = await fetch('/api/qc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: creative.image_url,
          brandId: creative.brand_id,
          creativeId: creative.id,
          onlyCheck: checkKey,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'QC check failed')
      setResult(prev => prev ? { ...prev, [checkKey]: data[checkKey], overallStatus: data.overallStatus } : data)
    } catch (e: any) {
      setError(e.message)
    }
    setRunningCheck(null)
  }

  const overallOk = result && result.overallStatus === 'pass'
  const overallFail = result && result.overallStatus === 'fail'

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400
    }}>
      <div style={{
        background: 'white', borderRadius: 12, border: '1px solid var(--border)',
        width: 540, maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.02em' }}>Quality Control</div>
            <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2 }}>{creative.title}</div>
          </div>
          <div style={{ flex: 1 }}/>
          {result && (
            <span className="status-pill" style={{
              background: statusBg(result.overallStatus),
              color: statusColor(result.overallStatus),
              marginRight: 12
            }}>
              {statusLabel(result.overallStatus)}
            </span>
          )}
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--gray-500)' }}>×</button>
        </div>

        <div style={{ padding: 24 }}>
          {/* Image preview */}
          <div style={{ marginBottom: 20, display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            <div style={{ width: 100, height: 100, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)', flexShrink: 0, background: 'var(--gray-100)' }}>
              <img src={creative.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{creative.title}</div>
              {creative.concept && <div style={{ fontSize: 12, color: 'var(--gray-500)', marginBottom: 4 }}>{creative.concept}</div>}
              {creative.persona && <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>Persona: {creative.persona}</div>}
            </div>
          </div>

          {/* The 3 checks */}
          <div style={{ marginBottom: 20 }}>
            {CHECKS.map(check => {
              const checkResult = result?.[check.key]
              const isRunning = runningCheck === check.key
              return (
                <div key={check.key} style={{
                  border: '1px solid var(--border)', borderRadius: 8, padding: '14px 16px',
                  marginBottom: 8, background: checkResult ? statusBg(checkResult.status) : 'var(--gray-50)',
                  borderColor: checkResult ? (checkResult.status === 'pass' ? '#bbf7d0' : checkResult.status === 'fail' ? '#fecaca' : checkResult.status === 'warning' ? '#fde68a' : 'var(--border)') : 'var(--border)',
                  transition: 'all 0.2s'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 18 }}>{check.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '-0.01em' }}>{check.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--gray-500)', marginTop: 2 }}>{check.desc}</div>
                    </div>
                    {isRunning ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--blue)', fontWeight: 600 }}>
                        <MiniSpinner/> Checking...
                      </div>
                    ) : checkResult ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                          fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
                          padding: '3px 8px', borderRadius: 4,
                          background: 'white', color: statusColor(checkResult.status)
                        }}>
                          {statusLabel(checkResult.status)}
                        </span>
                        <button onClick={() => runSingleCheck(check.key)} className="btn-ghost" style={{ fontSize: 11, padding: '3px 8px' }}>Re-run</button>
                      </div>
                    ) : (
                      <button onClick={() => runSingleCheck(check.key)} disabled={loading} className="btn-ghost" style={{ fontSize: 11, padding: '5px 10px' }}>
                        Run
                      </button>
                    )}
                  </div>

                  {/* Result detail */}
                  {checkResult && checkResult.message && (
                    <div style={{
                      marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(0,0,0,0.06)',
                      fontSize: 12, color: 'var(--gray-700)', lineHeight: 1.5
                    }}>
                      <strong>Finding:</strong> {checkResult.message}
                      {checkResult.detail && (
                        <div style={{ marginTop: 4, fontSize: 11, color: 'var(--gray-500)' }}>{checkResult.detail}</div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Error */}
          {error && (
            <div style={{ padding: '10px 14px', background: 'var(--red-light)', borderRadius: 6, fontSize: 12, color: 'var(--red)', marginBottom: 16 }}>
              {error}
            </div>
          )}

          {/* Run all button */}
          {!result && (
            <button
              className="btn-primary"
              onClick={runQC}
              disabled={loading}
              style={{ width: '100%', padding: 13 }}
            >
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <MiniSpinner light/> Running 3 QC checks...
                </span>
              ) : 'Run all 3 QC checks'}
            </button>
          )}

          {result && (
            <div style={{ marginTop: 0 }}>
              {overallOk && (
                <div style={{ padding: '12px 16px', background: 'var(--green-light)', borderRadius: 8, fontSize: 13, color: 'var(--green)', fontWeight: 600, textAlign: 'center' }}>
                  ✓ All checks passed — this creative is QC approved
                </div>
              )}
              {overallFail && (
                <div style={{ padding: '12px 16px', background: 'var(--red-light)', borderRadius: 8, fontSize: 13, color: 'var(--red)', fontWeight: 600, textAlign: 'center' }}>
                  Issues found — review the checks above before publishing
                </div>
              )}
              <button className="btn-ghost" onClick={runQC} disabled={loading} style={{ width: '100%', marginTop: 10 }}>
                Re-run all checks
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function MiniSpinner({ light }: { light?: boolean }) {
  return (
    <div style={{
      width: 12, height: 12,
      border: `2px solid ${light ? 'rgba(255,255,255,0.3)' : 'var(--border)'}`,
      borderTopColor: light ? 'white' : 'var(--blue)',
      borderRadius: '50%', animation: 'spin 0.7s linear infinite', flexShrink: 0
    }}/>
  )
}
