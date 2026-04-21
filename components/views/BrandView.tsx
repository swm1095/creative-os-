'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Brand, BrandAnalysis } from '@/lib/types'
import { DEFAULT_BRAND } from '@/lib/constants'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import SectionHeader from '@/components/ui/SectionHeader'
import LoadingSpinner, { LoadingState } from '@/components/ui/LoadingSpinner'
import ImagePreview from '@/components/ui/ImagePreview'

// Google Fonts picker with search
let googleFontsCache: string[] | null = null

function FontPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [query, setQuery] = useState(value)
  const [fonts, setFonts] = useState<string[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Load Google Fonts list via our API (cached)
  useEffect(() => {
    if (googleFontsCache) { setFonts(googleFontsCache); return }
    setLoading(true)
    fetch('/api/fonts')
      .then(r => r.json())
      .then(data => {
        if (data.fonts?.length) {
          googleFontsCache = data.fonts
          setFonts(data.fonts)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setShowDropdown(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Sync query with value prop
  useEffect(() => { setQuery(value) }, [value])

  const filtered = query
    ? fonts.filter(f => f.toLowerCase().includes(query.toLowerCase())).slice(0, 8)
    : fonts.slice(0, 8)

  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        value={query}
        onChange={e => { setQuery(e.target.value); setShowDropdown(true) }}
        onFocus={() => setShowDropdown(true)}
        onBlur={() => { setTimeout(() => { onChange(query) }, 200) }}
        placeholder="Search Google Fonts..."
        className="w-full px-3 py-2 bg-elevated border border-border rounded text-sm font-semibold text-text-primary focus:border-blue focus:outline-none pr-8"
      />
      {loading && <span className="absolute right-2 top-2.5 text-2xs text-text-dim">Loading...</span>}
      {showDropdown && filtered.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-border rounded-lg shadow-lg z-20 max-h-48 overflow-y-auto">
          {filtered.map(f => (
            <button key={f} onMouseDown={e => e.preventDefault()}
              onClick={() => { setQuery(f); onChange(f); setShowDropdown(false) }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-elevated transition-colors ${f === value ? 'text-blue font-bold' : 'text-text-primary'}`}
              style={{ fontFamily: `"${f}", sans-serif` }}>
              {f}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

interface BrandViewProps {
  brand: Brand | null
  onToast: (msg: string, type: 'success' | 'error' | 'info') => void
  onBrandUpdate: (brandId: string, updates: Partial<Brand>) => void
  isClient?: boolean
}

interface BrandAsset {
  name: string
  url: string
  size: number
  created?: string
}

export default function BrandView({ brand, onToast, onBrandUpdate, isClient }: BrandViewProps) {
  const [analyzing, setAnalyzing] = useState(false)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(brand?.logo_url || null)
  const [guidelinesFile, setGuidelinesFile] = useState<File | null>(null)
  const [guidelinesUrl, setGuidelinesUrl] = useState<string | null>(brand?.brand_guidelines_url || null)
  const [savedAssets, setSavedAssets] = useState<BrandAsset[]>([])
  const [pendingAssets, setPendingAssets] = useState<{ file: File; preview: string }[]>([])
  const [saving, setSaving] = useState(false)
  const [loadingAssets, setLoadingAssets] = useState(false)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [removingBg, setRemovingBg] = useState<string | null>(null)
  const [showAddPersona, setShowAddPersona] = useState(false)
  const [creatingLogin, setCreatingLogin] = useState(false)
  const [clientLoginCreated, setClientLoginCreated] = useState(false)
  const [newPersonaName, setNewPersonaName] = useState('')
  const [newPersonaDesc, setNewPersonaDesc] = useState('')
  const [newPersonaHook, setNewPersonaHook] = useState('')
  const logoRef = useRef<HTMLInputElement>(null)
  const guidelinesRef = useRef<HTMLInputElement>(null)
  const assetRef = useRef<HTMLInputElement>(null)
  const fontFileRef = useRef<HTMLInputElement>(null)

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

  // Sync logo/guidelines previews when brand changes
  useEffect(() => {
    setLogoPreview(brand?.logo_url || null)
    setGuidelinesUrl(brand?.brand_guidelines_url || null)
    setLogoFile(null)
    setGuidelinesFile(null)
  }, [brand?.id, brand?.logo_url, brand?.brand_guidelines_url])

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !brand?.id) return
    setLogoFile(file)
    const reader = new FileReader()
    reader.onload = ev => setLogoPreview(ev.target?.result as string)
    reader.readAsDataURL(file)

    // Upload to Supabase and save URL to brand
    const formData = new FormData()
    formData.append('brandId', brand.id)
    formData.append('files', file)
    try {
      const res = await fetch('/api/brand-assets', { method: 'POST', body: formData })
      const data = await res.json()
      if (data.uploaded?.[0]?.url) {
        onBrandUpdate(brand.id, { logo_url: data.uploaded[0].url })
        onToast('Logo saved to brand kit', 'success')
      }
    } catch {
      onToast('Logo uploaded locally but failed to save - try again', 'error')
    }
  }

  const handleGuidelinesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !brand?.id) return
    if (file.size > 50 * 1024 * 1024) {
      onToast(`File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max 50MB.`, 'error')
      return
    }
    setGuidelinesFile(file)
    onToast('Uploading brand guidelines...', 'info')

    try {
      // Use signed URL for direct upload (bypasses Vercel 4.5MB limit)
      const signedRes = await fetch(`/api/reference-images?action=signedUrl&brandId=${brand.id}&fileName=${encodeURIComponent(file.name)}&contentType=${encodeURIComponent(file.type)}`)
      const signedData = await signedRes.json()
      if (signedData.error) throw new Error(signedData.error)

      const uploadRes = await fetch(signedData.signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      })
      if (!uploadRes.ok) throw new Error(`Upload failed: ${uploadRes.status}`)

      setGuidelinesUrl(signedData.publicUrl)
      onBrandUpdate(brand.id, { brand_guidelines_url: signedData.publicUrl })
      onToast('Brand guidelines saved to brand kit', 'success')
    } catch (err) {
      onToast(`Guidelines upload failed: ${err instanceof Error ? err.message : String(err)}`, 'error')
    }
  }

  const handleFontFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !brand?.id) return

    // Prompt for font name
    const fileName = file.name.replace(/\.(ttf|otf|woff2?|eot)$/i, '')
    const fontName = prompt('Name this font:', fileName)
    if (!fontName) return

    onToast(`Uploading ${fontName}...`, 'info')
    try {
      // Upload font file to Supabase storage
      const formData = new FormData()
      formData.append('brandId', brand.id)
      formData.append('files', file)
      const res = await fetch('/api/brand-assets', { method: 'POST', body: formData })
      const data = await res.json()

      if (data.uploaded?.[0]?.url) {
        // Add font name to brand_fonts
        const next = [...fonts, fontName]
        onBrandUpdate(brand.id, { brand_fonts: next })
        onToast(`${fontName} uploaded and added to brand kit`, 'success')
      } else {
        throw new Error('Upload failed')
      }
    } catch (err) {
      onToast(`Font upload failed: ${err instanceof Error ? err.message : String(err)}`, 'error')
    }
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
    const hasLogo = logoFile || logoPreview
    const hasGuidelines = guidelinesFile || guidelinesUrl
    if (!hasLogo && !hasGuidelines) {
      onToast('Upload a logo or brand guidelines first', 'error')
      return
    }
    setAnalyzing(true)
    onToast('Analyzing brand assets with Gemini...', 'info')

    try {
      // For small files (logo), send via FormData. For guidelines, send URL.
      const formData = new FormData()
      formData.append('brandId', brand?.id || 'demo')
      if (logoFile) formData.append('logo', logoFile)
      if (guidelinesUrl) formData.append('guidelinesUrl', guidelinesUrl)
      else if (guidelinesFile && guidelinesFile.size < 4 * 1024 * 1024) formData.append('guidelines', guidelinesFile)
      else if (guidelinesFile) {
        // File too large for FormData - upload first then pass URL
        onToast('Uploading guidelines before analysis...', 'info')
        const signedRes = await fetch(`/api/reference-images?action=signedUrl&brandId=${brand?.id || 'shared'}&fileName=${encodeURIComponent(guidelinesFile.name)}&contentType=${encodeURIComponent(guidelinesFile.type)}`)
        const signedData = await signedRes.json()
        if (!signedData.error) {
          await fetch(signedData.signedUrl, { method: 'PUT', headers: { 'Content-Type': guidelinesFile.type }, body: guidelinesFile })
          formData.append('guidelinesUrl', signedData.publicUrl)
          setGuidelinesUrl(signedData.publicUrl)
          onBrandUpdate(brand!.id, { brand_guidelines_url: signedData.publicUrl })
        }
      }

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

  const handleAddPersona = async () => {
    if (!brand?.id || !newPersonaName.trim()) return
    const newPersona = {
      name: newPersonaName,
      age: '',
      description: newPersonaDesc,
      painPoints: [],
      motivators: [],
      channels: [],
      hook: newPersonaHook,
    }
    const currentResearch = brand.research || {
      industry: '', productCategory: '', priceRange: '', targetDemo: '',
      valueProps: [], differentiators: [], competitors: [],
      personas: [], painPoints: [], motivators: [], objections: [],
      brandVoice: '', messagingThemes: [], keyPhrases: [], avoidPhrases: [],
      searchKeywords: [], subreddits: [], hashTags: [],
      websiteUrl: '', researchDate: new Date().toISOString(), summary: '',
    }
    const updatedResearch = {
      ...currentResearch,
      personas: [...(currentResearch.personas || []), newPersona],
    }
    try {
      await fetch('/api/brands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: brand.id, research: updatedResearch }),
      })
      onBrandUpdate(brand.id, { research: updatedResearch })
      setNewPersonaName('')
      setNewPersonaDesc('')
      setNewPersonaHook('')
      setShowAddPersona(false)
      onToast(`Persona "${newPersonaName}" added`, 'success')
    } catch (err: unknown) {
      onToast(`Failed: ${err instanceof Error ? err.message : String(err)}`, 'error')
    }
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
          <SectionHeader title="Brand Colors" subtitle="Click to edit, + to add" />
          <div className="flex gap-2 flex-wrap">
            {colors.map((c, i) => (
              <div key={i} className="flex flex-col items-center gap-1 group relative">
                <input
                  type="color"
                  value={typeof c === 'string' ? c : '#000000'}
                  onChange={e => {
                    const next = [...colors]
                    next[i] = e.target.value
                    if (brand) onBrandUpdate(brand.id, { brand_colors: next })
                  }}
                  className="w-10 h-10 rounded-full border-2 border-white/10 cursor-pointer p-0"
                  style={{ background: typeof c === 'string' ? c : '#000' }}
                />
                <input
                  type="text"
                  value={typeof c === 'string' ? c : ''}
                  onChange={e => {
                    const next = [...colors]
                    next[i] = e.target.value
                    if (brand) onBrandUpdate(brand.id, { brand_colors: next })
                  }}
                  className="text-2xs font-mono text-text-dim bg-transparent border-none text-center w-16 focus:outline-none focus:text-text-primary"
                />
                <button
                  onClick={() => {
                    const next = colors.filter((_, idx) => idx !== i)
                    if (brand) onBrandUpdate(brand.id, { brand_colors: next })
                  }}
                  className="absolute -top-1 -right-1 w-4 h-4 bg-red text-white text-2xs rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                >x</button>
              </div>
            ))}
            <button
              onClick={() => {
                const next = [...colors, '#888888']
                if (brand) onBrandUpdate(brand.id, { brand_colors: next })
              }}
              className="w-10 h-10 rounded-full border-2 border-dashed border-border flex items-center justify-center text-text-dim hover:border-blue/40 transition-colors cursor-pointer"
            >+</button>
          </div>
        </div>

        {/* Typography */}
        <div>
          <SectionHeader title="Typography" subtitle="Search Google Fonts or type manually" />
          <div className="flex flex-col gap-2">
            {fonts.map((f, i) => (
              <div key={i} className="relative group">
                <FontPicker
                  value={typeof f === 'string' ? f : ''}
                  onChange={v => {
                    const next = [...fonts]
                    next[i] = v
                    if (brand) onBrandUpdate(brand.id, { brand_fonts: next })
                  }}
                />
                <button
                  onClick={() => {
                    const next = fonts.filter((_, idx) => idx !== i)
                    if (brand) onBrandUpdate(brand.id, { brand_fonts: next })
                  }}
                  className="absolute top-1.5 right-1.5 w-5 h-5 bg-red text-white text-2xs rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10"
                >x</button>
              </div>
            ))}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const next = [...fonts, '']
                  if (brand) onBrandUpdate(brand.id, { brand_fonts: next })
                }}
                className="flex-1 px-3 py-2 border-2 border-dashed border-border rounded text-sm text-text-dim hover:border-blue/40 transition-colors cursor-pointer text-center"
              >+ Add Font</button>
              <button
                onClick={() => fontFileRef.current?.click()}
                className="flex-1 px-3 py-2 border-2 border-dashed border-border rounded text-sm text-text-dim hover:border-blue/40 transition-colors cursor-pointer text-center"
              >Upload Font File</button>
            </div>
            <input ref={fontFileRef} type="file" accept=".ttf,.otf,.woff,.woff2" style={{ display: 'none' }} onChange={handleFontFileUpload} />
          </div>
        </div>

        {/* Tone */}
        <div>
          <SectionHeader title="Brand Tone" />
          <div className="bg-fulton-light border border-fulton/20 rounded-lg p-4 text-sm text-text-secondary leading-relaxed">
            {tone}
          </div>
        </div>

        {/* Target Personas */}
        <div>
          <SectionHeader
            title="Target Personas"
            subtitle={`${brand?.research?.personas?.length || 0} defined`}
            action={!isClient ? (
              <Button variant="ghost" size="sm" onClick={() => setShowAddPersona(!showAddPersona)}>
                {showAddPersona ? 'Cancel' : '+ Add Persona'}
              </Button>
            ) : undefined}
          />
          {showAddPersona && (
            <div className="bg-surface border border-border rounded-lg p-4 mb-3 space-y-2">
              <input
                type="text"
                placeholder="Persona name (e.g. Runners, 25-40)"
                value={newPersonaName}
                onChange={e => setNewPersonaName(e.target.value)}
                className="w-full px-3 py-2 bg-page border border-border rounded text-sm text-text-primary focus:border-fulton focus:outline-none"
                autoFocus
              />
              <input
                type="text"
                placeholder="Description (e.g. Active runners dealing with shin splints)"
                value={newPersonaDesc}
                onChange={e => setNewPersonaDesc(e.target.value)}
                className="w-full px-3 py-2 bg-page border border-border rounded text-sm text-text-primary focus:border-fulton focus:outline-none"
              />
              <input
                type="text"
                placeholder="Ad hook (e.g. Recovery support between runs)"
                value={newPersonaHook}
                onChange={e => setNewPersonaHook(e.target.value)}
                className="w-full px-3 py-2 bg-page border border-border rounded text-sm text-text-primary focus:border-fulton focus:outline-none"
              />
              <Button size="sm" className="w-full justify-center" onClick={handleAddPersona} disabled={!newPersonaName.trim()}>
                Save Persona
              </Button>
            </div>
          )}
          {brand?.research?.personas && brand.research.personas.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {brand.research.personas.map((p, i) => (
                <div key={i} className="bg-surface border border-border rounded-lg p-3">
                  <div className="text-2xs font-bold text-fulton uppercase tracking-wider mb-1">P{i + 1}</div>
                  <div className="text-sm font-bold mb-1">{p.name}</div>
                  {p.description && <div className="text-xs text-text-dim mb-1.5">{p.description}</div>}
                  {p.hook && (
                    <div className="bg-fulton-light border border-fulton/20 rounded px-2.5 py-1.5 mt-2">
                      <span className="text-2xs font-bold text-fulton">Hook: </span>
                      <span className="text-xs text-text-secondary">{p.hook}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-text-dim text-center py-4">
              No personas yet. Click &quot;+ Add Persona&quot; to create one, or run Brand Research to auto-generate them.
            </div>
          )}
        </div>

        {/* Do / Don't */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-green-light border border-green/20 rounded-lg p-4">
            <div className="text-xs font-bold text-green mb-2">DO</div>
            {(brand?.research?.keyPhrases?.length) ? (
              <ul className="space-y-1.5">
                {brand.research.keyPhrases.map((d, i) => <li key={i} className="text-xs text-text-secondary">- {d}</li>)}
              </ul>
            ) : (
              <div className="text-xs text-text-dim italic">Edit manually based on client preferences. Add key phrases and brand guidelines that should always be followed.</div>
            )}
          </div>
          <div className="bg-red-light border border-red/20 rounded-lg p-4">
            <div className="text-xs font-bold text-red mb-2">DON'T</div>
            {(brand?.research?.avoidPhrases?.length) ? (
              <ul className="space-y-1.5">
                {brand.research.avoidPhrases.map((d, i) => <li key={i} className="text-xs text-text-secondary">- {d}</li>)}
              </ul>
            ) : (
              <div className="text-xs text-text-dim italic">Edit manually based on client preferences. Add phrases, styles, and approaches that should be avoided for this brand.</div>
            )}
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
            <div className="flex gap-2">
              <button
                onClick={() => logoRef.current?.click()}
                className={`flex-1 p-3 rounded-lg border text-left flex items-center gap-3 transition-all ${
                  logoFile || logoPreview ? 'border-fulton bg-fulton-light' : 'border-border bg-page hover:border-text-subtle'
                }`}
              >
                <span className="text-lg">{logoFile || logoPreview ? '✓' : '🏷'}</span>
                <div>
                  <div className="text-xs font-semibold">{logoFile ? logoFile.name : logoPreview ? 'Logo Saved' : 'Upload Logo'}</div>
                  <div className="text-2xs text-text-dim">{logoFile ? `${(logoFile.size / 1024).toFixed(0)} KB` : logoPreview ? 'Click to replace' : 'PNG, SVG, JPG'}</div>
                </div>
              </button>
              {(logoFile || logoPreview) && (
                <button
                  onClick={() => {
                    setLogoFile(null)
                    setLogoPreview(null)
                    if (brand) onBrandUpdate(brand.id, { logo_url: '' } as Partial<Brand>)
                    onToast('Logo removed', 'info')
                  }}
                  className="px-3 rounded-lg border border-border hover:border-red/40 hover:bg-red/5 transition-all flex items-center"
                  title="Remove logo"
                >
                  <span className="text-red text-sm">x</span>
                </button>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => guidelinesRef.current?.click()}
                className={`flex-1 p-3 rounded-lg border text-left flex items-center gap-3 transition-all ${
                  guidelinesFile || guidelinesUrl ? 'border-fulton bg-fulton-light' : 'border-border bg-page hover:border-text-subtle'
                }`}
              >
                <span className="text-lg">{guidelinesFile || guidelinesUrl ? '✓' : '📄'}</span>
                <div>
                  <div className="text-xs font-semibold">{guidelinesFile ? guidelinesFile.name : guidelinesUrl ? 'Brand Guidelines Saved' : 'Upload Brand Guidelines'}</div>
                  <div className="text-2xs text-text-dim">{guidelinesFile ? `${(guidelinesFile.size / 1024).toFixed(0)} KB` : guidelinesUrl ? 'Click to replace' : 'PDF, PNG, JPG'}</div>
                </div>
              </button>
              {(guidelinesFile || guidelinesUrl) && (
                <button
                  onClick={() => {
                    setGuidelinesFile(null)
                    setGuidelinesUrl(null)
                    if (brand) onBrandUpdate(brand.id, { brand_guidelines_url: '' } as Partial<Brand>)
                    onToast('Brand guidelines removed', 'info')
                  }}
                  className="px-3 rounded-lg border border-border hover:border-red/40 hover:bg-red/5 transition-all flex items-center"
                  title="Remove guidelines"
                >
                  <span className="text-red text-sm">x</span>
                </button>
              )}
            </div>
          </div>

          {!isClient && (
            <Button onClick={handleAnalyze} disabled={analyzing} variant="secondary" className="w-full justify-center">
              {analyzing ? <><LoadingSpinner size={14} /> Analyzing...</> : 'Re-analyze with Gemini'}
            </Button>
          )}
        </Card>
      </div>

      {/* Client Sign-In Section - team only */}
      {brand && !isClient && (
        <div className="col-span-full mt-6">
          <Card title="Client Access" subtitle="Create a login for this client to view their dashboard">
            {clientLoginCreated ? (
              <div className="bg-green-light border border-green/20 rounded-lg p-4">
                <div className="text-sm font-bold text-green mb-2">Login created</div>
                <div className="space-y-1">
                  <div className="text-sm"><span className="text-text-dim">Username:</span> <span className="font-bold">{brand.name.toLowerCase().replace(/\s+/g, '-')}</span></div>
                  <div className="text-sm"><span className="text-text-dim">Password:</span> <span className="font-bold">{brand.name.replace(/\s+/g, '')}Hype10!</span></div>
                </div>
                <div className="text-2xs text-text-dim mt-2">Client can log in using the "Client Access" tab on the login screen</div>
              </div>
            ) : (
              <div>
                <div className="bg-surface border border-border rounded-lg p-4 mb-3">
                  <div className="space-y-1">
                    <div className="text-sm"><span className="text-text-dim">Username:</span> <span className="font-bold">{brand.name.toLowerCase().replace(/\s+/g, '-')}</span></div>
                    <div className="text-sm"><span className="text-text-dim">Password:</span> <span className="font-bold">{brand.name.replace(/\s+/g, '')}Hype10!</span></div>
                  </div>
                </div>
                <Button
                  className="w-full justify-center"
                  disabled={creatingLogin}
                  onClick={async () => {
                    setCreatingLogin(true)
                    try {
                      const res = await fetch('/api/auth/users', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          username: brand.name.toLowerCase().replace(/\s+/g, '-'),
                          password: `${brand.name.replace(/\s+/g, '')}Hype10!`,
                          name: brand.name,
                          email: '',
                          role: 'client',
                          brand_id: brand.id,
                        }),
                      })
                      const data = await res.json()
                      if (data.error) throw new Error(data.error)
                      setClientLoginCreated(true)
                      onToast(`Client login created for ${brand.name}`, 'success')
                    } catch (err: unknown) {
                      onToast(`Failed: ${err instanceof Error ? err.message : String(err)}`, 'error')
                    }
                    setCreatingLogin(false)
                  }}
                >
                  {creatingLogin ? 'Creating...' : 'Create Client Login'}
                </Button>
              </div>
            )}
          </Card>
        </div>
      )}

      <ImagePreview src={previewImage || ''} open={!!previewImage} onClose={() => setPreviewImage(null)} />
    </div>
  )
}
