'use client'

import { useState } from 'react'
import { Brand } from '@/lib/types'
import Button from '@/components/ui/Button'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

interface ConceptCreatorViewProps {
  brand: Brand | null
  onToast: (msg: string, type: 'success' | 'error' | 'info') => void
  onBrandUpdate: (brandId: string, updates: Partial<Brand>) => void
}

type ConceptType = 'ugc' | 'static'
type HookMode = 'personas' | 'themes' | 'collections'

interface ParsedConcept {
  id: string
  target: string
  type: 'hook' | 'body' | 'cta' | 'static' | 'notes'
  content: string
  headline?: string
  support?: string
  visual?: string
  format?: string
  cta?: string
}

export default function ConceptCreatorView({ brand, onToast, onBrandUpdate }: ConceptCreatorViewProps) {
  const [conceptType, setConceptType] = useState<ConceptType>('ugc')
  const [hookMode, setHookMode] = useState<HookMode>('personas')
  const [direction, setDirection] = useState('')
  const [generating, setGenerating] = useState(false)
  const [concepts, setConcepts] = useState<ParsedConcept[]>([])
  const [rawOutput, setRawOutput] = useState('')
  const [selectedPersonas, setSelectedPersonas] = useState<number[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')

  const research = brand?.research
  const hasMotion = !!brand?.motion_data
  const personas = research?.personas || []
  const themes = brand?.research?.messagingThemes || []
  const collections = ((brand as unknown as Record<string, unknown>)?.product_collections as string[]) || []

  if (!brand) {
    return (
      <div className="animate-fadeIn flex items-center justify-center h-96">
        <div className="text-center">
          <div className="text-4xl mb-4">🧪</div>
          <h3 className="text-xl font-black mb-2">Concept Creator</h3>
          <p className="text-sm text-text-dim">Select a brand to start creating concepts</p>
        </div>
      </div>
    )
  }

  if (!research) {
    return (
      <div className="animate-fadeIn flex items-center justify-center h-96">
        <div className="text-center">
          <div className="text-4xl mb-4">🔬</div>
          <h3 className="text-xl font-black mb-2">Research Required</h3>
          <p className="text-sm text-text-dim mb-4">Run brand research for {brand.name} first to unlock Concept Creator</p>
        </div>
      </div>
    )
  }

  const generate = async () => {
    setGenerating(true)
    setConcepts([])
    setRawOutput('')

    try {
      const res = await fetch('/api/concept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandId: brand.id,
          conceptType,
          direction: direction.trim() || undefined,
          hookMode,
          selectedPersonaIndices: hookMode === 'personas' && selectedPersonas.length ? selectedPersonas : undefined,
          selectedThemes: hookMode === 'themes' ? themes : undefined,
          selectedCollections: hookMode === 'collections' ? collections : undefined,
        }),
      })

      const data = await res.json()
      if (data.error) throw new Error(data.error)

      setConcepts(data.concepts || [])
      setRawOutput(data.raw || '')
      onToast(`Generated ${data.concepts?.length || 0} concepts`, 'success')
    } catch (err: unknown) {
      onToast(`Generation failed: ${err instanceof Error ? err.message : String(err)}`, 'error')
    }
    setGenerating(false)
  }

  const saveToInsights = async (concept: ParsedConcept) => {
    try {
      await fetch('/api/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandId: brand.id,
          type: conceptType === 'ugc' ? 'ugc_concept' : 'static_concept',
          title: concept.headline || concept.target || 'Concept',
          content: concept.content,
          metadata: { target: concept.target, conceptType, visual: concept.visual, format: concept.format },
        }),
      })
      onToast('Saved to insights', 'success')
    } catch {
      onToast('Failed to save', 'error')
    }
  }

  const startEdit = (concept: ParsedConcept) => {
    setEditingId(concept.id)
    setEditText(concept.content)
  }

  const saveEdit = (conceptId: string) => {
    setConcepts(prev => prev.map(c => c.id === conceptId ? { ...c, content: editText } : c))
    setEditingId(null)
    setEditText('')
  }

  const togglePersona = (idx: number) => {
    setSelectedPersonas(prev =>
      prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
    )
  }

  const hooks = concepts.filter(c => c.type === 'hook')
  const body = concepts.find(c => c.type === 'body')
  const cta = concepts.find(c => c.type === 'cta')
  const statics = concepts.filter(c => c.type === 'static')
  const notes = concepts.find(c => c.type === 'notes')

  return (
    <div className="animate-fadeIn max-w-6xl">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-black mb-1">Concept Creator</h2>
        <p className="text-sm text-text-dim">
          Combine brand research + social listening + ad performance data to generate concepts
        </p>
      </div>

      {/* Data Sources Status */}
      <div className="flex gap-3 mb-6">
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold border ${
          research ? 'bg-green/10 border-green/30 text-green' : 'bg-surface border-border text-text-dim'
        }`}>
          <span>🔬</span> Brand Research {research ? '(active)' : '(none)'}
        </div>
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold border ${
          hasMotion ? 'bg-green/10 border-green/30 text-green' : 'bg-surface border-border text-text-dim'
        }`}>
          <span>📊</span> Motion Data {hasMotion ? `(synced ${new Date(brand.motion_data!.syncedAt).toLocaleDateString()})` : '(not synced)'}
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold border bg-surface border-border text-text-muted">
          <span>👂</span> Social Listening (auto-included if available)
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left Column - Controls */}
        <div className="space-y-4">
          {/* Concept Type */}
          <div>
            <label className="block text-2xs font-bold tracking-wider uppercase text-text-muted mb-2">Concept Type</label>
            <div className="flex gap-2">
              <button
                onClick={() => setConceptType('ugc')}
                className={`flex-1 px-3 py-2.5 rounded-lg text-sm font-bold transition-all ${
                  conceptType === 'ugc' ? 'bg-fulton text-white' : 'bg-surface border border-border text-text-muted hover:border-fulton/40'
                }`}
              >
                🎬 UGC Script
              </button>
              <button
                onClick={() => setConceptType('static')}
                className={`flex-1 px-3 py-2.5 rounded-lg text-sm font-bold transition-all ${
                  conceptType === 'static' ? 'bg-fulton text-white' : 'bg-surface border border-border text-text-muted hover:border-fulton/40'
                }`}
              >
                🖼 Static Image
              </button>
            </div>
          </div>

          {/* Hook Mode */}
          <div>
            <label className="block text-2xs font-bold tracking-wider uppercase text-text-muted mb-2">Generate By</label>
            <div className="flex gap-1.5">
              {(['personas', 'themes', 'collections'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => setHookMode(mode)}
                  disabled={mode === 'themes' && !themes.length || mode === 'collections' && !collections.length}
                  className={`flex-1 px-2 py-2 rounded text-xs font-bold transition-all ${
                    hookMode === mode
                      ? 'bg-blue text-white'
                      : mode === 'themes' && !themes.length || mode === 'collections' && !collections.length
                      ? 'bg-surface border border-border text-text-dim opacity-50 cursor-not-allowed'
                      : 'bg-surface border border-border text-text-muted hover:border-blue/40'
                  }`}
                >
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Persona Selector */}
          {hookMode === 'personas' && personas.length > 0 && (
            <div>
              <label className="block text-2xs font-bold tracking-wider uppercase text-text-muted mb-2">
                Personas {selectedPersonas.length > 0 && `(${selectedPersonas.length} selected)`}
              </label>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {personas.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => togglePersona(i)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-all ${
                      selectedPersonas.includes(i) || selectedPersonas.length === 0
                        ? 'bg-blue/10 border border-blue/30 text-text-primary'
                        : 'bg-surface border border-border text-text-dim hover:border-blue/20'
                    }`}
                  >
                    <div className="font-bold">{p.name}</div>
                    <div className="text-2xs text-text-dim mt-0.5 truncate">{p.hook}</div>
                  </button>
                ))}
              </div>
              <div className="text-2xs text-text-dim mt-1">{selectedPersonas.length === 0 ? 'All personas selected' : 'Click to toggle'}</div>
            </div>
          )}

          {/* Theme/Collection Display */}
          {hookMode === 'themes' && themes.length > 0 && (
            <div>
              <label className="block text-2xs font-bold tracking-wider uppercase text-text-muted mb-2">Themes</label>
              <div className="flex flex-wrap gap-1.5">
                {themes.map(t => (
                  <span key={t} className="px-2.5 py-1 bg-blue/10 border border-blue/20 rounded-full text-xs text-blue font-semibold">{t}</span>
                ))}
              </div>
            </div>
          )}

          {hookMode === 'collections' && collections.length > 0 && (
            <div>
              <label className="block text-2xs font-bold tracking-wider uppercase text-text-muted mb-2">Collections</label>
              <div className="flex flex-wrap gap-1.5">
                {collections.map(c => (
                  <span key={c} className="px-2.5 py-1 bg-blue/10 border border-blue/20 rounded-full text-xs text-blue font-semibold">{c}</span>
                ))}
              </div>
            </div>
          )}

          {/* Creative Direction */}
          <div>
            <label className="block text-2xs font-bold tracking-wider uppercase text-text-muted mb-2">
              Creative Direction <span className="text-text-dim font-normal">(optional)</span>
            </label>
            <textarea
              value={direction}
              onChange={e => setDirection(e.target.value)}
              placeholder="e.g. Focus on the summer angle, lean into the 'I wish I knew sooner' hook style, compare against competitor X..."
              className="w-full px-3 py-2.5 bg-surface border border-border rounded-lg text-xs text-text-primary placeholder:text-text-dim resize-none focus:border-fulton focus:outline-none"
              rows={3}
            />
          </div>

          {/* Generate Button */}
          <Button
            onClick={generate}
            disabled={generating}
            className="w-full justify-center text-sm py-3"
          >
            {generating ? (
              <span className="flex items-center gap-2">
                <LoadingSpinner size={14} /> Generating concepts...
              </span>
            ) : (
              `Generate ${conceptType === 'ugc' ? 'UGC Scripts' : 'Static Concepts'}`
            )}
          </Button>

          {/* Performance Summary */}
          {hasMotion && brand.motion_data && (
            <div className="bg-surface border border-border rounded-lg p-3">
              <div className="text-2xs font-bold tracking-wider uppercase text-text-muted mb-2">
                📊 Performance Context
              </div>
              {brand.motion_data.winningFormats?.length ? (
                <div className="mb-2">
                  <div className="text-2xs text-text-dim mb-1">Winning formats</div>
                  <div className="flex flex-wrap gap-1">
                    {brand.motion_data.winningFormats.map(f => (
                      <span key={f} className="px-2 py-0.5 bg-green/10 border border-green/20 rounded text-2xs text-green font-semibold">{f}</span>
                    ))}
                  </div>
                </div>
              ) : null}
              {brand.motion_data.winningHooks?.length ? (
                <div className="mb-2">
                  <div className="text-2xs text-text-dim mb-1">Winning hooks</div>
                  <div className="flex flex-wrap gap-1">
                    {brand.motion_data.winningHooks.map(h => (
                      <span key={h} className="px-2 py-0.5 bg-green/10 border border-green/20 rounded text-2xs text-green font-semibold">{h}</span>
                    ))}
                  </div>
                </div>
              ) : null}
              {brand.motion_data.topCreatives?.length ? (
                <div>
                  <div className="text-2xs text-text-dim mb-1">Top creatives</div>
                  {brand.motion_data.topCreatives.slice(0, 3).map((c, i) => (
                    <div key={i} className="text-2xs text-text-muted py-0.5">
                      {i + 1}. {c.name} - {c.roas ? `${c.roas}x ROAS` : c.cpa ? `$${c.cpa} CPA` : `$${c.spend} spend`}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Right Column - Output (2 cols wide) */}
        <div className="col-span-2">
          {concepts.length === 0 && !generating ? (
            <div className="flex items-center justify-center h-96 bg-surface border border-border rounded-xl">
              <div className="text-center">
                <div className="text-4xl mb-4">{conceptType === 'ugc' ? '🎬' : '🖼'}</div>
                <h3 className="text-lg font-black mb-2">
                  {conceptType === 'ugc' ? 'UGC Script Concepts' : 'Static Image Concepts'}
                </h3>
                <p className="text-sm text-text-dim max-w-sm">
                  Set your parameters and click Generate. Concepts will be informed by
                  {research ? ' brand research' : ''}
                  {hasMotion ? ', Motion performance data' : ''}
                  , and social listening signals.
                </p>
              </div>
            </div>
          ) : generating ? (
            <div className="flex items-center justify-center h-96 bg-surface border border-border rounded-xl">
              <div className="text-center">
                <LoadingSpinner size={32} />
                <p className="text-sm text-text-dim mt-4">Analyzing data and generating concepts...</p>
                <p className="text-2xs text-text-dim mt-1">This takes 15-30 seconds</p>
              </div>
            </div>
          ) : conceptType === 'ugc' ? (
            /* UGC Script Output */
            <div className="space-y-4">
              {/* Hooks */}
              {hooks.length > 0 && (
                <div>
                  <h3 className="text-sm font-black mb-3 flex items-center gap-2">
                    🎣 Hooks <span className="text-2xs text-text-dim font-normal">({hooks.length} variations)</span>
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {hooks.map(hook => (
                      <div key={hook.id} className="bg-surface border border-border rounded-xl p-4 group">
                        <div className="text-2xs font-bold text-blue mb-2">{hook.target}</div>
                        {editingId === hook.id ? (
                          <div>
                            <textarea
                              value={editText}
                              onChange={e => setEditText(e.target.value)}
                              className="w-full px-3 py-2 bg-page border border-border rounded text-xs text-text-primary resize-none focus:border-fulton focus:outline-none"
                              rows={4}
                            />
                            <div className="flex gap-2 mt-2">
                              <button onClick={() => saveEdit(hook.id)} className="text-2xs text-green font-bold">Save</button>
                              <button onClick={() => setEditingId(null)} className="text-2xs text-text-dim">Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <div className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">{hook.content}</div>
                        )}
                        <div className="flex gap-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => startEdit(hook)} className="text-2xs text-text-dim hover:text-text-primary">Edit</button>
                          <button onClick={() => { navigator.clipboard.writeText(hook.content); onToast('Copied', 'success') }} className="text-2xs text-text-dim hover:text-text-primary">Copy</button>
                          <button onClick={() => saveToInsights(hook)} className="text-2xs text-text-dim hover:text-text-primary">Save</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Body */}
              {body && (
                <div>
                  <h3 className="text-sm font-black mb-3">📝 Shared Body</h3>
                  <div className="bg-surface border border-border rounded-xl p-4 group">
                    {editingId === body.id ? (
                      <div>
                        <textarea
                          value={editText}
                          onChange={e => setEditText(e.target.value)}
                          className="w-full px-3 py-2 bg-page border border-border rounded text-xs text-text-primary resize-none focus:border-fulton focus:outline-none"
                          rows={6}
                        />
                        <div className="flex gap-2 mt-2">
                          <button onClick={() => saveEdit(body.id)} className="text-2xs text-green font-bold">Save</button>
                          <button onClick={() => setEditingId(null)} className="text-2xs text-text-dim">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">{body.content}</div>
                    )}
                    <div className="flex gap-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => startEdit(body)} className="text-2xs text-text-dim hover:text-text-primary">Edit</button>
                      <button onClick={() => { navigator.clipboard.writeText(body.content); onToast('Copied', 'success') }} className="text-2xs text-text-dim hover:text-text-primary">Copy</button>
                      <button onClick={() => saveToInsights(body)} className="text-2xs text-text-dim hover:text-text-primary">Save</button>
                    </div>
                  </div>
                </div>
              )}

              {/* CTA */}
              {cta && (
                <div>
                  <h3 className="text-sm font-black mb-3">📣 CTA</h3>
                  <div className="bg-surface border border-border rounded-xl p-4 group">
                    <div className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">{cta.content}</div>
                    <div className="flex gap-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { navigator.clipboard.writeText(cta.content); onToast('Copied', 'success') }} className="text-2xs text-text-dim hover:text-text-primary">Copy</button>
                    </div>
                  </div>
                </div>
              )}

              {/* Copy Full Script */}
              {hooks.length > 0 && body && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const full = hooks.map(h => `[${h.target}]\n${h.content}`).join('\n\n') + '\n\n---\n\n' + body.content + (cta ? '\n\n' + cta.content : '')
                    navigator.clipboard.writeText(full)
                    onToast('Full script copied', 'success')
                  }}
                >
                  Copy Full Script
                </Button>
              )}

              {/* Notes */}
              {notes && (
                <div className="bg-blue/5 border border-blue/20 rounded-lg p-3">
                  <div className="text-2xs font-bold text-blue mb-1">Why these concepts</div>
                  <div className="text-xs text-text-muted whitespace-pre-wrap">{notes.content}</div>
                </div>
              )}
            </div>
          ) : (
            /* Static Concept Output */
            <div className="space-y-4">
              {statics.length > 0 && (
                <div className="grid grid-cols-2 gap-4">
                  {statics.map(concept => (
                    <div key={concept.id} className="bg-surface border border-border rounded-xl overflow-hidden group">
                      {/* Visual Direction Preview */}
                      <div className="bg-page p-4 border-b border-border">
                        <div className="text-2xs font-bold text-blue mb-1">{concept.target}</div>
                        {concept.format && (
                          <span className="text-2xs px-2 py-0.5 bg-blue/10 border border-blue/20 rounded text-blue font-semibold">{concept.format}</span>
                        )}
                      </div>
                      <div className="p-4">
                        {concept.headline && (
                          <h4 className="text-lg font-black mb-2 text-text-primary">{concept.headline}</h4>
                        )}
                        {concept.support && (
                          <p className="text-sm text-text-secondary mb-3">{concept.support}</p>
                        )}
                        {concept.visual && (
                          <div className="mb-3">
                            <div className="text-2xs font-bold text-text-muted mb-1">Art Direction</div>
                            <p className="text-xs text-text-dim">{concept.visual}</p>
                          </div>
                        )}
                        {concept.cta && (
                          <div className="inline-block px-4 py-2 bg-fulton text-white rounded-lg text-xs font-bold">
                            {concept.cta}
                          </div>
                        )}
                        <div className="flex gap-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => { navigator.clipboard.writeText(`${concept.headline}\n${concept.support}\n\nVisual: ${concept.visual}\nCTA: ${concept.cta}`); onToast('Copied', 'success') }} className="text-2xs text-text-dim hover:text-text-primary">Copy</button>
                          <button onClick={() => saveToInsights(concept)} className="text-2xs text-text-dim hover:text-text-primary">Save</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {notes && (
                <div className="bg-blue/5 border border-blue/20 rounded-lg p-3">
                  <div className="text-2xs font-bold text-blue mb-1">Why these concepts</div>
                  <div className="text-xs text-text-muted whitespace-pre-wrap">{notes.content}</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
