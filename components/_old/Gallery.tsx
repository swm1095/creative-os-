'use client'

import { useState } from 'react'
import { Creative, Brand, Job } from '@/lib/types'

interface GalleryProps {
  brand: Brand | null
  creatives: Creative[]
  jobs: Job[]
  onGenerate: () => void
  onCreativeClick: (c: Creative) => void
}

const THUMB_COLORS = ['t-blue','t-green','t-amber','t-purple','t-slate']
const colorMap: Record<string, {bg: string, color: string}> = {
  't-blue':   { bg: '#e8ecff', color: '#2B4EFF' },
  't-green':  { bg: '#e6f7f1', color: '#00a86b' },
  't-amber':  { bg: '#fef3c7', color: '#d97706' },
  't-purple': { bg: '#ede9fe', color: '#6d28d9' },
  't-slate':  { bg: '#f1f5f9', color: '#475569' },
}

function overallQC(c: Creative): 'pass' | 'warn' | 'pending' {
  const statuses = [c.qc_spelling, c.qc_brand, c.qc_claims]
  if (statuses.some(s => s === 'fail')) return 'warn'
  if (statuses.every(s => s === 'pass')) return 'pass'
  return 'pending'
}

export default function Gallery({ brand, creatives, jobs, onGenerate, onCreativeClick }: GalleryProps) {
  const [activeTab, setActiveTab] = useState<'gallery' | 'jobs' | 'brand' | 'personas'>('gallery')

  const thisWeek = creatives.filter(c => {
    const d = new Date(c.created_at)
    const now = new Date()
    return (now.getTime() - d.getTime()) < 7 * 24 * 60 * 60 * 1000
  }).length

  const passRate = creatives.length === 0 ? 0 : Math.round(
    (creatives.filter(c => overallQC(c) === 'pass').length / creatives.length) * 100
  )

  const inQueue = jobs.filter(j => j.status === 'queued' || j.status === 'running').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16, padding: '14px 24px',
        borderBottom: '1px solid var(--border)'
      }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: '-0.03em' }}>
            {brand?.name || 'Select a brand'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 1 }}>
            {brand?.url || '—'}
          </div>
        </div>
        <div style={{ flex: 1 }}/>
        {brand && <span className="status-pill sp-done">Brand guide {brand.brand_colors ? 'ready' : 'needed'}</span>}
        {brand && (
          <button className="btn-primary" onClick={onGenerate}>+ Generate</button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', padding: '0 24px' }}>
        {(['gallery','jobs','brand','personas'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              fontSize: 13, fontWeight: 600, padding: '10px 14px', cursor: 'pointer',
              color: activeTab === tab ? 'var(--blue)' : 'var(--gray-500)',
              borderBottom: activeTab === tab ? '2px solid var(--blue)' : '2px solid transparent',
              marginBottom: -1, background: 'none', border: 'none', borderBottomStyle: 'solid',
              borderBottomWidth: 2, borderBottomColor: activeTab === tab ? 'var(--blue)' : 'transparent',
              letterSpacing: '-0.01em', textTransform: 'capitalize',
              fontFamily: 'inherit',
            }}
          >{tab === 'brand' ? 'Brand guide' : tab.charAt(0).toUpperCase() + tab.slice(1)}</button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 24, background: 'var(--gray-50)' }}>
        {!brand ? (
          <div style={{ textAlign: 'center', paddingTop: 60, color: 'var(--gray-300)' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>▦</div>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Select a brand to get started</div>
            <div style={{ fontSize: 12 }}>Choose a brand from the sidebar or add a new one.</div>
          </div>
        ) : activeTab === 'gallery' ? (
          <>
            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 28 }}>
              {[
                { label: 'Total creatives', value: creatives.length, blue: false },
                { label: 'This week', value: thisWeek, blue: false },
                { label: 'QC pass rate', value: `${passRate}%`, blue: true },
                { label: 'In queue', value: inQueue, blue: false },
              ].map(s => (
                <div key={s.label} style={{
                  background: 'white', border: '1px solid var(--border)', borderRadius: 8, padding: '16px 18px'
                }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--gray-300)', marginBottom: 8 }}>{s.label}</div>
                  <div style={{ fontSize: 34, fontWeight: 900, letterSpacing: '-0.04em', color: s.blue ? 'var(--blue)' : 'var(--black)' }}>{s.value}</div>
                </div>
              ))}
            </div>

            <div className="section-title">Recent creatives</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {creatives.map((c, i) => {
                const tc = colorMap[THUMB_COLORS[i % THUMB_COLORS.length]]
                const qc = overallQC(c)
                return (
                  <div
                    key={c.id}
                    onClick={() => onCreativeClick(c)}
                    style={{
                      background: 'white', border: '1px solid var(--border)', borderRadius: 8,
                      overflow: 'hidden', cursor: 'pointer', transition: 'all 0.15s'
                    }}
                  >
                    {/* Thumbnail */}
                    {c.image_url ? (
                      <div style={{ height: 88, overflow: 'hidden', position: 'relative' }}>
                        <img src={c.image_url} alt={c.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                      </div>
                    ) : (
                      <div style={{
                        height: 88, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase',
                        background: tc.bg, color: tc.color
                      }}>
                        {c.format.replace('x','×')} {c.persona?.split(':')[0] || 'Creative'}
                      </div>
                    )}
                    <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border)' }}>
                      <div style={{
                        fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap', marginBottom: 5, letterSpacing: '-0.01em'
                      }}>{c.title}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 3, background: 'var(--gray-100)', color: 'var(--gray-500)' }}>
                          {c.format}
                        </span>
                        <span style={{
                          display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700,
                          letterSpacing: '0.06em', textTransform: 'uppercase', marginLeft: 'auto',
                          color: qc === 'pass' ? 'var(--green)' : qc === 'warn' ? 'var(--amber)' : 'var(--gray-300)'
                        }}>
                          <span style={{
                            width: 5, height: 5, borderRadius: '50%',
                            background: qc === 'pass' ? 'var(--green)' : qc === 'warn' ? 'var(--amber)' : 'var(--gray-300)',
                            display: 'inline-block'
                          }}/>
                          {qc === 'pass' ? 'Pass' : qc === 'warn' ? '1 flag' : 'Pending'}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}

              {/* Add card */}
              <div
                onClick={onGenerate}
                style={{
                  background: 'white', border: '1.5px dashed var(--border)', borderRadius: 8,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', height: 128,
                  cursor: 'pointer', color: 'var(--gray-300)', fontSize: 12, fontWeight: 700,
                  letterSpacing: '0.04em', textTransform: 'uppercase', transition: 'all 0.15s'
                }}
              >
                + New creative
              </div>
            </div>

            {/* Jobs strip */}
            {jobs.length > 0 && (
              <div style={{ marginTop: 28 }}>
                <div className="section-title">Active jobs</div>
                {jobs.filter(j => j.status !== 'done').map(job => (
                  <div key={job.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0',
                    borderBottom: '1px solid var(--border)'
                  }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 6, background: 'white',
                      border: '1px solid var(--border)', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', fontSize: 13
                    }}>
                      {job.status === 'running' ? '▶' : '◷'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{job.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--gray-500)', marginTop: 2 }}>{job.detail}</div>
                    </div>
                    <div style={{ width: 110 }}>
                      <div style={{ height: 3, background: 'var(--gray-100)', borderRadius: 3, overflow: 'hidden', marginBottom: 4 }}>
                        <div style={{ height: '100%', background: 'var(--blue)', borderRadius: 3, width: `${(job.progress / Math.max(job.total, 1)) * 100}%` }}/>
                      </div>
                      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--gray-300)', textAlign: 'right' }}>
                        {job.status === 'queued' ? 'Waiting' : `${Math.round((job.progress / Math.max(job.total, 1)) * 100)}%`}
                      </div>
                    </div>
                    <span style={{
                      fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                      padding: '4px 9px', borderRadius: 4,
                      background: job.status === 'running' ? 'var(--blue-light)' : 'var(--gray-100)',
                      color: job.status === 'running' ? 'var(--blue)' : 'var(--gray-500)',
                    }}>
                      {job.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : activeTab === 'jobs' ? (
          <JobsTab jobs={jobs}/>
        ) : activeTab === 'brand' ? (
          <BrandTab brand={brand}/>
        ) : (
          <PersonasTab brandId={brand.id}/>
        )}
      </div>
    </div>
  )
}

function JobsTab({ jobs }: { jobs: Job[] }) {
  return (
    <div>
      <div className="section-title">All jobs</div>
      {jobs.length === 0 ? (
        <p style={{ color: 'var(--gray-300)', fontSize: 13 }}>No jobs yet. Generate some creatives to see jobs here.</p>
      ) : jobs.map(job => (
        <div key={job.id} style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
          background: 'white', borderRadius: 8, border: '1px solid var(--border)', marginBottom: 8
        }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{job.name}</div>
            <div style={{ fontSize: 11, color: 'var(--gray-500)', marginTop: 2 }}>{job.detail}</div>
          </div>
          <div style={{ flex: 1 }}/>
          <span className={`status-pill ${job.status === 'done' ? 'sp-done' : job.status === 'running' ? 'sp-blue' : job.status === 'error' ? 'sp-error' : ''}`} style={{ background: job.status === 'queued' ? 'var(--gray-100)' : undefined, color: job.status === 'queued' ? 'var(--gray-500)' : undefined }}>
            {job.status}
          </span>
        </div>
      ))}
    </div>
  )
}

function BrandTab({ brand }: { brand: Brand }) {
  return (
    <div>
      <div className="section-title">Brand guide</div>
      <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 8, padding: 20 }}>
        {brand.brand_colors ? (
          <>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--gray-500)', marginBottom: 10 }}>Brand Colors</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {brand.brand_colors.map(c => (
                  <div key={c} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 6, background: c, border: '1px solid var(--border)' }}/>
                    <div style={{ fontSize: 10, color: 'var(--gray-500)', fontFamily: 'monospace' }}>{c}</div>
                  </div>
                ))}
              </div>
            </div>
            {brand.brand_fonts && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--gray-500)', marginBottom: 8 }}>Fonts</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {brand.brand_fonts.map(f => (
                    <span key={f} style={{ padding: '4px 10px', background: 'var(--gray-100)', borderRadius: 4, fontSize: 12, fontWeight: 600 }}>{f}</span>
                  ))}
                </div>
              </div>
            )}
            {brand.tone_notes && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--gray-500)', marginBottom: 8 }}>Tone & Style</div>
                <p style={{ fontSize: 13, color: 'var(--gray-700)', lineHeight: 1.6 }}>{brand.tone_notes}</p>
              </div>
            )}
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--gray-300)' }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>📋</div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>No brand guide yet</div>
            <div style={{ fontSize: 12 }}>Upload your logo and brand guidelines in the Brand Upload tab.</div>
          </div>
        )}
      </div>
    </div>
  )
}

function PersonasTab({ brandId }: { brandId: string }) {
  return (
    <div>
      <div className="section-title">Saved personas</div>
      <p style={{ color: 'var(--gray-300)', fontSize: 13 }}>
        Personas are defined when generating creatives. Use the Generate panel to create and save personas.
      </p>
    </div>
  )
}
