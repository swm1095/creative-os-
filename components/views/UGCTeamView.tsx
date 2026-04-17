'use client'

import { useState } from 'react'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import PageHeader from '@/components/ui/PageHeader'
import Modal from '@/components/ui/Modal'

interface Creator {
  id: string
  name: string
  specialty: string
  email: string
  address: string
  portfolioUrl: string
  color: string
}

const INITIAL_CREATORS: Creator[] = [
  { id: '1', name: 'Jess Martinez', specialty: 'Lifestyle, Influencer', email: 'jess@creator.com', address: '123 Creator Lane, Los Angeles, CA 90012', portfolioUrl: '', color: '#2d7a54' },
  { id: '2', name: 'Mike Chen', specialty: 'Fitness, Creator', email: 'mike@fitness.co', address: '456 Content Ave, Austin, TX 73301', portfolioUrl: '', color: '#7c3aed' },
  { id: '3', name: 'Sarah Kim', specialty: 'Wellness, Content Creator', email: 'sarah@wellness.io', address: '789 Brand Blvd, New York, NY 10001', portfolioUrl: '', color: '#d97706' },
]

type TabId = 'roster' | 'team' | 'addresses'

export default function UGCTeamView({ onToast }: { onToast: (msg: string, type: 'success' | 'error' | 'info') => void }) {
  const [tab, setTab] = useState<TabId>('team')
  const [creators, setCreators] = useState<Creator[]>(INITIAL_CREATORS)
  const [showAddModal, setShowAddModal] = useState(false)
  const [newCreator, setNewCreator] = useState({ name: '', specialty: '', email: '', address: '', portfolioUrl: '' })

  const handleAddCreator = () => {
    if (!newCreator.name.trim()) { onToast('Name is required', 'error'); return }
    const colors = ['#2d7a54', '#7c3aed', '#d97706', '#2138ff', '#f87171', '#34d399']
    const creator: Creator = {
      id: Date.now().toString(),
      ...newCreator,
      color: colors[creators.length % colors.length],
    }
    setCreators(prev => [...prev, creator])
    setNewCreator({ name: '', specialty: '', email: '', address: '', portfolioUrl: '' })
    setShowAddModal(false)
    onToast(`${creator.name} added to roster`, 'success')
  }

  const handleExportAddresses = () => {
    const text = creators.map(c => `${c.name}\n${c.address}\n${c.email}\n`).join('\n---\n\n')
    navigator.clipboard.writeText(text)
    onToast('All addresses copied to clipboard', 'success')
  }

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
            action={<Button onClick={() => setShowAddModal(true)}>+ Add Creator</Button>}
          />
          <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
            {creators.map(creator => (
              <Card key={creator.id} className="text-center hover:border-blue/40 transition-colors cursor-pointer">
                <div className="w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center text-2xl font-black text-white" style={{ background: creator.color }}>
                  {creator.name.charAt(0)}
                </div>
                <div className="text-sm font-bold">{creator.name}</div>
                <div className="text-xs text-text-dim mt-1">{creator.specialty}</div>
                <div className="text-2xs text-text-dim mt-1">{creator.email}</div>
                <div className="flex gap-2 mt-3 justify-center">
                  {creator.portfolioUrl && (
                    <Button size="sm" variant="ghost" onClick={() => window.open(creator.portfolioUrl, '_blank')}>Portfolio</Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => onToast(`${creator.name} profile`, 'info')}>View</Button>
                </div>
              </Card>
            ))}

            {/* Add creator card */}
            <button
              onClick={() => setShowAddModal(true)}
              className="border-2 border-dashed border-border rounded-lg p-5 text-center cursor-pointer flex flex-col items-center justify-center min-h-[200px] hover:border-blue/40 transition-colors"
            >
              <div className="text-4xl opacity-30 mb-2">+</div>
              <div className="text-sm font-bold">Add Creator</div>
              <div className="text-2xs text-text-dim mt-1">Name, contact, address, portfolio</div>
            </button>
          </div>
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
          <Card padding={false}>
            {/* Header row */}
            <div className="grid grid-cols-[180px_1fr_180px_120px] gap-0 px-5 py-3 border-b border-border">
              <span className="text-2xs font-bold uppercase tracking-wider text-text-dim">Name</span>
              <span className="text-2xs font-bold uppercase tracking-wider text-text-dim">Address</span>
              <span className="text-2xs font-bold uppercase tracking-wider text-text-dim">Email</span>
              <span className="text-2xs font-bold uppercase tracking-wider text-text-dim">Action</span>
            </div>
            {/* Rows */}
            {creators.map(creator => (
              <div key={creator.id} className="grid grid-cols-[180px_1fr_180px_120px] gap-0 px-5 py-3 border-b border-border/50 items-center hover:bg-elevated/50 transition-colors">
                <span className="text-sm font-bold">{creator.name}</span>
                <span className="text-xs text-text-dim">{creator.address || 'No address on file'}</span>
                <span className="text-xs text-text-dim">{creator.email}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    navigator.clipboard.writeText(`${creator.name}\n${creator.address}\n${creator.email}`)
                    onToast(`${creator.name}'s info copied`, 'success')
                  }}
                >
                  Copy
                </Button>
              </div>
            ))}
          </Card>
        </>
      )}

      {/* Add Creator Modal */}
      <Modal open={showAddModal} onClose={() => setShowAddModal(false)} title="Add Creator" subtitle="Add a new UGC creator to your roster">
        <div className="space-y-3">
          <div>
            <label className="block text-2xs font-bold tracking-wider uppercase text-text-muted mb-1.5">Name</label>
            <input type="text" placeholder="Full name" value={newCreator.name} onChange={e => setNewCreator(prev => ({ ...prev, name: e.target.value }))} className="w-full px-3 py-2.5 bg-page border border-border rounded text-sm text-text-primary focus:border-blue focus:outline-none" autoFocus />
          </div>
          <div>
            <label className="block text-2xs font-bold tracking-wider uppercase text-text-muted mb-1.5">Specialty</label>
            <input type="text" placeholder="e.g. Lifestyle, Fitness, Wellness" value={newCreator.specialty} onChange={e => setNewCreator(prev => ({ ...prev, specialty: e.target.value }))} className="w-full px-3 py-2.5 bg-page border border-border rounded text-sm text-text-primary focus:border-blue focus:outline-none" />
          </div>
          <div>
            <label className="block text-2xs font-bold tracking-wider uppercase text-text-muted mb-1.5">Email</label>
            <input type="email" placeholder="creator@email.com" value={newCreator.email} onChange={e => setNewCreator(prev => ({ ...prev, email: e.target.value }))} className="w-full px-3 py-2.5 bg-page border border-border rounded text-sm text-text-primary focus:border-blue focus:outline-none" />
          </div>
          <div>
            <label className="block text-2xs font-bold tracking-wider uppercase text-text-muted mb-1.5">Mailing Address</label>
            <input type="text" placeholder="Full mailing address for shipments" value={newCreator.address} onChange={e => setNewCreator(prev => ({ ...prev, address: e.target.value }))} className="w-full px-3 py-2.5 bg-page border border-border rounded text-sm text-text-primary focus:border-blue focus:outline-none" />
          </div>
          <div>
            <label className="block text-2xs font-bold tracking-wider uppercase text-text-muted mb-1.5">Portfolio URL (optional)</label>
            <input type="url" placeholder="https://..." value={newCreator.portfolioUrl} onChange={e => setNewCreator(prev => ({ ...prev, portfolioUrl: e.target.value }))} className="w-full px-3 py-2.5 bg-page border border-border rounded text-sm text-text-primary focus:border-blue focus:outline-none" />
          </div>
          <Button onClick={handleAddCreator} className="w-full justify-center mt-2" disabled={!newCreator.name.trim()}>
            Add to Roster
          </Button>
        </div>
      </Modal>
    </div>
  )
}
