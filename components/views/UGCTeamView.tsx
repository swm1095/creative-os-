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
}

type TabId = 'team' | 'addresses'

export default function UGCTeamView({ onToast }: { onToast: (msg: string, type: 'success' | 'error' | 'info') => void }) {
  const [tab, setTab] = useState<TabId>('team')
  const [creators, setCreators] = useState<Creator[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingCreator, setEditingCreator] = useState<Creator | null>(null)
  const [formData, setFormData] = useState({ name: '', specialty: '', email: '', address: '', portfolio_url: '' })

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

    setFormData({ name: '', specialty: '', email: '', address: '', portfolio_url: '' })
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
    })
    setShowAddModal(true)
  }

  const handleExportAddresses = () => {
    const text = creators.map(c => `${c.name}\n${c.address || 'No address'}\n${c.email || ''}\n`).join('\n---\n\n')
    navigator.clipboard.writeText(text)
    onToast('All addresses copied to clipboard', 'success')
  }

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
            action={<Button onClick={() => { setEditingCreator(null); setFormData({ name: '', specialty: '', email: '', address: '', portfolio_url: '' }); setShowAddModal(true) }}>+ Add Creator</Button>}
          />

          {creators.length === 0 ? (
            <EmptyState
              emoji="👥"
              title="No creators yet"
              subtitle="Add UGC creators to your roster to manage contacts, addresses, and portfolios"
              action={<Button onClick={() => setShowAddModal(true)}>+ Add First Creator</Button>}
            />
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
              {creators.map(creator => (
                <Card key={creator.id} className="text-center hover:border-blue/40 transition-colors">
                  <div className="w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center text-2xl font-black text-white" style={{ background: creator.color || '#2138ff' }}>
                    {creator.name.charAt(0)}
                  </div>
                  <div className="text-sm font-bold">{creator.name}</div>
                  {creator.specialty && <div className="text-xs text-text-dim mt-1">{creator.specialty}</div>}
                  {creator.email && <div className="text-2xs text-text-dim mt-1">{creator.email}</div>}
                  <div className="flex gap-2 mt-3 justify-center">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(creator)}>Edit</Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(creator)}>Remove</Button>
                  </div>
                </Card>
              ))}

              {/* Add creator card */}
              <button
                onClick={() => { setEditingCreator(null); setFormData({ name: '', specialty: '', email: '', address: '', portfolio_url: '' }); setShowAddModal(true) }}
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
            action={<Button onClick={handleExportAddresses}>Export All</Button>}
          />

          {creators.length === 0 ? (
            <EmptyState emoji="📋" title="No addresses" subtitle="Add creators to the roster first" />
          ) : (
            <Card padding={false}>
              <div className="grid grid-cols-[180px_1fr_180px_120px] gap-0 px-5 py-3 border-b border-border">
                <span className="text-2xs font-bold uppercase tracking-wider text-text-dim">Name</span>
                <span className="text-2xs font-bold uppercase tracking-wider text-text-dim">Address</span>
                <span className="text-2xs font-bold uppercase tracking-wider text-text-dim">Email</span>
                <span className="text-2xs font-bold uppercase tracking-wider text-text-dim">Action</span>
              </div>
              {creators.map(creator => (
                <div key={creator.id} className="grid grid-cols-[180px_1fr_180px_120px] gap-0 px-5 py-3 border-b border-border/50 items-center hover:bg-elevated/50 transition-colors">
                  <span className="text-sm font-bold">{creator.name}</span>
                  <span className="text-xs text-text-dim">{creator.address || 'No address on file'}</span>
                  <span className="text-xs text-text-dim">{creator.email || '-'}</span>
                  <Button size="sm" variant="ghost" onClick={() => {
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
          <div>
            <label className="block text-2xs font-bold tracking-wider uppercase text-text-muted mb-1.5">Name *</label>
            <input type="text" placeholder="Full name" value={formData.name} onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))} className="w-full px-3 py-2.5 bg-page border border-border rounded text-sm text-text-primary focus:border-blue focus:outline-none" autoFocus />
          </div>
          <div>
            <label className="block text-2xs font-bold tracking-wider uppercase text-text-muted mb-1.5">Specialty</label>
            <input type="text" placeholder="e.g. Lifestyle, Fitness, Wellness" value={formData.specialty} onChange={e => setFormData(prev => ({ ...prev, specialty: e.target.value }))} className="w-full px-3 py-2.5 bg-page border border-border rounded text-sm text-text-primary focus:border-blue focus:outline-none" />
          </div>
          <div>
            <label className="block text-2xs font-bold tracking-wider uppercase text-text-muted mb-1.5">Email</label>
            <input type="email" placeholder="creator@email.com" value={formData.email} onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))} className="w-full px-3 py-2.5 bg-page border border-border rounded text-sm text-text-primary focus:border-blue focus:outline-none" />
          </div>
          <div>
            <label className="block text-2xs font-bold tracking-wider uppercase text-text-muted mb-1.5">Mailing Address</label>
            <input type="text" placeholder="Full mailing address for shipments" value={formData.address} onChange={e => setFormData(prev => ({ ...prev, address: e.target.value }))} className="w-full px-3 py-2.5 bg-page border border-border rounded text-sm text-text-primary focus:border-blue focus:outline-none" />
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
