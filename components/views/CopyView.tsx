'use client'

import { useState, useEffect } from 'react'
import { CopyVariant, Brand } from '@/lib/types'
import { DEFAULT_PERSONAS, PLATFORMS, TONES } from '@/lib/constants'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import { FormTextarea } from '@/components/ui/FormInput'
import LoadingSpinner, { LoadingState } from '@/components/ui/LoadingSpinner'
import EmptyState from '@/components/ui/EmptyState'

interface CopyViewProps {
  brandId?: string
  brand?: Brand | null
  onToast: (msg: string, type: 'success' | 'error' | 'info') => void
  onBrandUpdate?: (brandId: string, updates: Partial<Brand>) => void
}

const CONTENT_TYPES = [
  { id: 'ad-copy', label: 'Ad Copy', desc: 'Headlines, body, CTA for paid ads' },
  { id: 'ugc-script', label: 'UGC Script', desc: 'Genuine, friend-recommending-a-product style' },
  { id: 'static-headlines', label: 'Static Headlines', desc: 'Outcome-driven, pain-point specific' },
]

export default function CopyView({ brandId, brand, onToast, onBrandUpdate }: CopyViewProps) {
  const [contentType, setContentType] = useState('ad-copy')

  // Use personas from brand research if available
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

  // Reset state when brand changes
  useEffect(() => {
    setVariants([])
    setPrompt('')
    const personas = brand?.research?.personas
    if (personas?.length) setPersona(personas[0].name)
  }, [brand?.id])

  // Pre-fill from insight if navigated from HyperListening
  useEffect(() => {
    const draft = typeof window !== 'undefined' ? localStorage.getItem('hc-brief-draft') : null
    if (draft) {
      setPrompt(draft)
      localStorage.removeItem('hc-brief-draft')
      onToast('Brief pre-filled from saved insight', 'info')
    }
  }, [])
  const [variants, setVariants] = useState<CopyVariant[]>([])
  const [generating, setGenerating] = useState(false)

  const activeType = CONTENT_TYPES.find(t => t.id === contentType)

  const handleGenerate = async () => {
    if (!prompt.trim()) { onToast('Enter a brief first', 'error'); return }
    setGenerating(true)
    setVariants([])
    onToast(`Generating ${activeType?.label || 'copy'} with Claude...`, 'info')

    try {
      const res = await fetch('/api/copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          persona,
          tone,
          platform,
          prompt: `Content type: ${activeType?.label || 'Ad Copy'}. ${activeType?.desc || ''}.\n\n${prompt}`,
          brandId,
          contentType,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setVariants(data.variants || [])
      onToast(`${data.variants?.length || 0} variants generated`, 'success')
    } catch (err: unknown) {
      onToast(`Copy failed: ${err instanceof Error ? err.message : String(err)}`, 'error')
    }
    setGenerating(false)
  }

  const getVariantLabel = () => {
    switch (contentType) {
      case 'ugc-script': return 'Script'
      case 'static-headlines': return 'Headline Set'
      case 'video-script': return 'Scene'
      case 'email': return 'Email'
      default: return 'Variant'
    }
  }

  if (!brand) {
    return <EmptyState emoji="📋" title="Select a brand" subtitle="Choose a client from the sidebar to start generating copy" />
  }

  if (!hasPersonas) {
    return (
      <EmptyState
        emoji="👥"
        title="No personas found"
        subtitle="Run brand research first to create target personas, or add them manually in the Brand Kit"
      />
    )
  }

  return (
    <div className="animate-fadeIn grid grid-cols-[1fr_1fr] gap-4">
      {/* Left */}
      <div className="space-y-4">
        {/* Content type selector */}
        <Card title="Content Type" subtitle="What kind of copy do you need?">
          <div className="flex flex-wrap gap-2">
            {CONTENT_TYPES.map(type => (
              <button
                key={type.id}
                onClick={() => setContentType(type.id)}
                className={`px-3 py-2 rounded-lg border text-left transition-all ${
                  contentType === type.id
                    ? 'border-fulton bg-fulton-light'
                    : 'border-border bg-page hover:border-text-subtle'
                }`}
              >
                <div className="text-xs font-bold">{type.label}</div>
                <div className="text-2xs text-text-dim">{type.desc}</div>
              </button>
            ))}
          </div>
        </Card>

        <Card title={`${activeType?.label || 'Copy'} Studio`} subtitle={`Claude generates ${activeType?.desc?.toLowerCase() || 'copy'} tailored to your persona and platform`}>
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-2xs font-bold tracking-wider uppercase text-text-muted">Persona</label>
                <button
                  onClick={() => setShowAddPersona(!showAddPersona)}
                  className="text-2xs font-bold text-fulton hover:underline"
                >
                  {showAddPersona ? 'Cancel' : '+ Add Persona'}
                </button>
              </div>
              {showAddPersona ? (
                <div className="space-y-2 mb-2">
                  <input
                    type="text"
                    placeholder="Persona name (e.g. Runners, 25-40)"
                    value={newPersonaName}
                    onChange={e => setNewPersonaName(e.target.value)}
                    className="w-full px-3 py-2.5 bg-page border border-border rounded text-sm text-text-primary focus:border-fulton focus:outline-none"
                  />
                  <input
                    type="text"
                    placeholder="Hook or angle (e.g. Recovery between runs)"
                    value={newPersonaHook}
                    onChange={e => setNewPersonaHook(e.target.value)}
                    className="w-full px-3 py-2.5 bg-page border border-border rounded text-sm text-text-primary focus:border-fulton focus:outline-none"
                  />
                  <Button
                    size="sm"
                    className="w-full justify-center"
                    disabled={!newPersonaName.trim() || !brandId}
                    onClick={async () => {
                      if (!brandId || !brand?.research) { onToast('Brand research required', 'error'); return }
                      const newPersona = {
                        name: newPersonaName,
                        age: '',
                        description: newPersonaHook,
                        painPoints: [],
                        motivators: [],
                        channels: [],
                        hook: newPersonaHook,
                      }
                      const updatedResearch = {
                        ...brand.research,
                        personas: [...(brand.research.personas || []), newPersona],
                      }
                      try {
                        await fetch('/api/brands', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ id: brandId, research: updatedResearch }),
                        })
                        if (onBrandUpdate) onBrandUpdate(brandId, { research: updatedResearch })
                        setPersona(newPersonaName)
                        setNewPersonaName('')
                        setNewPersonaHook('')
                        setShowAddPersona(false)
                        onToast(`Persona "${newPersonaName}" added to brand`, 'success')
                      } catch (err: unknown) {
                        onToast(`Failed: ${err instanceof Error ? err.message : String(err)}`, 'error')
                      }
                    }}
                  >
                    Save Persona
                  </Button>
                </div>
              ) : (
                <select
                  value={persona}
                  onChange={e => setPersona(e.target.value)}
                  className="w-full px-3 py-2.5 bg-page border border-border rounded text-sm text-text-primary focus:border-fulton focus:outline-none"
                >
                  {brandPersonas.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                </select>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-2xs font-bold tracking-wider uppercase text-text-muted mb-1.5">Tone</label>
                <select
                  value={tone}
                  onChange={e => setTone(e.target.value)}
                  className="w-full px-3 py-2.5 bg-page border border-border rounded text-sm text-text-primary focus:border-fulton focus:outline-none"
                >
                  {TONES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-2xs font-bold tracking-wider uppercase text-text-muted mb-1.5">Platform</label>
                <select
                  value={platform}
                  onChange={e => setPlatform(e.target.value)}
                  className="w-full px-3 py-2.5 bg-page border border-border rounded text-sm text-text-primary focus:border-fulton focus:outline-none"
                >
                  {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>

            <FormTextarea
              label="Brief"
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              rows={4}
              placeholder="Describe what you want the copy to accomplish..."
            />

            <Button onClick={handleGenerate} disabled={generating} className="w-full justify-center py-3">
              {generating ? <><LoadingSpinner size={16} /> Generating...</> : `Generate 4 ${activeType?.label || 'Copy'} Variants`}
            </Button>
          </div>
        </Card>
      </div>

      {/* Right */}
      <div className="space-y-3">
        {generating ? (
          <LoadingState size="md" title={`Claude is writing your ${activeType?.label?.toLowerCase() || 'copy'}...`} />
        ) : variants.length > 0 ? (
          variants.map((v, i) => (
            <Card key={i} className="hover:border-fulton/30 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xs font-bold text-fulton uppercase tracking-wider">{getVariantLabel()} {i + 1}</span>
                <button
                  onClick={() => { navigator.clipboard.writeText(`${v.headline}\n${v.body}\n${v.cta}`); onToast('Copied to clipboard', 'success') }}
                  className="text-2xs text-text-dim hover:text-text-primary transition-colors"
                >
                  Copy
                </button>
              </div>
              <div className="text-lg font-black tracking-tight mb-1.5">{v.headline}</div>
              <div className="text-sm text-text-secondary leading-relaxed mb-2">{v.body}</div>
              {v.cta && <div className="inline-block px-3 py-1.5 bg-fulton text-white text-xs font-bold rounded">{v.cta}</div>}
            </Card>
          ))
        ) : (
          <EmptyState
            emoji="✍️"
            title={`${activeType?.label || 'Copy'} Variants`}
            subtitle="Generated content will appear here"
          />
        )}
        {variants.length > 0 && !generating && (
          <Button
            variant="secondary"
            className="w-full justify-center"
            onClick={() => {
              const all = variants.map((v, i) => `--- ${getVariantLabel()} ${i + 1} ---\n${v.headline}\n${v.body}\n${v.cta || ''}`).join('\n\n')
              navigator.clipboard.writeText(all)
              onToast('All variants copied to clipboard', 'success')
            }}
          >
            Copy All Variants
          </Button>
        )}
      </div>
    </div>
  )
}
