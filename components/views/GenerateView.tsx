'use client'

import { useState, useRef, useEffect } from 'react'
import { PersonaInput, GenerateResult } from '@/lib/types'
import { DEFAULT_PERSONAS } from '@/lib/constants'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import { FormTextarea } from '@/components/ui/FormInput'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import ImagePreview from '@/components/ui/ImagePreview'

interface GenerateViewProps {
  brandId: string | undefined
  onToast: (msg: string, type: 'success' | 'error' | 'info') => void
  onGenerated?: (results: GenerateResult[]) => void
  droppedFiles?: File[]
  onDroppedFilesConsumed?: () => void
}

export default function GenerateView({ brandId, onToast, onGenerated, droppedFiles, onDroppedFilesConsumed }: GenerateViewProps) {
  const [prompt, setPrompt] = useState('Premium product lifestyle photo, Fulton house shoe with cork arch support, warm home environment, natural lighting, clean minimal composition, photorealistic, aspirational wellness aesthetic')
  const [personas] = useState<PersonaInput[]>(DEFAULT_PERSONAS)
  const [activePersonas, setActivePersonas] = useState<Set<number>>(new Set([0, 1, 2, 3]))
  const [results, setResults] = useState<GenerateResult[]>([])
  const [generating, setGenerating] = useState(false)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [referenceImage, setReferenceImage] = useState<File | null>(null)
  const [referencePreview, setReferencePreview] = useState<string | null>(null)
  const refInputRef = useRef<HTMLInputElement>(null)

  // Handle files dropped from global drag-and-drop
  useEffect(() => {
    if (droppedFiles?.length) {
      const imageFile = droppedFiles.find(f => f.type.startsWith('image/'))
      if (imageFile) {
        setReferenceImage(imageFile)
        const reader = new FileReader()
        reader.onload = ev => setReferencePreview(ev.target?.result as string)
        reader.readAsDataURL(imageFile)
        onToast('Dropped image set as reference', 'success')
      }
      onDroppedFilesConsumed?.()
    }
  }, [droppedFiles])

  const togglePersona = (idx: number) => {
    setActivePersonas(prev => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  const handleReferenceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setReferenceImage(file)
    const reader = new FileReader()
    reader.onload = ev => setReferencePreview(ev.target?.result as string)
    reader.readAsDataURL(file)
    onToast('Reference image uploaded - it will guide the generation style', 'success')
  }

  const handleGenerate = async () => {
    if (!prompt.trim()) { onToast('Enter a base prompt first', 'error'); return }
    const selected = personas.filter((_, i) => activePersonas.has(i))
    if (!selected.length) { onToast('Select at least one persona', 'error'); return }

    const toGenerate = [selected[0]]

    setGenerating(true)
    setResults([])
    onToast(`Generating creative with Gemini...`, 'info')

    try {
      const enrichedPrompt = referenceImage
        ? `${prompt}\n\nUse the reference image as style and composition inspiration. Match its visual tone, lighting, and layout while adapting for the brand and persona.`
        : prompt

      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          concept: enrichedPrompt,
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
        <Card title="Image Generator" subtitle="Gemini Nano Banana 2 - text-to-image generation">
          <div className="flex gap-2">
            <div className="flex-1 px-3 py-2.5 bg-fulton-light border-2 border-fulton rounded-lg">
              <div className="text-xs font-bold text-fulton">Gemini (Nano Banana 2)</div>
              <div className="text-2xs text-text-dim">Primary - AI image generation</div>
            </div>
          </div>
        </Card>

        {/* Reference image upload */}
        <Card title="Reference Image" subtitle="Upload an image to recreate or use as style inspiration (optional)">
          <input ref={refInputRef} type="file" accept="image/*" className="hidden" onChange={handleReferenceUpload} />
          {referencePreview ? (
            <div className="flex items-center gap-3">
              <img
                src={referencePreview}
                alt="Reference"
                className="w-20 h-20 object-cover rounded-lg border border-border cursor-pointer"
                onClick={() => setPreviewImage(referencePreview)}
              />
              <div className="flex-1">
                <div className="text-sm font-semibold">{referenceImage?.name}</div>
                <div className="text-2xs text-text-dim">{referenceImage ? `${(referenceImage.size / 1024).toFixed(0)} KB` : ''}</div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => { setReferenceImage(null); setReferencePreview(null) }}>Remove</Button>
            </div>
          ) : (
            <button
              onClick={() => refInputRef.current?.click()}
              className="w-full p-4 border-2 border-dashed border-border rounded-lg text-center hover:border-fulton/40 transition-colors"
            >
              <div className="text-xl mb-1">📷</div>
              <div className="text-xs font-semibold text-text-muted">Click to upload reference image</div>
              <div className="text-2xs text-text-dim mt-0.5">Gemini will match its style and composition</div>
            </button>
          )}
        </Card>

        <Card title="Base Prompt" subtitle="Shared prompt applied to all personas - each adds its own angle">
          <FormTextarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={3} />
        </Card>

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
                <div className="text-2xs font-bold text-fulton mb-1.5">Persona {String(i + 1).padStart(2, '0')}</div>
                <div className="mb-1"><span className="text-2xs text-text-dim uppercase tracking-wider">Audience</span><div className="text-sm font-semibold">{p.name}</div></div>
                <div className="mb-1"><span className="text-2xs text-text-dim uppercase tracking-wider">Angle</span><div className="text-sm font-semibold">{p.angle}</div></div>
                <div><span className="text-2xs text-text-dim uppercase tracking-wider">Hook</span><div className="text-sm font-semibold">{p.hook}</div></div>
              </button>
            ))}
          </div>
          <Button onClick={handleGenerate} disabled={generating} className="w-full py-3.5 text-sm justify-center">
            {generating ? <><LoadingSpinner size={16} /> Generating...</> : 'Generate 1 Creative'}
          </Button>
        </Card>
      </div>

      {/* Right column */}
      <div className="space-y-4">
        <Card title="Pipeline Options">
          <div className="space-y-3">
            {[
              { name: 'Remove Background', desc: 'Remove.bg - transparent PNG', checked: false },
              { name: 'Render All Formats', desc: 'Creatomate - 1x1, 4x5, 9x16', checked: false },
              { name: 'Auto-run QC', desc: 'Claude - 3 checks after generation', checked: true },
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
              <div className="col-span-2 aspect-square rounded-lg bg-elevated flex items-center justify-center">
                <div className="text-center">
                  <LoadingSpinner size={24} />
                  <div className="text-2xs text-text-dim mt-2">Generating...</div>
                </div>
              </div>
            ) : results.length > 0 ? (
              results.map((r, i) => (
                <div
                  key={i}
                  className="aspect-square rounded-lg overflow-hidden relative bg-elevated cursor-pointer hover:ring-2 hover:ring-fulton transition-all"
                  onClick={() => r.imageUrl && setPreviewImage(r.imageUrl)}
                >
                  {r.imageUrl ? (
                    <>
                      <img src={r.imageUrl} alt={`P${i + 1}`} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/0 hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 hover:opacity-100">
                        <span className="text-white text-xs font-bold bg-black/50 px-2 py-1 rounded">Click to preview</span>
                      </div>
                    </>
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
                  <div className="text-2xs mt-1">Click to preview full size</div>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>

      <ImagePreview src={previewImage || ''} open={!!previewImage} onClose={() => setPreviewImage(null)} />
    </div>
  )
}
