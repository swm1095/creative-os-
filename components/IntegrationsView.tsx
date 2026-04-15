'use client'

import { useState } from 'react'

interface Integration {
  id: string
  name: string
  desc: string
  logo: string
  logoBg: string
  tags: string[]
  highlight: string[]
  category: 'core' | 'imagegen' | 'postprocess'
  docsUrl: string
  connected: boolean
}

const DEFAULT_INTEGRATIONS: Integration[] = [
  // Core
  { id: 'claude',      name: 'Claude API',      desc: 'Powers brief writing, persona building, multi-pass QC loops, and brand analysis.',      logo: 'Cl',  logoBg: '#c96442', tags: ['Briefs','QC','Required'],                                  highlight: ['Briefs','QC'],          category: 'core',        docsUrl: 'https://console.anthropic.com/keys',                  connected: !!process.env.NEXT_PUBLIC_HAS_ANTHROPIC },
  { id: 'ideogram',    name: 'Ideogram',         desc: 'Best-in-class text rendering inside images. Essential for ad creatives with copy.',      logo: 'Id',  logoBg: '#0f172a', tags: ['Text in images','Typography'],                              highlight: ['Text in images'],       category: 'imagegen',    docsUrl: 'https://ideogram.ai/manage-api',                      connected: false },
  // Image gen
  { id: 'fal',         name: 'fal.ai Flux',      desc: 'Fast inference for Flux models. Low cost per image, ideal for high-volume runs.',        logo: 'fal', logoBg: '#1d4ed8', tags: ['Flux','Low cost','Fast'],                                   highlight: [],                       category: 'imagegen',    docsUrl: 'https://fal.ai/dashboard/keys',                       connected: false },
  { id: 'kling',       name: 'Kling AI',         desc: 'High-quality text-to-image and image-to-image generation for lifestyle/product scenes.', logo: 'KL',  logoBg: '#6d28d9', tags: ['Image gen','img2img','Batch'],                              highlight: ['Image gen'],            category: 'imagegen',    docsUrl: 'https://klingai.com/settings/api',                    connected: false },
  { id: 'stability',   name: 'Stability AI',     desc: 'Fast batch generation and inpainting for product shots. Great for high-volume runs.',    logo: 'SA',  logoBg: '#7c3aed', tags: ['Inpainting','High volume'],                                 highlight: [],                       category: 'imagegen',    docsUrl: 'https://platform.stability.ai/account/keys',          connected: false },
  // Post-process
  { id: 'removebg',    name: 'Remove.bg',        desc: 'Instant automated background removal. Runs on every product image before templating.',   logo: 'Rb',  logoBg: '#00a86b', tags: ['Auto BG removal','Product shots'],                          highlight: ['Auto BG removal'],      category: 'postprocess', docsUrl: 'https://www.remove.bg/dashboard#api-key',             connected: false },
  { id: 'creatomate',  name: 'Creatomate',       desc: 'Template-based rendering engine. Produces final 1×1, 4×5, 9×16 exports at scale.',      logo: 'Cr',  logoBg: '#e8441a', tags: ['Final render','Multi-format'],                              highlight: ['Final render'],         category: 'postprocess', docsUrl: 'https://creatomate.com/docs/api/rest-api',            connected: false },
  { id: 'cloudinary',  name: 'Cloudinary',       desc: 'Asset storage, CDN delivery, and auto-compression for fast gallery performance.',        logo: 'Cd',  logoBg: '#3b82f6', tags: ['Storage','CDN','Compression'],                              highlight: [],                       category: 'postprocess', docsUrl: 'https://cloudinary.com/console/settings/api-keys',    connected: false },
]

export default function IntegrationsView() {
  const [integrations, setIntegrations] = useState(DEFAULT_INTEGRATIONS)
  const [modal, setModal] = useState<{ id: string; name: string; docsUrl: string } | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [saving, setSaving] = useState(false)

  const connected = integrations.filter(i => i.connected)

  const openModal = (id: string, name: string, docsUrl: string) => {
    setApiKey('')
    setModal({ id, name, docsUrl })
  }

  const saveConnection = async () => {
    if (!apiKey.trim() || !modal) return
    setSaving(true)
    // In production, save the API key to Supabase (encrypted) or env
    // For now, mark as connected in local state
    await new Promise(r => setTimeout(r, 600))
    setIntegrations(prev => prev.map(i => i.id === modal.id ? { ...i, connected: true } : i))
    setModal(null)
    setSaving(false)
  }

  const disconnect = (id: string) => {
    setIntegrations(prev => prev.map(i => i.id === id ? { ...i, connected: false } : i))
  }

  const core    = integrations.filter(i => i.category === 'core')
  const imgGen  = integrations.filter(i => i.category === 'imagegen')
  const post    = integrations.filter(i => i.category === 'postprocess')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Topbar */}
      <div style={{ padding: '14px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: '-0.03em' }}>Integrations</div>
          <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 1 }}>Connect tools to power your creative pipeline</div>
        </div>
        <div style={{ flex: 1 }}/>
        <span className="status-pill sp-done">{connected.length} connected</span>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 24, background: 'var(--gray-50)' }}>
        {/* Pipeline diagram */}
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '18px 20px', marginBottom: 28 }}>
          <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '-0.01em', marginBottom: 10 }}>How connected tools work together</div>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0 }}>
            {[
              { label: 'Brand Upload',   core: true },
              { label: 'Claude (briefs + QC)', core: true },
              { label: 'Ideogram / fal.ai', core: false },
              { label: 'Remove.bg', core: false },
              { label: 'Creatomate', core: false },
              { label: 'Gallery', core: true },
            ].map((node, i, arr) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{
                  fontSize: 11, fontWeight: 600, padding: '5px 10px', borderRadius: 5,
                  background: node.core ? 'var(--blue-light)' : 'var(--gray-50)',
                  border: `1px solid ${node.core ? 'var(--blue-mid)' : 'var(--border)'}`,
                  color: node.core ? 'var(--blue)' : 'var(--gray-700)',
                  whiteSpace: 'nowrap'
                }}>{node.label}</div>
                {i < arr.length - 1 && <span style={{ fontSize: 12, color: 'var(--gray-300)', padding: '0 4px' }}>→</span>}
              </div>
            ))}
          </div>
        </div>

        <SectionLabel>Core — required</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 28 }}>
          {core.map(i => <IntCard key={i.id} int={i} onConnect={openModal} onDisconnect={disconnect}/>)}
        </div>

        <SectionLabel>Image generation</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 28 }}>
          {imgGen.map(i => <IntCard key={i.id} int={i} onConnect={openModal} onDisconnect={disconnect}/>)}
        </div>

        <SectionLabel>Post-processing & output</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 28 }}>
          {post.map(i => <IntCard key={i.id} int={i} onConnect={openModal} onDisconnect={disconnect}/>)}
        </div>

        {/* Version notice */}
        <div style={{ background: 'var(--blue-light)', border: '1px solid var(--blue-mid)', borderRadius: 8, padding: '14px 18px', fontSize: 12, color: 'var(--blue)' }}>
          <strong>🔔 Stack update policy:</strong> Claude will notify you when new major versions of connected APIs are released. Check this panel for upgrade badges.
        </div>
      </div>

      {/* API Key Modal */}
      {modal && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500 }}>
          <div style={{ background: 'white', borderRadius: 12, border: '1px solid var(--border)', padding: '28px 28px 24px', width: 380 }}>
            <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 6 }}>Connect {modal.name}</div>
            <div style={{ fontSize: 12, color: 'var(--gray-500)', marginBottom: 20 }}>Paste your API key below. Keys are stored securely and never shared.</div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--gray-500)', marginBottom: 6 }}>API Key</div>
            <input
              className="input-base"
              type="password"
              placeholder="sk-••••••••••••"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveConnection()}
              style={{ marginBottom: 12 }}
            />
            <a href={modal.docsUrl} target="_blank" rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--blue)', textDecoration: 'none', fontWeight: 600, marginBottom: 20 }}>
              Get your API key ↗
            </a>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn-ghost" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn-primary" onClick={saveConnection} disabled={saving || !apiKey.trim()}>
                {saving ? 'Saving...' : 'Save & connect'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
      color: 'var(--gray-300)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12
    }}>
      {children}
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }}/>
    </div>
  )
}

function IntCard({ int, onConnect, onDisconnect }: {
  int: Integration
  onConnect: (id: string, name: string, docsUrl: string) => void
  onDisconnect: (id: string) => void
}) {
  return (
    <div style={{
      background: int.connected ? '#f0fdf4' : 'white',
      border: `1px solid ${int.connected ? '#bbf7d0' : 'var(--border)'}`,
      borderRadius: 10, padding: '18px 20px', display: 'flex', alignItems: 'flex-start', gap: 14
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 8, background: int.logoBg, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, fontWeight: 900, color: 'white', letterSpacing: '-0.02em'
      }}>{int.logo}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 3 }}>{int.name}</div>
        <div style={{ fontSize: 12, color: 'var(--gray-500)', lineHeight: 1.45, marginBottom: 10 }}>{int.desc}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 12 }}>
          {int.tags.map(tag => (
            <span key={tag} style={{
              fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 3,
              background: int.highlight.includes(tag) ? 'var(--blue-light)' : 'var(--gray-100)',
              color: int.highlight.includes(tag) ? 'var(--blue)' : 'var(--gray-500)'
            }}>{tag}</span>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {int.connected ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, padding: '6px 12px', borderRadius: 5, background: 'var(--green-light)', border: '1px solid #bbf7d0', color: 'var(--green)' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)' }}/>
                Connected
              </div>
              <button
                onClick={() => onDisconnect(int.id)}
                style={{ fontSize: 11, padding: '5px 10px', borderRadius: 5, background: 'transparent', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--gray-500)', fontFamily: 'inherit', transition: 'all 0.15s' }}
              >Disconnect</button>
            </>
          ) : (
            <button
              onClick={() => onConnect(int.id, int.name, int.docsUrl)}
              className="btn-primary"
              style={{ fontSize: 12, padding: '7px 14px' }}
            >Connect via API key</button>
          )}
        </div>
      </div>
    </div>
  )
}
