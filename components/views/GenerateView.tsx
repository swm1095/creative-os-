'use client'

import { useState } from 'react'
import { PersonaInput, GenerateResult } from '@/lib/types'
import { DEFAULT_PERSONAS } from '@/lib/constants'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import { FormTextarea } from '@/components/ui/FormInput'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

interface GenerateViewProps {
  brandId: string | undefined
  onToast: (msg: string, type: 'success' | 'error' | 'info') => void
  onGenerated?: (results: GenerateResult[]) => void
}

export default function GenerateView({ brandId, onToast, onGenerated }: GenerateViewProps) {
  const [prompt, setPrompt] = useState('Premium product lifestyle photo, Fulton house shoe with cork arch support, warm home environment, natural lighting, clean minimal composition, photorealistic, aspirational wellness aesthetic')
  const [personas] = useState<PersonaInput[]>(DEFAULT_PERSONAS)
  const [activePersonas, setActivePersonas] = useState<Set<number>>(new Set([0, 1, 2, 3]))
  const [results, setResults] = useState<GenerateResult[]>([])
  const [generating, setGenerating] = useState(false)

  const togglePersona = (idx: number) => {
    setActivePersonas(prev => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  const handleGenerate = async () => {
    if (!prompt.trim()) { onToast('Enter a base prompt first', 'error'); return }
    const selected = personas.filter((_, i) => activePersonas.has(i))
    if (!selected.length) { onToast('Select at least one persona', 'error'); return }

    // Only send first persona to conserve quota
    const toGenerate = [selected[0]]

    setGenerating(true)
    setResults([])
    onToast(`Generating ${toGenerate.length} creative${toGenerate.length > 1 ? 's' : ''} with Gemini...`, 'info')

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          concept: prompt,
          personas: toGenerate,
          aspectRatio: '1x1',
          generator: 'gemini',
          brandId: brandId || 'demo',
        }),
      })
      const data = await res.json()
      if (data.error) { onToast(`Error: ${data.error}`, 'error'); setGenerating(false); return }

      setResults(data.results || [])
      onGenerated?.(data.results || [])
      const successCount = (data.results || []).filter((r: GenerateResult) => r.imageUrl).length
      onToast(`Generation complete! ${successCount} image${successCount !== 1 ? 's' : ''} created`, 'success')
    } catch (err: unknown) {
      onToast(`Generation failed: ${err instanceof Error ? err.message : String(err)}`, 'error')
    }
    setGenerating(false)
  }

  return (
    <div className="animate-fadeIn grid grid-cols-[1fr_340px] gap-4">
      {/* Left column */}
      <div className="space-y-4">
        {/* Generator select */}
        <Card title="Image Generator" subtitle="Gemini Nano Banana 2 — text-to-image generation">
          <div className="flex gap-2">
            <div className="flex-1 px-3 py-2.5 bg-fulton-light border-2 border-fulton rounded-lg">
              <div className="text-xs font-bold text-fulton">Gemini (Nano Banana 2)</div>
              <div className="text-2xs text-text-dim">Primary — AI image generation</div>
            </div>
          </div>
        </Card>

        {/* Prompt */}
        <Card title="Base Prompt" subtitle="Shared prompt applied to all personas — each adds its own angle">
          <FormTextarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={3} />
        </Card>

        {/* Personas */}
        <Card title="Personas" subtitle="Select personas to generate for">
          <div className="grid grid-cols-2 gap-3 mb-4">
            {personas.map((p, i) => (
              <button
                key={i}
                onClick={() => togglePersona(i)}
                className={`text-left p-3 rounded-[10px] border transition-all ${
                  activePersonas.has(i)
                    ? 'border-fulton bg-fulton-light'
                    : 'border-border bg-page hover:border-text-subtle'
                }`}
              >
                <div className="text-2xs font-bold text-fulton mb-1.5">● Persona {String(i + 1).padStart(2, '0')}</div>
                <div className="mb-1"><span className="text-2xs text-text-dim uppercase tracking-wider">Audience</span><div className="text-sm font-semibold">{p.name}</div></div>
                <div className="mb-1"><span className="text-2xs text-text-dim uppercase tracking-wider">Angle</span><div className="text-sm font-semibold">{p.angle}</div></div>
                <div><span className="text-2xs text-text-dim uppercase tracking-wider">Hook</span><div className="text-sm font-semibold">{p.hook}</div></div>
              </button>
            ))}
          </div>
          <Button onClick={handleGenerate} disabled={generating} className="w-full py-3.5 text-sm justify-center">
            {generating ? <><LoadingSpinner size={16} /> Generating...</> : `▶ Generate ${activePersonas.size > 1 ? '1' : '1'} Creative`}
          </Button>
        </Card>
      </div>

      {/* Right column — Output */}
      <div className="space-y-4">
        <Card title="Pipeline Options">
          <div className="space-y-3">
            {[
              { name: 'Remove Background', desc: 'Remove.bg · transparent PNG', checked: false },
              { name: 'Render All Formats', desc: 'Creatomate · 1×1 · 4×5 · 9×16', checked: false },
              { name: 'Auto-run QC', desc: 'Claude · 3 checks after generation', checked: true },
            ].map(opt => (
              <label key={opt.name} className="flex items-center justify-between cursor-pointer">
                <div>
                  <div className="text-sm font-semibold">{opt.name}</div>
                  <div className="text-2xs text-text-dim">{opt.desc}</div>
                </div>
                <input type="checkbox" defaultChecked={opt.checked} className="w-4 h-4 accent-fulton" />
              </label>
            ))}
          </div>
        </Card>

        <Card title="Output Preview">
          <div className="grid grid-cols-2 gap-2">
            {generating ? (
              Array.from({ length: 1 }).map((_, i) => (
                <div key={i} className="aspect-square rounded-lg bg-elevated flex items-center justify-center">
                  <div className="text-center">
                    <LoadingSpinner size={24} />
                    <div className="text-2xs text-text-dim mt-2">Generating P{i + 1}...</div>
                  </div>
                </div>
              ))
            ) : results.length > 0 ? (
              results.map((r, i) => (
                <div key={i} className="aspect-square rounded-lg overflow-hidden relative bg-elevated">
                  {r.imageUrl ? (
                    <img src={r.imageUrl} alt={`P${i + 1}`} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-2xs text-red p-2 text-center">
                      {r.error || 'Failed'}
                    </div>
                  )}
                  <span className="absolute top-1.5 left-1.5 bg-black/60 text-white text-2xs font-bold px-1.5 py-0.5 rounded">P{i + 1}</span>
                </div>
              ))
            ) : (
              <div className="col-span-2 aspect-video rounded-lg bg-elevated flex items-center justify-center">
                <div className="text-center text-text-dim">
                  <div className="text-2xl mb-2">🖼</div>
                  <div className="text-xs">Generated images will appear here</div>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
