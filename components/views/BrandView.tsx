'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Brand, BrandAnalysis } from '@/lib/types'
import { DEFAULT_BRAND } from '@/lib/constants'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import SectionHeader from '@/components/ui/SectionHeader'
import LoadingSpinner, { LoadingState } from '@/components/ui/LoadingSpinner'
import ImagePreview from '@/components/ui/ImagePreview'

interface BrandViewProps {
  brand: Brand | null
  onToast: (msg: string, type: 'success' | 'error' | 'info') => void
  onBrandUpdate: (brandId: string, updates: Partial<Brand>) => void
}

interface BrandAsset {
  name: string
  url: string
  size: number
  created?: string
}

export default function BrandView({ brand, onToast, onBrandUpdate }: BrandViewProps) {
  const [analyzing, setAnalyzing] = useState(false)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [guidelinesFile, setGuidelinesFile] = useState<File | null>(null)
  const [savedAssets, setSavedAssets] = useState<BrandAsset[]>([])
  const [pendingAssets, setPendingAssets] = useState<{ file: File; preview: string }[]>([])
  const [saving, setSaving] = useState(false)
  const [loadingAssets, setLoadingAssets] = useState(false)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [removingBg, setRemovingBg] = useState<string | null>(null)
  const logoRef = useRef<HTMLInputElement>(null)
  const guidelinesRef = useRef<HTMLInputElement>(null)
  const assetRef = useRef<HTMLInputElement>(null)

  const colors = brand?.brand_colors || DEFAULT_BRAND.colors.map(c => c.hex)
  const fonts = brand?.brand_fonts || DEFAULT_BRAND.fonts.map(f => f.name)
  const tone = brand?.tone_notes || DEFAULT_BRAND.tone

  // Load saved assets from Supabase
  const loadAssets = useCallback(async () => {
    if (!brand?.id) return
    setLoadingAssets(true)
    try {
      const res = await fetch(`/api/brand-assets?brandId=${brand.id}`)
      const data = await res.json()
      if (data.assets) setSavedAssets(data.assets)
    } catch { /* silent fail */ }
    setLoadingAssets(false)
  }, [brand?.id])

  useEffect(() => { loadAssets() }, [loadAssets])

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoFile(file)
    const reader = new FileReader()
    reader.onload = ev => setLogoPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
    onToast('Logo uploaded', 'success')
  }

  const handleGuidelinesUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 50 * 1024 * 1024) {
      onToast(`File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max 50MB.`, 'error')
      return
    }
    setGuidelinesFile(file)
    onToast(`${file.name} uploaded - click "Re-analyze with Gemini" to extract`, 'info')
  }

  const handleAssetUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    files.forEach(file => {
      const reader = new FileReader()
      reader.onload = (ev) => {
        setPendingAssets(prev => [...prev, { file, preview: ev.target?.result as string }])
      }
      reader.readAsDataURL(file)
    })
    if (files.length) onToast(`${files.length} file${files.length > 1 ? 's' : ''} added - click Save to upload`, 'info')
  }

  const handleSaveAssets = async () => {
    if (!pendingAssets.length) { onToast('No new assets to save', 'info'); return }
    if (!brand?.id) { onToast('No brand selected', 'error'); return }

    setSaving(true)
    onToast(`Saving ${pendingAssets.length} asset${pendingAssets.length > 1 ? 's' : ''}...`, 'info')

    try {
      const formData = new FormData()
      formData.append('brandId', brand.id)
      pendingAssets.forEach(a => formData.append('files', a.file))

      const res = await fetch('/api/brand-assets', { method: 'POST', body: formData })
      const data = await res.json()
      if (data.error) throw new Error(data.error)

      onToast(`${data.count} asset${data.count > 1 ? 's' : ''} saved to brand library`, 'success')
      setPendingAssets([])
      loadAssets() // refresh the saved list
    } catch (err: unknown) {
      onToast(`Save failed: ${err instanceof Error ? err.message : String(err)}`, 'error')
    }
    setSaving(false)
  }

  const handleAnalyze = async () => {
    if (!logoFile && !guidelinesFile) {
      onToast('Upload a logo or brand guidelines first', 'error')
      return
    }
    setAnalyzing(true)
    onToast('Analyzing brand assets with Gemini...', 'info')

    try {
      const formData = new FormData()
      formData.append('brandId', brand?.id || 'demo')
      if (logoFile) formData.append('logo', logoFile)
      if (guidelinesFile) formData.append('guidelines', guidelinesFile)

      const res = await fetch('/api/brand-analyze', { method: 'POST', body: formData })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(text.slice(0, 200))
      }
      const data = await res.json()
      if (data.error) throw new Error(data.error)

      const analysis: BrandAnalysis = data.analysis
      if (brand) {
        onBrandUpdate(brand.id, {
          brand_colors: analysis.colors,
          brand_fonts: analysis.fonts,
          tone_notes: `${analysis.tone} ${analysis.styleNotes || ''}`.trim(),
          logo_url: data.logoUrl || brand.logo_url,
        })
      }
      onToast('Brand analysis complete - colors, fonts, and tone extracted', 'success')
    } catch (err: unknown) {
      onToast(`Analysis failed: ${err instanceof Error ? err.message : String(err)}`, 'error')
    }
    setAnalyzing(false)
  }

  const handleRemoveBg = async (assetUrl: string, assetName: string) => {
    setRemovingBg(assetName)
    onToast('Removing background...', 'info')

    try {
      const res = await fetch('/api/removebg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: assetUrl }),
      })

      if (!res.ok) {
        const text = await res.text()
        throw new Error(text.slice(0, 200))
      }

      const data = await res.json()
      if (data.error) throw new Error(data.error)

      // Add the cutout as a new asset
      if (data.resultUrl || data.base64) {
        const newUrl = data.resultUrl || `data:image/png;base64,${data.base64}`
        setSavedAssets(prev => [{ name: `${assetName.replace(/\.\w+$/, '')}-cutout.png`, url: newUrl, size: 0 }, ...prev])
        onToast('Background removed - cutout saved to library', 'success')
      } else {
        onToast('Background removed but no result returned', 'error')
      }
    } catch (err: unknown) {
      onToast(`Remove background failed: ${err instanceof Error ? err.message : String(err)}`, 'error')
    }
    setRemovingBg(null)
  }

  return (
    <div className="animate-fadeIn grid grid-cols-[1fr_320px] gap-4">
      {/* Left - Brand Profile */}
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center gap-4">
          <div
            className="w-[72px] h-[72px] rounded-xl flex items-center justify-center text-white text-xl font-black overflow-hidden cursor-pointer relative group"
            style={{ background: brand?.color || '#1B4332' }}
            onClick={() => logoRef.current?.click()}
          >
            {logoPreview || brand?.logo_url ? (
              <img src={logoPreview || brand?.logo_url} alt="" className="w-full h-full object-contain p-1.5" />
            ) : (
              <span>{brand?.name?.charAt(0) || 'F'}</span>
            )}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-2xs text-white font-semibold">
              Upload
            </div>
          </div>
          <div>
            <h2 className="text-2xl font-black tracking-tight">{brand?.name || 'Fulton'}</h2>
            <p className="text-xs text-text-dim">{DEFAULT_BRAND.industry}</p>
          </div>
        </div>

        {/* Colors */}
        <div>
          <SectionHeader title="Brand Colors" />
          <div className="flex gap-2 flex-wrap">
            {colors.map((c, i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <div className="w-10 h-10 rounded-full border-2 border-white/10" style={{ background: typeof c === 'string' ? c : '#000' }} />
                <span className="text-2xs font-mono text-text-dim">{typeof c === 'string' ? c : ''}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Typography */}
        <div>
          <SectionHeader title="Typography" />
          <div className="flex gap-2 flex-wrap">
            {fonts.map((f, i) => (
              <span key={i} className="px-3 py-1.5 bg-elevated border border-border rounded text-sm font-semibold">
                {typeof f === 'string' ? f : ''}
              </span>
            ))}
          </div>
        </div>

        {/* Tone */}
        <div>
          <SectionHeader title="Brand Tone" />
          <div className="bg-fulton-light border border-fulton/20 rounded-lg p-4 text-sm text-text-secondary leading-relaxed">
            {tone}
          </div>
        </div>

        {/* Do / Don't */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-green-light border border-green/20 rounded-lg p-4">
            <div className="text-xs font-bold text-green mb-2">DO</div>
            <ul className="space-y-1.5">
              {DEFAULT_BRAND.dos.map((d, i) => <li key={i} className="text-xs text-text-secondary">- {d}</li>)}
            </ul>
          </div>
          <div className="bg-red-light border border-red/20 rounded-lg p-4">
            <div className="text-xs font-bold text-red mb-2">DON'T</div>
            <ul className="space-y-1.5">
              {DEFAULT_BRAND.donts.map((d, i) => <li key={i} className="text-xs text-text-secondary">- {d}</li>)}
            </ul>
          </div>
        </div>

        {/* Asset Library */}
        <div>
          <SectionHeader
            title="Brand Asset Library"
            subtitle={`${savedAssets.length} saved asset${savedAssets.length !== 1 ? 's' : ''}`}
            action={
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => assetRef.current?.click()}>+ Add Files</Button>
                {pendingAssets.length > 0 && (
                  <Button size="sm" onClick={handleSaveAssets} disabled={saving}>
                    {saving ? <><LoadingSpinner size={12} /> Saving...</> : `Save ${pendingAssets.length} File${pendingAssets.length > 1 ? 's' : ''}`}
                  </Button>
                )}
              </div>
            }
          />
          <input ref={assetRef} type="file" accept="image/*,.pdf,.svg" multiple className="hidden" onChange={handleAssetUpload} />

          {/* Pending uploads (not yet saved) */}
          {pendingAssets.length > 0 && (
            <div className="mb-4">
              <div className="text-2xs font-bold text-amber uppercase tracking-wider mb-2">Unsaved - click Save to upload</div>
              <div className="grid grid-cols-4 gap-2">
                {pendingAssets.map((asset, i) => (
                  <div key={i} className="relative aspect-square rounded-lg overflow-hidden border-2 border-dashed border-amber group">
                    <img src={asset.preview} alt="" className="w-full h-full object-cover" />
                    <button
                      onClick={() => setPendingAssets(prev => prev.filter((_, idx) => idx !== i))}
                      className="absolute top-1 right-1 w-5 h-5 bg-black/60 text-white text-2xs rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                    >
                      x
                    </button>
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1.5 py-0.5">
                      <div className="text-2xs text-white truncate">{asset.file.name}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Saved assets from Supabase */}
          {loadingAssets ? (
            <LoadingState size="sm" />
          ) : savedAssets.length > 0 ? (
            <div className="grid grid-cols-4 gap-2">
              {savedAssets.map((asset, i) => (
                <div
                  key={i}
                  className="relative aspect-square rounded-lg overflow-hidden border border-border cursor-pointer hover:border-fulton/40 transition-colors group"
                >
                  <img src={asset.url} alt={asset.name} className="w-full h-full object-cover" onClick={() => setPreviewImage(asset.url)} />
                  <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-1.5 py-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="text-2xs text-white truncate mb-1">{asset.name}</div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRemoveBg(asset.url, asset.name) }}
                      disabled={removingBg === asset.name}
                      className="w-full text-2xs font-bold text-fulton bg-fulton-light hover:bg-fulton hover:text-white px-1.5 py-0.5 rounded transition-colors disabled:opacity-50"
                    >
                      {removingBg === asset.name ? 'Removing...' : 'Remove BG'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-surface border border-border rounded-lg p-6 text-center">
              <div className="text-xl mb-2">📁</div>
              <div className="text-xs text-text-dim">No saved assets yet. Upload product photos, logos, and brand materials.</div>
            </div>
          )}
        </div>
      </div>

      {/* Right - Upload & Analyze */}
      <div className="space-y-4">
        <Card title="Update Brand Kit" subtitle="Upload assets for Gemini analysis">
          <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
          <input ref={guidelinesRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleGuidelinesUpload} />

          <div className="space-y-3 mb-4">
            <button
              onClick={() => logoRef.current?.click()}
              className={`w-full p-3 rounded-lg border text-left flex items-center gap-3 transition-all ${
                logoFile ? 'border-fulton bg-fulton-light' : 'border-border bg-page hover:border-text-subtle'
              }`}
            >
              <span className="text-lg">{logoFile ? '✓' : '🏷'}</span>
              <div>
                <div className="text-xs font-semibold">{logoFile ? logoFile.name : 'Upload Logo'}</div>
                <div className="text-2xs text-text-dim">{logoFile ? `${(logoFile.size / 1024).toFixed(0)} KB` : 'PNG, SVG, JPG'}</div>
              </div>
            </button>

            <button
              onClick={() => guidelinesRef.current?.click()}
              className={`w-full p-3 rounded-lg border text-left flex items-center gap-3 transition-all ${
                guidelinesFile ? 'border-fulton bg-fulton-light' : 'border-border bg-page hover:border-text-subtle'
              }`}
            >
              <span className="text-lg">{guidelinesFile ? '✓' : '📄'}</span>
              <div>
                <div className="text-xs font-semibold">{guidelinesFile ? guidelinesFile.name : 'Upload Brand Guidelines'}</div>
                <div className="text-2xs text-text-dim">{guidelinesFile ? `${(guidelinesFile.size / 1024).toFixed(0)} KB` : 'PDF, PNG, JPG'}</div>
              </div>
            </button>
          </div>

          <Button onClick={handleAnalyze} disabled={analyzing} variant="secondary" className="w-full justify-center">
            {analyzing ? <><LoadingSpinner size={14} /> Analyzing...</> : 'Re-analyze with Gemini'}
          </Button>
        </Card>
      </div>

      <ImagePreview src={previewImage || ''} open={!!previewImage} onClose={() => setPreviewImage(null)} />
    </div>
  )
}
