'use client'

import { useState, useEffect, useCallback } from 'react'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import PageHeader from '@/components/ui/PageHeader'
import Modal from '@/components/ui/Modal'
import { LoadingState } from '@/components/ui/LoadingSpinner'
import EmptyState from '@/components/ui/EmptyState'

interface Creator {
  id: string
  name: string
  specialty: string
  email: string
  address: string
  portfolio_url: string
  color: string
  brand_id?: string
  ig_handle?: string
  gender?: string
  demo?: string
  deliverables?: number
  tracker_link?: string
  website?: string
}

type TabId = 'team' | 'addresses'

export default function UGCTeamView({ onToast }: { onToast: (msg: string, type: 'success' | 'error' | 'info') => void }) {
  const [tab, setTab] = useState<TabId>('team')
  const [creators, setCreators] = useState<Creator[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingCreator, setEditingCreator] = useState<Creator | null>(null)
  const [formData, setFormData] = useState({ name: '', specialty: '', email: '', address: '', portfolio_url: '', ig_handle: '', gender: '', demo: '', deliverables: 0, tracker_link: '', website: '' })
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [genderFilter, setGenderFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'name' | 'deliverables'>('name')

  const loadCreators = useCallback(async () => {
    try {
      const res = await fetch('/api/creators')
      const data = await res.json()
      if (data.creators) setCreators(data.creators)
    } catch { /* silent */ }
    setLoading(false)
  }, [])

  useEffect(() => { loadCreators() }, [loadCreators])

  const handleSave = async () => {
    if (!formData.name.trim()) { onToast('Name is required', 'error'); return }

    const colors = ['#2d7a54', '#7c3aed', '#d97706', '#2138ff', '#f87171', '#34d399', '#0066ff', '#e11d48']

    try {
      if (editingCreator) {
        const res = await fetch('/api/creators', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingCreator.id, ...formData }),
        })
        const data = await res.json()
        if (data.error) throw new Error(data.error)
        setCreators(prev => prev.map(c => c.id === editingCreator.id ? { ...c, ...data.creator } : c))
        onToast(`${formData.name} updated`, 'success')
      } else {
        const res = await fetch('/api/creators', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...formData, color: colors[creators.length % colors.length] }),
        })
        const data = await res.json()
        if (data.error) throw new Error(data.error)
        setCreators(prev => [...prev, data.creator])
        onToast(`${formData.name} added to roster`, 'success')
      }
    } catch (err: unknown) {
      onToast(`Failed: ${err instanceof Error ? err.message : String(err)}`, 'error')
    }

    setFormData({ name: '', specialty: '', email: '', address: '', portfolio_url: '', ig_handle: '', gender: '', demo: '', deliverables: 0, tracker_link: '', website: '' })
    setShowAddModal(false)
    setEditingCreator(null)
  }

  const handleDelete = async (creator: Creator) => {
    if (!confirm(`Remove ${creator.name} from the roster?`)) return
    try {
      const res = await fetch('/api/creators', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: creator.id }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setCreators(prev => prev.filter(c => c.id !== creator.id))
      onToast(`${creator.name} removed`, 'success')
    } catch (err: unknown) {
      onToast(`Failed: ${err instanceof Error ? err.message : String(err)}`, 'error')
    }
  }

  const openEdit = (creator: Creator) => {
    setEditingCreator(creator)
    setFormData({
      name: creator.name,
      specialty: creator.specialty || '',
      email: creator.email || '',
      address: creator.address || '',
      portfolio_url: creator.portfolio_url || '',
      ig_handle: creator.ig_handle || '',
      gender: creator.gender || '',
      demo: creator.demo || '',
      deliverables: creator.deliverables || 0,
      tracker_link: creator.tracker_link || '',
      website: creator.website || '',
    })
    setShowAddModal(true)
  }

  const handleExportAddresses = () => {
    const text = creators.filter(c => c.address).map(c => c.address.replace(/\n/g, ', ')).join('\n')
    navigator.clipboard.writeText(text)
    onToast('All addresses copied to clipboard', 'success')
  }

  const handleExportSelected = () => {
    const selected = creators.filter(c => selectedIds.has(c.id) && c.address)
    if (!selected.length) { onToast('Select creators with addresses first', 'error'); return }
    const text = selected.map(c => `${c.name}\n${c.address.replace(/\n/g, ', ')}\n${c.email || ''}`).join('\n\n')
    navigator.clipboard.writeText(text)
    onToast(`${selected.length} address${selected.length > 1 ? 'es' : ''} copied to clipboard`, 'success')
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === creators.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(creators.map(c => c.id)))
  }

  // Get unique genders for filter
  const genders = [...new Set(creators.map(c => c.gender).filter(Boolean))]

  // Filter and sort
  const filteredCreators = creators
    .filter(c => genderFilter === 'all' || c.gender === genderFilter)
    .sort((a, b) => {
      if (sortBy === 'deliverables') return (b.deliverables || 0) - (a.deliverables || 0)
      return a.name.localeCompare(b.name)
    })

  if (loading) return <LoadingState size="md" title="Loading team roster..." />

  return (
    <div className="animate-fadeIn">
      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 border-b border-border">
        <button onClick={() => setTab('team')} className={`px-4 py-2.5 text-sm font-bold border-b-2 -mb-px transition-colors ${tab === 'team' ? 'border-blue text-blue' : 'border-transparent text-text-dim hover:text-text-primary'}`}>
          Full Team ({creators.length})
        </button>
        <button onClick={() => setTab('addresses')} className={`px-4 py-2.5 text-sm font-bold border-b-2 -mb-px transition-colors ${tab === 'addresses' ? 'border-blue text-blue' : 'border-transparent text-text-dim hover:text-text-primary'}`}>
          Addresses
        </button>
      </div>

      {/* FULL TEAM TAB */}
      {tab === 'team' && (
        <>
          <PageHeader
            title="UGC Team Roster"
            subtitle="Manage your creator network"
            action={<Button onClick={() => { setEditingCreator(null); setFormData({ name: '', specialty: '', email: '', address: '', portfolio_url: '', ig_handle: '', gender: '', demo: '', deliverables: 0, tracker_link: '', website: '' }); setShowAddModal(true) }}>+ Add Creator</Button>}
          />

          {/* Filters */}
          {creators.length > 0 && (
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center gap-2">
                <span className="text-2xs font-bold uppercase tracking-wider text-text-dim">Gender:</span>
                <div className="flex gap-1">
                  <button onClick={() => setGenderFilter('all')}
                    className={`px-2.5 py-1 text-xs rounded border transition-all ${genderFilter === 'all' ? 'border-blue bg-blue-light text-blue font-bold' : 'border-border text-text-dim hover:border-text-subtle'}`}>
                    All
                  </button>
                  {genders.map(g => (
                    <button key={g} onClick={() => setGenderFilter(g!)}
                      className={`px-2.5 py-1 text-xs rounded border transition-all ${genderFilter === g ? 'border-blue bg-blue-light text-blue font-bold' : 'border-border text-text-dim hover:border-text-subtle'}`}>
                      {g}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2 ml-4">
                <span className="text-2xs font-bold uppercase tracking-wider text-text-dim">Sort:</span>
                <select value={sortBy} onChange={e => setSortBy(e.target.value as 'name' | 'deliverables')}
                  className="px-2 py-1 bg-page border border-border rounded text-xs text-text-primary focus:border-blue focus:outline-none">
                  <option value="name">A-Z</option>
                  <option value="deliverables">Deliverables</option>
                </select>
              </div>
              <span className="text-2xs text-text-dim ml-auto">{filteredCreators.length} of {creators.length} creators</span>
            </div>
          )}

          {creators.length === 0 ? (
            <EmptyState
              emoji="👥"
              title="No creators yet"
              subtitle="Add UGC creators to your roster to manage contacts, addresses, and portfolios"
              action={<Button onClick={() => setShowAddModal(true)}>+ Add First Creator</Button>}
            />
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
              {filteredCreators.map(creator => (
                <Card key={creator.id} className="hover:border-blue/40 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-black text-white shrink-0" style={{ background: creator.color || '#2138ff' }}>
                      {creator.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold">{creator.name}</div>
                      {creator.ig_handle && <div className="text-2xs text-blue">@{creator.ig_handle.replace('@', '')}</div>}
                      <div className="flex gap-2 mt-1 flex-wrap">
                        {creator.gender && <span className="text-2xs bg-elevated border border-border px-1.5 py-0.5 rounded">{creator.gender}</span>}
                        {creator.demo && <span className="text-2xs bg-elevated border border-border px-1.5 py-0.5 rounded">{creator.demo}</span>}
                        {(creator.deliverables || 0) > 0 && <span className="text-2xs bg-blue-light text-blue px-1.5 py-0.5 rounded font-bold">{creator.deliverables} deliverables</span>}
                      </div>
                      {creator.specialty && <div className="text-2xs text-text-dim mt-1 italic">{creator.specialty}</div>}
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(creator)}>Edit</Button>
                    {creator.website && <Button size="sm" variant="ghost" onClick={() => window.open(creator.website, '_blank')}>Site</Button>}
                    {creator.tracker_link && <Button size="sm" variant="ghost" onClick={() => window.open(creator.tracker_link, '_blank')}>Tracker</Button>}
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(creator)}>Remove</Button>
                  </div>
                </Card>
              ))}

              {/* Add creator card */}
              <button
                onClick={() => { setEditingCreator(null); setFormData({ name: '', specialty: '', email: '', address: '', portfolio_url: '', ig_handle: '', gender: '', demo: '', deliverables: 0, tracker_link: '', website: '' }); setShowAddModal(true) }}
                className="border-2 border-dashed border-border rounded-lg p-5 text-center cursor-pointer flex flex-col items-center justify-center min-h-[200px] hover:border-blue/40 transition-colors"
              >
                <div className="text-4xl opacity-30 mb-2">+</div>
                <div className="text-sm font-bold">Add Creator</div>
                <div className="text-2xs text-text-dim mt-1">Name, contact, address, portfolio</div>
              </button>
            </div>
          )}
        </>
      )}

      {/* ADDRESSES TAB */}
      {tab === 'addresses' && (
        <>
          <PageHeader
            title="Creator Addresses"
            subtitle="Mailing addresses for product shipments"
            action={
              <div className="flex gap-2">
                {selectedIds.size > 0 && (
                  <Button onClick={handleExportSelected}>
                    Export Selected ({selectedIds.size})
                  </Button>
                )}
                <Button variant="secondary" onClick={handleExportAddresses}>Export All</Button>
              </div>
            }
          />

          {creators.length === 0 ? (
            <EmptyState emoji="📋" title="No addresses" subtitle="Add creators to the roster first" />
          ) : (
            <Card padding={false}>
              <div className="grid grid-cols-[40px_180px_1fr_150px_130px_70px_80px] gap-0 px-5 py-3 border-b border-border">
                <div className="flex items-center">
                  <input type="checkbox" checked={selectedIds.size === creators.length} onChange={toggleSelectAll}
                    className="w-4 h-4 accent-blue cursor-pointer" />
                </div>
                <span className="text-2xs font-bold uppercase tracking-wider text-text-dim">Name</span>
                <span className="text-2xs font-bold uppercase tracking-wider text-text-dim">Address</span>
                <span className="text-2xs font-bold uppercase tracking-wider text-text-dim">IG Handle</span>
                <span className="text-2xs font-bold uppercase tracking-wider text-text-dim">Demo</span>
                <span className="text-2xs font-bold uppercase tracking-wider text-text-dim">Count</span>
                <span className="text-2xs font-bold uppercase tracking-wider text-text-dim">Action</span>
              </div>
              {filteredCreators.map(creator => (
                <div key={creator.id} className={`grid grid-cols-[40px_180px_1fr_150px_130px_70px_80px] gap-0 px-5 py-3 border-b border-border/50 items-center transition-colors cursor-pointer ${selectedIds.has(creator.id) ? 'bg-blue/5' : 'hover:bg-elevated/50'}`}
                  onClick={() => toggleSelect(creator.id)}>
                  <div className="flex items-center">
                    <input type="checkbox" checked={selectedIds.has(creator.id)} onChange={() => toggleSelect(creator.id)}
                      onClick={e => e.stopPropagation()} className="w-4 h-4 accent-blue cursor-pointer" />
                  </div>
                  <span className="text-sm font-bold">{creator.name}</span>
                  <span className="text-xs text-text-dim pr-4">{creator.address || 'No address on file'}</span>
                  <span className="text-xs text-blue">{creator.ig_handle ? `@${creator.ig_handle.replace('@', '')}` : '-'}</span>
                  <span className="text-xs text-text-dim">{creator.demo || '-'}</span>
                  <span className="text-xs font-bold text-center">{creator.deliverables || 0}</span>
                  <Button size="sm" variant="ghost" onClick={(e: React.MouseEvent) => {
                    e.stopPropagation()
                    navigator.clipboard.writeText(`${creator.name}\n${creator.address || ''}\n${creator.email || ''}`)
                    onToast(`${creator.name}'s info copied`, 'success')
                  }}>
                    Copy
                  </Button>
                </div>
              ))}
            </Card>
          )}
        </>
      )}

      {/* Add/Edit Creator Modal */}
      <Modal
        open={showAddModal}
        onClose={() => { setShowAddModal(false); setEditingCreator(null) }}
        title={editingCreator ? 'Edit Creator' : 'Add Creator'}
        subtitle={editingCreator ? `Update ${editingCreator.name}'s info` : 'Add a new UGC creator to your roster'}
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-2xs font-bold tracking-wider uppercase text-text-muted mb-1.5">Name *</label>
              <input type="text" placeholder="Full name" value={formData.name} onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))} className="w-full px-3 py-2.5 bg-page border border-border rounded text-sm text-text-primary focus:border-blue focus:outline-none" autoFocus />
            </div>
            <div>
              <label className="block text-2xs font-bold tracking-wider uppercase text-text-muted mb-1.5">IG Handle</label>
              <input type="text" placeholder="@handle" value={formData.ig_handle} onChange={e => setFormData(prev => ({ ...prev, ig_handle: e.target.value }))} className="w-full px-3 py-2.5 bg-page border border-border rounded text-sm text-text-primary focus:border-blue focus:outline-none" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-2xs font-bold tracking-wider uppercase text-text-muted mb-1.5">Gender</label>
              <select value={formData.gender} onChange={e => setFormData(prev => ({ ...prev, gender: e.target.value }))} className="w-full px-3 py-2.5 bg-page border border-border rounded text-sm text-text-primary focus:border-blue focus:outline-none">
                <option value="">Select</option>
                <option value="Female">Female</option>
                <option value="Male">Male</option>
                <option value="Non-binary">Non-binary</option>
              </select>
            </div>
            <div>
              <label className="block text-2xs font-bold tracking-wider uppercase text-text-muted mb-1.5">Demo</label>
              <input type="text" placeholder="e.g. Mid 20s woman" value={formData.demo} onChange={e => setFormData(prev => ({ ...prev, demo: e.target.value }))} className="w-full px-3 py-2.5 bg-page border border-border rounded text-sm text-text-primary focus:border-blue focus:outline-none" />
            </div>
            <div>
              <label className="block text-2xs font-bold tracking-wider uppercase text-text-muted mb-1.5">Deliverables</label>
              <input type="number" placeholder="0" value={formData.deliverables} onChange={e => setFormData(prev => ({ ...prev, deliverables: parseInt(e.target.value) || 0 }))} className="w-full px-3 py-2.5 bg-page border border-border rounded text-sm text-text-primary focus:border-blue focus:outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-2xs font-bold tracking-wider uppercase text-text-muted mb-1.5">Email</label>
            <input type="email" placeholder="creator@email.com" value={formData.email} onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))} className="w-full px-3 py-2.5 bg-page border border-border rounded text-sm text-text-primary focus:border-blue focus:outline-none" />
          </div>
          <div>
            <label className="block text-2xs font-bold tracking-wider uppercase text-text-muted mb-1.5">Website / Portfolio</label>
            <input type="url" placeholder="https://..." value={formData.website} onChange={e => setFormData(prev => ({ ...prev, website: e.target.value }))} className="w-full px-3 py-2.5 bg-page border border-border rounded text-sm text-text-primary focus:border-blue focus:outline-none" />
          </div>
          <div>
            <label className="block text-2xs font-bold tracking-wider uppercase text-text-muted mb-1.5">Tracker Link</label>
            <input type="url" placeholder="Google Sheets or tracking URL" value={formData.tracker_link} onChange={e => setFormData(prev => ({ ...prev, tracker_link: e.target.value }))} className="w-full px-3 py-2.5 bg-page border border-border rounded text-sm text-text-primary focus:border-blue focus:outline-none" />
          </div>
          <div>
            <label className="block text-2xs font-bold tracking-wider uppercase text-text-muted mb-1.5">Notes</label>
            <input type="text" placeholder="e.g. Great on camera, specializes in lifestyle" value={formData.specialty} onChange={e => setFormData(prev => ({ ...prev, specialty: e.target.value }))} className="w-full px-3 py-2.5 bg-page border border-border rounded text-sm text-text-primary focus:border-blue focus:outline-none" />
          </div>
          <div className="text-2xs font-bold tracking-wider uppercase text-text-muted mb-1.5">Mailing Address</div>
          <div>
            <input type="text" placeholder="Street address" value={formData.address.split('\n')[0] || ''} onChange={e => { const parts = formData.address.split('\n'); parts[0] = e.target.value; setFormData(prev => ({ ...prev, address: parts.join('\n') })) }} className="w-full px-3 py-2.5 bg-page border border-border rounded-t text-sm text-text-primary focus:border-blue focus:outline-none" />
            <input type="text" placeholder="Apt, suite, unit (optional)" value={formData.address.split('\n')[1] || ''} onChange={e => { const parts = formData.address.split('\n'); parts[1] = e.target.value; setFormData(prev => ({ ...prev, address: parts.filter(Boolean).join('\n') })) }} className="w-full px-3 py-2.5 bg-page border-x border-border text-sm text-text-primary focus:border-blue focus:outline-none" />
            <div className="flex">
              <input type="text" placeholder="City" value={formData.address.split('\n')[2] || ''} onChange={e => { const parts = formData.address.split('\n'); parts[2] = e.target.value; setFormData(prev => ({ ...prev, address: parts.filter(Boolean).join('\n') })) }} className="flex-1 px-3 py-2.5 bg-page border border-border rounded-bl text-sm text-text-primary focus:border-blue focus:outline-none" />
              <input type="text" placeholder="State" value={formData.address.split('\n')[3] || ''} onChange={e => { const parts = formData.address.split('\n'); parts[3] = e.target.value; setFormData(prev => ({ ...prev, address: parts.filter(Boolean).join('\n') })) }} className="w-20 px-3 py-2.5 bg-page border-y border-border text-sm text-text-primary focus:border-blue focus:outline-none" />
              <input type="text" placeholder="ZIP" value={formData.address.split('\n')[4] || ''} onChange={e => { const parts = formData.address.split('\n'); parts[4] = e.target.value; setFormData(prev => ({ ...prev, address: parts.filter(Boolean).join('\n') })) }} className="w-24 px-3 py-2.5 bg-page border border-border rounded-br text-sm text-text-primary focus:border-blue focus:outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-2xs font-bold tracking-wider uppercase text-text-muted mb-1.5">Portfolio URL (optional)</label>
            <input type="url" placeholder="https://..." value={formData.portfolio_url} onChange={e => setFormData(prev => ({ ...prev, portfolio_url: e.target.value }))} className="w-full px-3 py-2.5 bg-page border border-border rounded text-sm text-text-primary focus:border-blue focus:outline-none" />
          </div>
          <Button onClick={handleSave} className="w-full justify-center mt-2" disabled={!formData.name.trim()}>
            {editingCreator ? 'Save Changes' : 'Add to Roster'}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
