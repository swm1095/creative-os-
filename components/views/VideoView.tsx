'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Brand } from '@/lib/types'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import { FormTextarea } from '@/components/ui/FormInput'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

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
  const [mode, setMode] = useState<'text-to-video' | 'image-to-video'>('text-to-video')
  const [creatorImageUrl, setCreatorImageUrl] = useState('')
  const [creatorImagePreview, setCreatorImagePreview] = useState<string | null>(null)
  const creatorImageRef = useRef<HTMLInputElement>(null)
  const [pollStatus, setPollStatus] = useState<string>('')
  const [elapsedTime, setElapsedTime] = useState(0)
  const [estimatedTotal, setEstimatedTotal] = useState(0)
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const cancelledRef = useRef(false)

  // Product images
  const [productImagePreviews, setProductImagePreviews] = useState<string[]>([])
  const [productImageUrls, setProductImageUrls] = useState<string[]>([])
  const productInputRef = useRef<HTMLInputElement>(null)

  // Reference video
  const [refVideoPreview, setRefVideoPreview] = useState<string | null>(null)
  const [refVideoUrl, setRefVideoUrl] = useState<string | null>(null)
  const refVideoInputRef = useRef<HTMLInputElement>(null)

  // Feedback chat
  const [feedback, setFeedback] = useState('')
  const [generationCount, setGenerationCount] = useState(0)

  // Video analysis
  const [analyzing, setAnalyzing] = useState(false)

  // Product name + phonetic
  const [productName, setProductName] = useState('')
  const [productPhonetic, setProductPhonetic] = useState('')

  // Voice (ElevenLabs)
  const [voiceEnabled, setVoiceEnabled] = useState(false)
  const [voiceScript, setVoiceScript] = useState('')
  const [selectedVoice, setSelectedVoice] = useState('')
  const [voices, setVoices] = useState<{ voice_id: string; name: string; category: string }[]>([])
  const [voiceLoading, setVoiceLoading] = useState(false)
  const [voicePreviewUrl, setVoicePreviewUrl] = useState<string | null>(null)
  const [voicePreviewing, setVoicePreviewing] = useState(false)
  const voiceAudioRef = useRef<HTMLAudioElement | null>(null)
  const [voiceStability, setVoiceStability] = useState(0.05)
  const [voiceSimilarity, setVoiceSimilarity] = useState(0.75)
  const [voiceStyle, setVoiceStyle] = useState(0.75)
  const [voiceSpeed, setVoiceSpeed] = useState(1.0)

  // Pre-fill from HyperListening if navigated with a video prompt
  useEffect(() => {
    const savedPrompt = localStorage.getItem('hc-video-prompt')
    const savedModel = localStorage.getItem('hc-video-model')
    const savedStyle = localStorage.getItem('hc-video-style')
    if (savedPrompt) { setPrompt(savedPrompt); localStorage.removeItem('hc-video-prompt') }
    if (savedModel && (savedModel === 'seedance' || savedModel === 'kling')) { setModel(savedModel); localStorage.removeItem('hc-video-model') }
    if (savedStyle && ['ugc', 'cinematic', 'animated', 'product'].includes(savedStyle)) { setStyle(savedStyle as VideoStyle); localStorage.removeItem('hc-video-style') }
  }, [])

  // Load ElevenLabs voices when voice is enabled
  useEffect(() => {
    if (!voiceEnabled || voices.length > 0) return
    fetch('/api/voice?action=voices')
      .then(r => r.json())
      .then(data => {
        if (data.voices) {
          setVoices(data.voices)
          if (data.voices.length > 0) setSelectedVoice(data.voices[0].voice_id)
        }
      })
      .catch(() => onToast('Could not load voices - check ElevenLabs API key', 'error'))
  }, [voiceEnabled, voices.length, onToast])

  const handleCreatorImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setCreatorImagePreview(ev.target?.result as string)
    reader.readAsDataURL(file)
    const formData = new FormData()
    formData.append('brandId', brandId || 'shared')
    formData.append('files', file)
    fetch('/api/reference-images', { method: 'POST', body: formData })
      .then(r => r.json())
      .then(data => {
        if (data.uploaded?.[0]?.url) {
          setCreatorImageUrl(data.uploaded[0].url)
          onToast('Creator photo uploaded', 'success')
        }
      })
      .catch(() => onToast('Upload failed', 'error'))
  }

  const handleProductImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    files.forEach(file => {
      const reader = new FileReader()
      reader.onload = (ev) => setProductImagePreviews(prev => [...prev, ev.target?.result as string])
      reader.readAsDataURL(file)
      // Upload for public URL
      const formData = new FormData()
      formData.append('brandId', brandId || 'shared')
      formData.append('files', file)
      fetch('/api/reference-images', { method: 'POST', body: formData })
        .then(r => r.json())
        .then(data => {
          if (data.uploaded?.[0]?.url) {
            setProductImageUrls(prev => [...prev, data.uploaded[0].url])
          }
        })
        .catch(() => {})
    })
    if (files.length) onToast(`${files.length} product image${files.length > 1 ? 's' : ''} added`, 'success')
  }

  const handleRefVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    // Show local preview immediately
    setRefVideoPreview(URL.createObjectURL(file))
    onToast('Uploading reference video...', 'info')

    try {
      // Get signed URL for direct upload (bypasses Vercel 4.5MB limit)
      const signedRes = await fetch(`/api/reference-images?action=signedUrl&brandId=${brandId || 'shared'}&fileName=${encodeURIComponent(file.name)}&contentType=${encodeURIComponent(file.type)}`)
      const signedData = await signedRes.json()
      if (signedData.error) throw new Error(signedData.error)

      // Upload directly to Supabase storage
      const uploadRes = await fetch(signedData.signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      })
      if (!uploadRes.ok) throw new Error(`Upload failed: ${uploadRes.status}`)

      setRefVideoUrl(signedData.publicUrl)
      onToast('Reference video uploaded', 'success')
    } catch (err) {
      onToast(`Video upload failed: ${err instanceof Error ? err.message : String(err)}`, 'error')
      setRefVideoPreview(null)
    }
  }

  const handleAnalyzeVideo = async () => {
    if (!refVideoUrl) { onToast('Upload a reference video first', 'error'); return }
    setAnalyzing(true)
    onToast('Analyzing reference video with Gemini...', 'info')
    try {
      const res = await fetch('/api/video-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoUrl: refVideoUrl,
          style,
          model,
          brandName: brand?.name || '',
          brandResearch: brand?.research || null,
          productName: productName || brand?.name || '',
          productPhonetic,
          productImageUrls: productImageUrls.length > 0 ? productImageUrls : undefined,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      if (data.prompt) {
        setPrompt(data.prompt)
        onToast('Prompt generated from reference video', 'success')
      }
    } catch (err: unknown) {
      onToast(`Analysis failed: ${err instanceof Error ? err.message : String(err)}`, 'error')
    }
    setAnalyzing(false)
  }

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) { clearInterval(pollIntervalRef.current); pollIntervalRef.current = null }
    if (timerIntervalRef.current) { clearInterval(timerIntervalRef.current); timerIntervalRef.current = null }
  }, [])

  const handleCancel = useCallback(() => {
    cancelledRef.current = true
    stopPolling()
    setGenerating(false)
    setPollStatus('')
    setElapsedTime(0)
    onToast('Video generation cancelled', 'info')
  }, [stopPolling, onToast])

  useEffect(() => () => stopPolling(), [stopPolling])

  // Generate voice audio and upload to Supabase for lip sync
  const generateVoiceForSync = async (): Promise<string | null> => {
    if (!voiceScript.trim() || !selectedVoice) return null
    const scriptText = productPhonetic && productName
      ? voiceScript.replace(new RegExp(productName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), productPhonetic)
      : voiceScript
    const res = await fetch('/api/voice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: scriptText,
        voiceId: selectedVoice,
        stability: voiceStability,
        similarityBoost: voiceSimilarity,
        style: voiceStyle,
        upload: true,
        brandId: brandId || brand?.id || 'shared',
      }),
    })
    const data = await res.json()
    if (data.error) throw new Error(`Voice: ${data.error}`)
    return data.publicAudioUrl || null
  }

  // Run lip sync: merge video + audio
  const runLipSync = async (vidUrl: string, audioPublicUrl: string): Promise<string> => {
    setPollStatus('Syncing lips to audio...')

    const res = await fetch('/api/lipsync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        videoUrl: vidUrl,
        audioUrl: audioPublicUrl,
        brandId: brandId || brand?.id,
        async: true,
      }),
    })
    const data = await res.json()
    if (data.error) throw new Error(`Lip sync: ${data.error}`)

    const lsResponseUrl = data.responseUrl
    if (!lsResponseUrl) throw new Error('No lip sync response URL')

    // Poll for lip sync completion
    return new Promise((resolve, reject) => {
      const lsPoll = setInterval(async () => {
        if (cancelledRef.current) { clearInterval(lsPoll); reject(new Error('Cancelled')); return }
        try {
          const pollRes = await fetch(`/api/lipsync?responseUrl=${encodeURIComponent(lsResponseUrl)}`)
          const pollData = await pollRes.json()
          if (pollData.status === 'complete' && pollData.videoUrl) {
            clearInterval(lsPoll)
            resolve(pollData.videoUrl)
          } else if (pollData.status === 'processing') {
            setPollStatus(pollData.queuePosition ? `Lip sync (queue ${pollData.queuePosition})...` : 'Syncing lips to audio...')
          }
        } catch { /* retry */ }
      }, 5000)
    })
  }

  const handleGenerate = async (feedbackText?: string) => {
    const effectivePrompt = feedbackText
      ? `${prompt}\n\nFEEDBACK ON PREVIOUS VERSION - APPLY THESE CHANGES:\n${feedbackText}`
      : prompt

    if (!effectivePrompt.trim()) { onToast('Enter a video prompt', 'error'); return }
    if (mode === 'image-to-video' && !creatorImageUrl && !creatorImagePreview) {
      onToast('Upload a creator photo first', 'error'); return
    }

    const useVoice = voiceEnabled && voiceScript.trim() && selectedVoice

    cancelledRef.current = false
    setGenerating(true)
    setVideoUrl(null)
    setError('')
    setElapsedTime(0)
    setPollStatus('Submitting job...')

    // Estimate: video time + voice (~5s) + lip sync (~60s) if voice enabled
    const estTotal = (60 + duration * 15) + (useVoice ? 70 : 0)
    setEstimatedTotal(estTotal)

    const startTime = Date.now()
    timerIntervalRef.current = setInterval(() => setElapsedTime(Math.floor((Date.now() - startTime) / 1000)), 1000)

    const isImageMode = mode === 'image-to-video' && creatorImageUrl

    let fullPrompt = effectivePrompt
    if (productImageUrls.length > 0) {
      fullPrompt += `\n\nProduct reference images provided - ensure the product shown matches these references exactly.`
    }
    if (refVideoUrl) {
      fullPrompt += `\n\nReference video style provided - match the production quality, camera work, and aesthetic of the reference.`
    }

    onToast(useVoice
      ? `Generating video + voiceover + lip sync pipeline...`
      : isImageMode
        ? 'Animating creator photo with Seedance 2.0...'
        : `Generating ${style} video with ${model === 'seedance' ? 'Seedance 2.0' : 'Kling v3'}...`, 'info')

    try {
      // Step 1: Submit video job
      const videoRes = await fetch('/api/video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: fullPrompt,
          model: isImageMode ? 'seedance' : model,
          style,
          aspectRatio,
          duration,
          brandId: brandId || brand?.id,
          imageUrl: isImageMode ? creatorImageUrl : (productImageUrls[0] || undefined),
          async: true,
        }),
      })
      const videoData = await videoRes.json()
      if (videoData.error) throw new Error(videoData.error)
      if (cancelledRef.current) return

      const responseUrl = videoData.responseUrl
      if (!responseUrl) throw new Error('No response URL returned')

      // Step 2: Generate voice in parallel (if enabled)
      let voiceAudioPublicUrl: string | null = null
      if (useVoice) {
        setPollStatus('Generating video + voiceover in parallel...')
        try {
          voiceAudioPublicUrl = await generateVoiceForSync()
          if (voiceAudioPublicUrl) {
            onToast('Voiceover generated, waiting for video...', 'success')
          }
        } catch (voiceErr: unknown) {
          onToast(`Voice generation failed: ${voiceErr instanceof Error ? voiceErr.message : String(voiceErr)}. Continuing without voice.`, 'error')
        }
      }

      setPollStatus('Processing video...')

      // Step 3: Poll for video completion
      const poll = async () => {
        if (cancelledRef.current) return
        try {
          const pollRes = await fetch(`/api/video?responseUrl=${encodeURIComponent(responseUrl)}`)
          const pollData = await pollRes.json()
          if (cancelledRef.current) return

          if (pollData.status === 'complete' && pollData.videoUrl) {
            stopPolling()

            // Step 4: If voice was generated, run lip sync
            if (voiceAudioPublicUrl) {
              try {
                const finalVideoUrl = await runLipSync(pollData.videoUrl, voiceAudioPublicUrl)
                setVideoUrl(finalVideoUrl)
                setGenerating(false)
                setPollStatus('')
                setGenerationCount(prev => prev + 1)
                setFeedback('')
                onToast('Video with synced voiceover ready!', 'success')
              } catch (lsErr: unknown) {
                // Lip sync failed, fall back to raw video
                setVideoUrl(pollData.videoUrl)
                setGenerating(false)
                setPollStatus('')
                setGenerationCount(prev => prev + 1)
                setFeedback('')
                const msg = lsErr instanceof Error ? lsErr.message : String(lsErr)
                if (msg !== 'Cancelled') {
                  onToast(`Lip sync failed (${msg}). Raw video delivered instead.`, 'error')
                }
              }
            } else {
              setVideoUrl(pollData.videoUrl)
              setGenerating(false)
              setPollStatus('')
              setGenerationCount(prev => prev + 1)
              setFeedback('')
              onToast('Video generated!', 'success')
            }
            return
          }

          if (pollData.status === 'processing') {
            setPollStatus(pollData.queuePosition
              ? `Video in queue (position ${pollData.queuePosition})...`
              : useVoice ? 'Processing video (voiceover ready)...' : 'Processing video...')
          }
        } catch { /* retry */ }
      }

      pollIntervalRef.current = setInterval(poll, 5000)
      setTimeout(poll, 3000)

    } catch (err: unknown) {
      stopPolling()
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
      setGenerating(false)
      setPollStatus('')
      onToast(`Video failed: ${msg}`, 'error')
    }
  }

  const handleVoicePreview = async () => {
    if (!voiceScript.trim() || !selectedVoice) { onToast('Write a script and select a voice first', 'error'); return }
    setVoicePreviewing(true)
    try {
      const scriptText = productPhonetic && productName
        ? voiceScript.replace(new RegExp(productName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), productPhonetic)
        : voiceScript
      const res = await fetch('/api/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: scriptText,
          voiceId: selectedVoice,
          stability: voiceStability,
          similarityBoost: voiceSimilarity,
          style: voiceStyle,
          speed: voiceSpeed,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      if (data.audioUrl) {
        setVoicePreviewUrl(data.audioUrl)
        onToast('Preview ready - adjust script and try again if needed', 'success')
        // Auto-play after state update
        setTimeout(() => {
          if (voiceAudioRef.current) {
            voiceAudioRef.current.load()
            voiceAudioRef.current.play().catch(() => {})
          }
        }, 100)
      }
    } catch (err: unknown) {
      onToast(`Preview failed: ${err instanceof Error ? err.message : String(err)}`, 'error')
    }
    setVoicePreviewing(false)
  }


  return (
    <div className="animate-fadeIn">
      <div className="grid grid-cols-[1fr_380px] gap-4">
        {/* Left - Controls */}
        <div className="space-y-4">
          {/* Mode selector */}
          <Card title="Generation Mode">
            <div className="flex gap-3">
              <button
                onClick={() => setMode('text-to-video')}
                className={`flex-1 p-3 rounded-lg border text-left transition-all ${
                  mode === 'text-to-video' ? 'border-blue bg-blue-light' : 'border-border bg-page hover:border-text-subtle'
                }`}
              >
                <div className="text-lg mb-1">✨</div>
                <div className="text-sm font-bold">Text to Video</div>
                <div className="text-2xs text-text-dim">Generate from a text prompt</div>
              </button>
              <button
                onClick={() => { setMode('image-to-video'); setModel('seedance') }}
                className={`flex-1 p-3 rounded-lg border text-left transition-all ${
                  mode === 'image-to-video' ? 'border-blue bg-blue-light' : 'border-border bg-page hover:border-text-subtle'
                }`}
              >
                <div className="text-lg mb-1">📸</div>
                <div className="text-sm font-bold">UGC Recreation</div>
                <div className="text-2xs text-text-dim">Animate a creator photo with Seedance</div>
              </button>
            </div>
          </Card>

          {/* Creator photo upload (image-to-video mode) */}
          {mode === 'image-to-video' && (
            <Card title="Creator Photo" subtitle="Upload a photo of the creator - Seedance will animate them">
              <input ref={creatorImageRef} type="file" accept="image/*" className="hidden" onChange={handleCreatorImageUpload} />
              {creatorImagePreview ? (
                <div className="flex items-center gap-3">
                  <img src={creatorImagePreview} alt="Creator" className="w-20 h-20 object-cover rounded-lg border border-border" />
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-green">Photo uploaded</div>
                    <div className="text-2xs text-text-dim">Seedance will animate this person</div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => { setCreatorImagePreview(null); setCreatorImageUrl('') }}>Change</Button>
                </div>
              ) : (
                <button
                  onClick={() => creatorImageRef.current?.click()}
                  className="w-full p-6 border-2 border-dashed border-border rounded-lg text-center hover:border-blue/40 transition-colors"
                >
                  <div className="text-2xl mb-2">📸</div>
                  <div className="text-sm font-semibold text-text-muted">Click to upload creator photo</div>
                  <div className="text-2xs text-text-dim mt-1">Best results: clear face, good lighting, front-facing</div>
                </button>
              )}
              <input
                type="url"
                placeholder="Or paste creator photo URL..."
                value={creatorImageUrl}
                onChange={e => { setCreatorImageUrl(e.target.value); if (e.target.value) setCreatorImagePreview(e.target.value) }}
                className="w-full px-3 py-2 bg-page border border-border rounded text-xs text-text-primary focus:border-blue focus:outline-none mt-2"
              />
            </Card>
          )}

          {/* Product Images */}
          <Card title="Product Images" subtitle="Upload product photos so the AI knows what to feature (optional)">
            <input ref={productInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleProductImageUpload} />
            <div className="flex gap-2 flex-wrap">
              {productImagePreviews.map((src, i) => (
                <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border border-border group">
                  <img src={src} alt="" className="w-full h-full object-cover" />
                  <button
                    onClick={() => {
                      setProductImagePreviews(prev => prev.filter((_, idx) => idx !== i))
                      setProductImageUrls(prev => prev.filter((_, idx) => idx !== i))
                    }}
                    className="absolute top-0.5 right-0.5 w-4 h-4 bg-black/60 text-white text-2xs rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                  >
                    x
                  </button>
                </div>
              ))}
              <button
                onClick={() => productInputRef.current?.click()}
                className="w-16 h-16 rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center hover:border-blue/40 transition-colors cursor-pointer"
              >
                <span className="text-sm">+</span>
                <span className="text-2xs text-text-dim">Add</span>
              </button>
            </div>
          </Card>

          {/* Product Name + Phonetic */}
          <Card title="Product Name" subtitle="Used in prompts and voiceover scripts">
            <div className="space-y-2">
              <input
                type="text"
                value={productName}
                onChange={e => setProductName(e.target.value)}
                placeholder={brand?.name ? `e.g. ${brand.name} Daily Multivitamin` : 'e.g. GlowSerum Pro'}
                className="w-full px-3 py-2.5 bg-page border border-border rounded text-sm text-text-primary focus:border-blue focus:outline-none"
              />
              <input
                type="text"
                value={productPhonetic}
                onChange={e => setProductPhonetic(e.target.value)}
                placeholder="Phonetic spelling for voiceover (e.g. GLOW-seer-um)"
                className="w-full px-3 py-2 bg-page border border-border rounded text-xs text-text-muted focus:border-blue focus:outline-none"
              />
              <div className="text-2xs text-text-dim">Phonetic spelling helps ElevenLabs pronounce the product name correctly</div>
            </div>
          </Card>

          {/* Reference Video */}
          <Card title="Reference Video" subtitle="Upload a high-production video to match its style (optional)">
            <input ref={refVideoInputRef} type="file" accept="video/*" className="hidden" onChange={handleRefVideoUpload} />
            {refVideoPreview ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <video src={refVideoPreview} className="w-24 h-16 object-cover rounded-lg border border-border" muted />
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-green">Reference uploaded</div>
                    <div className="text-2xs text-text-dim">Style will be matched</div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => { setRefVideoPreview(null); setRefVideoUrl(null) }}>Remove</Button>
                </div>
                <Button
                  onClick={handleAnalyzeVideo}
                  disabled={analyzing || !refVideoUrl}
                  variant="secondary"
                  className="w-full justify-center"
                  size="sm"
                >
                  {analyzing ? <><LoadingSpinner size={14} /> Analyzing Video...</> : 'Analyze & Generate Prompt'}
                </Button>
              </div>
            ) : (
              <button
                onClick={() => refVideoInputRef.current?.click()}
                className="w-full p-4 border-2 border-dashed border-border rounded-lg text-center hover:border-blue/40 transition-colors"
              >
                <div className="text-sm font-semibold text-text-muted">Click to upload reference video</div>
                <div className="text-2xs text-text-dim mt-1">MP4, MOV - the AI will match this production style</div>
              </button>
            )}
          </Card>

          {/* Model selector */}
          {mode === 'text-to-video' && <Card title="Video Model">
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
          </Card>}

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

          {/* Suggested Prompts */}
          {!prompt.trim() && (
            <Card title="Quick Start" subtitle="Click any prompt to use it">
              <div className="space-y-2">
                {(style === 'ugc' ? [
                  'Person unboxing the product at their kitchen table, morning light through window, genuine excited reaction, handheld camera',
                  'Someone walking through their home wearing the product, casual POV shot, cozy interior, natural movement',
                  'Close-up of hands holding the product, turning it to show details, soft background blur, authentic home setting',
                  'Person sitting on couch talking directly to camera about a product they love, warm living room, iPhone selfie angle',
                ] : style === 'cinematic' ? [
                  'Slow dolly shot of the product on a wooden surface, golden hour light streaming through window, shallow depth of field, dust particles in air',
                  'Aerial tracking shot over a product display, moody lighting, slow motion fabric drape reveal, cinematic color grade',
                  'Macro close-up of product texture, smooth rack focus to full product, dramatic side lighting, dark background',
                  'Product on a pedestal with rotating camera orbit, studio lighting with rim light, clean seamless background',
                ] : style === 'animated' ? [
                  'Product logo morphs into a 3D render, smooth particle effects, gradient background shifts colors, modern motion design',
                  'Text animates in letter by letter with bounce effect, product slides in from right, clean flat design aesthetic',
                  'Isometric view of product with animated infographic callouts, clean lines, subtle glow effects, white background',
                  'Product features highlighted one by one with animated arrows and icons, smooth transitions between each feature',
                ] : [
                  'Product centered on white seamless background, slow 360 rotation, studio three-point lighting, ultra clean',
                  'Product placed on natural stone surface, water droplets nearby, macro lens, soft diffused lighting from above',
                  'Side-by-side product comparison, camera slowly pans across both, even lighting, minimal styling',
                  'Product in lifestyle context, shallow depth of field, warm tones, subtle camera push in',
                ]).map((suggestion, i) => (
                  <button
                    key={i}
                    onClick={() => setPrompt(suggestion)}
                    className="w-full text-left px-3 py-2.5 bg-page border border-border rounded-lg text-xs text-text-muted hover:text-text-primary hover:border-blue/40 transition-all"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </Card>
          )}

          {/* Prompt */}
          <Card title="Video Prompt" subtitle="Describe the scene, action, and mood">
            <FormTextarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              rows={4}
              placeholder="Type your own or click a suggestion above..."
            />
            {prompt.trim() && (
              <button onClick={() => setPrompt('')} className="text-2xs text-text-dim hover:text-text-primary mt-2">Clear prompt</button>
            )}
          </Card>

          {/* Voice / ElevenLabs */}
          <Card title="Voice (ElevenLabs)" subtitle="Add a voiceover to the generated video">
            <div className="flex items-center gap-3 mb-3">
              <button
                onClick={() => setVoiceEnabled(!voiceEnabled)}
                className={`relative w-10 h-5 rounded-full transition-colors ${voiceEnabled ? 'bg-blue' : 'bg-border'}`}
              >
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${voiceEnabled ? 'left-5' : 'left-0.5'}`} />
              </button>
              <span className="text-sm text-text-muted">{voiceEnabled ? 'Voice enabled' : 'No voice'}</span>
            </div>
            {voiceEnabled && (
              <div className="space-y-3">
                <div>
                  <label className="block text-2xs font-bold tracking-wider uppercase text-text-muted mb-1.5">Voice</label>
                  <select
                    value={selectedVoice}
                    onChange={e => setSelectedVoice(e.target.value)}
                    className="w-full px-3 py-2.5 bg-page border border-border rounded text-sm text-text-primary focus:border-blue focus:outline-none"
                  >
                    {voices.length === 0 && <option value="">Loading voices...</option>}
                    {voices.map(v => (
                      <option key={v.voice_id} value={v.voice_id}>{v.name} ({v.category})</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="flex justify-between text-2xs font-bold tracking-wider uppercase text-text-muted mb-1">
                      <span>Stability</span>
                      <span className="text-text-dim font-normal">{Math.round(voiceStability * 100)}%</span>
                    </label>
                    <input type="range" min="0" max="1" step="0.05" value={voiceStability} onChange={e => setVoiceStability(Number(e.target.value))}
                      className="w-full h-1.5 accent-blue" />
                    <div className="flex justify-between text-2xs text-text-dim mt-0.5"><span>Expressive</span><span>Stable</span></div>
                  </div>
                  <div>
                    <label className="flex justify-between text-2xs font-bold tracking-wider uppercase text-text-muted mb-1">
                      <span>Clarity</span>
                      <span className="text-text-dim font-normal">{Math.round(voiceSimilarity * 100)}%</span>
                    </label>
                    <input type="range" min="0" max="1" step="0.05" value={voiceSimilarity} onChange={e => setVoiceSimilarity(Number(e.target.value))}
                      className="w-full h-1.5 accent-blue" />
                    <div className="flex justify-between text-2xs text-text-dim mt-0.5"><span>Natural</span><span>Clear</span></div>
                  </div>
                  <div>
                    <label className="flex justify-between text-2xs font-bold tracking-wider uppercase text-text-muted mb-1">
                      <span>Style</span>
                      <span className="text-text-dim font-normal">{Math.round(voiceStyle * 100)}%</span>
                    </label>
                    <input type="range" min="0" max="1" step="0.05" value={voiceStyle} onChange={e => setVoiceStyle(Number(e.target.value))}
                      className="w-full h-1.5 accent-blue" />
                    <div className="flex justify-between text-2xs text-text-dim mt-0.5"><span>Neutral</span><span>Exaggerated</span></div>
                  </div>
                  <div>
                    <label className="flex justify-between text-2xs font-bold tracking-wider uppercase text-text-muted mb-1">
                      <span>Speed</span>
                      <span className="text-text-dim font-normal">{voiceSpeed.toFixed(1)}x</span>
                    </label>
                    <input type="range" min="0.5" max="2.0" step="0.1" value={voiceSpeed} onChange={e => setVoiceSpeed(Number(e.target.value))}
                      className="w-full h-1.5 accent-blue" />
                    <div className="flex justify-between text-2xs text-text-dim mt-0.5"><span>Slow</span><span>Fast</span></div>
                  </div>
                </div>
                <div>
                  <label className="block text-2xs font-bold tracking-wider uppercase text-text-muted mb-1.5">Script</label>
                  {(productName || productPhonetic) && (
                    <div className="text-2xs text-text-dim mb-1.5 p-2 bg-page rounded border border-border">
                      Product: <span className="font-semibold text-text-muted">{productName || brand?.name || 'Not set'}</span>
                      {productPhonetic && <> - say it as: <span className="font-semibold text-blue">{productPhonetic}</span></>}
                    </div>
                  )}
                  <textarea
                    value={voiceScript}
                    onChange={e => setVoiceScript(e.target.value)}
                    placeholder="Write the voiceover script here... This is what the creator will say."
                    className="w-full px-3 py-2.5 text-sm text-text-primary bg-page border border-border rounded focus:border-blue focus:outline-none transition-colors resize-y min-h-[60px]"
                    rows={3}
                  />
                </div>
                <Button
                  onClick={handleVoicePreview}
                  disabled={voicePreviewing || !voiceScript.trim() || !selectedVoice}
                  variant="secondary"
                  size="sm"
                  className="w-full justify-center"
                >
                  {voicePreviewing ? <><LoadingSpinner size={14} /> Generating Preview...</> : 'Preview Voice'}
                </Button>
                {voicePreviewUrl && (
                  <div className="space-y-2">
                    <audio ref={voiceAudioRef} src={voicePreviewUrl} controls className="w-full h-8" />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          const a = document.createElement('a')
                          a.href = voicePreviewUrl
                          a.download = `voiceover-${productName || 'preview'}-${Date.now()}.mp3`
                          a.click()
                        }}
                        className="text-2xs text-blue hover:underline"
                      >
                        Download MP3
                      </button>
                      <span className="text-2xs text-text-dim">Adjust your script and preview again until it sounds right</span>
                    </div>
                  </div>
                )}
                {voiceLoading && (
                  <div className="flex items-center gap-2 text-xs text-text-dim">
                    <LoadingSpinner size={12} /> Generating voiceover...
                  </div>
                )}
              </div>
            )}
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
                  <option value={15}>15 seconds</option>
                  <option value={20}>20 seconds</option>
                  <option value={30}>30 seconds</option>
                </select>
                {duration > 10 && (
                  <div className="text-2xs text-text-dim mt-1">Longer videos take more time to generate</div>
                )}
              </div>
            </div>
            {/* Quick format buttons */}
            <div className="flex gap-2 mt-3">
              {[
                { label: '9:16', value: '9:16' },
                { label: '4:5', value: '4:5' },
                { label: '1:1', value: '1:1' },
                { label: '16:9', value: '16:9' },
              ].map(f => (
                <button
                  key={f.value}
                  onClick={() => setAspectRatio(f.value)}
                  className={`flex-1 py-1.5 text-xs rounded border transition-all ${
                    aspectRatio === f.value ? 'border-blue bg-blue-light text-blue font-bold' : 'border-border text-text-dim hover:border-text-subtle'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </Card>

          {generating ? (
            <div className="flex gap-2">
              <div className="flex-1 py-3.5 bg-elevated border border-border rounded-lg flex items-center justify-center gap-2 text-sm text-text-muted">
                <LoadingSpinner size={16} />
                <span>{pollStatus || 'Generating...'}</span>
                <span className="text-text-dim text-xs ml-1">
                  {elapsedTime > 0 && (() => {
                    const remaining = Math.max(0, estimatedTotal - elapsedTime)
                    if (remaining === 0) return 'Almost done...'
                    const m = Math.floor(remaining / 60)
                    const s = remaining % 60
                    return `~${m}:${String(s).padStart(2, '0')} remaining`
                  })()}
                </span>
              </div>
              <Button onClick={handleCancel} variant="secondary" className="px-5 py-3.5 text-sm justify-center border-red/30 text-red hover:bg-red/10">
                Cancel
              </Button>
            </div>
          ) : (
            <Button onClick={() => handleGenerate()} className="w-full py-3.5 text-sm justify-center">
              Generate Video
            </Button>
          )}
        </div>

        {/* Right - Preview + Feedback */}
        <div className="space-y-4">
          <Card title="Video Preview">
            <div className={`aspect-[${aspectRatio.replace(':', '/')}] rounded-lg overflow-hidden bg-elevated`}>
              {generating ? (
                <div className="w-full h-full flex flex-col items-center justify-center min-h-[400px]">
                  <LoadingSpinner size={32} />
                  <div className="text-sm text-text-muted mt-4">{pollStatus || 'Generating video...'}</div>
                  <div className="text-2xs text-text-dim mt-1">
                    {elapsedTime > 0 && (() => {
                      const remaining = Math.max(0, estimatedTotal - elapsedTime)
                      if (remaining === 0) return 'Almost done...'
                      const m = Math.floor(remaining / 60)
                      const s = remaining % 60
                      return `~${m}:${String(s).padStart(2, '0')} remaining`
                    })()}
                  </div>
                  <div className="text-2xs text-text-dim mt-1">{model === 'seedance' ? 'Seedance 2.0' : 'Kling v3'} - {style} - {duration}s</div>
                  <button
                    onClick={handleCancel}
                    className="mt-4 px-4 py-2 text-xs text-red border border-red/30 rounded-lg hover:bg-red/10 transition-colors"
                  >
                    Cancel Generation
                  </button>
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
                <Button
                  size="sm"
                  variant="secondary"
                  className="justify-center"
                  onClick={() => setAspectRatio('4:5')}
                >
                  Resize 4:5
                </Button>
              </div>
            )}
          </Card>

          {/* Feedback Chat - appears after generation */}
          {videoUrl && !generating && (
            <Card title="Feedback" subtitle="Tell the AI what to change">
              <textarea
                value={feedback}
                onChange={e => setFeedback(e.target.value)}
                placeholder="e.g. Make the camera movement slower, zoom in more on the product, warmer lighting, more dramatic reveal..."
                className="w-full px-3 py-2.5 text-sm text-text-primary bg-page border border-border rounded focus:border-blue focus:outline-none transition-colors resize-y min-h-[60px] mb-3"
                rows={2}
              />
              <Button
                onClick={() => handleGenerate(feedback)}
                disabled={!feedback.trim() || generating}
                className="w-full justify-center"
              >
                Regenerate with Feedback
              </Button>
              {generationCount > 1 && (
                <div className="text-2xs text-text-dim mt-2 text-center">
                  Iteration {generationCount} - previous prompt refined with your feedback
                </div>
              )}
            </Card>
          )}

          {/* Tips */}
          <Card title="Prompt Tips" subtitle="For best results">
            <ul className="space-y-1.5 list-disc list-inside text-xs text-text-dim">
              <li>Describe the scene, not the ad concept</li>
              <li>Include camera movement (slow zoom, dolly, pan)</li>
              <li>Mention lighting (natural, studio, golden hour)</li>
              <li>Specify the subject clearly</li>
              <li>Keep prompts under 200 words</li>
              <li>Upload product photos for accurate product depiction</li>
              <li>Upload a reference video to match production style</li>
              <li>Seedance is better for people/UGC</li>
              <li>Kling is better for products/objects</li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  )
}
