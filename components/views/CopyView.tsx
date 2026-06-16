'use client'

import { useState, useEffect, useRef } from 'react'
import { CopyVariant, Brand } from '@/lib/types'
import { DEFAULT_PERSONAS, PLATFORMS, TONES } from '@/lib/constants'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import { FormTextarea } from '@/components/ui/FormInput'
import LoadingSpinner, { LoadingState } from '@/components/ui/LoadingSpinner'
import EmptyState from '@/components/ui/EmptyState'
import Modal from '@/components/ui/Modal'

interface CopyViewProps {
  brandId?: string
  brand?: Brand | null
  onToast: (msg: string, type: 'success' | 'error' | 'info') => void
  onBrandUpdate?: (brandId: string, updates: Partial<Brand>) => void
}

const CONTENT_TYPES = [
  { id: 'ugc-script', label: 'UGC Script', desc: '4 hooks (one per persona) + 1 shared body script + CTA', emoji: '🎬' },
  { id: 'static-headlines', label: 'Static Headlines', desc: 'Headlines per persona for paid social ads', emoji: '📝' },
  { id: 'ad-copy', label: 'Ad Copy', desc: 'Full ad variants with headline, body, and CTA', emoji: '✍️' },
]

interface UGCScript {
  hooks: { persona: string; persona_number: number; hook: string }[]
  body: string
  cta: string
}

export default function CopyView({ brandId, brand, onToast, onBrandUpdate }: CopyViewProps) {
  const [contentType, setContentType] = useState('ugc-script')

  const hasPersonas = brand?.research?.personas && brand.research.personas.length > 0
  const brandPersonas = hasPersonas
    ? brand!.research!.personas!.map(p => ({ name: p.name, angle: p.description || '', hook: p.hook || '' }))
    : DEFAULT_PERSONAS

  const [persona, setPersona] = useState(brandPersonas[0]?.name || '')
  const [activePersonas, setActivePersonas] = useState<Set<number>>(new Set(brandPersonas.map((_, i) => i)))
  const [showAddPersona, setShowAddPersona] = useState(false)
  const [newPersonaName, setNewPersonaName] = useState('')
  const [newPersonaHook, setNewPersonaHook] = useState('')
  const [tone, setTone] = useState('Empathetic')
  const [platform, setPlatform] = useState(PLATFORMS[0])
  const [prompt, setPrompt] = useState('')
  const [useResearchData, setUseResearchData] = useState(true)
  const [generating, setGenerating] = useState(false)

  // Ad copy variants
  const [variants, setVariants] = useState<CopyVariant[]>([])

  // UGC script
  const [ugcScripts, setUgcScripts] = useState<UGCScript | null>(null)

  // Static headlines
  const [headlines, setHeadlines] = useState<{ persona: string; headlines: string[] }[]>([])

  // Feedback thread
  const [copyFeedback, setCopyFeedback] = useState('')
  const [refining, setRefining] = useState(false)
  const [feedbackHistory, setFeedbackHistory] = useState<{ role: 'user' | 'ai'; text: string }[]>([])
  const feedbackRef = useRef<HTMLInputElement>(null)

  // Products
  interface ProductProfile { id: string; name: string; url: string; price: string; description: string; features: string[]; usps: string[]; targetUseCase: string }
  const products: ProductProfile[] = (brand as Brand & { products?: ProductProfile[] })?.products || []
  const [selectedProduct, setSelectedProduct] = useState<string>('all')

  // Reset state when brand changes
  useEffect(() => {
    setVariants([]); setUgcScripts(null); setHeadlines([])
    setPrompt(''); setSelectedProduct('all')
    const personas = brand?.research?.personas
    if (personas?.length) { setPersona(personas[0].name); setActivePersonas(new Set(personas.map((_, i) => i))) }
  }, [brand?.id])

  const handleRefine = async () => {
    if (!copyFeedback.trim() || !brandId) return
    const feedback = copyFeedback.trim()
    setFeedbackHistory(prev => [...prev, { role: 'user', text: feedback }])
    setCopyFeedback('')
    setRefining(true)

    if (contentType === 'ugc-script' && ugcScripts) {
      const currentScript = `HOOKS:\n${ugcScripts.hooks.map(h => `P${h.persona_number}: "${h.hook}"`).join('\n')}\n\nBODY:\n${ugcScripts.body}\n\nCTA:\n${ugcScripts.cta}`
      try {
        const res = await fetch('/api/ugc-script', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ brandId, insight: { title: 'Refine script', summary: `REFINE THIS SCRIPT:\n${currentScript}\n\nFEEDBACK: ${feedback}\n\nKeep same structure, apply feedback.` } }) })
        const data = await res.json()
        if (data.error) throw new Error(data.error)
        setUgcScripts(data)
        setFeedbackHistory(prev => [...prev, { role: 'ai', text: 'Script updated with your feedback' }])
      } catch (err: unknown) { onToast(`Refine failed: ${err instanceof Error ? err.message : String(err)}`, 'error') }
    } else if (contentType === 'ad-copy' && variants.length > 0) {
      const current = variants.map((v, i) => `Variant ${i + 1}: ${v.headline} | ${v.body} | ${v.cta}`).join('\n')
      try {
        const res = await fetch('/api/copy', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ persona, tone, platform, brandId, contentType,
            prompt: `REFINE THESE EXISTING VARIANTS:\n${current}\n\nFEEDBACK: ${feedback}\n\nApply the feedback to improve all variants. Keep the same structure.` }) })
        const data = await res.json()
        if (data.error) throw new Error(data.error)
        setVariants(data.variants || [])
        setFeedbackHistory(prev => [...prev, { role: 'ai', text: 'Ad copy updated with your feedback' }])
      } catch (err: unknown) { onToast(`Refine failed: ${err instanceof Error ? err.message : String(err)}`, 'error') }
    } else if (contentType === 'static-headlines' && headlines.length > 0) {
      const current = headlines.map(g => `${g.persona}: ${g.headlines.join(', ')}`).join('\n')
      try {
        const res = await fetch('/api/design', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'generate-copy', brandName: brand?.name, brandResearch: brand?.research,
            persona: brandPersonas.map(p => p.name).join(', '),
            angle: `REFINE THESE HEADLINES:\n${current}\n\nFEEDBACK: ${feedback}`, referenceAnalysis: null }) })
        const data = await res.json()
        if (data.error) throw new Error(data.error)
        const allHeadlines = [...(data.copy?.hooks || []), ...(data.copy?.subheadlines || [])]
        const perPersona = brandPersonas.map((p, i) => ({
          persona: p.name, headlines: allHeadlines.slice(i * 2, i * 2 + 3).length > 0 ? allHeadlines.slice(i * 2, i * 2 + 3) : [allHeadlines[i % allHeadlines.length] || ''],
        }))
        setHeadlines(perPersona)
        setFeedbackHistory(prev => [...prev, { role: 'ai', text: 'Headlines updated with your feedback' }])
      } catch (err: unknown) { onToast(`Refine failed: ${err instanceof Error ? err.message : String(err)}`, 'error') }
    }
    setRefining(false)
    setTimeout(() => feedbackRef.current?.focus(), 100)
  }

  // Pre-fill from HyperListening
  useEffect(() => {
    const draft = typeof window !== 'undefined' ? localStorage.getItem('hc-brief-draft') : null
    if (draft) { setPrompt(draft); localStorage.removeItem('hc-brief-draft'); onToast('Brief pre-filled from saved insight', 'info') }
  }, [])

  const handleGenerate = async () => {
    setGenerating(true)

    if (contentType === 'ugc-script') {
      // Use the ugc-script API (same as HyperListening)
      setUgcScripts(null)
      const activeProduct = products.find(p => p.id === selectedProduct)
      const productContext = activeProduct
        ? `Product: ${activeProduct.name}. ${activeProduct.description}. Features: ${activeProduct.features.join(', ')}. USPs: ${activeProduct.usps.join(', ')}. Price: ${activeProduct.price}. Target: ${activeProduct.targetUseCase}`
        : ''
      onToast(`Generating UGC scripts${activeProduct ? ` for ${activeProduct.name}` : ''}...`, 'info')
      try {
        const insight = {
          title: prompt.trim() || (activeProduct ? activeProduct.name : `${brand?.name} product overview`),
          summary: prompt.trim() || productContext || brand?.research?.summary || `${brand?.name} - ${brand?.research?.productCategory || 'product'}`,
          painPoints: useResearchData ? (brand?.research?.painPoints?.slice(0, 3) || []) : [],
          motivators: useResearchData ? (brand?.research?.motivators?.slice(0, 3) || []) : [],
        }
        const res = await fetch('/api/ugc-script', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ brandId, insight, productContext, selectedPersonaIndices: [...activePersonas] }),
        })
        const data = await res.json()
        if (data.error) throw new Error(data.error)
        setUgcScripts(data)
        onToast(`${data.hooks?.length || 0} hooks + shared body generated`, 'success')
      } catch (err: unknown) {
        onToast(`UGC script failed: ${err instanceof Error ? err.message : String(err)}`, 'error')
      }
    } else if (contentType === 'static-headlines') {
      // Generate headlines per persona
      setHeadlines([])
      onToast('Generating headlines per persona...', 'info')
      try {
        const res = await fetch('/api/design', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'generate-copy',
            brandName: brand?.name || 'Brand',
            brandResearch: brand?.research || null,
            persona: brandPersonas.map(p => p.name).join(', '),
            angle: prompt.trim() || 'Problem/Solution',
            referenceAnalysis: null,
          }),
        })
        const data = await res.json()
        if (data.error) throw new Error(data.error)
        // Map hooks and subheadlines to personas
        const allHeadlines = [...(data.copy?.hooks || []), ...(data.copy?.subheadlines || [])]
        const perPersona = brandPersonas.map((p, i) => ({
          persona: p.name,
          headlines: allHeadlines.slice(i * 2, i * 2 + 3).length > 0
            ? allHeadlines.slice(i * 2, i * 2 + 3)
            : [allHeadlines[i % allHeadlines.length] || 'No headline generated'],
        }))
        setHeadlines(perPersona)
        onToast('Headlines generated per persona', 'success')
      } catch (err: unknown) {
        onToast(`Headlines failed: ${err instanceof Error ? err.message : String(err)}`, 'error')
      }
    } else {
      // Ad copy variants
      if (!prompt.trim()) { onToast('Enter a brief first', 'error'); setGenerating(false); return }
      setVariants([])
      onToast('Generating ad copy variants...', 'info')
      try {
        const res = await fetch('/api/copy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ persona, tone, platform, prompt: selectedProduct !== 'all' ? `${prompt}\n\nPRODUCT CONTEXT: ${products.find(p => p.id === selectedProduct)?.name}: ${products.find(p => p.id === selectedProduct)?.description}. Features: ${products.find(p => p.id === selectedProduct)?.features.join(', ')}` : prompt, brandId, contentType }),
        })
        const data = await res.json()
        if (data.error) throw new Error(data.error)
        setVariants(data.variants || [])
        onToast(`${data.variants?.length || 0} variants generated`, 'success')
      } catch (err: unknown) {
        onToast(`Copy failed: ${err instanceof Error ? err.message : String(err)}`, 'error')
      }
    }
    setGenerating(false)
  }

  if (!brand) {
    return <EmptyState emoji="📋" title="Select a brand" subtitle="Choose a client from the sidebar to start generating copy" />
  }

  if (!hasPersonas) {
    return <EmptyState emoji="👥" title="No personas found" subtitle="Run brand research first to create target personas, or add them manually in the Brand Kit" />
  }

  return (
    <div className="animate-fadeIn grid grid-cols-[1fr_1fr] gap-4">
      {/* Left */}
      <div className="space-y-4">
        {/* Content type selector */}
        <Card title="Content Type" subtitle="What kind of copy do you need?">
          <div className="space-y-2">
            {CONTENT_TYPES.map(type => (
              <button
                key={type.id}
                onClick={() => { setContentType(type.id); setVariants([]); setUgcScripts(null); setHeadlines([]) }}
                className={`w-full px-3 py-3 rounded-lg border text-left transition-all flex items-center gap-3 ${
                  contentType === type.id ? 'border-fulton bg-fulton-light' : 'border-border bg-page hover:border-text-subtle'
                }`}
              >
                <span className="text-lg">{type.emoji}</span>
                <div>
                  <div className="text-sm font-bold">{type.label}</div>
                  <div className="text-2xs text-text-dim">{type.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </Card>

        <Card title="Settings">
          <div className="space-y-3">
            {/* Persona - only for ad copy (UGC uses all personas automatically) */}
            {contentType === 'ad-copy' && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-2xs font-bold tracking-wider uppercase text-text-muted">Persona</label>
                  <button onClick={() => setShowAddPersona(!showAddPersona)} className="text-2xs font-bold text-fulton hover:underline">
                    {showAddPersona ? 'Cancel' : '+ Add Persona'}
                  </button>
                </div>
                {showAddPersona ? (
                  <div className="space-y-2 mb-2">
                    <input type="text" placeholder="Persona name" value={newPersonaName} onChange={e => setNewPersonaName(e.target.value)}
                      className="w-full px-3 py-2.5 bg-page border border-border rounded text-sm text-text-primary focus:border-fulton focus:outline-none" />
                    <input type="text" placeholder="Hook or angle" value={newPersonaHook} onChange={e => setNewPersonaHook(e.target.value)}
                      className="w-full px-3 py-2.5 bg-page border border-border rounded text-sm text-text-primary focus:border-fulton focus:outline-none" />
                    <Button size="sm" className="w-full justify-center" disabled={!newPersonaName.trim() || !brandId}
                      onClick={async () => {
                        if (!brandId || !brand?.research) return
                        const savedName = newPersonaName
                        const newP = { name: newPersonaName, age: '', description: newPersonaHook, painPoints: [], motivators: [], channels: [], hook: newPersonaHook }
                        const updated = { ...brand.research, personas: [...(brand.research.personas || []), newP] }
                        try {
                          await fetch('/api/brands', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: brandId, research: updated }) })
                          if (onBrandUpdate) onBrandUpdate(brandId, { research: updated })
                          setPersona(savedName); setNewPersonaName(''); setNewPersonaHook(''); setShowAddPersona(false)
                          onToast(`Persona "${savedName}" added`, 'success')
                        } catch (err: unknown) { onToast(`Failed: ${err instanceof Error ? err.message : String(err)}`, 'error') }
                      }}>Save Persona</Button>
                  </div>
                ) : (
                  <select value={persona} onChange={e => setPersona(e.target.value)}
                    className="w-full px-3 py-2.5 bg-page border border-border rounded text-sm text-text-primary focus:border-fulton focus:outline-none">
                    {brandPersonas.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                  </select>
                )}
              </div>
            )}

            {/* Persona selector for UGC/Headlines - click to toggle */}
            {(contentType === 'ugc-script' || contentType === 'static-headlines') && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-2xs font-bold tracking-wider uppercase text-text-muted">Select Personas</label>
                  <button onClick={() => {
                    if (activePersonas.size === brandPersonas.length) setActivePersonas(new Set())
                    else setActivePersonas(new Set(brandPersonas.map((_, i) => i)))
                  }} className="text-2xs text-fulton hover:underline">
                    {activePersonas.size === brandPersonas.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {brandPersonas.map((p, i) => (
                    <button key={i} onClick={() => {
                      const next = new Set(activePersonas)
                      if (next.has(i)) next.delete(i); else next.add(i)
                      if (next.size === 0) { onToast('Select at least one persona', 'error'); return }
                      setActivePersonas(next)
                    }} className={`text-2xs px-2 py-1 rounded font-bold transition-all ${
                      activePersonas.has(i) ? 'bg-fulton-light text-fulton border border-fulton/30' : 'bg-elevated text-text-dim border border-border line-through'
                    }`}>
                      P{i + 1}: {p.name}
                    </button>
                  ))}
                </div>
                <div className="text-2xs text-text-dim mt-1">{activePersonas.size} of {brandPersonas.length} selected - click to toggle</div>
              </div>
            )}

            {/* Product selector */}
            {products.length > 0 && (
              <div>
                <label className="block text-2xs font-bold tracking-wider uppercase text-text-muted mb-1.5">Product</label>
                <select value={selectedProduct} onChange={e => setSelectedProduct(e.target.value)}
                  className="w-full px-3 py-2.5 bg-page border border-border rounded text-sm text-text-primary focus:border-fulton focus:outline-none">
                  <option value="all">All Products (Brand-wide)</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}{p.price ? ` - ${p.price}` : ''}</option>)}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-2xs font-bold tracking-wider uppercase text-text-muted mb-1.5">Tone</label>
                <select value={tone} onChange={e => setTone(e.target.value)}
                  className="w-full px-3 py-2.5 bg-page border border-border rounded text-sm text-text-primary focus:border-fulton focus:outline-none">
                  {TONES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-2xs font-bold tracking-wider uppercase text-text-muted mb-1.5">Platform</label>
                <select value={platform} onChange={e => setPlatform(e.target.value)}
                  className="w-full px-3 py-2.5 bg-page border border-border rounded text-sm text-text-primary focus:border-fulton focus:outline-none">
                  {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>

            {/* Use research data toggle */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold">Use brand research + social listening</div>
                <div className="text-2xs text-text-dim">Pull pain points, motivators, and signals into generation</div>
              </div>
              <button onClick={() => setUseResearchData(!useResearchData)}
                className={`relative w-10 h-5 rounded-full transition-colors ${useResearchData ? 'bg-fulton' : 'bg-border'}`}>
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${useResearchData ? 'left-5' : 'left-0.5'}`} />
              </button>
            </div>

            <FormTextarea
              label={contentType === 'ugc-script' ? 'Brief (optional - leave empty to auto-generate from research)' :
                     contentType === 'static-headlines' ? 'Angle (optional - e.g. Problem/Solution, Social Proof)' :
                     'Brief'}
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              rows={3}
              placeholder={contentType === 'ugc-script' ? 'Leave empty to generate from brand research and social listening data...' :
                          contentType === 'static-headlines' ? 'Optional: describe the angle or campaign theme...' :
                          'Describe what you want the copy to accomplish...'}
            />

            <Button onClick={handleGenerate} disabled={generating} className="w-full justify-center py-3">
              {generating ? <><LoadingSpinner size={16} /> Generating...</> :
                contentType === 'ugc-script' ? `Generate ${activePersonas.size} Hook${activePersonas.size !== 1 ? 's' : ''} + Body Script` :
                contentType === 'static-headlines' ? 'Generate Headlines Per Persona' :
                'Generate 4 Ad Copy Variants'}
            </Button>
          </div>
        </Card>
      </div>

      {/* Right - Output */}
      <div className="space-y-3">
        {generating && (
          <LoadingState size="md" title={
            contentType === 'ugc-script' ? 'Generating UGC scripts with 4 persona hooks...' :
            contentType === 'static-headlines' ? 'Generating headlines per persona...' :
            'Claude is writing your ad copy...'
          } />
        )}

        {/* UGC Script Output */}
        {contentType === 'ugc-script' && ugcScripts && !generating && (
          <div className="space-y-3">
            {ugcScripts.hooks.map((h, i) => (
              <Card key={i}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xs font-bold text-fulton bg-fulton-light px-2 py-0.5 rounded">P{h.persona_number}</span>
                    <span className="text-2xs text-text-dim">{h.persona}</span>
                  </div>
                  <button onClick={() => { navigator.clipboard.writeText(h.hook); onToast('Hook copied', 'success') }}
                    className="text-2xs text-blue hover:underline">Copy Hook</button>
                </div>
                <textarea value={h.hook} onChange={e => {
                  const updated = { ...ugcScripts, hooks: ugcScripts.hooks.map((hk, idx) => idx === i ? { ...hk, hook: e.target.value } : hk) }
                  setUgcScripts(updated)
                }} className="w-full text-sm text-text-secondary leading-relaxed italic bg-page border border-border rounded p-3 focus:border-fulton focus:outline-none resize-y min-h-[50px] mb-2" rows={2} />
                <div className="bg-elevated rounded-lg p-3">
                  <div className="text-2xs text-text-dim mb-1.5">Refine this hook with AI</div>
                  <RefineInput text={h.hook} onRefined={refined => {
                    const updated = { ...ugcScripts, hooks: ugcScripts.hooks.map((hk, idx) => idx === i ? { ...hk, hook: refined } : hk) }
                    setUgcScripts(updated)
                  }} onToast={onToast} />
                </div>
              </Card>
            ))}

            <Card>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-text-muted uppercase tracking-wider">Body + CTA</span>
                <button onClick={() => { navigator.clipboard.writeText(`${ugcScripts.body}${ugcScripts.cta ? `\n\n${ugcScripts.cta}` : ''}`); onToast('Body copied', 'success') }}
                  className="text-2xs text-blue hover:underline">Copy Body</button>
              </div>
              <textarea value={`${ugcScripts.body}${ugcScripts.cta ? `\n\n${ugcScripts.cta}` : ''}`}
                onChange={e => setUgcScripts({ ...ugcScripts, body: e.target.value, cta: '' })}
                className="w-full text-sm text-text-secondary leading-relaxed bg-page border border-border rounded p-3 focus:border-fulton focus:outline-none resize-y min-h-[100px] mb-2" rows={5} />
              <div className="bg-elevated rounded-lg p-3">
                <div className="text-2xs text-text-dim mb-1.5">Refine body with AI</div>
                <RefineInput text={`${ugcScripts.body}${ugcScripts.cta ? `\n\n${ugcScripts.cta}` : ''}`}
                  onRefined={refined => setUgcScripts({ ...ugcScripts, body: refined, cta: '' })} onToast={onToast} />
              </div>
            </Card>

            <div className="flex gap-2">
              <Button className="flex-1 justify-center" onClick={async () => {
                if (!brandId) return
                const fullScript = `HOOKS:\n${ugcScripts.hooks.map(h => `P${h.persona_number} (${h.persona}): "${h.hook}"`).join('\n')}\n\nBODY:\n${ugcScripts.body}${ugcScripts.cta ? `\n\n${ugcScripts.cta}` : ''}`
                try { await fetch('/api/insights', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ brandId, title: 'UGC Script', detail: fullScript, insight_type: 'ugc-script', priority: 'high' }) })
                  onToast('Script saved', 'success')
                } catch { onToast('Save failed', 'error') }
              }}>Save to Brand</Button>
              <Button variant="secondary" className="flex-1 justify-center" onClick={() => {
                const all = `HOOKS:\n${ugcScripts.hooks.map(h => `P${h.persona_number} (${h.persona}): "${h.hook}"`).join('\n')}\n\nBODY:\n${ugcScripts.body}${ugcScripts.cta ? `\n\n${ugcScripts.cta}` : ''}`
                navigator.clipboard.writeText(all); onToast('All copied', 'success')
              }}>Copy All</Button>
            </div>
          </div>
        )}

        {/* Static Headlines Output */}
        {contentType === 'static-headlines' && headlines.length > 0 && !generating && (
          <div className="space-y-3">
            {headlines.map((group, i) => (
              <Card key={i}>
                <div className="text-2xs font-bold text-fulton uppercase tracking-wider mb-2">P{i + 1}: {group.persona}</div>
                <div className="space-y-2">
                  {group.headlines.map((h, j) => (
                    <div key={j} className="flex items-center justify-between gap-2 bg-page border border-border rounded p-3">
                      <div className="text-sm font-bold text-text-primary">{h}</div>
                      <button onClick={() => { navigator.clipboard.writeText(h); onToast('Headline copied', 'success') }}
                        className="text-2xs text-text-dim hover:text-text-primary shrink-0">Copy</button>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
            <div className="flex gap-2">
              <Button className="flex-1 justify-center" onClick={async () => {
                if (!brandId) return
                const all = headlines.map(g => `${g.persona}:\n${g.headlines.join('\n')}`).join('\n\n')
                try {
                  await fetch('/api/insights', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ brandId, title: 'Static Headlines', detail: all, insight_type: 'headlines', priority: 'medium' }) })
                  onToast('Headlines saved to Insights', 'success')
                } catch { onToast('Save failed', 'error') }
              }}>Save to Brand</Button>
              <Button variant="secondary" className="flex-1 justify-center" onClick={() => {
                const all = headlines.map(g => `${g.persona}:\n${g.headlines.join('\n')}`).join('\n\n')
                navigator.clipboard.writeText(all)
                onToast('All headlines copied', 'success')
              }}>Copy All</Button>
            </div>
            <div className="pt-3 border-t border-border">
              <div className="flex gap-2">
                <input type="text" value={copyFeedback} onChange={e => setCopyFeedback(e.target.value)}
                  placeholder="Refine: e.g. punchier, different angle, more urgency..."
                  className="flex-1 px-3 py-2 bg-page border border-border rounded text-sm text-text-primary focus:border-fulton focus:outline-none"
                  onKeyDown={e => { if (e.key === 'Enter' && copyFeedback.trim()) { handleRefine() } }} />
                <Button size="sm" disabled={!copyFeedback.trim() || refining} onClick={handleRefine}>
                  {refining ? <><LoadingSpinner size={14} /> Refining...</> : 'Refine'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Ad Copy Output */}
        {contentType === 'ad-copy' && variants.length > 0 && !generating && (
          <div className="space-y-3">
            {variants.map((v, i) => (
              <Card key={i} className="hover:border-fulton/30 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xs font-bold text-fulton uppercase tracking-wider">Variant {i + 1}</span>
                  <button onClick={() => { navigator.clipboard.writeText(`${v.headline}\n${v.body}\n${v.cta}`); onToast('Copied', 'success') }}
                    className="text-2xs text-text-dim hover:text-text-primary transition-colors">Copy</button>
                </div>
                <div className="text-lg font-black tracking-tight mb-1.5">{v.headline}</div>
                <div className="text-sm text-text-secondary leading-relaxed mb-2">{v.body}</div>
                {v.cta && <div className="inline-block px-3 py-1.5 bg-fulton text-white text-xs font-bold rounded">{v.cta}</div>}
              </Card>
            ))}
            <div className="flex gap-2">
              <Button className="flex-1 justify-center" onClick={async () => {
                if (!brandId) return
                const all = variants.map((v, i) => `--- Variant ${i + 1} ---\n${v.headline}\n${v.body}\n${v.cta || ''}`).join('\n\n')
                try {
                  await fetch('/api/insights', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ brandId, title: 'Ad Copy Variants', detail: all, insight_type: 'ad-copy', priority: 'medium' }) })
                  onToast('Ad copy saved to Insights', 'success')
                } catch { onToast('Save failed', 'error') }
              }}>Save to Brand</Button>
              <Button variant="secondary" className="flex-1 justify-center" onClick={() => {
                const all = variants.map((v, i) => `--- Variant ${i + 1} ---\n${v.headline}\n${v.body}\n${v.cta || ''}`).join('\n\n')
                navigator.clipboard.writeText(all)
                onToast('All variants copied', 'success')
              }}>Copy All</Button>
            </div>
            <div className="pt-3 border-t border-border">
              <div className="flex gap-2">
                <input type="text" value={copyFeedback} onChange={e => setCopyFeedback(e.target.value)}
                  placeholder="Refine: e.g. different tone, shorter, more direct..."
                  className="flex-1 px-3 py-2 bg-page border border-border rounded text-sm text-text-primary focus:border-fulton focus:outline-none"
                  onKeyDown={e => { if (e.key === 'Enter' && copyFeedback.trim()) { handleRefine() } }} />
                <Button size="sm" disabled={!copyFeedback.trim() || refining} onClick={handleRefine}>
                  {refining ? <><LoadingSpinner size={14} /> Refining...</> : 'Refine'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Empty states */}
        {!generating && contentType === 'ugc-script' && !ugcScripts && (
          <EmptyState emoji="🎬" title="UGC Scripts" subtitle="4 hooks (one per persona) + 1 shared body will appear here" />
        )}
        {!generating && contentType === 'static-headlines' && headlines.length === 0 && (
          <EmptyState emoji="📝" title="Static Headlines" subtitle="Headlines per persona will appear here" />
        )}
        {!generating && contentType === 'ad-copy' && variants.length === 0 && (
          <EmptyState emoji="✍️" title="Ad Copy Variants" subtitle="Generated ad copy will appear here" />
        )}
      </div>
    </div>
  )
}

// Reusable refine input component
function RefineInput({ text, onRefined, onToast }: { text: string; onRefined: (refined: string) => void; onToast: (msg: string, type: 'success' | 'error' | 'info') => void }) {
  const [feedback, setFeedback] = useState('')
  const [loading, setLoading] = useState(false)

  const handleRefine = async () => {
    if (!feedback.trim()) return
    setLoading(true)
    try {
      const res = await fetch('/api/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, feedback: feedback.trim() }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      if (data.refined) {
        onRefined(data.refined)
        setFeedback('')
        onToast('Refined', 'success')
      }
    } catch (err: unknown) { onToast(`Refine failed: ${err instanceof Error ? err.message : String(err)}`, 'error') }
    setLoading(false)
  }

  return (
    <div className="flex gap-2">
      <input type="text" value={feedback} onChange={e => setFeedback(e.target.value)}
        placeholder="Tell Claude what to change..."
        className="flex-1 px-3 py-2 bg-page border border-border rounded text-xs text-text-primary focus:border-fulton focus:outline-none"
        onKeyDown={e => { if (e.key === 'Enter') handleRefine() }}
        disabled={loading} />
      <Button size="sm" onClick={handleRefine} disabled={!feedback.trim() || loading}>
        {loading ? <LoadingSpinner size={12} /> : '→'}
      </Button>
    </div>
  )
}
