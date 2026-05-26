'use client'

import { useState, useRef } from 'react'
import { Brand } from '@/lib/types'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

interface BrandOnboardingProps {
  onComplete: (brand: Brand) => void
  onCancel: () => void
  onToast: (msg: string, type: 'success' | 'error' | 'info') => void
}

const STEPS = [
  { id: 'basics', label: 'Brand Basics', required: true },
  { id: 'product', label: 'Product Info', required: false },
  { id: 'audience', label: 'Target Audience', required: false },
  { id: 'voice', label: 'Brand Voice', required: false },
  { id: 'competitors', label: 'Competitors', required: false },
  { id: 'listening', label: 'Social Listening', required: false },
]

export default function BrandOnboarding({ onComplete, onCancel, onToast }: BrandOnboardingProps) {
  const [step, setStep] = useState(0)
  const [researching, setResearching] = useState(false)
  const [brandId, setBrandId] = useState<string | null>(null)
  const [skippedSteps, setSkippedSteps] = useState<Set<string>>(new Set())

  // Step 1: Basics
  const [brandName, setBrandName] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')

  // Step 2: Product
  const [productCategory, setProductCategory] = useState('')
  const [priceRange, setPriceRange] = useState('')
  const [productUrls, setProductUrls] = useState<string[]>([])
  const [newProductUrl, setNewProductUrl] = useState('')

  // Step 3: Audience
  const [personas, setPersonas] = useState<{ name: string; description: string; hook: string }[]>([])
  const [newPersonaName, setNewPersonaName] = useState('')
  const [newPersonaDesc, setNewPersonaDesc] = useState('')
  const [newPersonaHook, setNewPersonaHook] = useState('')

  // Step 4: Voice
  const [toneNotes, setToneNotes] = useState('')
  const [brandColors, setBrandColors] = useState<string[]>([])
  const [newColor, setNewColor] = useState('#2138ff')
  const logoRef = useRef<HTMLInputElement>(null)
  const guidelinesRef = useRef<HTMLInputElement>(null)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [guidelinesUrl, setGuidelinesUrl] = useState<string | null>(null)

  // Step 5: Competitors
  const [competitors, setCompetitors] = useState<string[]>([])
  const [newCompetitor, setNewCompetitor] = useState('')
  const [competitorUrls, setCompetitorUrls] = useState<string[]>([])
  const [newCompetitorUrl, setNewCompetitorUrl] = useState('')

  // Step 6: Listening
  const [keywords, setKeywords] = useState<string[]>([])
  const [newKeyword, setNewKeyword] = useState('')
  const [subreddits, setSubreddits] = useState<string[]>([])
  const [newSubreddit, setNewSubreddit] = useState('')

  const currentStep = STEPS[step]
  const isLastStep = step === STEPS.length - 1
  const progress = ((step + 1) / STEPS.length) * 100

  // Step 1: Create brand + run research
  const handleCreateBrand = async () => {
    if (!brandName.trim() || !websiteUrl.trim()) { onToast('Brand name and website required', 'error'); return }
    setResearching(true)
    onToast(`Researching ${brandName}... this takes about 30 seconds`, 'info')
    try {
      const res = await fetch('/api/brand-research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandName, websiteUrl }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setBrandId(data.brandId)

      // Pre-fill from research if available
      if (data.research) {
        if (data.research.productCategory) setProductCategory(data.research.productCategory)
        if (data.research.priceRange) setPriceRange(data.research.priceRange)
        if (data.research.personas?.length) {
          setPersonas(data.research.personas.map((p: { name: string; description?: string; hook?: string }) => ({
            name: p.name, description: p.description || '', hook: p.hook || '',
          })))
        }
        if (data.research.brandVoice) setToneNotes(data.research.brandVoice)
        if (data.research.competitors?.length) setCompetitors(data.research.competitors)
        if (data.research.searchKeywords?.length) setKeywords(data.research.searchKeywords)
        if (data.research.subreddits?.length) setSubreddits(data.research.subreddits)
      }

      onToast(`${brandName} created and researched`, 'success')
      setStep(1)
    } catch (err: unknown) {
      onToast(`Failed: ${err instanceof Error ? err.message : String(err)}`, 'error')
    }
    setResearching(false)
  }

  // Save current step data to brand
  const saveStepData = async () => {
    if (!brandId) return
    const updates: Record<string, unknown> = {}

    if (step === 1) {
      // Product info
      updates.research = {
        productCategory, priceRange,
      }
      if (productUrls.length) updates.own_product_urls = productUrls
    } else if (step === 2) {
      // Audience - merge personas
      updates.research = { personas: personas.map(p => ({ name: p.name, description: p.description, hook: p.hook, age: '', painPoints: [], motivators: [], channels: [] })) }
    } else if (step === 3) {
      // Voice
      updates.tone_notes = toneNotes
      if (brandColors.length) updates.brand_colors = brandColors
      if (logoUrl) updates.logo_url = logoUrl
      if (guidelinesUrl) updates.brand_guidelines_url = guidelinesUrl
    } else if (step === 4) {
      // Competitors
      updates.research = { competitors }
      if (competitorUrls.length) updates.competitor_urls = competitorUrls
    } else if (step === 5) {
      // Listening
      updates.research = { searchKeywords: keywords, subreddits }
    }

    try {
      // For research fields, merge with existing
      if (updates.research) {
        const existingRes = await fetch(`/api/brands`).then(r => r.json())
        const brand = (existingRes.brands || []).find((b: Brand) => b.id === brandId)
        if (brand?.research) {
          updates.research = { ...brand.research, ...updates.research }
        }
      }

      await fetch('/api/brands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: brandId, ...updates }),
      })
    } catch { /* silent - data saves best effort */ }
  }

  const handleNext = async () => {
    await saveStepData()
    if (isLastStep) {
      // Complete onboarding
      const res = await fetch('/api/brands')
      const data = await res.json()
      const brand = (data.brands || []).find((b: Brand) => b.id === brandId)
      if (brand) onComplete(brand)
      else onToast('Brand created but could not load - select it from the dropdown', 'info')
    } else {
      setStep(step + 1)
    }
  }

  const handleSkip = () => {
    setSkippedSteps(prev => new Set([...prev, currentStep.id]))
    if (isLastStep) {
      handleNext()
    } else {
      setStep(step + 1)
    }
  }

  const handleFileUpload = async (file: File, type: 'logo' | 'guidelines') => {
    if (!brandId) return
    try {
      const signedRes = await fetch(`/api/reference-images?action=signedUrl&brandId=${brandId}&fileName=${encodeURIComponent(file.name)}&contentType=${encodeURIComponent(file.type)}`)
      const signedData = await signedRes.json()
      if (signedData.error) throw new Error(signedData.error)
      await fetch(signedData.signedUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file })
      if (type === 'logo') {
        setLogoUrl(signedData.publicUrl)
        await fetch('/api/brands', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: brandId, logo_url: signedData.publicUrl }) })
        onToast('Logo uploaded', 'success')
      } else {
        setGuidelinesUrl(signedData.publicUrl)
        await fetch('/api/brands', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: brandId, brand_guidelines_url: signedData.publicUrl }) })
        onToast('Guidelines uploaded', 'success')
      }
    } catch { onToast('Upload failed', 'error') }
  }

  const SkipWarning = () => (
    <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-2 text-xs text-amber-400 mt-3">
      Skipping this step means insights and copy generated for this brand will be less accurate and relevant.
    </div>
  )

  return (
    <div className="animate-fadeIn max-w-2xl mx-auto">
      {/* Progress */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-black">Set Up {brandName || 'New Brand'}</h2>
          <span className="text-2xs text-text-dim">Step {step + 1} of {STEPS.length}</span>
        </div>
        <div className="h-1.5 bg-border rounded-full overflow-hidden">
          <div className="h-full bg-blue rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
        <div className="flex justify-between mt-2">
          {STEPS.map((s, i) => (
            <span key={s.id} className={`text-2xs ${i <= step ? 'text-blue font-bold' : i < step ? 'text-text-muted' : 'text-text-dim'} ${skippedSteps.has(s.id) ? 'line-through opacity-50' : ''}`}>
              {s.label}
            </span>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <Card>
        {/* Step 1: Basics */}
        {step === 0 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-bold mb-1">Brand Basics</h3>
              <p className="text-xs text-text-dim">Claude will automatically research this brand from their website.</p>
            </div>
            <div>
              <label className="block text-2xs font-bold tracking-wider uppercase text-text-muted mb-1.5">Brand Name *</label>
              <input type="text" value={brandName} onChange={e => setBrandName(e.target.value)} placeholder="e.g. Fulton"
                className="w-full px-3 py-2.5 bg-page border border-border rounded text-sm text-text-primary focus:border-blue focus:outline-none" autoFocus />
            </div>
            <div>
              <label className="block text-2xs font-bold tracking-wider uppercase text-text-muted mb-1.5">Website URL *</label>
              <input type="url" value={websiteUrl} onChange={e => setWebsiteUrl(e.target.value)} placeholder="https://walkfulton.com"
                className="w-full px-3 py-2.5 bg-page border border-border rounded text-sm text-text-primary focus:border-blue focus:outline-none" />
            </div>
            <Button onClick={handleCreateBrand} disabled={!brandName.trim() || !websiteUrl.trim() || researching} className="w-full justify-center py-3">
              {researching ? <><LoadingSpinner size={16} /> Researching Brand...</> : 'Create + Research Brand'}
            </Button>
          </div>
        )}

        {/* Step 2: Product */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-bold mb-1">Product Info</h3>
              <p className="text-xs text-text-dim">Help us understand what this brand sells so insights are relevant.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-2xs font-bold tracking-wider uppercase text-text-muted mb-1.5">Product Category</label>
                <input type="text" value={productCategory} onChange={e => setProductCategory(e.target.value)} placeholder="e.g. Supportive Insoles"
                  className="w-full px-3 py-2.5 bg-page border border-border rounded text-sm text-text-primary focus:border-blue focus:outline-none" />
              </div>
              <div>
                <label className="block text-2xs font-bold tracking-wider uppercase text-text-muted mb-1.5">Price Range</label>
                <input type="text" value={priceRange} onChange={e => setPriceRange(e.target.value)} placeholder="e.g. $40-65"
                  className="w-full px-3 py-2.5 bg-page border border-border rounded text-sm text-text-primary focus:border-blue focus:outline-none" />
              </div>
            </div>
            <div>
              <label className="block text-2xs font-bold tracking-wider uppercase text-text-muted mb-1.5">Product Page URLs (Amazon or brand site)</label>
              <div className="space-y-1.5 mb-2">
                {productUrls.map((url, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="text-blue truncate flex-1">{url}</span>
                    <button onClick={() => setProductUrls(prev => prev.filter((_, idx) => idx !== i))} className="text-red text-2xs">x</button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input type="url" value={newProductUrl} onChange={e => setNewProductUrl(e.target.value)} placeholder="https://amazon.com/dp/... or brand product page"
                  className="flex-1 px-3 py-2 bg-page border border-border rounded text-sm text-text-primary focus:border-blue focus:outline-none" />
                <Button size="sm" disabled={!newProductUrl.trim()} onClick={() => { setProductUrls(prev => [...prev, newProductUrl.trim()]); setNewProductUrl('') }}>Add</Button>
              </div>
            </div>
            <SkipWarning />
          </div>
        )}

        {/* Step 3: Audience */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-bold mb-1">Target Audience</h3>
              <p className="text-xs text-text-dim">Define personas so scripts and copy speak directly to real people. {personas.length > 0 && `${personas.length} pre-filled from research.`}</p>
            </div>
            {personas.map((p, i) => (
              <div key={i} className="bg-page border border-border rounded-lg p-3 relative group">
                <div className="text-2xs font-bold text-blue mb-1">Persona {i + 1}</div>
                <input type="text" value={p.name} onChange={e => { const next = [...personas]; next[i] = { ...next[i], name: e.target.value }; setPersonas(next) }}
                  className="w-full px-2 py-1.5 bg-transparent text-sm font-bold text-text-primary focus:outline-none mb-1" placeholder="Persona name" />
                <input type="text" value={p.description} onChange={e => { const next = [...personas]; next[i] = { ...next[i], description: e.target.value }; setPersonas(next) }}
                  className="w-full px-2 py-1 bg-transparent text-xs text-text-dim focus:outline-none mb-1" placeholder="Description" />
                <input type="text" value={p.hook} onChange={e => { const next = [...personas]; next[i] = { ...next[i], hook: e.target.value }; setPersonas(next) }}
                  className="w-full px-2 py-1 bg-transparent text-xs text-text-dim focus:outline-none" placeholder="Ad hook angle" />
                <button onClick={() => setPersonas(prev => prev.filter((_, idx) => idx !== i))}
                  className="absolute top-2 right-2 text-red text-xs opacity-0 group-hover:opacity-100">x</button>
              </div>
            ))}
            <div className="bg-page border-2 border-dashed border-border rounded-lg p-3 space-y-2">
              <input type="text" value={newPersonaName} onChange={e => setNewPersonaName(e.target.value)} placeholder="Persona name (e.g. Active Moms, 28-40)"
                className="w-full px-2 py-1.5 bg-transparent text-sm text-text-primary focus:outline-none" />
              <input type="text" value={newPersonaDesc} onChange={e => setNewPersonaDesc(e.target.value)} placeholder="Description"
                className="w-full px-2 py-1 bg-transparent text-xs text-text-dim focus:outline-none" />
              <input type="text" value={newPersonaHook} onChange={e => setNewPersonaHook(e.target.value)} placeholder="Ad hook angle"
                className="w-full px-2 py-1 bg-transparent text-xs text-text-dim focus:outline-none" />
              <Button size="sm" disabled={!newPersonaName.trim()} onClick={() => {
                setPersonas(prev => [...prev, { name: newPersonaName, description: newPersonaDesc, hook: newPersonaHook }])
                setNewPersonaName(''); setNewPersonaDesc(''); setNewPersonaHook('')
              }}>+ Add Persona</Button>
            </div>
            <SkipWarning />
          </div>
        )}

        {/* Step 4: Voice */}
        {step === 3 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-bold mb-1">Brand Voice</h3>
              <p className="text-xs text-text-dim">Upload brand assets and define the tone. This shapes all generated copy.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <input ref={logoRef} type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={e => { if (e.target.files?.[0]) handleFileUpload(e.target.files[0], 'logo') }} />
                <button onClick={() => logoRef.current?.click()}
                  className={`w-full p-4 rounded-lg border text-center transition-all ${logoUrl ? 'border-green bg-green/5' : 'border-border hover:border-blue/40'}`}>
                  <div className="text-lg mb-1">{logoUrl ? '✓' : '🏷'}</div>
                  <div className="text-xs font-semibold">{logoUrl ? 'Logo Uploaded' : 'Upload Logo'}</div>
                </button>
              </div>
              <div>
                <input ref={guidelinesRef} type="file" accept="image/*,.pdf" style={{ display: 'none' }}
                  onChange={e => { if (e.target.files?.[0]) handleFileUpload(e.target.files[0], 'guidelines') }} />
                <button onClick={() => guidelinesRef.current?.click()}
                  className={`w-full p-4 rounded-lg border text-center transition-all ${guidelinesUrl ? 'border-green bg-green/5' : 'border-border hover:border-blue/40'}`}>
                  <div className="text-lg mb-1">{guidelinesUrl ? '✓' : '📄'}</div>
                  <div className="text-xs font-semibold">{guidelinesUrl ? 'Guidelines Uploaded' : 'Upload Guidelines'}</div>
                </button>
              </div>
            </div>
            <div>
              <label className="block text-2xs font-bold tracking-wider uppercase text-text-muted mb-1.5">Brand Colors</label>
              <div className="flex gap-2 flex-wrap mb-2">
                {brandColors.map((c, i) => (
                  <div key={i} className="relative group">
                    <input type="color" value={c} onChange={e => { const next = [...brandColors]; next[i] = e.target.value; setBrandColors(next) }}
                      className="w-8 h-8 rounded-full border border-border cursor-pointer" />
                    <button onClick={() => setBrandColors(prev => prev.filter((_, idx) => idx !== i))}
                      className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red text-white text-2xs rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center">x</button>
                  </div>
                ))}
                <div className="flex items-center gap-1">
                  <input type="color" value={newColor} onChange={e => setNewColor(e.target.value)} className="w-8 h-8 rounded-full border-2 border-dashed border-border cursor-pointer" />
                  <button onClick={() => { setBrandColors(prev => [...prev, newColor]) }} className="text-2xs text-blue">Add</button>
                </div>
              </div>
            </div>
            <div>
              <label className="block text-2xs font-bold tracking-wider uppercase text-text-muted mb-1.5">Tone & Voice</label>
              <textarea value={toneNotes} onChange={e => setToneNotes(e.target.value)}
                placeholder="Describe the brand's personality. E.g. Bold, direct, empowering. Speaks to customers like a friend."
                className="w-full px-3 py-2.5 bg-page border border-border rounded text-sm text-text-primary focus:border-blue focus:outline-none resize-y min-h-[60px]" rows={3} />
            </div>
            <SkipWarning />
          </div>
        )}

        {/* Step 5: Competitors */}
        {step === 4 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-bold mb-1">Competitors</h3>
              <p className="text-xs text-text-dim">We'll mine competitor weaknesses and customer complaints for ad angles. {competitors.length > 0 && `${competitors.length} pre-filled from research.`}</p>
            </div>
            <div>
              <label className="block text-2xs font-bold tracking-wider uppercase text-text-muted mb-1.5">Competitor Brands</label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {competitors.map((c, i) => (
                  <span key={i} className="text-xs bg-elevated border border-border px-2 py-1 rounded flex items-center gap-1.5">
                    {c} <button onClick={() => setCompetitors(prev => prev.filter((_, idx) => idx !== i))} className="text-red text-2xs">x</button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input type="text" value={newCompetitor} onChange={e => setNewCompetitor(e.target.value)} placeholder="Competitor name"
                  className="flex-1 px-3 py-2 bg-page border border-border rounded text-sm text-text-primary focus:border-blue focus:outline-none"
                  onKeyDown={e => { if (e.key === 'Enter' && newCompetitor.trim()) { setCompetitors(prev => [...prev, newCompetitor.trim()]); setNewCompetitor('') } }} />
                <Button size="sm" disabled={!newCompetitor.trim()} onClick={() => { setCompetitors(prev => [...prev, newCompetitor.trim()]); setNewCompetitor('') }}>Add</Button>
              </div>
            </div>
            <div>
              <label className="block text-2xs font-bold tracking-wider uppercase text-text-muted mb-1.5">Competitor Product URLs</label>
              <div className="space-y-1.5 mb-2">
                {competitorUrls.map((url, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="text-blue truncate flex-1">{url}</span>
                    <button onClick={() => setCompetitorUrls(prev => prev.filter((_, idx) => idx !== i))} className="text-red text-2xs">x</button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input type="url" value={newCompetitorUrl} onChange={e => setNewCompetitorUrl(e.target.value)} placeholder="https://amazon.com/dp/... or competitor product page"
                  className="flex-1 px-3 py-2 bg-page border border-border rounded text-sm text-text-primary focus:border-blue focus:outline-none" />
                <Button size="sm" disabled={!newCompetitorUrl.trim()} onClick={() => { setCompetitorUrls(prev => [...prev, newCompetitorUrl.trim()]); setNewCompetitorUrl('') }}>Add</Button>
              </div>
            </div>
            <SkipWarning />
          </div>
        )}

        {/* Step 6: Listening */}
        {step === 5 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-bold mb-1">Social Listening Config</h3>
              <p className="text-xs text-text-dim">Define what to listen for. These drive HyperListening scans. {keywords.length > 0 && `${keywords.length} keywords pre-filled from research.`}</p>
            </div>
            <div>
              <label className="block text-2xs font-bold tracking-wider uppercase text-text-muted mb-1.5">Search Keywords</label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {keywords.map((k, i) => (
                  <span key={i} className="text-2xs bg-blue-light text-blue px-2 py-0.5 rounded flex items-center gap-1">
                    {k} <button onClick={() => setKeywords(prev => prev.filter((_, idx) => idx !== i))} className="text-blue/60">x</button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input type="text" value={newKeyword} onChange={e => setNewKeyword(e.target.value)} placeholder="e.g. foot pain, arch support"
                  className="flex-1 px-3 py-2 bg-page border border-border rounded text-sm text-text-primary focus:border-blue focus:outline-none"
                  onKeyDown={e => { if (e.key === 'Enter' && newKeyword.trim()) { setKeywords(prev => [...prev, newKeyword.trim()]); setNewKeyword('') } }} />
                <Button size="sm" disabled={!newKeyword.trim()} onClick={() => { setKeywords(prev => [...prev, newKeyword.trim()]); setNewKeyword('') }}>Add</Button>
              </div>
            </div>
            <div>
              <label className="block text-2xs font-bold tracking-wider uppercase text-text-muted mb-1.5">Subreddits to Monitor</label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {subreddits.map((s, i) => (
                  <span key={i} className="text-2xs bg-elevated border border-border px-2 py-0.5 rounded flex items-center gap-1">
                    r/{s} <button onClick={() => setSubreddits(prev => prev.filter((_, idx) => idx !== i))} className="text-text-dim">x</button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input type="text" value={newSubreddit} onChange={e => setNewSubreddit(e.target.value)} placeholder="e.g. footcare, running"
                  className="flex-1 px-3 py-2 bg-page border border-border rounded text-sm text-text-primary focus:border-blue focus:outline-none"
                  onKeyDown={e => { if (e.key === 'Enter' && newSubreddit.trim()) { setSubreddits(prev => [...prev, newSubreddit.trim()]); setNewSubreddit('') } }} />
                <Button size="sm" disabled={!newSubreddit.trim()} onClick={() => { setSubreddits(prev => [...prev, newSubreddit.trim()]); setNewSubreddit('') }}>Add</Button>
              </div>
            </div>
            <SkipWarning />
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
          <div>
            {step > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setStep(step - 1)}>Back</Button>
            )}
            {step === 0 && (
              <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
            )}
          </div>
          <div className="flex gap-2">
            {step > 0 && !currentStep.required && (
              <Button variant="ghost" size="sm" onClick={handleSkip}>Skip</Button>
            )}
            {step > 0 && (
              <Button size="sm" onClick={handleNext}>
                {isLastStep ? 'Complete Setup' : 'Next'}
              </Button>
            )}
          </div>
        </div>

        {/* Skipped steps warning summary */}
        {skippedSteps.size > 0 && step > 0 && (
          <div className="mt-3 text-2xs text-amber-400">
            Skipped: {[...skippedSteps].map(s => STEPS.find(st => st.id === s)?.label).join(', ')} - you can complete these later in the Brand Kit
          </div>
        )}
      </Card>
    </div>
  )
}
