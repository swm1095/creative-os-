'use client'

import { useState } from 'react'
import { AspectRatio, Generator, PersonaInput, GenerateResult, Brand } from '@/lib/types'

interface GeneratePanelProps {
  brand: Brand
  onClose: () => void
  onComplete: (results: GenerateResult[]) => void
}

const DEFAULT_PERSONAS: PersonaInput[] = [
  { name: 'Persona 1', angle: '', hook: '' },
  { name: 'Persona 2', angle: '', hook: '' },
  { name: 'Persona 3', angle: '', hook: '' },
  { name: 'Persona 4', angle: '', hook: '' },
]

const RATIO_OPTIONS: { value: AspectRatio; label: string; desc: string; icon: string }[] = [
  { value: '1x1',  label: '1×1',  desc: 'Feed / Square',    icon: '□' },
  { value: '4x5',  label: '4×5',  desc: 'Portrait',         icon: '▬' },
  { value: '9x16', label: '9×16', desc: 'Story / Reel',     icon: '▮' },
]

const GEN_OPTIONS: { value: Generator; label: string; best: string; badge?: string }[] = [
  { value: 'kling',     label: 'Kling AI',     best: 'Lifestyle & product scenes — supports image-to-image', badge: 'Primary' },
  { value: 'ideogram',  label: 'Ideogram',     best: 'Best-in-class text rendering — ads with overlaid copy' },
  { value: 'stability', label: 'Stability AI', best: 'Batch runs & product shot inpainting at scale' },
]

export default function GeneratePanel({ brand, onClose, onComplete }: GeneratePanelProps) {
  const [concept, setConcept] = useState('')
  const [personas, setPersonas] = useState<PersonaInput[]>(DEFAULT_PERSONAS)
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1x1')
  const [generator, setGenerator] = useState<Generator>('kling')
  const [runRemoveBg, setRunRemoveBg] = useState(false)
  const [runCreatomate, setRunCreatomate] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sheetsUrl, setSheetsUrl] = useState('')
  const [loadingSheets, setLoadingSheets] = useState(false)
  const [sheetsMsg, setSheetsMsg] = useState('')
  const [results, setResults] = useState<GenerateResult[] | null>(null)

  const updatePersona = (i: number, field: keyof PersonaInput, val: string) => {
    setPersonas(prev => prev.map((p, idx) => idx === i ? { ...p, [field]: val } : p))
  }

  const importFromSheets = async () => {
    if (!sheetsUrl.trim()) { setSheetsMsg('Please enter a Google Sheets CSV URL.'); return }
    setLoadingSheets(true)
    setSheetsMsg('')
    try {
      const res = await fetch('/api/sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: sheetsUrl }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Import failed')
      const imported: PersonaInput[] = data.personas.slice(0, 4)
      // Fill slots
      setPersonas(prev => prev.map((p, i) => imported[i] || p))
      setSheetsMsg(`✓ Imported ${imported.length} persona${imported.length !== 1 ? 's' : ''} from ${data.rowCount} rows`)
    } catch (e: any) {
      setSheetsMsg('✗ ' + e.message)
    }
    setLoadingSheets(false)
  }

  const handleGenerate = async () => {
    if (!concept.trim()) { setError('Please enter a concept or brief.'); return }
    const activePersonas = personas.filter(p => p.name.trim() && p.angle.trim())
    if (activePersonas.length === 0) { setError('Fill in at least one persona name and angle.'); return }
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ concept, personas: activePersonas, aspectRatio, generator, brandId: brand.id, runRemoveBg }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Generation failed')
      setResults(data.results)
    } catch (e: any) {
      setError(e.message)
    }
    setLoading(false)
  }

  const handleUseResults = () => {
    if (results) onComplete(results)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end',
      zIndex: 300, paddingTop: 0
    }}>
      <div style={{
        background: 'white', width: 560, height: '100vh', overflowY: 'auto',
        borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.02em' }}>Generate creatives</div>
            <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2 }}>Brand: {brand.name}</div>
          </div>
          <div style={{ flex: 1 }}/>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--gray-500)', padding: '0 4px' }}>×</button>
        </div>

        <div style={{ padding: 24, flex: 1 }}>
          {results ? (
            /* Results view */
            <ResultsView results={results} onUse={handleUseResults} onBack={() => setResults(null)} />
          ) : (
            <>
              {/* Concept input */}
              <div style={{ marginBottom: 24 }}>
                <Label>Concept / Campaign brief</Label>
                <textarea
                  className="input-base"
                  rows={3}
                  placeholder="e.g. Summer sleep campaign — focus on waking up refreshed and energized"
                  value={concept}
                  onChange={e => setConcept(e.target.value)}
                  style={{ resize: 'vertical' }}
                />
              </div>

              {/* Personas */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <Label style={{ margin: 0 }}>Personas / Angles (up to 4)</Label>
                  <div style={{ flex: 1 }}/>
                  <button onClick={() => document.getElementById('sheets-section')?.classList.toggle('hidden')}
                    className="btn-ghost" style={{ fontSize: 11, padding: '5px 10px' }}>
                    📊 Import from Sheets
                  </button>
                </div>

                {/* Google Sheets import */}
                <div id="sheets-section" className="hidden" style={{ marginBottom: 16, background: 'var(--blue-light)', borderRadius: 8, padding: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--blue)', marginBottom: 8 }}>Import from Google Sheets</div>
                  <div style={{ fontSize: 11, color: 'var(--gray-500)', marginBottom: 10, lineHeight: 1.5 }}>
                    Publish your sheet as CSV (File → Share → Publish to web → CSV) and paste the URL below.<br/>
                    Expected columns: <strong>persona</strong>, <strong>angle</strong>, <strong>hook</strong>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      className="input-base"
                      placeholder="https://docs.google.com/spreadsheets/.../pub?output=csv"
                      value={sheetsUrl}
                      onChange={e => setSheetsUrl(e.target.value)}
                      style={{ flex: 1, marginBottom: 0 }}
                    />
                    <button className="btn-primary" onClick={importFromSheets} disabled={loadingSheets} style={{ whiteSpace: 'nowrap' }}>
                      {loadingSheets ? '...' : 'Import'}
                    </button>
                  </div>
                  {sheetsMsg && (
                    <div style={{ marginTop: 8, fontSize: 11, color: sheetsMsg.startsWith('✓') ? 'var(--green)' : 'var(--red)' }}>
                      {sheetsMsg}
                    </div>
                  )}
                </div>

                {/* Persona cards */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {personas.map((p, i) => (
                    <div key={i} style={{
                      background: 'var(--gray-50)', border: '1.5px solid var(--border)',
                      borderRadius: 8, padding: 12
                    }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--blue)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
                        Persona {i + 1}
                      </div>
                      <input
                        className="input-base"
                        placeholder="Name (e.g. Budget-conscious mom)"
                        value={p.name}
                        onChange={e => updatePersona(i, 'name', e.target.value)}
                        style={{ marginBottom: 8, fontSize: 12, background: 'white' }}
                      />
                      <input
                        className="input-base"
                        placeholder="Angle (e.g. Pain point: poor sleep)"
                        value={p.angle}
                        onChange={e => updatePersona(i, 'angle', e.target.value)}
                        style={{ marginBottom: 8, fontSize: 12, background: 'white' }}
                      />
                      <input
                        className="input-base"
                        placeholder="Hook / copy (optional)"
                        value={p.hook || ''}
                        onChange={e => updatePersona(i, 'hook', e.target.value)}
                        style={{ fontSize: 12, background: 'white' }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Format & Generator */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
                <div>
                  <Label>Aspect ratio</Label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {RATIO_OPTIONS.map(r => (
                      <button
                        key={r.value}
                        onClick={() => setAspectRatio(r.value)}
                        style={{
                          flex: 1, padding: '8px 4px', borderRadius: 6, cursor: 'pointer',
                          border: '1.5px solid', fontFamily: 'inherit', textAlign: 'center',
                          borderColor: aspectRatio === r.value ? 'var(--blue)' : 'var(--border)',
                          background: aspectRatio === r.value ? 'var(--blue-light)' : 'white',
                          color: aspectRatio === r.value ? 'var(--blue)' : 'var(--gray-700)',
                        }}
                      >
                        <div style={{ fontSize: 18, lineHeight: 1 }}>{r.icon}</div>
                        <div style={{ fontSize: 11, fontWeight: 700, marginTop: 4 }}>{r.label}</div>
                        <div style={{ fontSize: 10, color: 'var(--gray-500)' }}>{r.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label>Image generator</Label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {GEN_OPTIONS.map(g => (
                      <button
                        key={g.value}
                        onClick={() => setGenerator(g.value)}
                        style={{
                          padding: '10px 12px', borderRadius: 6, cursor: 'pointer', textAlign: 'left',
                          border: '1.5px solid', fontFamily: 'inherit',
                          borderColor: generator === g.value ? 'var(--blue)' : 'var(--border)',
                          background: generator === g.value ? 'var(--blue-light)' : 'white',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: generator === g.value ? 'var(--blue)' : 'var(--black)' }}>{g.label}</span>
                          {g.badge && (
                            <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 5px', borderRadius: 3, background: 'var(--blue)', color: 'white', letterSpacing: '0.04em' }}>{g.badge}</span>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>{g.best}</div>
                      </button>
                    ))}
                  </div>

                  {/* Pipeline toggles */}
                  <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                      <input type="checkbox" checked={runRemoveBg} onChange={e => setRunRemoveBg(e.target.checked)} style={{ width: 14, height: 14, accentColor: 'var(--blue)' }}/>
                      <span>Auto background removal <span style={{ fontWeight: 400, color: 'var(--gray-500)' }}>(Remove.bg)</span></span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                      <input type="checkbox" checked={runCreatomate} onChange={e => setRunCreatomate(e.target.checked)} style={{ width: 14, height: 14, accentColor: 'var(--blue)' }}/>
                      <span>Render with Creatomate template <span style={{ fontWeight: 400, color: 'var(--gray-500)' }}>(1×1, 4×5, 9×16)</span></span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div style={{ padding: '10px 14px', background: 'var(--red-light)', border: '1px solid #fecaca', borderRadius: 6, fontSize: 12, color: 'var(--red)', marginBottom: 16 }}>
                  {error}
                </div>
              )}

              {/* Generate button */}
              <button className="btn-primary" onClick={handleGenerate} disabled={loading} style={{ width: '100%', padding: '13px', fontSize: 14 }}>
                {loading ? (
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <Spinner/> Generating {personas.filter(p => p.angle.trim()).length} creatives...
                  </span>
                ) : `Generate ${personas.filter(p => p.angle.trim()).length} creatives`}
              </button>

              <div style={{ marginTop: 12, fontSize: 11, color: 'var(--gray-300)', textAlign: 'center' }}>
                Each persona generates one image · All saved to gallery automatically
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function ResultsView({ results, onUse, onBack }: {
  results: GenerateResult[]; onUse: () => void; onBack: () => void
}) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button onClick={onBack} className="btn-ghost" style={{ fontSize: 12 }}>← Back</button>
        <div style={{ fontWeight: 700, fontSize: 15 }}>Generated {results.length} creatives</div>
        <div style={{ flex: 1 }}/>
        <button className="btn-primary" onClick={onUse}>Add all to gallery</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {results.map((r, i) => (
          <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', background: 'white' }}>
            {r.imageUrl ? (
              <img src={r.imageUrl} alt={r.persona.name} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover' }}/>
            ) : (
              <div style={{ aspectRatio: '1', background: 'var(--gray-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gray-300)' }}>
                No image
              </div>
            )}
            <div style={{ padding: '10px 12px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 2 }}>{r.persona.name}</div>
              <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>{r.persona.angle}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Label({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
      color: 'var(--gray-500)', marginBottom: 8, ...style
    }}>{children}</div>
  )
}

function Spinner() {
  return (
    <div style={{
      width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)',
      borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.7s linear infinite'
    }}/>
  )
}
