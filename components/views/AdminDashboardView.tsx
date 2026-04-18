'use client'

import { useState, useEffect, useCallback } from 'react'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import PageHeader from '@/components/ui/PageHeader'
import { LoadingState } from '@/components/ui/LoadingSpinner'
import Pill from '@/components/ui/Pill'
import StatCard from '@/components/ui/StatCard'

interface UsageStats {
  window: string
  totalRequests: number
  totalCost: number
  byService: Record<string, { count: number; tokensIn: number; tokensOut: number; cost: number }>
  byAction: Record<string, { count: number; cost: number }>
  byUser: Record<string, { count: number; cost: number; name: string }>
  byDay: Record<string, { count: number; cost: number }>
}

interface AdminEmail {
  id: string
  email: string
  name: string
  can_view_usage: boolean
  receives_alerts: boolean
}

interface AdminDashboardViewProps {
  onToast: (msg: string, type: 'success' | 'error' | 'info') => void
}

export default function AdminDashboardView({ onToast }: AdminDashboardViewProps) {
  const [stats, setStats] = useState<UsageStats | null>(null)
  const [admins, setAdmins] = useState<AdminEmail[]>([])
  const [loading, setLoading] = useState(true)
  const [window, setWindow] = useState('7d')
  const [newEmail, setNewEmail] = useState('')
  const [newName, setNewName] = useState('')

  const loadStats = useCallback(async () => {
    setLoading(true)
    try {
      const [usageRes, adminsRes] = await Promise.all([
        fetch(`/api/admin/usage?window=${window}`),
        fetch('/api/admin/emails'),
      ])
      const usageData = await usageRes.json()
      const adminsData = await adminsRes.json()
      if (usageData.totalRequests !== undefined) setStats(usageData)
      if (adminsData.emails) setAdmins(adminsData.emails)
    } catch { /* silent */ }
    setLoading(false)
  }, [window])

  useEffect(() => { loadStats() }, [loadStats])

  const addAdmin = async () => {
    if (!newEmail.trim()) return
    try {
      const res = await fetch('/api/admin/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newEmail, name: newName || undefined }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setAdmins(prev => [...prev, data.admin])
      setNewEmail('')
      setNewName('')
      onToast(`${newEmail} added to admin team`, 'success')
    } catch (err: unknown) {
      onToast(`Failed: ${err instanceof Error ? err.message : String(err)}`, 'error')
    }
  }

  const removeAdmin = async (id: string, email: string) => {
    if (email === 'sam@hype10agency.com') { onToast('Cannot remove primary admin', 'error'); return }
    try {
      await fetch('/api/admin/emails', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
      setAdmins(prev => prev.filter(a => a.id !== id))
      onToast('Admin removed', 'success')
    } catch { /* silent */ }
  }

  if (loading) return <LoadingState size="md" title="Loading admin dashboard..." />

  const serviceColors: Record<string, string> = {
    anthropic: 'text-amber',
    gemini: 'text-blue',
    fal: 'text-green',
    apify: 'text-fulton',
    removebg: 'text-red',
  }

  return (
    <div className="animate-fadeIn">
      <PageHeader
        title="Admin Dashboard"
        subtitle="Platform usage and team management"
        action={
          <div className="flex gap-2">
            {['24h', '7d', '30d', '90d'].map(w => (
              <button
                key={w}
                onClick={() => setWindow(w)}
                className={`px-3 py-1.5 text-2xs font-bold uppercase tracking-wider rounded transition-colors ${
                  window === w ? 'bg-blue text-white' : 'bg-surface border border-border text-text-muted hover:text-text-primary'
                }`}
              >
                {w}
              </button>
            ))}
          </div>
        }
      />

      {stats && (
        <>
          {/* KPI Row */}
          <div className="grid grid-cols-4 gap-3.5 mb-6">
            <StatCard label="Total API Requests" value={stats.totalRequests} change={`Last ${window}`} />
            <StatCard label="Estimated Cost" value={`$${stats.totalCost.toFixed(2)}`} change={`Last ${window}`} />
            <StatCard label="Services Active" value={Object.keys(stats.byService).length} />
            <StatCard label="Team Members" value={Object.keys(stats.byUser).length} />
          </div>

          {/* By Service */}
          <Card title="Usage by Service" className="mb-4">
            <div className="space-y-3">
              {Object.entries(stats.byService).sort((a, b) => b[1].cost - a[1].cost).map(([service, data]) => (
                <div key={service} className="flex items-center gap-3">
                  <span className={`text-sm font-bold w-24 ${serviceColors[service] || 'text-text-primary'}`}>
                    {service.charAt(0).toUpperCase() + service.slice(1)}
                  </span>
                  <div className="flex-1 bg-elevated rounded-full h-3">
                    <div
                      className="bg-blue rounded-full h-3 transition-all"
                      style={{ width: `${Math.min(100, (data.count / stats.totalRequests) * 100)}%` }}
                    />
                  </div>
                  <span className="text-xs text-text-muted w-20 text-right">{data.count} calls</span>
                  <span className="text-xs font-bold w-16 text-right">${data.cost.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* By Action */}
          <Card title="Usage by Action" className="mb-4">
            <div className="grid grid-cols-3 gap-3">
              {Object.entries(stats.byAction).sort((a, b) => b[1].count - a[1].count).map(([action, data]) => (
                <div key={action} className="bg-page border border-border rounded-lg p-3">
                  <div className="text-sm font-bold">{action.replace(/_/g, ' ')}</div>
                  <div className="text-xl font-black mt-1">{data.count}</div>
                  <div className="text-2xs text-text-dim">${data.cost.toFixed(3)}</div>
                </div>
              ))}
            </div>
          </Card>

          {/* By User */}
          <Card title="Usage by Team Member" className="mb-4">
            {Object.keys(stats.byUser).length > 0 ? (
              <div className="space-y-2">
                {Object.entries(stats.byUser).sort((a, b) => b[1].count - a[1].count).map(([email, data]) => (
                  <div key={email} className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0">
                    <div className="w-8 h-8 rounded-full bg-blue flex items-center justify-center text-white text-xs font-bold shrink-0">
                      {data.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold">{data.name}</div>
                      <div className="text-2xs text-text-dim truncate">{email}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold">{data.count}</div>
                      <div className="text-2xs text-text-dim">${data.cost.toFixed(2)}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-text-dim text-sm">No usage data yet. Usage tracking starts on API calls.</div>
            )}
          </Card>

          {/* Daily Usage */}
          {Object.keys(stats.byDay).length > 0 && (
            <Card title="Daily Activity" className="mb-6">
              <div className="space-y-1">
                {Object.entries(stats.byDay).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 14).map(([day, data]) => (
                  <div key={day} className="flex items-center gap-3">
                    <span className="text-xs text-text-dim w-20">{day}</span>
                    <div className="flex-1 bg-elevated rounded-full h-2">
                      <div
                        className="bg-blue rounded-full h-2"
                        style={{ width: `${Math.min(100, (data.count / Math.max(...Object.values(stats.byDay).map(d => d.count))) * 100)}%` }}
                      />
                    </div>
                    <span className="text-2xs text-text-muted w-12 text-right">{data.count}</span>
                    <span className="text-2xs font-bold w-14 text-right">${data.cost.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}

      {/* Admin Team Management */}
      <Card title="Leadership Team" subtitle="Team members who can view this dashboard and receive health alerts">
        <div className="space-y-2 mb-4">
          {admins.map(admin => (
            <div key={admin.id} className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0">
              <div className="w-8 h-8 rounded-full bg-blue flex items-center justify-center text-white text-xs font-bold shrink-0">
                {admin.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <div className="text-sm font-bold">{admin.name}</div>
                <div className="text-2xs text-text-dim">{admin.email}</div>
              </div>
              <div className="flex gap-1">
                {admin.can_view_usage && <Pill variant="blue">Usage</Pill>}
                {admin.receives_alerts && <Pill variant="green">Alerts</Pill>}
              </div>
              {admin.email !== 'sam@hype10agency.com' && (
                <button onClick={() => removeAdmin(admin.id, admin.email)} className="text-text-dim hover:text-red text-xs">Remove</button>
              )}
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="email"
            placeholder="email@hype10agency.com"
            value={newEmail}
            onChange={e => setNewEmail(e.target.value)}
            className="flex-1 px-3 py-2.5 bg-page border border-border rounded text-sm text-text-primary focus:border-blue focus:outline-none"
          />
          <input
            type="text"
            placeholder="Name"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            className="w-32 px-3 py-2.5 bg-page border border-border rounded text-sm text-text-primary focus:border-blue focus:outline-none"
          />
          <Button onClick={addAdmin} disabled={!newEmail.trim()}>Add</Button>
        </div>
      </Card>
    </div>
  )
}
