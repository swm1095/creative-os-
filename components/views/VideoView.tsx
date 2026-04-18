'use client'

import { useState, useEffect } from 'react'
import { Brand } from '@/lib/types'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import { FormTextarea } from '@/components/ui/FormInput'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import PageHeader from '@/components/ui/PageHeader'

interface VideoViewProps {
  brand?: Brand | null
  brandId?: string
  onToast: (msg: string, type: 'success' | 'error' | 'info') => void
}

type VideoModel = 'seedance' | 'kling'
type VideoStyle = 'ugc' | 'cinematic' | 'animated' | 'product'

const STYLES: { id: VideoStyle; label: string; desc: string; emoji: string }[] = [
  { id: 'ugc', label: 'UGC Style', desc: 'iPhone-shot, authentic, casual', emoji: '📱' },
  { id: 'cinematic', label: 'Cinematic', desc: 'High production, smooth camera', emoji: '🎬' },
  { id: 'animated', label: 'Animated', desc: 'Motion graphics, clean transitions', emoji: '✨' },
  { id: 'product', label: 'Product Shot', desc: 'Studio lighting, slow reveal', emoji: '🎯' },
]

const MODELS: { id: VideoModel; label: string; desc: string }[] = [
  { id: 'seedance', label: 'Seedance 2.0', desc: 'Best for UGC and cinematic' },
  { id: 'kling', label: 'Kling v3', desc: 'Best for product and lifestyle' },
]

export default function VideoView({ brand, brandId, onToast }: VideoViewProps) {
  const [prompt, setPrompt] = useState('')
  const [model, setModel] = useState<VideoModel>('seedance')
  const [style, setStyle] = useState<VideoStyle>('ugc')
  const [aspectRatio, setAspectRatio] = useState('9:16')
  const [duration, setDuration] = useState(5)
  const [generating, setGenerating] = useState(false)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [error, setError] = useState('')

  // Pre-fill from HyperListening if navigated with a video prompt
  useEffect(() => {
    const savedPrompt = localStorage.getItem('hc-video-prompt')
    const savedModel = localStorage.getItem('hc-video-model')
    const savedStyle = localStorage.getItem('hc-video-style')
    if (savedPrompt) { setPrompt(savedPrompt); localStorage.removeItem('hc-video-prompt') }
    if (savedModel && (savedModel === 'seedance' || savedModel === 'kling')) { setModel(savedModel); localStorage.removeItem('hc-video-model') }
    if (savedStyle && ['ugc', 'cinematic', 'animated', 'product'].includes(savedStyle)) { setStyle(savedStyle as VideoStyle); localStorage.removeItem('hc-video-style') }
  }, [])

  const handleGenerate = async () => {
    if (!prompt.trim()) { onToast('Enter a video prompt', 'error'); return }

    setGenerating(true)
    setVideoUrl(null)
    setError('')
    onToast(`Generating ${style} video with ${model === 'seedance' ? 'Seedance 2.0' : 'Kling v3'}... This takes 1-3 minutes.`, 'info')

    try {
      const res = await fetch('/api/video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          model,
          style,
          aspectRatio,
          duration,
          brandId: brandId || brand?.id,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)

      if (data.videoUrl) {
        setVideoUrl(data.videoUrl)
        onToast('Video generated!', 'success')
      } else {
        throw new Error('No video URL returned')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
      onToast(`Video failed: ${msg}`, 'error')
    }
    setGenerating(false)
  }

  return (
    <div className="animate-fadeIn">
      <div className="grid grid-cols-[1fr_380px] gap-4">
        {/* Left - Controls */}
        <div className="space-y-4">
          {/* Model selector */}
          <Card title="Video Model">
            <div className="flex gap-3">
              {MODELS.map(m => (
                <button
                  key={m.id}
                  onClick={() => setModel(m.id)}
                  className={`flex-1 p-3 rounded-lg border text-left transition-all ${
                    model === m.id ? 'border-blue bg-blue-light' : 'border-border bg-page hover:border-text-subtle'
                  }`}
                >
                  <div className="text-sm font-bold">{m.label}</div>
                  <div className="text-2xs text-text-dim">{m.desc}</div>
                </button>
              ))}
            </div>
          </Card>

          {/* Style selector */}
          <Card title="Video Style">
            <div className="grid grid-cols-2 gap-2">
              {STYLES.map(s => (
                <button
                  key={s.id}
                  onClick={() => setStyle(s.id)}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    style === s.id ? 'border-blue bg-blue-light' : 'border-border bg-page hover:border-text-subtle'
                  }`}
                >
                  <div className="text-lg mb-1">{s.emoji}</div>
                  <div className="text-sm font-bold">{s.label}</div>
                  <div className="text-2xs text-text-dim">{s.desc}</div>
                </button>
              ))}
            </div>
          </Card>

          {/* Prompt */}
          <Card title="Video Prompt" subtitle="Describe the scene, action, and mood">
            <FormTextarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              rows={4}
              placeholder={
                style === 'ugc' ? 'Person unboxing the product at their kitchen table, natural lighting, genuine reaction...' :
                style === 'cinematic' ? 'Slow dolly shot of the product on a wooden surface, golden hour lighting, shallow depth of field...' :
                style === 'animated' ? 'Product icon transforms into a 3D render, smooth rotation, particles float around...' :
                'Close-up of the product on white surface, slow 360 rotation, studio lighting reveals texture...'
              }
            />
          </Card>

          {/* Settings */}
          <Card title="Settings">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-2xs font-bold tracking-wider uppercase text-text-muted mb-1.5">Format</label>
                <select
                  value={aspectRatio}
                  onChange={e => setAspectRatio(e.target.value)}
                  className="w-full px-3 py-2.5 bg-page border border-border rounded text-sm text-text-primary focus:border-blue focus:outline-none"
                >
                  <option value="9:16">9:16 (Stories/Reels)</option>
                  <option value="4:5">4:5 (Feed)</option>
                  <option value="1:1">1:1 (Square)</option>
                  <option value="16:9">16:9 (Landscape)</option>
                </select>
              </div>
              <div>
                <label className="block text-2xs font-bold tracking-wider uppercase text-text-muted mb-1.5">Duration</label>
                <select
                  value={duration}
                  onChange={e => setDuration(Number(e.target.value))}
                  className="w-full px-3 py-2.5 bg-page border border-border rounded text-sm text-text-primary focus:border-blue focus:outline-none"
                >
                  <option value={3}>3 seconds</option>
                  <option value={5}>5 seconds</option>
                  <option value={10}>10 seconds</option>
                </select>
              </div>
            </div>
          </Card>

          <Button onClick={handleGenerate} disabled={generating} className="w-full py-3.5 text-sm justify-center">
            {generating ? <><LoadingSpinner size={16} /> Generating Video...</> : `Generate ${style.charAt(0).toUpperCase() + style.slice(1)} Video`}
          </Button>
        </div>

        {/* Right - Preview */}
        <div className="space-y-4">
          <Card title="Video Preview">
            <div className={`aspect-[${aspectRatio.replace(':', '/')}] rounded-lg overflow-hidden bg-elevated`}>
              {generating ? (
                <div className="w-full h-full flex flex-col items-center justify-center min-h-[400px]">
                  <LoadingSpinner size={32} />
                  <div className="text-sm text-text-muted mt-4">Generating video...</div>
                  <div className="text-2xs text-text-dim mt-1">This takes 1-3 minutes</div>
                  <div className="text-2xs text-text-dim mt-1">{model === 'seedance' ? 'Seedance 2.0' : 'Kling v3'} - {style}</div>
                </div>
              ) : videoUrl ? (
                <div className="w-full min-h-[400px]">
                  <video
                    src={videoUrl}
                    controls
                    autoPlay
                    loop
                    className="w-full h-full object-contain"
                    style={{ maxHeight: '600px' }}
                  />
                </div>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center min-h-[400px] text-center p-4">
                  <div className="text-4xl mb-3">🎬</div>
                  <div className="text-sm font-bold mb-1">Video Preview</div>
                  <div className="text-xs text-text-dim">Your generated video will appear here</div>
                </div>
              )}
            </div>

            {error && (
              <div className="mt-3 p-3 bg-red-light border border-red/20 rounded-lg text-sm text-red">
                {error}
              </div>
            )}

            {videoUrl && (
              <div className="flex gap-2 mt-3">
                <Button
                  size="sm"
                  variant="secondary"
                  className="flex-1 justify-center"
                  onClick={() => {
                    const a = document.createElement('a')
                    a.href = videoUrl
                    a.download = `hypercreate-${style}-${Date.now()}.mp4`
                    a.click()
                    onToast('Downloading video...', 'success')
                  }}
                >
                  Download
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="flex-1 justify-center"
                  onClick={() => {
                    navigator.clipboard.writeText(videoUrl)
                    onToast('Video URL copied', 'success')
                  }}
                >
                  Copy URL
                </Button>
              </div>
            )}
          </Card>

          {/* Tips */}
          <Card title="Prompt Tips" subtitle="For best results">
            <ul className="space-y-1.5 list-disc list-inside text-xs text-text-dim">
              <li>Describe the scene, not the ad concept</li>
              <li>Include camera movement (slow zoom, dolly, pan)</li>
              <li>Mention lighting (natural, studio, golden hour)</li>
              <li>Specify the subject clearly</li>
              <li>Keep prompts under 200 words</li>
              <li>Seedance is better for people/UGC</li>
              <li>Kling is better for products/objects</li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  )
}
