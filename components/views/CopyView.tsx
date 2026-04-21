'use client'

import { useState, useEffect } from 'react'
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

  // Reset state when brand changes
  useEffect(() => {
    setVariants([]); setUgcScripts(null); setHeadlines([])
    setPrompt('')
    const personas = brand?.research?.personas
    if (personas?.length) setPersona(personas[0].name)
  }, [brand?.id])

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
      onToast('Generating UGC scripts with 4 hooks...', 'info')
      try {
        const insight = {
          title: prompt.trim() || `${brand?.name} product overview`,
          summary: prompt.trim() || brand?.research?.summary || `${brand?.name} - ${brand?.research?.productCategory || 'product'}`,
          painPoints: useResearchData ? (brand?.research?.painPoints?.slice(0, 3) || []) : [],
          motivators: useResearchData ? (brand?.research?.motivators?.slice(0, 3) || []) : [],
        }
        const res = await fetch('/api/ugc-script', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ brandId, insight }),
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
          body: JSON.stringify({ persona, tone, platform, prompt, brandId, contentType }),
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

            {/* Show all personas being used for UGC/Headlines */}
            {(contentType === 'ugc-script' || contentType === 'static-headlines') && (
              <div>
                <label className="text-2xs font-bold tracking-wider uppercase text-text-muted mb-1.5 block">Using All Personas</label>
                <div className="flex flex-wrap gap-1.5">
                  {brandPersonas.map((p, i) => (
                    <span key={i} className="text-2xs bg-fulton-light text-fulton px-2 py-1 rounded font-bold">P{i + 1}: {p.name}</span>
                  ))}
                </div>
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
                contentType === 'ugc-script' ? 'Generate 4 Hooks + Body Script' :
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
          <div className="space-y-4">
            <Card title="Hook Options (pick one)" subtitle="0-3 seconds">
              <div className="space-y-2">
                {ugcScripts.hooks.map((h, i) => (
                  <div key={i} className="bg-page border border-border rounded-lg p-4 hover:border-fulton/40 transition-colors">
                    <div className="flex items-start gap-3">
                      <span className="text-2xs font-bold text-fulton bg-fulton-light px-2 py-0.5 rounded shrink-0 mt-0.5">P{h.persona_number}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-2xs text-text-dim mb-1">{h.persona}</div>
                        <div className="text-sm text-text-secondary leading-relaxed italic">&quot;{h.hook}&quot;</div>
                      </div>
                      <button onClick={() => { navigator.clipboard.writeText(`${h.hook}\n\n${ugcScripts.body}\n\n${ugcScripts.cta}`); onToast(`P${h.persona_number} full script copied`, 'success') }}
                        className="text-2xs text-text-dim hover:text-text-primary shrink-0">Copy Full</button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card title="Body (shared for all hooks)" subtitle="3-20 seconds">
              <div className="text-sm text-text-secondary leading-relaxed">{ugcScripts.body}</div>
            </Card>

            <Card title="CTA">
              <div className="text-sm font-bold text-text-secondary">{ugcScripts.cta}</div>
            </Card>

            <Button variant="secondary" className="w-full justify-center" onClick={() => {
              const all = `HOOKS:\n${ugcScripts.hooks.map(h => `P${h.persona_number} (${h.persona}): "${h.hook}"`).join('\n')}\n\nBODY:\n${ugcScripts.body}\n\nCTA:\n${ugcScripts.cta}`
              navigator.clipboard.writeText(all)
              onToast('All scripts copied', 'success')
            }}>Copy All Scripts</Button>
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
            <Button variant="secondary" className="w-full justify-center" onClick={() => {
              const all = headlines.map(g => `${g.persona}:\n${g.headlines.join('\n')}`).join('\n\n')
              navigator.clipboard.writeText(all)
              onToast('All headlines copied', 'success')
            }}>Copy All Headlines</Button>
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
            <Button variant="secondary" className="w-full justify-center" onClick={() => {
              const all = variants.map((v, i) => `--- Variant ${i + 1} ---\n${v.headline}\n${v.body}\n${v.cta || ''}`).join('\n\n')
              navigator.clipboard.writeText(all)
              onToast('All variants copied', 'success')
            }}>Copy All Variants</Button>
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
