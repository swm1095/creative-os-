'use client'

import { useState, useRef, useEffect } from 'react'
import { Brand } from '@/lib/types'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import ImagePreview from '@/components/ui/ImagePreview'

interface DesignViewProps {
  brand?: Brand | null
  brandId?: string
  onToast: (msg: string, type: 'success' | 'error' | 'info') => void
}

interface ReferenceAnalysis {
  layout: string
  typography: string
  palette: string[]
  mood: string
  headline: string
  subheadline: string
  cta: string
  benefits: string[]
  priceOriginal: string
  priceSale: string
  logoPosition: string
}

interface CopyVariants {
  hooks: string[]
  subheadlines: string[]
  benefits: string[][]
  ctas: string[]
}

export default function DesignView({ brand, brandId, onToast }: DesignViewProps) {
  // Reference
  const [refImage, setRefImage] = useState<string | null>(null)
  const [refAnalysis, setRefAnalysis] = useState<ReferenceAnalysis | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const refInputRef = useRef<HTMLInputElement>(null)

  // Product
  const [productImage, setProductImage] = useState<string | null>(null)
  const [productImageUrl, setProductImageUrl] = useState<string | null>(null)
  const productInputRef = useRef<HTMLInputElement>(null)

  // Brand kit - load from brand data
  const [brandColors, setBrandColors] = useState<string[]>([])
  const [brandFont, setBrandFont] = useState('')

  // Persona
  const personas = brand?.research?.personas || []
  const [selectedPersona, setSelectedPersona] = useState(0)
  const [angle, setAngle] = useState('Problem/Solution')

  // Copy
  const [copyVariants, setCopyVariants] = useState<CopyVariants | null>(null)
  const [copyLoading, setCopyLoading] = useState(false)
  const [activeHook, setActiveHook] = useState(0)
  const [activeSub, setActiveSub] = useState(0)
  const [activeBenefits, setActiveBenefits] = useState(0)
  const [activeCta, setActiveCta] = useState(0)

  // Editable copy fields
  const [hookText, setHookText] = useState('')
  const [subText, setSubText] = useState('')
  const [benefitsText, setBenefitsText] = useState<string[]>([])
  const [ctaText, setCtaText] = useState('')
  const [priceText, setPriceText] = useState('')
  const [salePriceText, setSalePriceText] = useState('')

  // Generated creatives
  const [generatedImages, setGeneratedImages] = useState<Record<string, string>>({})
  const [generating, setGenerating] = useState(false)
  const [activeAspect, setActiveAspect] = useState<'all' | '1:1' | '4:5' | '9:16'>('all')
  const [previewImage, setPreviewImage] = useState<string | null>(null)

  // Load brand colors and fonts from brand data
  useEffect(() => {
    if (brand?.brand_colors?.length) {
      setBrandColors(brand.brand_colors)
    } else if (brand?.color) {
      setBrandColors([brand.color, '#ffffff', '#1a1a1a'])
    }
    if (brand?.brand_fonts?.length) {
      setBrandFont(brand.brand_fonts[0])
    }
  }, [brand?.id, brand?.color, brand?.brand_colors, brand?.brand_fonts, brand?.research])

  const handleRefUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string
      setRefImage(dataUrl)
      analyzeRef(dataUrl)
    }
    reader.readAsDataURL(file)
  }

  const analyzeRef = async (imageData: string) => {
    setAnalyzing(true)
    onToast('Analyzing reference ad...', 'info')
    try {
      const res = await fetch('/api/design', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'analyze', referenceImage: imageData }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setRefAnalysis(data.analysis)

      // Pre-fill copy from reference
      if (data.analysis.headline) setHookText(data.analysis.headline)
      if (data.analysis.subheadline) setSubText(data.analysis.subheadline)
      if (data.analysis.benefits?.length) setBenefitsText(data.analysis.benefits)
      if (data.analysis.cta) setCtaText(data.analysis.cta)
      if (data.analysis.priceOriginal) setPriceText(data.analysis.priceOriginal)
      if (data.analysis.priceSale) setSalePriceText(data.analysis.priceSale)
      // Don't override brand colors from reference - keep the brand's actual colors

      onToast('Reference analyzed - style extracted', 'success')
    } catch (err: unknown) {
      onToast(`Analysis failed: ${err instanceof Error ? err.message : String(err)}`, 'error')
    }
    setAnalyzing(false)
  }

  const handleProductUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setProductImage(ev.target?.result as string)
    reader.readAsDataURL(file)
    // Upload for URL
    const formData = new FormData()
    formData.append('brandId', brandId || 'shared')
    formData.append('files', file)
    fetch('/api/reference-images', { method: 'POST', body: formData })
      .then(r => r.json())
      .then(data => {
        if (data.uploaded?.[0]?.url) setProductImageUrl(data.uploaded[0].url)
      })
      .catch(() => {})
  }

  const handleGenerateCopy = async () => {
    setCopyLoading(true)
    onToast('Generating copy variants...', 'info')
    try {
      const res = await fetch('/api/design', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate-copy',
          brandName: brand?.name || 'Brand',
          brandResearch: brand?.research || null,
          persona: personas[selectedPersona]?.name || 'General consumer',
          angle,
          referenceAnalysis: refAnalysis,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setCopyVariants(data.copy)

      // Set first variants as active
      if (data.copy.hooks?.[0]) setHookText(data.copy.hooks[0])
      if (data.copy.subheadlines?.[0]) setSubText(data.copy.subheadlines[0])
      if (data.copy.benefits?.[0]) setBenefitsText(data.copy.benefits[0])
      if (data.copy.ctas?.[0]) setCtaText(data.copy.ctas[0])

      onToast('Copy variants generated', 'success')
    } catch (err: unknown) {
      onToast(`Copy failed: ${err instanceof Error ? err.message : String(err)}`, 'error')
    }
    setCopyLoading(false)
  }

  const generateOneAspect = async (ar: string, sourceImage?: string) => {
    const res = await fetch('/api/design', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'generate-creative',
        referenceImage: refImage || undefined,
        productImage: productImage || undefined,
        sourceImage, // previously generated 1:1 to keep design consistent
        brandName: brand?.name || 'Brand',
        brandColors,
        hook: hookText,
        subheadline: subText,
        benefits: benefitsText,
        cta: ctaText,
        price: priceText || undefined,
        salePrice: salePriceText || undefined,
        aspectRatio: ar,
        style: refAnalysis || {},
      }),
    })
    const data = await res.json()
    if (data.imageUrl) return data.imageUrl
    if (data.error) throw new Error(data.error)
    throw new Error('No image returned')
  }

  const handleGenerate = async (aspect?: string) => {
    if (!hookText.trim()) { onToast('Add a headline first', 'error'); return }
    setGenerating(true)

    if (aspect) {
      // Single format regeneration - use existing 1:1 as reference if available
      onToast(`Regenerating ${aspect}...`, 'info')
      try {
        const url = await generateOneAspect(aspect, generatedImages['1:1'] || undefined)
        setGeneratedImages(prev => ({ ...prev, [aspect]: url }))
        onToast(`${aspect} regenerated`, 'success')
      } catch (err: unknown) {
        onToast(`${aspect} failed: ${err instanceof Error ? err.message : String(err)}`, 'error')
      }
    } else {
      // Full generation: 1:1 first, then use it as reference for 4:5 and 9:16
      onToast('Generating 1:1 creative first...', 'info')
      try {
        const squareUrl = await generateOneAspect('1:1')
        setGeneratedImages(prev => ({ ...prev, '1:1': squareUrl }))
        onToast('1:1 done. Generating 4:5 and 9:16 to match...', 'info')

        // Generate 4:5 and 9:16 in parallel, using 1:1 as the design reference
        const [fourFive, nineStx] = await Promise.allSettled([
          generateOneAspect('4:5', squareUrl),
          generateOneAspect('9:16', squareUrl),
        ])

        if (fourFive.status === 'fulfilled') {
          setGeneratedImages(prev => ({ ...prev, '4:5': fourFive.value }))
        } else {
          onToast(`4:5 failed: ${fourFive.reason?.message || 'Unknown error'}`, 'error')
        }

        if (nineStx.status === 'fulfilled') {
          setGeneratedImages(prev => ({ ...prev, '9:16': nineStx.value }))
        } else {
          onToast(`9:16 failed: ${nineStx.reason?.message || 'Unknown error'}`, 'error')
        }

        onToast('All creatives generated', 'success')
      } catch (err: unknown) {
        onToast(`Generation failed: ${err instanceof Error ? err.message : String(err)}`, 'error')
      }
    }
    setGenerating(false)
  }

  return (
    <div className="animate-fadeIn">
      <div className="grid grid-cols-[280px_1fr_300px] gap-4 h-[calc(100vh-120px)]">
        {/* Left - Inputs */}
        <div className="space-y-3 overflow-y-auto pr-2">
          {/* 01 Reference Ad */}
          <Card title="01 Reference Ad">
            <input ref={refInputRef} type="file" accept="image/*" className="hidden" onChange={handleRefUpload} />
            {refImage ? (
              <div className="space-y-2">
                <div className="relative">
                  <img src={refImage} alt="Reference" className="w-full rounded-lg border border-border" />
                  <button onClick={() => { setRefImage(null); setRefAnalysis(null) }}
                    className="absolute top-1 right-1 w-5 h-5 bg-black/60 text-white text-xs rounded-full flex items-center justify-center">x</button>
                </div>
                {analyzing && <div className="flex items-center gap-2 text-xs text-text-dim"><LoadingSpinner size={12} /> Analyzing...</div>}
                {refAnalysis && (
                  <div className="text-2xs space-y-1 p-2 bg-page rounded border border-border">
                    <div className="font-bold text-text-muted uppercase tracking-wider mb-1">Extracted Style</div>
                    <div><span className="text-text-dim">Layout:</span> <span className="text-text-primary">{refAnalysis.layout}</span></div>
                    <div><span className="text-text-dim">Type:</span> <span className="text-text-primary">{refAnalysis.typography}</span></div>
                    <div><span className="text-text-dim">Mood:</span> <span className="text-text-primary">{refAnalysis.mood}</span></div>
                    <div className="flex gap-1 mt-1">
                      {refAnalysis.palette?.map((c, i) => (
                        <div key={i} className="w-5 h-5 rounded border border-border" style={{ backgroundColor: c }} />
                      ))}
                    </div>
                    <button onClick={() => analyzeRef(refImage)} className="text-2xs text-blue hover:underline mt-1">Re-analyze</button>
                  </div>
                )}
              </div>
            ) : (
              <button onClick={() => refInputRef.current?.click()}
                className="w-full p-4 border-2 border-dashed border-border rounded-lg text-center hover:border-blue/40 transition-colors">
                <div className="text-xl mb-1">📷</div>
                <div className="text-xs font-semibold text-text-muted">Upload reference ad</div>
                <div className="text-2xs text-text-dim mt-0.5">We'll extract the style</div>
              </button>
            )}
          </Card>

          {/* 02 Product */}
          <Card title="02 Product">
            <input ref={productInputRef} type="file" accept="image/*" className="hidden" onChange={handleProductUpload} />
            {productImage ? (
              <div className="flex items-center gap-3">
                <img src={productImage} alt="Product" className="w-14 h-14 object-cover rounded-lg border border-border" />
                <div className="flex-1">
                  <div className="text-xs font-semibold">{brand?.name || 'Product'}</div>
                  <div className="text-2xs text-text-dim">Product image loaded</div>
                </div>
                <button onClick={() => { setProductImage(null); setProductImageUrl(null) }} className="text-2xs text-text-dim hover:text-text-primary">x</button>
              </div>
            ) : (
              <button onClick={() => productInputRef.current?.click()}
                className="w-full py-3 border-2 border-dashed border-border rounded-lg text-center hover:border-blue/40 transition-colors">
                <div className="text-xs text-text-muted">+ Add product image</div>
              </button>
            )}
          </Card>

          {/* 03 Brand Kit */}
          <Card title="03 Brand Kit">
            <div className="space-y-2">
              <div>
                <div className="text-2xs text-text-dim mb-1">Brand</div>
                <div className="px-3 py-2 bg-page border border-border rounded text-sm">{brand?.name || 'Select a brand'}</div>
              </div>
              <div>
                <div className="text-2xs text-text-dim mb-1">Palette</div>
                <div className="flex gap-1.5">
                  {brandColors.map((c, i) => (
                    <input key={i} type="color" value={c} onChange={e => {
                      const next = [...brandColors]
                      next[i] = e.target.value
                      setBrandColors(next)
                    }} className="w-8 h-8 rounded border border-border cursor-pointer" />
                  ))}
                  <button onClick={() => setBrandColors(prev => [...prev, '#888888'])}
                    className="w-8 h-8 rounded border-2 border-dashed border-border flex items-center justify-center text-xs text-text-dim">+</button>
                </div>
              </div>
              <div>
                <div className="text-2xs text-text-dim mb-1">Display type</div>
                <input type="text" value={brandFont} onChange={e => setBrandFont(e.target.value)}
                  className="w-full px-3 py-1.5 bg-page border border-border rounded text-xs text-text-primary focus:border-blue focus:outline-none" />
              </div>
            </div>
          </Card>

          {/* 04 Persona */}
          <Card title="04 Persona">
            {personas.length > 0 ? (
              <div className="space-y-2">
                {personas.map((p, i) => (
                  <button key={i} onClick={() => setSelectedPersona(i)}
                    className={`w-full text-left p-2 rounded border text-2xs transition-all ${
                      selectedPersona === i ? 'border-blue bg-blue-light' : 'border-border hover:border-text-subtle'
                    }`}>
                    <div className="font-bold">{p.name}</div>
                    <div className="text-text-dim">{p.description?.slice(0, 60)}</div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-2xs text-text-dim">Run brand research to load personas</div>
            )}
            <div className="mt-2">
              <div className="text-2xs text-text-dim mb-1">Angle</div>
              <select value={angle} onChange={e => setAngle(e.target.value)}
                className="w-full px-2 py-1.5 bg-page border border-border rounded text-xs text-text-primary focus:border-blue focus:outline-none">
                <option>Problem/Solution</option>
                <option>Social Proof</option>
                <option>Before/After</option>
                <option>Contrarian</option>
                <option>Urgency/Scarcity</option>
                <option>Educational</option>
              </select>
            </div>
          </Card>
        </div>

        {/* Center - Canvas */}
        <div className="flex flex-col overflow-hidden">
          {/* Aspect tabs */}
          <div className="flex items-center gap-2 mb-3 px-1">
            {(['all', '1:1', '4:5', '9:16'] as const).map(a => (
              <button key={a} onClick={() => setActiveAspect(a)}
                className={`px-3 py-1.5 text-xs rounded border transition-all ${
                  activeAspect === a ? 'border-blue bg-blue-light text-blue font-bold' : 'border-border text-text-dim hover:border-text-subtle'
                }`}>
                {a === 'all' ? 'All aspects' : a}
              </button>
            ))}
            <div className="flex-1" />
            <Button onClick={() => handleGenerate()} disabled={generating} size="sm" className="px-4">
              {generating ? <><LoadingSpinner size={14} /> Generating...</> : 'Generate'}
            </Button>
          </div>

          {/* Canvas area */}
          <div className="flex-1 overflow-auto bg-elevated rounded-lg p-4">
            {generating ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <LoadingSpinner size={32} />
                  <div className="text-sm text-text-muted mt-3">Generating creatives...</div>
                  <div className="text-2xs text-text-dim mt-1">This takes 15-30 seconds per format</div>
                </div>
              </div>
            ) : Object.keys(generatedImages).length > 0 ? (
              <div className={`flex gap-4 justify-center items-start ${activeAspect !== 'all' ? 'justify-center' : ''}`}>
                {(['1:1', '4:5', '9:16'] as const)
                  .filter(a => activeAspect === 'all' || activeAspect === a)
                  .map(a => (
                    <div key={a} className="flex flex-col items-center gap-2">
                      <div className="text-2xs text-text-dim font-bold">
                        {a === '1:1' ? '1080x1080' : a === '4:5' ? '1080x1350' : '1080x1920'}
                        <span className="ml-2 text-text-dim font-normal">
                          {a === '1:1' ? 'Feed' : a === '4:5' ? 'Feed Portrait' : 'Story/Reels'}
                        </span>
                      </div>
                      {generatedImages[a] ? (
                        <div className="relative group cursor-pointer" onClick={() => setPreviewImage(generatedImages[a])}>
                          <img src={generatedImages[a]} alt={`${a} creative`}
                            className={`rounded-lg border border-border shadow-lg ${
                              a === '1:1' ? 'w-64 h-64' : a === '4:5' ? 'w-56 h-70' : 'w-44 h-78'
                            } object-cover`}
                            style={a === '4:5' ? { height: '320px' } : a === '9:16' ? { height: '400px' } : {}}
                          />
                          <div className="absolute bottom-2 left-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleGenerate(a)}
                              className="flex-1 px-2 py-1 bg-black/70 text-white text-2xs rounded hover:bg-black/90">Regenerate</button>
                            <button onClick={() => {
                              const link = document.createElement('a')
                              link.href = generatedImages[a]
                              link.download = `${brand?.name || 'creative'}-${a.replace(':', 'x')}-${Date.now()}.png`
                              link.click()
                            }} className="px-2 py-1 bg-black/70 text-white text-2xs rounded hover:bg-black/90">Save</button>
                          </div>
                        </div>
                      ) : (
                        <div className={`rounded-lg border-2 border-dashed border-border flex items-center justify-center text-text-dim text-2xs ${
                          a === '1:1' ? 'w-64 h-64' : a === '4:5' ? 'w-56' : 'w-44'
                        }`} style={a === '4:5' ? { height: '320px' } : a === '9:16' ? { height: '400px' } : {}}>
                          Not generated
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-center">
                <div>
                  <div className="text-4xl mb-3">🎨</div>
                  <div className="text-sm font-bold text-text-muted mb-1">HyperDesign Studio</div>
                  <div className="text-xs text-text-dim max-w-xs">Upload a reference ad, add your product, set your copy, and generate creatives in all formats</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right - Copy */}
        <div className="space-y-3 overflow-y-auto pl-2">
          <Button onClick={handleGenerateCopy} disabled={copyLoading} className="w-full justify-center" size="sm">
            {copyLoading ? <><LoadingSpinner size={14} /> Generating...</> : 'Generate Copy'}
          </Button>

          {/* Hook */}
          <Card title="Hook">
            <input type="text" value={hookText} onChange={e => setHookText(e.target.value)}
              className="w-full px-3 py-2 bg-page border border-border rounded text-sm font-bold text-text-primary focus:border-blue focus:outline-none mb-1" />
            <div className="text-2xs text-text-dim">{hookText.length}/40 chars</div>
            {copyVariants?.hooks && (
              <div className="flex flex-wrap gap-1 mt-2">
                {copyVariants.hooks.map((h, i) => (
                  <button key={i} onClick={() => { setHookText(h); setActiveHook(i) }}
                    className={`px-2 py-1 text-2xs rounded border transition-all ${
                      activeHook === i ? 'border-blue bg-blue-light' : 'border-border hover:border-text-subtle'
                    }`}>
                    {h}
                  </button>
                ))}
              </div>
            )}
          </Card>

          {/* Subheadline */}
          <Card title="Subhead">
            <input type="text" value={subText} onChange={e => setSubText(e.target.value)}
              className="w-full px-3 py-2 bg-page border border-border rounded text-sm text-text-primary focus:border-blue focus:outline-none mb-1" />
            <div className="text-2xs text-text-dim">{subText.length}/30 chars</div>
            {copyVariants?.subheadlines && (
              <div className="flex flex-wrap gap-1 mt-2">
                {copyVariants.subheadlines.map((s, i) => (
                  <button key={i} onClick={() => { setSubText(s); setActiveSub(i) }}
                    className={`px-2 py-1 text-2xs rounded border transition-all ${
                      activeSub === i ? 'border-blue bg-blue-light' : 'border-border hover:border-text-subtle'
                    }`}>
                    {s}
                  </button>
                ))}
              </div>
            )}
          </Card>

          {/* Benefits */}
          <Card title="Benefits">
            {benefitsText.map((b, i) => (
              <input key={i} type="text" value={b}
                onChange={e => {
                  const next = [...benefitsText]
                  next[i] = e.target.value
                  setBenefitsText(next)
                }}
                className="w-full px-3 py-1.5 bg-page border border-border rounded text-xs text-text-primary focus:border-blue focus:outline-none mb-1" />
            ))}
            <button onClick={() => setBenefitsText(prev => [...prev, ''])}
              className="text-2xs text-blue hover:underline">+ Add benefit</button>
            {copyVariants?.benefits && copyVariants.benefits.length > 1 && (
              <div className="flex gap-1 mt-2">
                {copyVariants.benefits.map((_, i) => (
                  <button key={i} onClick={() => { setBenefitsText(copyVariants.benefits[i]); setActiveBenefits(i) }}
                    className={`px-2 py-1 text-2xs rounded border ${
                      activeBenefits === i ? 'border-blue bg-blue-light' : 'border-border'
                    }`}>
                    Set {i + 1}
                  </button>
                ))}
              </div>
            )}
          </Card>

          {/* CTA */}
          <Card title="CTA">
            <input type="text" value={ctaText} onChange={e => setCtaText(e.target.value)}
              className="w-full px-3 py-2 bg-page border border-border rounded text-sm font-bold text-text-primary focus:border-blue focus:outline-none mb-1" />
            {copyVariants?.ctas && (
              <div className="flex flex-wrap gap-1 mt-1">
                {copyVariants.ctas.map((c, i) => (
                  <button key={i} onClick={() => { setCtaText(c); setActiveCta(i) }}
                    className={`px-2 py-1 text-2xs rounded border ${
                      activeCta === i ? 'border-blue bg-blue-light' : 'border-border'
                    }`}>
                    {c}
                  </button>
                ))}
              </div>
            )}
          </Card>

          {/* Price */}
          <Card title="Pricing">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-2xs text-text-dim mb-1">Original</div>
                <input type="text" value={priceText} onChange={e => setPriceText(e.target.value)}
                  placeholder="$65" className="w-full px-2 py-1.5 bg-page border border-border rounded text-xs focus:border-blue focus:outline-none" />
              </div>
              <div>
                <div className="text-2xs text-text-dim mb-1">Sale</div>
                <input type="text" value={salePriceText} onChange={e => setSalePriceText(e.target.value)}
                  placeholder="$48" className="w-full px-2 py-1.5 bg-page border border-border rounded text-xs focus:border-blue focus:outline-none" />
              </div>
            </div>
          </Card>

          {/* Export */}
          {Object.keys(generatedImages).length > 0 && (
            <Card title="Export">
              <div className="space-y-2">
                {Object.entries(generatedImages).map(([ar, url]) => (
                  <button key={ar} onClick={() => {
                    const link = document.createElement('a')
                    link.href = url
                    link.download = `${brand?.name || 'creative'}-${ar.replace(':', 'x')}-${Date.now()}.png`
                    link.click()
                    onToast(`${ar} downloaded`, 'success')
                  }} className="w-full px-3 py-2 bg-page border border-border rounded text-xs text-text-primary hover:border-blue/40 transition-colors text-left">
                    Download {ar} ({ar === '1:1' ? '1080x1080' : ar === '4:5' ? '1080x1350' : '1080x1920'})
                  </button>
                ))}
                <button onClick={() => {
                  Object.entries(generatedImages).forEach(([ar, url]) => {
                    const link = document.createElement('a')
                    link.href = url
                    link.download = `${brand?.name || 'creative'}-${ar.replace(':', 'x')}-${Date.now()}.png`
                    link.click()
                  })
                  onToast('All formats downloaded', 'success')
                }} className="w-full px-3 py-2 bg-blue text-white rounded text-xs font-bold hover:bg-blue-dark transition-colors">
                  Download All
                </button>
              </div>
            </Card>
          )}
        </div>
      </div>

      <ImagePreview src={previewImage || ''} open={!!previewImage} onClose={() => setPreviewImage(null)} />
    </div>
  )
}
