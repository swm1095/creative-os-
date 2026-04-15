'use client'

import { useState } from 'react'
import { CopyVariant } from '@/lib/types'
import { DEFAULT_PERSONAS, PLATFORMS, TONES } from '@/lib/constants'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import { FormTextarea } from '@/components/ui/FormInput'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

interface CopyViewProps {
  brandContext?: string
  onToast: (msg: string, type: 'success' | 'error' | 'info') => void
}

export default function CopyView({ brandContext, onToast }: CopyViewProps) {
  const [persona, setPersona] = useState(DEFAULT_PERSONAS[0].name)
  const [tone, setTone] = useState('Empathetic')
  const [platform, setPlatform] = useState(PLATFORMS[0])
  const [prompt, setPrompt] = useState('Write ad copy for a premium cork arch-support house shoe that solves foot pain. Focus on the cost savings vs physical therapy angle.')
  const [variants, setVariants] = useState<CopyVariant[]>([])
  const [generating, setGenerating] = useState(false)

  const handleGenerate = async () => {
    if (!prompt.trim()) { onToast('Enter a brief first', 'error'); return }
    setGenerating(true)
    setVariants([])
    onToast('Generating ad copy with Claude...', 'info')

    try {
      const res = await fetch('/api/copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ persona, tone, platform, prompt, brandContext }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setVariants(data.variants || [])
      onToast(`${data.variants?.length || 0} copy variants generated`, 'success')
    } catch (err: unknown) {
      onToast(`Copy failed: ${err instanceof Error ? err.message : String(err)}`, 'error')
    }
    setGenerating(false)
  }

  return (
    <div className="animate-fadeIn grid grid-cols-[1fr_1fr] gap-4">
      {/* Left — Input */}
      <div className="space-y-4">
        <Card title="Copy Studio" subtitle="Claude generates ad copy tailored to your persona and platform">
          <div className="space-y-3">
            <div>
              <label className="block text-2xs font-bold tracking-wider uppercase text-text-muted mb-1.5">Persona</label>
              <select
                value={persona}
                onChange={e => setPersona(e.target.value)}
                className="w-full px-3 py-2.5 bg-page border border-border rounded text-sm text-text-primary focus:border-fulton focus:outline-none"
              >
                {DEFAULT_PERSONAS.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
              </select>
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
              {generating ? <><LoadingSpinner size={16} /> Generating...</> : '✍️ Generate 4 Copy Variants'}
            </Button>
          </div>
        </Card>
      </div>

      {/* Right — Results */}
      <div className="space-y-3">
        {generating ? (
          <Card>
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <LoadingSpinner size={28} />
                <div className="text-xs text-text-dim mt-3">Claude is writing your copy...</div>
              </div>
            </div>
          </Card>
        ) : variants.length > 0 ? (
          variants.map((v, i) => (
            <Card key={i} className="hover:border-fulton/30 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xs font-bold text-fulton uppercase tracking-wider">Variant {i + 1}</span>
                <button
                  onClick={() => { navigator.clipboard.writeText(`${v.headline}\n${v.body}\n${v.cta}`); onToast('Copied to clipboard', 'success') }}
                  className="text-2xs text-text-dim hover:text-text-primary transition-colors"
                >
                  Copy ↗
                </button>
              </div>
              <div className="text-lg font-black tracking-tight mb-1.5">{v.headline}</div>
              <div className="text-sm text-text-secondary leading-relaxed mb-2">{v.body}</div>
              <div className="inline-block px-3 py-1.5 bg-fulton text-white text-xs font-bold rounded">{v.cta}</div>
            </Card>
          ))
        ) : (
          <Card>
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="text-3xl mb-3">✍️</div>
              <div className="text-sm font-bold mb-1">Copy Variants</div>
              <div className="text-xs text-text-dim">Generated copy will appear here</div>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
