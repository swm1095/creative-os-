'use client'

import { useState, useRef } from 'react'
import { Brand, BrandAnalysis } from '@/lib/types'

interface BrandUploadProps {
  brand: Brand | null
  onAnalysisComplete: (analysis: BrandAnalysis, brandId: string) => void
  onClose: () => void
  onCreateBrand: (name: string, url: string) => Promise<Brand>
}

export default function BrandUpload({ brand, onAnalysisComplete, onClose, onCreateBrand }: BrandUploadProps) {
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [guidelinesFile, setGuidelinesFile] = useState<File | null>(null)
  const [brandName, setBrandName] = useState(brand?.name || '')
  const [brandUrl, setBrandUrl] = useState(brand?.url || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [analysis, setAnalysis] = useState<BrandAnalysis | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)

  const logoRef = useRef<HTMLInputElement>(null)
  const guidelinesRef = useRef<HTMLInputElement>(null)

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setLogoFile(f)
    const reader = new FileReader()
    reader.onload = ev => setLogoPreview(ev.target?.result as string)
    reader.readAsDataURL(f)
  }

  const handleAnalyze = async () => {
    if (!logoFile && !guidelinesFile) {
      setError('Please upload at least your logo or brand guidelines document.')
      return
    }
    setError('')
    setLoading(true)

    try {
      // Create brand first if needed
      let activeBrand = brand
      if (!activeBrand) {
        if (!brandName.trim()) { setError('Please enter a brand name.'); setLoading(false); return }
        activeBrand = await onCreateBrand(brandName, brandUrl)
      }

      const formData = new FormData()
      formData.append('brandId', activeBrand.id)
      if (logoFile) formData.append('logo', logoFile)
      if (guidelinesFile) formData.append('guidelines', guidelinesFile)

      const res = await fetch('/api/brand-analyze', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Analysis failed')

      setAnalysis(data.analysis)
      onAnalysisComplete(data.analysis, activeBrand.id)
    } catch (e: any) {
      setError(e.message)
    }
    setLoading(false)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400
    }}>
      <div style={{
        background: 'white', borderRadius: 12, border: '1px solid var(--border)',
        width: 500, maxHeight: '90vh', overflowY: 'auto'
      }}>
        {/* Header */}
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.02em' }}>
              {brand ? 'Update brand guide' : 'Add new brand'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2 }}>
              Claude will analyze your assets to extract colors, fonts & tone
            </div>
          </div>
          <div style={{ flex: 1 }}/>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--gray-500)' }}>×</button>
        </div>

        <div style={{ padding: 24 }}>
          {!brand && (
            <div style={{ marginBottom: 20 }}>
              <Label>Brand name</Label>
              <input className="input-base" placeholder="e.g. Lumio Sleep" value={brandName} onChange={e => setBrandName(e.target.value)} style={{ marginBottom: 10 }}/>
              <Label>Website URL</Label>
              <input className="input-base" placeholder="https://lumiosleep.com" value={brandUrl} onChange={e => setBrandUrl(e.target.value)} />
            </div>
          )}

          {/* Logo upload */}
          <div style={{ marginBottom: 16 }}>
            <Label>Logo <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: 'var(--gray-400)' }}>(PNG, SVG, JPG)</span></Label>
            <DropZone
              accept="image/*"
              label="Upload logo"
              file={logoFile}
              preview={logoPreview}
              onClick={() => logoRef.current?.click()}
            />
            <input ref={logoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogoChange}/>
          </div>

          {/* Guidelines upload */}
          <div style={{ marginBottom: 20 }}>
            <Label>Brand guidelines <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(PDF, PNG, JPG)</span></Label>
            <DropZone
              accept=".pdf,image/*"
              label="Upload brand guidelines"
              file={guidelinesFile}
              onClick={() => guidelinesRef.current?.click()}
            />
            <input ref={guidelinesRef} type="file" accept=".pdf,image/*" style={{ display: 'none' }} onChange={e => setGuidelinesFile(e.target.files?.[0] || null)}/>
            <div style={{ fontSize: 11, color: 'var(--gray-300)', marginTop: 6 }}>
              Claude will extract colors, fonts, tone, and style notes from this document.
            </div>
          </div>

          {error && (
            <div style={{ padding: '10px 14px', background: 'var(--red-light)', borderRadius: 6, fontSize: 12, color: 'var(--red)', marginBottom: 16 }}>
              {error}
            </div>
          )}

          {/* Analysis result */}
          {analysis && (
            <div style={{ background: 'var(--green-light)', border: '1px solid #bbf7d0', borderRadius: 8, padding: 16, marginBottom: 20 }}>
              <div style={{ fontWeight: 700, color: 'var(--green)', marginBottom: 12 }}>✓ Brand analysis complete</div>

              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--gray-500)', marginBottom: 8 }}>Colors detected</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {analysis.colors.map(c => (
                    <div key={c} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 5, background: c, border: '1px solid rgba(0,0,0,0.1)' }}/>
                      <div style={{ fontSize: 9, fontFamily: 'monospace', color: 'var(--gray-500)' }}>{c}</div>
                    </div>
                  ))}
                </div>
              </div>

              {analysis.fonts.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--gray-500)', marginBottom: 6 }}>Fonts</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {analysis.fonts.map(f => (
                      <span key={f} style={{ padding: '3px 8px', background: 'white', borderRadius: 4, fontSize: 12, fontWeight: 600, border: '1px solid #bbf7d0' }}>{f}</span>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--gray-500)', marginBottom: 6 }}>Tone & style</div>
                <p style={{ fontSize: 12, color: 'var(--gray-700)', lineHeight: 1.5 }}>{analysis.tone}</p>
              </div>
            </div>
          )}

          <button className="btn-primary" onClick={handleAnalyze} disabled={loading} style={{ width: '100%', padding: 12 }}>
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <Spinner/> Analyzing with Claude...
              </span>
            ) : 'Analyze & save brand guide'}
          </button>
        </div>
      </div>
    </div>
  )
}

function DropZone({ accept, label, file, preview, onClick }: {
  accept: string; label: string; file: File | null; preview?: string | null; onClick: () => void
}) {
  return (
    <div
      onClick={onClick}
      style={{
        border: file ? '1.5px solid var(--green)' : '1.5px dashed var(--border)',
        borderRadius: 8, padding: 16, cursor: 'pointer', textAlign: 'center',
        background: file ? 'var(--green-light)' : 'var(--gray-50)',
        transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 12
      }}
    >
      {preview ? (
        <img src={preview} alt="" style={{ width: 48, height: 48, objectFit: 'contain', borderRadius: 4 }}/>
      ) : (
        <div style={{ width: 48, height: 48, borderRadius: 6, background: file ? 'var(--green-light)' : 'var(--gray-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
          {file ? '✓' : '⬆'}
        </div>
      )}
      <div style={{ textAlign: 'left' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: file ? 'var(--green)' : 'var(--gray-700)' }}>
          {file ? file.name : label}
        </div>
        <div style={{ fontSize: 11, color: 'var(--gray-300)', marginTop: 2 }}>
          {file ? `${(file.size / 1024).toFixed(0)} KB · Click to replace` : 'Click to browse'}
        </div>
      </div>
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--gray-500)', marginBottom: 8 }}>
      {children}
    </div>
  )
}

function Spinner() {
  return <div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }}/>
}
