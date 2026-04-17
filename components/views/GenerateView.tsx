'use client'

import { useState, useRef, useEffect } from 'react'
import { PersonaInput, GenerateResult, Brand } from '@/lib/types'
import { DEFAULT_PERSONAS } from '@/lib/constants'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import { FormTextarea } from '@/components/ui/FormInput'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import ImagePreview from '@/components/ui/ImagePreview'

interface GenerateViewProps {
  brandId: string | undefined
  brand?: Brand | null
  onToast: (msg: string, type: 'success' | 'error' | 'info') => void
  onGenerated?: (results: GenerateResult[]) => void
  droppedFiles?: File[]
  onDroppedFilesConsumed?: () => void
}

export default function GenerateView({ brandId, brand, onToast, onGenerated, droppedFiles, onDroppedFilesConsumed }: GenerateViewProps) {
  const [prompt, setPrompt] = useState('Premium product lifestyle photo, warm home environment, natural lighting, clean minimal composition, photorealistic, aspirational wellness aesthetic')

  // Use personas from brand research if available, otherwise default
  const researchPersonas: PersonaInput[] = brand?.research?.personas?.map(p => ({
    name: p.name,
    angle: p.description || p.painPoints?.[0] || '',
    hook: p.hook,
  })) || DEFAULT_PERSONAS
  const [personas] = useState<PersonaInput[]>(researchPersonas)
  const [activePersonas, setActivePersonas] = useState<Set<number>>(new Set([0, 1, 2, 3]))
  const [results, setResults] = useState<GenerateResult[]>([])
  const [generating, setGenerating] = useState(false)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [referenceImage, setReferenceImage] = useState<File | null>(null)
  const [referencePreview, setReferencePreview] = useState<string | null>(null)
  const [productImagePreviews, setProductImagePreviews] = useState<string[]>([])
  const [feedback, setFeedback] = useState('')
  const [generationHistory, setGenerationHistory] = useState<string[]>([])
  const refInputRef = useRef<HTMLInputElement>(null)
  const productInputRef = useRef<HTMLInputElement>(null)
  const refLibInputRef = useRef<HTMLInputElement>(null)
  const [refLibImages, setRefLibImages] = useState<{ name: string; url: string }[]>([])
  const [refLibLoading, setRefLibLoading] = useState(false)

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

  // Load reference library from Supabase
  useEffect(() => {
    if (!brandId) return
    setRefLibLoading(true)
    fetch(`/api/reference-images?brandId=${brandId}`)
      .then(res => res.json())
      .then(data => { if (data.images) setRefLibImages(data.images) })
      .catch(() => {})
      .finally(() => setRefLibLoading(false))
  }, [brandId])

  const handleRefLibUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (!files.length || !brandId) return
    const formData = new FormData()
    formData.append('brandId', brandId)
    files.forEach(f => formData.append('files', f))
    try {
      const res = await fetch('/api/reference-images', { method: 'POST', body: formData })
      const data = await res.json()
      if (data.uploaded) {
        setRefLibImages(prev => [...data.uploaded, ...prev])
        onToast(`${data.count} reference image${data.count > 1 ? 's' : ''} uploaded to library`, 'success')
      }
    } catch { onToast('Upload failed', 'error') }
  }

  // Pre-fill prompt from insight if navigated from HyperListening
  useEffect(() => {
    const draft = typeof window !== 'undefined' ? localStorage.getItem('hc-brief-draft') : null
    if (draft) {
      setPrompt(draft)
      localStorage.removeItem('hc-brief-draft')
      onToast('Prompt pre-filled from saved insight', 'info')
    }
  }, [])

  // Compress an image to max 1024px and return base64
  const compressImage = (dataUrl: string, maxSize: number = 1024): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let { width, height } = img
        if (width > maxSize || height > maxSize) {
          const ratio = Math.min(maxSize / width, maxSize / height)
          width = Math.round(width * ratio)
          height = Math.round(height * ratio)
        }
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx?.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', 0.85))
      }
      img.src = dataUrl
    })
  }

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

  const handleGenerate = async (withFeedback?: string) => {
    if (!prompt.trim()) { onToast('Enter a base prompt first', 'error'); return }
    const selected = personas.filter((_, i) => activePersonas.has(i))
    if (!selected.length) { onToast('Select at least one persona', 'error'); return }

    const toGenerate = [selected[0]]

    setGenerating(true)
    setResults([])

    const feedbackText = withFeedback || ''
    if (feedbackText) {
      onToast('Regenerating with your feedback...', 'info')
    } else {
      onToast('Generating creative with Gemini...', 'info')
    }

    try {
      // Use the last generated image as reference if regenerating with feedback
      let compressedRef: string | undefined
      if (feedbackText && generationHistory.length > 0) {
        // Use the last output as the new reference
        compressedRef = await compressImage(generationHistory[generationHistory.length - 1])
      } else if (referencePreview) {
        compressedRef = await compressImage(referencePreview)
      }

      let compressedProducts: string[] | undefined
      if (productImagePreviews.length) {
        compressedProducts = await Promise.all(productImagePreviews.map(img => compressImage(img)))
      }

      // Build the concept with feedback appended
      const fullConcept = feedbackText
        ? `${prompt}\n\nFEEDBACK ON PREVIOUS VERSION - APPLY THESE CHANGES:\n${feedbackText}`
        : prompt

      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          concept: fullConcept,
          personas: toGenerate,
          aspectRatio: '1x1',
          generator: 'gemini',
          brandId: brandId || 'demo',
          referenceImage: compressedRef,
          productImages: compressedProducts,
        }),
      })
      const data = await res.json()
      if (data.error) { onToast(`Error: ${data.error}`, 'error'); setGenerating(false); return }

      setResults(data.results || [])
      onGenerated?.(data.results || [])

      // Store in history for feedback iterations
      const successImages = (data.results || []).filter((r: GenerateResult) => r.imageUrl).map((r: GenerateResult) => r.imageUrl)
      if (successImages.length) {
        setGenerationHistory(prev => [...prev, ...successImages])
        setFeedback('') // clear feedback after successful regeneration
      }

      const successCount = successImages.length
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

        {/* Reference Image Library (shared, persisted) */}
        <Card title="Reference Library" subtitle="Shared ad references - click any to use as reference">
          <input ref={refLibInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleRefLibUpload} />
          <div className="flex flex-wrap gap-2 mb-2">
            {refLibImages.map((img, i) => (
              <div
                key={i}
                className={`w-16 h-16 rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${
                  referencePreview === img.url ? 'border-blue ring-2 ring-blue/30' : 'border-border hover:border-blue/40'
                }`}
                onClick={() => { setReferencePreview(img.url); setReferenceImage(null) }}
              >
                <img src={img.url} alt="" className="w-full h-full object-cover" />
              </div>
            ))}
            <button
              onClick={() => refLibInputRef.current?.click()}
              className="w-16 h-16 rounded-lg border-2 border-dashed border-border flex items-center justify-center hover:border-blue/40 transition-colors cursor-pointer"
            >
              <span className="text-sm">+</span>
            </button>
          </div>
          {refLibLoading && <div className="text-2xs text-text-dim">Loading library...</div>}
        </Card>

        {/* Product images */}
        <Card title="Product Images" subtitle="Upload product photos to feature in the generated creative (optional)">
          <input
            ref={productInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files || [])
              files.forEach(file => {
                const reader = new FileReader()
                reader.onload = (ev) => {
                  setProductImagePreviews(prev => [...prev, ev.target?.result as string])
                }
                reader.readAsDataURL(file)
              })
              if (files.length) onToast(`${files.length} product image${files.length > 1 ? 's' : ''} added`, 'success')
            }}
          />
          <div className="flex gap-2 flex-wrap">
            {productImagePreviews.map((src, i) => (
              <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border border-border group">
                <img src={src} alt="" className="w-full h-full object-cover" />
                <button
                  onClick={() => setProductImagePreviews(prev => prev.filter((_, idx) => idx !== i))}
                  className="absolute top-0.5 right-0.5 w-4 h-4 bg-black/60 text-white text-2xs rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                >
                  x
                </button>
              </div>
            ))}
            <button
              onClick={() => productInputRef.current?.click()}
              className="w-16 h-16 rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center hover:border-fulton/40 transition-colors cursor-pointer"
            >
              <span className="text-sm">+</span>
              <span className="text-2xs text-text-dim">Add</span>
            </button>
          </div>
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
          <Button onClick={() => handleGenerate()} disabled={generating} className="w-full py-3.5 text-sm justify-center">
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
              <div className="col-span-2 aspect-[9/16] rounded-lg bg-elevated flex items-center justify-center">
                <div className="text-center">
                  <LoadingSpinner size={24} />
                  <div className="text-2xs text-text-dim mt-2">Generating...</div>
                </div>
              </div>
            ) : results.length > 0 ? (
              results.map((r, i) => (
                <div
                  key={i}
                  className="col-span-2 aspect-[9/16] rounded-lg overflow-hidden relative bg-elevated cursor-pointer hover:ring-2 hover:ring-fulton transition-all"
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

        {/* Feedback - appears after generation */}
        {results.length > 0 && results.some(r => r.imageUrl) && !generating && (
          <Card title="Feedback" subtitle="Tell Gemini what to change">
            <textarea
              value={feedback}
              onChange={e => setFeedback(e.target.value)}
              placeholder="e.g. Make the background lighter, zoom in on the product, use warmer tones, add more space around the shoe..."
              className="w-full px-3 py-2.5 text-sm text-text-primary bg-page border border-border rounded focus:border-fulton focus:outline-none transition-colors resize-y min-h-[60px] mb-3"
              rows={2}
            />
            <Button
              onClick={() => handleGenerate(feedback)}
              disabled={!feedback.trim() || generating}
              className="w-full justify-center"
            >
              Regenerate with Feedback
            </Button>
            {generationHistory.length > 1 && (
              <div className="text-2xs text-text-dim mt-2 text-center">
                Iteration {generationHistory.length} - previous output used as reference
              </div>
            )}
          </Card>
        )}
      </div>

      <ImagePreview src={previewImage || ''} open={!!previewImage} onClose={() => setPreviewImage(null)} />
    </div>
  )
}
