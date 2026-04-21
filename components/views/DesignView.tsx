'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Brand } from '@/lib/types'
import Button from '@/components/ui/Button'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import ImagePreview from '@/components/ui/ImagePreview'

interface DesignViewProps {
  brand?: Brand | null
  brandId?: string
  onToast: (msg: string, type: 'success' | 'error' | 'info') => void
}

// ── Layout system: normalized 0-1 coords per element per aspect ──
const DEFAULT_LAYOUT: Record<string, Record<string, { x: number; y: number; w: number; h: number }>> = {
  '1x1': {
    headline: { x: 0.075, y: 0.08, w: 0.6, h: 0.42 },
    subhead:  { x: 0.075, y: 0.56, w: 0.6, h: 0.07 },
    bullets:  { x: 0.075, y: 0.65, w: 0.72, h: 0.28 },
    cta:      { x: 0.075, y: 0.88, w: 0.36, h: 0.08 },
    price:    { x: 0.70,  y: 0.10, w: 0.22, h: 0.22 },
    product:  { x: 0.34,  y: 0.34, w: 0.80, h: 0.62 },
    logo:     { x: 0.72,  y: 0.91, w: 0.22, h: 0.06 },
  },
  '4x5': {
    headline: { x: 0.07, y: 0.06, w: 0.7, h: 0.40 },
    subhead:  { x: 0.07, y: 0.49, w: 0.7, h: 0.06 },
    bullets:  { x: 0.07, y: 0.58, w: 0.8, h: 0.28 },
    cta:      { x: 0.07, y: 0.88, w: 0.4, h: 0.07 },
    price:    { x: 0.70, y: 0.08, w: 0.25, h: 0.18 },
    product:  { x: 0.28, y: 0.38, w: 0.88, h: 0.48 },
    logo:     { x: 0.70, y: 0.04, w: 0.25, h: 0.05 },
  },
  '9x16': {
    headline: { x: 0.07, y: 0.06, w: 0.85, h: 0.32 },
    subhead:  { x: 0.07, y: 0.40, w: 0.85, h: 0.05 },
    bullets:  { x: 0.07, y: 0.66, w: 0.86, h: 0.22 },
    cta:      { x: 0.07, y: 0.91, w: 0.55, h: 0.06 },
    price:    { x: 0.68, y: 0.18, w: 0.28, h: 0.17 },
    product:  { x: 0.00, y: 0.46, w: 1.02, h: 0.24 },
    logo:     { x: 0.70, y: 0.04, w: 0.26, h: 0.04 },
  },
}

function aspectSpec(a: string) {
  if (a === '1x1') return { w: 540, h: 540, label: '1:1', use: 'Feed' }
  if (a === '4x5') return { w: 432, h: 540, label: '4:5', use: 'Feed - Portrait' }
  if (a === '9x16') return { w: 304, h: 540, label: '9:16', use: 'Story - Reels' }
  return { w: 540, h: 540, label: '1:1', use: 'Feed' }
}

interface LayoutBox { x: number; y: number; w: number; h: number }
interface Creative {
  headline: string
  subhead: string
  bullets: string[]
  cta: string
  priceOld: string
  priceNew: string
  layouts: Record<string, Record<string, LayoutBox>>
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
}

interface CopyVariants {
  hooks: string[]
  subheadlines: string[]
  benefits: string[][]
  ctas: string[]
}

// ── Frame: draggable/resizable wrapper ──
function Frame({ id, layout, selected, editingText, onSelect, onChange, onStartEdit, lockAspect, children, extraStyle }: {
  id: string; layout: LayoutBox; selected: boolean; editingText?: boolean
  onSelect: (id: string | null) => void; onChange: (id: string, box: LayoutBox) => void
  onStartEdit?: (id: string) => void; lockAspect?: boolean
  children: React.ReactNode; extraStyle?: React.CSSProperties
}) {
  const ref = useRef<HTMLDivElement>(null)

  const startDrag = (e: React.MouseEvent) => {
    if (editingText) return
    e.stopPropagation()
    onSelect(id)
    const startX = e.clientX, startY = e.clientY
    const board = ref.current?.closest('.ad-canvas') as HTMLElement
    if (!board) return
    const rect = board.getBoundingClientRect()
    const init = { ...layout }
    const move = (ev: MouseEvent) => {
      const dx = (ev.clientX - startX) / rect.width
      const dy = (ev.clientY - startY) / rect.height
      onChange(id, { x: Math.max(-0.2, Math.min(1.1, init.x + dx)), y: Math.max(-0.2, Math.min(1.1, init.y + dy)), w: init.w, h: init.h })
    }
    const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up) }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  const startResize = (corner: string) => (e: React.MouseEvent) => {
    e.stopPropagation(); e.preventDefault()
    const startX = e.clientX, startY = e.clientY
    const board = ref.current?.closest('.ad-canvas') as HTMLElement
    if (!board) return
    const rect = board.getBoundingClientRect()
    const init = { ...layout }
    const move = (ev: MouseEvent) => {
      const dx = (ev.clientX - startX) / rect.width
      const dy = (ev.clientY - startY) / rect.height
      let { x, y, w, h } = init
      if (corner.includes('e')) w = Math.max(0.05, init.w + dx)
      if (corner.includes('s')) h = Math.max(0.04, init.h + dy)
      if (corner.includes('w')) { x = init.x + dx; w = Math.max(0.05, init.w - dx) }
      if (corner.includes('n')) { y = init.y + dy; h = Math.max(0.04, init.h - dy) }
      if (lockAspect && init.w && init.h) { h = w * (init.h / init.w) }
      onChange(id, { x, y, w, h })
    }
    const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up) }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  const handles = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']
  const cursorMap: Record<string, string> = { n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize', ne: 'nesw-resize', sw: 'nesw-resize', nw: 'nwse-resize', se: 'nwse-resize' }
  const handlePos: Record<string, React.CSSProperties> = {
    nw: { top: -4, left: -4 }, n: { top: -4, left: '50%', transform: 'translateX(-50%)' },
    ne: { top: -4, right: -4 }, e: { top: '50%', right: -4, transform: 'translateY(-50%)' },
    se: { bottom: -4, right: -4 }, s: { bottom: -4, left: '50%', transform: 'translateX(-50%)' },
    sw: { bottom: -4, left: -4 }, w: { top: '50%', left: -4, transform: 'translateY(-50%)' },
  }

  return (
    <div ref={ref} onMouseDown={startDrag}
      onDoubleClick={e => { e.stopPropagation(); onStartEdit?.(id) }}
      style={{
        position: 'absolute', left: `${layout.x * 100}%`, top: `${layout.y * 100}%`,
        width: `${layout.w * 100}%`, height: `${layout.h * 100}%`,
        cursor: editingText ? 'text' : 'move', userSelect: editingText ? 'text' : 'none',
        zIndex: selected ? 10 : 1, ...extraStyle,
      }}>
      {children}
      {selected && !editingText && (
        <>
          <div style={{ position: 'absolute', inset: -1, border: '2px solid #2138ff', borderRadius: 2, pointerEvents: 'none' }} />
          {handles.map(c => (
            <div key={c} onMouseDown={startResize(c)} style={{
              position: 'absolute', width: 8, height: 8, background: '#2138ff', borderRadius: 2,
              cursor: cursorMap[c], ...handlePos[c],
            }} />
          ))}
        </>
      )}
    </div>
  )
}

// ── EditText: inline content-editable ──
function EditText({ value, editing, onCommit, style, multiline }: {
  value: string; editing: boolean; onCommit: (v: string) => void
  style: React.CSSProperties; multiline?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => { if (editing && ref.current) { ref.current.focus(); document.execCommand?.('selectAll', false, undefined) } }, [editing])
  if (!editing) return <div style={{ ...style, whiteSpace: multiline ? 'pre-line' : 'normal' }}>{value}</div>
  return (
    <div ref={ref} contentEditable suppressContentEditableWarning
      onBlur={e => onCommit(multiline ? e.currentTarget.innerText : e.currentTarget.innerText.replace(/\n/g, ' '))}
      onKeyDown={e => { if (e.key === 'Escape') (e.target as HTMLElement).blur(); if (e.key === 'Enter' && !multiline) { e.preventDefault(); (e.target as HTMLElement).blur() } }}
      style={{ ...style, whiteSpace: multiline ? 'pre-line' : 'normal', outline: '2px solid #2138ff', outlineOffset: 2, cursor: 'text' }}>
      {value}
    </div>
  )
}

// ── Ad: renders a single creative at a given aspect ──
function AdCanvas({ aspect, creative, brandColors, brandName, brandFont, productImage, selected, editing, onSelect, onLayoutChange, onTextChange, onStartEdit }: {
  aspect: string; creative: Creative; brandColors: string[]; brandName: string; brandFont: string; productImage: string | null
  selected: string | null; editing: string | null
  onSelect: (id: string | null) => void
  onLayoutChange: (aspect: string, id: string, box: LayoutBox) => void
  onTextChange: (field: string, value: string | string[]) => void
  onStartEdit: (id: string | null) => void
}) {
  const s = aspectSpec(aspect)
  const u = s.w / 540
  const baseLayout = DEFAULT_LAYOUT[aspect] || DEFAULT_LAYOUT['1x1']
  const overrides = creative.layouts[aspect] || {}
  const layout: Record<string, LayoutBox> = {}
  for (const k of Object.keys(baseLayout)) layout[k] = { ...baseLayout[k], ...(overrides[k] || {}) }

  const bg = brandColors[0] || '#f5f0eb'
  const ink = brandColors[1] || '#1a1a1a'
  const accent = brandColors[2] || '#2138ff'

  const getFontSize = (id: string) => {
    const box = layout[id]
    if (!box) return 14 * u
    const base = box.h * s.h
    const coef: Record<string, Record<string, number>> = {
      headline: { '1x1': 0.40, '4x5': 0.38, '9x16': 0.34 },
      subhead: { '1x1': 0.70, '4x5': 0.70, '9x16': 0.80 },
      cta: { '1x1': 0.45, '4x5': 0.45, '9x16': 0.45 },
      price: { '1x1': 0.28, '4x5': 0.30, '9x16': 0.26 },
      bullets: { '1x1': 0.20, '4x5': 0.19, '9x16': 0.20 },
      logo: { '1x1': 0.60, '4x5': 0.60, '9x16': 0.70 },
    }
    return base * ((coef[id] || {})[aspect] ?? 0.5)
  }

  return (
    <div className="ad-canvas" style={{
      background: bg, overflow: 'hidden', position: 'absolute', inset: 0, fontFamily: brandFont ? `"${brandFont}", Impact, sans-serif` : 'Impact, sans-serif',
    }} onMouseDown={e => { if ((e.target as HTMLElement).classList.contains('ad-canvas')) onSelect(null) }}>

      {/* Product */}
      <Frame id="product" layout={layout.product} selected={selected === 'product'}
        onSelect={onSelect} onChange={(id, box) => onLayoutChange(aspect, id, box)} lockAspect>
        {productImage ? (
          <img src={productImage} alt="" draggable={false} style={{
            width: '100%', height: '100%', objectFit: 'contain',
            filter: 'drop-shadow(0 18px 30px rgba(0,0,0,0.22))',
            mixBlendMode: 'multiply', pointerEvents: 'none',
          }} />
        ) : (
          <div style={{ width: '100%', height: '100%', borderRadius: 20, background: accent, display: 'grid', placeItems: 'center', color: 'white', fontSize: 32, fontWeight: 900 }}>
            {brandName.charAt(0)}
          </div>
        )}
      </Frame>

      {/* Price badge */}
      <Frame id="price" layout={layout.price} selected={selected === 'price'}
        onSelect={onSelect} onChange={(id, box) => onLayoutChange(aspect, id, box)} lockAspect
        extraStyle={{ transform: 'rotate(-12deg)' }}>
        <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: accent, color: 'white', display: 'grid', placeItems: 'center', boxShadow: '0 6px 18px rgba(0,0,0,0.12)', textAlign: 'center' }}>
          <div style={{ lineHeight: 1 }}>
            <EditText value={creative.priceOld} editing={editing === 'priceOld'}
              onCommit={v => onTextChange('priceOld', v)}
              style={{ fontSize: getFontSize('price') * 0.5, textDecoration: 'line-through', opacity: 0.85, fontWeight: 600 }} />
            <EditText value={creative.priceNew} editing={editing === 'priceNew'}
              onCommit={v => onTextChange('priceNew', v)}
              style={{ fontSize: getFontSize('price'), fontWeight: 800, marginTop: 2 }} />
          </div>
        </div>
      </Frame>

      {/* Headline */}
      <Frame id="headline" layout={layout.headline} selected={selected === 'headline'}
        editingText={editing === 'headline'} onSelect={onSelect}
        onChange={(id, box) => onLayoutChange(aspect, id, box)}
        onStartEdit={() => onStartEdit('headline')}>
        <EditText value={creative.headline} editing={editing === 'headline'}
          onCommit={v => { onTextChange('headline', v); onStartEdit(null) }} multiline
          style={{ fontWeight: 900, fontSize: getFontSize('headline'), lineHeight: 0.92, letterSpacing: '-0.03em', textTransform: 'uppercase', color: ink }} />
      </Frame>

      {/* Subhead */}
      <Frame id="subhead" layout={layout.subhead} selected={selected === 'subhead'}
        editingText={editing === 'subhead'} onSelect={onSelect}
        onChange={(id, box) => onLayoutChange(aspect, id, box)}
        onStartEdit={() => onStartEdit('subhead')}>
        <EditText value={creative.subhead} editing={editing === 'subhead'}
          onCommit={v => { onTextChange('subhead', v); onStartEdit(null) }}
          style={{ fontWeight: 700, fontSize: getFontSize('subhead'), textTransform: 'uppercase', letterSpacing: '0.01em', color: ink }} />
      </Frame>

      {/* Bullets */}
      <Frame id="bullets" layout={layout.bullets} selected={selected === 'bullets'}
        editingText={editing?.startsWith('bullet-')} onSelect={onSelect}
        onChange={(id, box) => onLayoutChange(aspect, id, box)}
        onStartEdit={() => onStartEdit('bullet-0')}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 * u, height: '100%', justifyContent: 'space-evenly' }}>
          {creative.bullets.map((b, i) => (
            <div key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: 'white', borderRadius: 999, padding: `${6 * u}px ${14 * u}px`, fontWeight: 600, color: ink, fontSize: getFontSize('bullets') }}
              onDoubleClick={e => { e.stopPropagation(); onStartEdit('bullet-' + i) }}>
              <span style={{ width: 18 * u, height: 18 * u, borderRadius: '50%', background: accent, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <svg width={10 * u} height={10 * u} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
              </span>
              <EditText value={b} editing={editing === 'bullet-' + i}
                onCommit={v => { const next = [...creative.bullets]; next[i] = v; onTextChange('bullets', next); onStartEdit(null) }}
                style={{}} />
            </div>
          ))}
        </div>
      </Frame>

      {/* CTA */}
      <Frame id="cta" layout={layout.cta} selected={selected === 'cta'}
        editingText={editing === 'cta'} onSelect={onSelect}
        onChange={(id, box) => onLayoutChange(aspect, id, box)}
        onStartEdit={() => onStartEdit('cta')}>
        <div style={{ width: '100%', height: '100%', background: ink, color: bg, borderRadius: 999, display: 'grid', placeItems: 'center', padding: `0 ${18 * u}px`, fontSize: getFontSize('cta'), fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.02em' }}>
          <EditText value={creative.cta} editing={editing === 'cta'}
            onCommit={v => { onTextChange('cta', v); onStartEdit(null) }} style={{}} />
        </div>
      </Frame>

      {/* Logo */}
      <Frame id="logo" layout={layout.logo} selected={selected === 'logo'}
        onSelect={onSelect} onChange={(id, box) => onLayoutChange(aspect, id, box)}>
        <div style={{ width: '100%', height: '100%', fontWeight: 800, fontSize: getFontSize('logo'), letterSpacing: '0.02em', color: ink, display: 'flex', alignItems: 'center', gap: 6, opacity: 0.9, justifyContent: 'flex-end' }}>
          <span style={{ width: getFontSize('logo'), height: getFontSize('logo'), background: accent, borderRadius: 4 }} />
          {brandName}
        </div>
      </Frame>
    </div>
  )
}

// ── Main Component ──
export default function DesignView({ brand, brandId, onToast }: DesignViewProps) {
  // Tabs
  const [leftTab, setLeftTab] = useState<'inputs' | 'layers' | 'history'>('inputs')
  const [rightTab, setRightTab] = useState<'copy' | 'style' | 'export'>('copy')
  const [activeAspect, setActiveAspect] = useState<'all' | '1x1' | '4x5' | '9x16'>('all')
  const [zoom, setZoom] = useState(70)

  // Reference
  const [refImage, setRefImage] = useState<string | null>(null)
  const [refAnalysis, setRefAnalysis] = useState<ReferenceAnalysis | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const refInputRef = useRef<HTMLInputElement>(null)

  // Product
  const [productImage, setProductImage] = useState<string | null>(null)
  const productInputRef = useRef<HTMLInputElement>(null)

  // Brand
  const [brandColors, setBrandColors] = useState<string[]>([])
  const [brandFont, setBrandFont] = useState('')

  // Persona
  const personas = brand?.research?.personas || []
  const [selectedPersona, setSelectedPersona] = useState(0)
  const [angle, setAngle] = useState('Problem/Solution')
  const [brief, setBrief] = useState('')

  // Creative state
  const [creative, setCreative] = useState<Creative>({
    headline: 'YOUR\nHEADLINE\nHERE',
    subhead: 'UNLESS YOU WANT',
    bullets: ['Real arch support', 'All-day comfort', 'Natural cork base', 'Fits any shoe'],
    cta: 'SHOP NOW',
    priceOld: '$65',
    priceNew: '$48',
    layouts: {},
  })

  // Canvas state
  const [selected, setSelected] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)

  // Copy variants
  const [copyVariants, setCopyVariants] = useState<CopyVariants | null>(null)
  const [copyLoading, setCopyLoading] = useState(false)

  // Generation
  const [generating, setGenerating] = useState(false)
  const [generatedImages, setGeneratedImages] = useState<Record<string, string>>({})
  const [previewImage, setPreviewImage] = useState<string | null>(null)

  // Track brand ID to detect actual brand switches
  const prevBrandId = useRef(brand?.id)

  // Load brand colors on mount + reset state on brand switch
  useEffect(() => {
    const isBrandSwitch = prevBrandId.current !== undefined && prevBrandId.current !== brand?.id
    prevBrandId.current = brand?.id

    // Only reset creative state on actual brand switches, not initial load
    if (isBrandSwitch) {
      setCreative({
        headline: 'YOUR\nHEADLINE\nHERE', subhead: 'SUBHEADLINE',
        bullets: ['Benefit one', 'Benefit two', 'Benefit three', 'Benefit four'],
        cta: 'SHOP NOW', priceOld: '', priceNew: '', layouts: {},
      })
      setRefImage(null); setRefAnalysis(null)
      setProductImage(null); setCopyVariants(null)
      setGeneratedImages({}); setSelected(null); setEditing(null)
    }

    // Load brand colors - empty for new brands without colors set
    setBrandColors(brand?.brand_colors || [])
    setBrandFont(brand?.brand_fonts?.[0] || '')
  }, [brand?.id])

  // Escape to deselect
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setSelected(null); setEditing(null) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const handleRefUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => { setRefImage(ev.target?.result as string); analyzeRef(ev.target?.result as string) }
    reader.readAsDataURL(file)
  }

  const analyzeRef = async (imageData: string) => {
    setAnalyzing(true)
    onToast('Analyzing reference ad...', 'info')
    try {
      const res = await fetch('/api/design', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'analyze', referenceImage: imageData }) })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setRefAnalysis(data.analysis)
      if (data.analysis.headline) setCreative(prev => ({ ...prev, headline: data.analysis.headline }))
      if (data.analysis.subheadline) setCreative(prev => ({ ...prev, subhead: data.analysis.subheadline }))
      if (data.analysis.benefits?.length) setCreative(prev => ({ ...prev, bullets: data.analysis.benefits }))
      if (data.analysis.cta) setCreative(prev => ({ ...prev, cta: data.analysis.cta }))
      if (data.analysis.priceOriginal) setCreative(prev => ({ ...prev, priceOld: data.analysis.priceOriginal }))
      if (data.analysis.priceSale) setCreative(prev => ({ ...prev, priceNew: data.analysis.priceSale }))
      onToast('Reference analyzed', 'success')
    } catch (err: unknown) { onToast(`Analysis failed: ${err instanceof Error ? err.message : String(err)}`, 'error') }
    setAnalyzing(false)
  }

  const handleProductUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setProductImage(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  const handleLayoutChange = useCallback((aspect: string, id: string, box: LayoutBox) => {
    setCreative(prev => ({
      ...prev,
      layouts: { ...prev.layouts, [aspect]: { ...(prev.layouts[aspect] || {}), [id]: box } },
    }))
  }, [])

  const handleTextChange = useCallback((field: string, value: string | string[]) => {
    setCreative(prev => ({ ...prev, [field]: value }))
  }, [])

  const handleGenerateCopy = async () => {
    setCopyLoading(true)
    onToast('Generating copy variants...', 'info')
    try {
      const res = await fetch('/api/design', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate-copy', brandName: brand?.name || 'Brand', brandResearch: brand?.research || null,
          persona: personas[selectedPersona]?.name || 'General', angle, referenceAnalysis: refAnalysis }) })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setCopyVariants(data.copy)
      if (data.copy.hooks?.[0]) setCreative(prev => ({ ...prev, headline: data.copy.hooks[0] }))
      if (data.copy.subheadlines?.[0]) setCreative(prev => ({ ...prev, subhead: data.copy.subheadlines[0] }))
      if (data.copy.benefits?.[0]) setCreative(prev => ({ ...prev, bullets: data.copy.benefits[0] }))
      if (data.copy.ctas?.[0]) setCreative(prev => ({ ...prev, cta: data.copy.ctas[0] }))
      onToast('Copy variants generated', 'success')
    } catch (err: unknown) { onToast(`Copy failed: ${err instanceof Error ? err.message : String(err)}`, 'error') }
    setCopyLoading(false)
  }

  const generateOne = async (ar: string, sourceImage?: string) => {
    const res = await fetch('/api/design', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'generate-creative', referenceImage: refImage || undefined, productImage: productImage || undefined,
        sourceImage, brandName: brand?.name || 'Brand', brandColors, hook: creative.headline, subheadline: creative.subhead,
        benefits: creative.bullets, cta: creative.cta, price: creative.priceOld, salePrice: creative.priceNew, aspectRatio: ar, style: refAnalysis || {} }) })
    const data = await res.json()
    if (data.imageUrl) return data.imageUrl
    if (data.error) throw new Error(data.error)
    throw new Error('No image returned')
  }

  const handleGenerate = async () => {
    // Generate button = generate AI copy if no copy yet, or render exports if copy exists
    if (!copyVariants) {
      await handleGenerateCopy()
      return
    }

    // Render export images from current canvas state
    if (!creative.headline.trim()) { onToast('Add a headline first', 'error'); return }
    setGenerating(true)
    setGeneratedImages({})
    setRightTab('export')

    try {
      onToast('Rendering 1:1 export...', 'info')
      const squareUrl = await generateOne('1:1')
      setGeneratedImages(prev => ({ ...prev, '1:1': squareUrl }))
      onToast('1:1 done. Rendering 4:5 and 9:16...', 'info')

      const [r45, r916] = await Promise.allSettled([
        generateOne('4:5', squareUrl),
        generateOne('9:16', squareUrl),
      ])
      if (r45.status === 'fulfilled') setGeneratedImages(prev => ({ ...prev, '4:5': r45.value }))
      else onToast(`4:5 failed: ${r45.reason?.message}`, 'error')
      if (r916.status === 'fulfilled') setGeneratedImages(prev => ({ ...prev, '9:16': r916.value }))
      else onToast(`9:16 failed: ${r916.reason?.message}`, 'error')
      onToast('Exports ready - download from the Export tab', 'success')
    } catch (err: unknown) {
      onToast(`Export failed: ${err instanceof Error ? err.message : String(err)}`, 'error')
    }
    setGenerating(false)
  }

  // Section title helper
  const SectionTitle = ({ num, label }: { num: string; label: string }) => (
    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-dim, #888)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ color: 'var(--text-subtle, #666)', opacity: 0.5 }}>{num}</span> {label}
    </div>
  )

  const aspects = activeAspect === 'all' ? ['1x1', '4x5', '9x16'] : [activeAspect.replace(':', 'x')]

  return (
    <div className="animate-fadeIn" style={{ height: 'calc(100vh - 120px)', display: 'grid', gridTemplateColumns: '268px 1fr 320px', gap: 0, overflow: 'hidden' }}>
      {/* ── Left Pane ── */}
      <div style={{ borderRight: '1px solid var(--border, #2a2e3a)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border, #2a2e3a)', padding: '0 14px' }}>
          {(['inputs', 'layers', 'history'] as const).map(t => (
            <button key={t} onClick={() => setLeftTab(t)} style={{
              padding: '10px 12px', fontSize: 12, fontWeight: leftTab === t ? 700 : 500,
              color: leftTab === t ? 'var(--text-primary, #fff)' : 'var(--text-dim, #888)',
              borderBottom: leftTab === t ? '2px solid #2138ff' : '2px solid transparent',
              textTransform: 'capitalize',
            }}>{t}</button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {leftTab === 'inputs' && <>
            {/* 01 Reference */}
            <div>
              <SectionTitle num="01" label="Reference Ad" />
              <input ref={refInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleRefUpload} />
              {refImage ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ position: 'relative' }}>
                    <img src={refImage} alt="" style={{ width: '100%', borderRadius: 8, border: '1px solid var(--border, #2a2e3a)' }} />
                    <button onClick={() => { setRefImage(null); setRefAnalysis(null) }}
                      style={{ position: 'absolute', top: 4, right: 4, width: 20, height: 20, background: 'rgba(0,0,0,0.6)', color: 'white', borderRadius: 10, fontSize: 11, display: 'grid', placeItems: 'center' }}>x</button>
                  </div>
                  {analyzing && <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#888' }}><LoadingSpinner size={12} /> Analyzing...</div>}
                  {refAnalysis && (
                    <div style={{ fontSize: 11, padding: 10, background: 'var(--elevated, #1a1e2e)', borderRadius: 8, border: '1px solid var(--border, #2a2e3a)' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#888', marginBottom: 6 }}>Extracted Style</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '50px 1fr', gap: '3px 8px', fontSize: 11 }}>
                        <span style={{ color: '#666' }}>Layout</span><span>{refAnalysis.layout}</span>
                        <span style={{ color: '#666' }}>Type</span><span>{refAnalysis.typography}</span>
                        <span style={{ color: '#666' }}>Mood</span><span>{refAnalysis.mood}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                        {refAnalysis.palette?.map((c, i) => <div key={i} style={{ width: 20, height: 20, borderRadius: 4, background: c, border: '1px solid var(--border, #2a2e3a)' }} />)}
                      </div>
                      <button onClick={() => analyzeRef(refImage)} style={{ fontSize: 11, color: '#2138ff', marginTop: 6 }}>Re-analyze</button>
                    </div>
                  )}
                </div>
              ) : (
                <button onClick={() => refInputRef.current?.click()}
                  style={{ width: '100%', padding: 20, border: '2px dashed var(--border, #2a2e3a)', borderRadius: 8, textAlign: 'center', fontSize: 12, color: '#888' }}>
                  <div style={{ fontSize: 18, marginBottom: 4 }}>📷</div>
                  Upload reference ad
                </button>
              )}
            </div>

            {/* 02 Product */}
            <div>
              <SectionTitle num="02" label="Product" />
              <input ref={productInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleProductUpload} />
              {productImage ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <img src={productImage} alt="" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border, #2a2e3a)' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{brand?.name || 'Product'}</div>
                    <div style={{ fontSize: 11, color: '#888' }}>Product loaded</div>
                  </div>
                  <button onClick={() => setProductImage(null)} style={{ fontSize: 11, color: '#888' }}>x</button>
                </div>
              ) : (
                <button onClick={() => productInputRef.current?.click()}
                  style={{ width: '100%', padding: 14, border: '2px dashed var(--border, #2a2e3a)', borderRadius: 8, textAlign: 'center', fontSize: 12, color: '#888' }}>
                  + Add product image
                </button>
              )}
            </div>

            {/* 03 Brand Kit */}
            <div>
              <SectionTitle num="03" label="Brand Kit" />
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>{brand?.name || 'Select brand'}</div>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Palette</div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                {brandColors.map((c, i) => (
                  <input key={i} type="color" value={c} onChange={e => { const next = [...brandColors]; next[i] = e.target.value; setBrandColors(next) }}
                    style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border, #2a2e3a)', cursor: 'pointer', padding: 0 }} />
                ))}
                <button onClick={() => setBrandColors(prev => [...prev, '#888888'])}
                  style={{ width: 28, height: 28, borderRadius: 6, border: '2px dashed var(--border, #2a2e3a)', fontSize: 14, color: '#888', display: 'grid', placeItems: 'center' }}>+</button>
              </div>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Display type</div>
              {(brand?.brand_fonts?.length || 0) > 0 ? (
                <select value={brandFont} onChange={e => setBrandFont(e.target.value)}
                  style={{ width: '100%', padding: '6px 10px', background: 'var(--elevated, #1a1e2e)', border: '1px solid var(--border, #2a2e3a)', borderRadius: 6, fontSize: 12, color: 'inherit' }}>
                  {brand?.brand_fonts?.map((f, i) => (
                    <option key={i} value={f}>{f}</option>
                  ))}
                </select>
              ) : (
                <div style={{ padding: '6px 10px', background: 'var(--elevated, #1a1e2e)', border: '1px solid var(--border, #2a2e3a)', borderRadius: 6, fontSize: 11, color: '#888' }}>
                  Add fonts in Brand Kit first
                </div>
              )}
            </div>

            {/* 04 Persona */}
            <div>
              <SectionTitle num="04" label="Persona" />
              {personas.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {personas.map((p, i) => (
                    <button key={i} onClick={() => setSelectedPersona(i)}
                      style={{ textAlign: 'left', padding: 8, borderRadius: 8, border: selectedPersona === i ? '1px solid #2138ff' : '1px solid var(--border, #2a2e3a)', background: selectedPersona === i ? 'rgba(33,56,255,0.1)' : 'transparent', fontSize: 11 }}>
                      <div style={{ fontWeight: 600 }}>{p.name}</div>
                      <div style={{ color: '#888', fontSize: 10 }}>{p.description?.slice(0, 50)}</div>
                    </button>
                  ))}
                </div>
              ) : <div style={{ fontSize: 11, color: '#888' }}>Run brand research to load personas</div>}
            </div>

            {/* 05 Strategy */}
            <div>
              <SectionTitle num="05" label="Creative Strategy" />
              <textarea value={brief} onChange={e => setBrief(e.target.value)} placeholder="Brief: what's the campaign about?"
                style={{ width: '100%', padding: 8, background: 'var(--elevated, #1a1e2e)', border: '1px solid var(--border, #2a2e3a)', borderRadius: 6, fontSize: 12, color: 'inherit', resize: 'vertical', minHeight: 50 }} rows={2} />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                {['Problem/Solution', 'Social Proof', 'UGC', 'Contrarian', 'Bold Claim'].map(a => (
                  <button key={a} onClick={() => setAngle(a)}
                    style={{ padding: '4px 10px', borderRadius: 999, fontSize: 11, border: angle === a ? '1px solid #2138ff' : '1px solid var(--border, #2a2e3a)', background: angle === a ? 'rgba(33,56,255,0.1)' : 'transparent', color: angle === a ? '#2138ff' : '#888' }}>
                    {a}
                  </button>
                ))}
              </div>
            </div>
          </>}

          {leftTab === 'layers' && (
            <div style={{ fontSize: 12 }}>
              {['headline', 'subhead', 'bullets', 'cta', 'price', 'product', 'logo'].map(id => (
                <button key={id} onClick={() => setSelected(id)}
                  style={{ width: '100%', textAlign: 'left', padding: '6px 8px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 8,
                    background: selected === id ? 'rgba(33,56,255,0.1)' : 'transparent', color: selected === id ? '#2138ff' : 'inherit', fontSize: 12 }}>
                  <span style={{ width: 14, height: 14, borderRadius: 3, background: selected === id ? '#2138ff' : 'var(--border, #2a2e3a)', opacity: 0.5 }} />
                  {id}
                </button>
              ))}
            </div>
          )}

          {leftTab === 'history' && (
            <div style={{ fontSize: 11, color: '#888' }}>Version history coming soon</div>
          )}
        </div>
      </div>

      {/* ── Center Canvas ── */}
      <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg, #111)' }}>
        {/* Toolbar */}
        <div style={{ height: 42, borderBottom: '1px solid var(--border, #2a2e3a)', display: 'flex', alignItems: 'center', padding: '0 14px', gap: 6 }}>
          {(['all', '1x1', '4x5', '9x16'] as const).map(a => (
            <button key={a} onClick={() => setActiveAspect(a)}
              style={{ padding: '4px 10px', fontSize: 11, borderRadius: 6, border: activeAspect === a ? '1px solid #2138ff' : '1px solid transparent',
                background: activeAspect === a ? 'rgba(33,56,255,0.08)' : 'transparent', color: activeAspect === a ? '#2138ff' : '#888', fontWeight: activeAspect === a ? 700 : 500 }}>
              {a === 'all' ? 'All aspects' : a.replace('x', ':')}
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#888' }}>
            <button onClick={() => setZoom(z => Math.max(30, z - 10))} style={{ padding: '2px 6px' }}>-</button>
            <span>{zoom}%</span>
            <button onClick={() => setZoom(z => Math.min(150, z + 10))} style={{ padding: '2px 6px' }}>+</button>
          </div>
          <Button onClick={handleGenerateCopy} disabled={copyLoading} size="sm" variant="secondary" className="px-3 ml-2">
            {copyLoading ? <><LoadingSpinner size={14} /> Copy...</> : 'Generate Copy'}
          </Button>
          <Button onClick={handleGenerate} disabled={generating} size="sm" className="px-4">
            {generating ? <><LoadingSpinner size={14} /> Exporting...</> : 'Export Images'}
          </Button>
        </div>

        {/* Canvas */}
        <div style={{ flex: 1, overflow: 'auto', padding: 24, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', gap: 40,
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)', backgroundSize: '18px 18px' }}>
          {aspects.map(a => {
            const spec = aspectSpec(a)
            const scale = zoom / 100
            const hasGenerated = generatedImages[a.replace('x', ':')]
            return (
              <div key={a} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <div style={{ fontSize: 11, color: '#888', display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontWeight: 600 }}>{spec.label}</span>
                  <span style={{ padding: '2px 6px', background: 'var(--elevated, #1a1e2e)', borderRadius: 4, fontSize: 10 }}>{spec.use}</span>
                  <span style={{ fontSize: 10 }}>{a === '1x1' ? '1080x1080' : a === '4x5' ? '1080x1350' : '1080x1920'}</span>
                </div>
                <div style={{ width: spec.w * scale, height: spec.h * scale, position: 'relative', borderRadius: 8, overflow: 'visible', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
                  <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: spec.w, height: spec.h, borderRadius: 8, overflow: 'hidden' }}>
                    <AdCanvas
                      aspect={a}
                      creative={creative}
                      brandColors={brandColors}
                      brandName={brand?.name || 'Brand'}
                      brandFont={brandFont}
                      productImage={productImage}
                      selected={selected}
                      editing={editing}
                      onSelect={setSelected}
                      onLayoutChange={handleLayoutChange}
                      onTextChange={handleTextChange}
                      onStartEdit={setEditing}
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Right Pane ── */}
      <div style={{ borderLeft: '1px solid var(--border, #2a2e3a)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border, #2a2e3a)', padding: '0 14px' }}>
          {(['copy', 'style', 'export'] as const).map(t => (
            <button key={t} onClick={() => setRightTab(t)} style={{
              padding: '10px 12px', fontSize: 12, fontWeight: rightTab === t ? 700 : 500,
              color: rightTab === t ? 'var(--text-primary, #fff)' : 'var(--text-dim, #888)',
              borderBottom: rightTab === t ? '2px solid #2138ff' : '2px solid transparent',
              textTransform: 'capitalize',
            }}>{t}</button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {rightTab === 'copy' && <>
            <Button onClick={handleGenerateCopy} disabled={copyLoading} className="w-full justify-center" size="sm">
              {copyLoading ? <><LoadingSpinner size={14} /> Generating...</> : 'Generate Copy'}
            </Button>

            {/* Hook */}
            <CopyCard label="Hook" tag="H1" value={creative.headline} charLimit={40}
              onChange={v => setCreative(prev => ({ ...prev, headline: v }))}
              variants={copyVariants?.hooks} onSelectVariant={v => setCreative(prev => ({ ...prev, headline: v }))} />

            {/* Subhead */}
            <CopyCard label="Subhead" tag="H2" value={creative.subhead} charLimit={30}
              onChange={v => setCreative(prev => ({ ...prev, subhead: v }))}
              variants={copyVariants?.subheadlines} onSelectVariant={v => setCreative(prev => ({ ...prev, subhead: v }))} />

            {/* Benefits */}
            <div style={{ padding: 10, background: 'var(--elevated, #1a1e2e)', borderRadius: 8, border: '1px solid var(--border, #2a2e3a)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#888', marginBottom: 6 }}>Benefits</div>
              {creative.bullets.map((b, i) => (
                <input key={i} type="text" value={b}
                  onChange={e => { const next = [...creative.bullets]; next[i] = e.target.value; setCreative(prev => ({ ...prev, bullets: next })) }}
                  style={{ width: '100%', padding: '5px 8px', background: 'var(--bg, #111)', border: '1px solid var(--border, #2a2e3a)', borderRadius: 4, fontSize: 12, color: 'inherit', marginBottom: 4 }} />
              ))}
              <button onClick={() => setCreative(prev => ({ ...prev, bullets: [...prev.bullets, ''] }))}
                style={{ fontSize: 11, color: '#2138ff' }}>+ Add benefit</button>
            </div>

            {/* CTA */}
            <CopyCard label="CTA" tag="" value={creative.cta} charLimit={18}
              onChange={v => setCreative(prev => ({ ...prev, cta: v }))}
              variants={copyVariants?.ctas} onSelectVariant={v => setCreative(prev => ({ ...prev, cta: v }))} />

            {/* Price */}
            <div style={{ padding: 10, background: 'var(--elevated, #1a1e2e)', borderRadius: 8, border: '1px solid var(--border, #2a2e3a)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#888', marginBottom: 6 }}>Pricing</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <div style={{ fontSize: 10, color: '#666', marginBottom: 2 }}>Original</div>
                  <input type="text" value={creative.priceOld} onChange={e => setCreative(prev => ({ ...prev, priceOld: e.target.value }))}
                    style={{ width: '100%', padding: '5px 8px', background: 'var(--bg, #111)', border: '1px solid var(--border, #2a2e3a)', borderRadius: 4, fontSize: 12, color: 'inherit' }} />
                </div>
                <div>
                  <div style={{ fontSize: 10, color: '#666', marginBottom: 2 }}>Sale</div>
                  <input type="text" value={creative.priceNew} onChange={e => setCreative(prev => ({ ...prev, priceNew: e.target.value }))}
                    style={{ width: '100%', padding: '5px 8px', background: 'var(--bg, #111)', border: '1px solid var(--border, #2a2e3a)', borderRadius: 4, fontSize: 12, color: 'inherit' }} />
                </div>
              </div>
            </div>
          </>}

          {rightTab === 'style' && (
            <div style={{ fontSize: 11, color: '#888' }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Reference Locks</div>
              <div style={{ fontSize: 12, color: '#666' }}>Coming soon - toggle which elements follow the reference vs brand kit</div>
            </div>
          )}

          {rightTab === 'export' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {Object.keys(generatedImages).length === 0 && (
                <div style={{ textAlign: 'center', padding: 20 }}>
                  <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>Edit your design on the canvas, then click Export Images to render final files</div>
                  <Button onClick={handleGenerate} disabled={generating} className="w-full justify-center" size="sm">
                    {generating ? <><LoadingSpinner size={14} /> Exporting...</> : 'Export Images'}
                  </Button>
                </div>
              )}
              {Object.entries(generatedImages).map(([ar, url]) => (
                <div key={ar} style={{ padding: 10, background: 'var(--elevated, #1a1e2e)', border: '1px solid var(--border, #2a2e3a)', borderRadius: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
                    <span>{ar} {ar === '1:1' ? '1080x1080' : ar === '4:5' ? '1080x1350' : '1080x1920'}</span>
                  </div>
                  <img src={url} alt={`${ar} export`} style={{ width: '100%', borderRadius: 6, border: '1px solid var(--border, #2a2e3a)', cursor: 'pointer', marginBottom: 6 }}
                    onClick={() => setPreviewImage(url)} />
                  <button onClick={() => {
                    const link = document.createElement('a'); link.href = url
                    link.download = `${brand?.name || 'creative'}-${ar.replace(':', 'x')}-${Date.now()}.png`; link.click()
                    onToast(`${ar} downloaded`, 'success')
                  }} style={{ width: '100%', padding: '6px', background: 'var(--bg, #111)', border: '1px solid var(--border, #2a2e3a)', borderRadius: 4, fontSize: 11, color: 'inherit', textAlign: 'center' }}>
                    Download
                  </button>
                </div>
              ))}
              {Object.keys(generatedImages).length > 0 && (
                <>
                  <Button onClick={() => {
                    Object.entries(generatedImages).forEach(([ar, url]) => {
                      const link = document.createElement('a'); link.href = url
                      link.download = `${brand?.name || 'creative'}-${ar.replace(':', 'x')}-${Date.now()}.png`; link.click()
                    })
                    onToast('All formats downloaded', 'success')
                  }} className="w-full justify-center">Download All</Button>
                  <Button onClick={handleGenerate} disabled={generating} variant="secondary" className="w-full justify-center" size="sm">
                    {generating ? <><LoadingSpinner size={14} /> Re-exporting...</> : 'Re-export with Changes'}
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <ImagePreview src={previewImage || ''} open={!!previewImage} onClose={() => setPreviewImage(null)} />
    </div>
  )
}

// ── CopyCard component ──
function CopyCard({ label, tag, value, charLimit, onChange, variants, onSelectVariant }: {
  label: string; tag: string; value: string; charLimit: number
  onChange: (v: string) => void; variants?: string[]; onSelectVariant: (v: string) => void
}) {
  return (
    <div style={{ padding: 10, background: 'var(--elevated, #1a1e2e)', borderRadius: 8, border: '1px solid var(--border, #2a2e3a)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#888' }}>{label}</span>
        {tag && <span style={{ fontSize: 9, padding: '1px 5px', background: 'rgba(33,56,255,0.15)', color: '#2138ff', borderRadius: 4, fontWeight: 700 }}>{tag}</span>}
      </div>
      <input type="text" value={value} onChange={e => onChange(e.target.value)}
        style={{ width: '100%', padding: '6px 8px', background: 'var(--bg, #111)', border: '1px solid var(--border, #2a2e3a)', borderRadius: 4, fontSize: 13, fontWeight: 700, color: 'inherit' }} />
      <div style={{ fontSize: 10, color: value.length > charLimit ? '#e74c3c' : '#666', marginTop: 3 }}>
        {value.length}/{charLimit} chars
      </div>
      {variants && variants.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
          {variants.map((v, i) => (
            <button key={i} onClick={() => onSelectVariant(v)}
              style={{ padding: '3px 8px', fontSize: 10, borderRadius: 999, border: value === v ? '1px solid #2138ff' : '1px solid var(--border, #2a2e3a)',
                background: value === v ? 'rgba(33,56,255,0.1)' : 'transparent', color: value === v ? '#2138ff' : '#888' }}>
              {v}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
