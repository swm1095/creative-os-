'use client'

import { useState } from 'react'
import Button from '@/components/ui/Button'

interface LoginViewProps {
  onLogin: (username: string, password: string) => Promise<{ success: boolean; error?: string }>
  onGoogleLogin: (email: string) => Promise<{ success: boolean; error?: string }>
}

export default function LoginView({ onLogin, onGoogleLogin }: LoginViewProps) {
  const [tab, setTab] = useState<'team' | 'client'>('team')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleTeamLogin = async () => {
    if (!email.trim()) { setError('Enter your email'); return }
    if (!email.endsWith('@hype10agency.com')) { setError('Only @hype10agency.com emails allowed'); return }
    setLoading(true)
    setError('')
    const result = await onGoogleLogin(email)
    if (!result.success) setError(result.error || 'Login failed')
    setLoading(false)
  }

  const handleClientLogin = async () => {
    if (!username.trim() || !password.trim()) { setError('Enter username and password'); return }
    setLoading(true)
    setError('')
    const result = await onLogin(username, password)
    if (!result.success) setError(result.error || 'Invalid credentials')
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 bg-page flex items-center justify-center z-[9999]">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-xl bg-blue flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-black text-lg">H10</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight">HyperCreate</h1>
          <p className="text-xs text-text-dim mt-1 uppercase tracking-wider font-semibold">by Hype10</p>
        </div>

        {/* Tab switcher */}
        <div className="flex mb-6 bg-surface border border-border rounded-lg p-1">
          <button
            onClick={() => { setTab('team'); setError('') }}
            className={`flex-1 py-2.5 text-sm font-bold rounded-md transition-colors ${
              tab === 'team' ? 'bg-blue text-white' : 'text-text-muted hover:text-text-primary'
            }`}
          >
            Hype10 Team
          </button>
          <button
            onClick={() => { setTab('client'); setError('') }}
            className={`flex-1 py-2.5 text-sm font-bold rounded-md transition-colors ${
              tab === 'client' ? 'bg-blue text-white' : 'text-text-muted hover:text-text-primary'
            }`}
          >
            Client Access
          </button>
        </div>

        {/* Login form */}
        <div className="bg-surface border border-border rounded-xl p-6">
          {error && (
            <div className="bg-red-light border border-red/20 rounded-lg px-4 py-2.5 mb-4 text-sm text-red font-medium">
              {error}
            </div>
          )}

          {tab === 'team' ? (
            <div className="space-y-4">
              <div>
                <label className="block text-2xs font-bold tracking-wider uppercase text-text-muted mb-1.5">Email</label>
                <input
                  type="email"
                  placeholder="you@hype10agency.com"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError('') }}
                  onKeyDown={e => e.key === 'Enter' && handleTeamLogin()}
                  className="w-full px-4 py-3 bg-page border border-border rounded-lg text-sm text-text-primary focus:border-blue focus:outline-none"
                  autoFocus
                />
                <div className="text-2xs text-text-dim mt-1.5">@hype10agency.com emails only</div>
              </div>
              <Button onClick={handleTeamLogin} disabled={loading} className="w-full justify-center py-3">
                {loading ? 'Signing in...' : 'Sign In'}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-2xs font-bold tracking-wider uppercase text-text-muted mb-1.5">Username</label>
                <input
                  type="text"
                  placeholder="Your username"
                  value={username}
                  onChange={e => { setUsername(e.target.value); setError('') }}
                  className="w-full px-4 py-3 bg-page border border-border rounded-lg text-sm text-text-primary focus:border-blue focus:outline-none"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-2xs font-bold tracking-wider uppercase text-text-muted mb-1.5">Password</label>
                <input
                  type="password"
                  placeholder="Your password"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError('') }}
                  onKeyDown={e => e.key === 'Enter' && handleClientLogin()}
                  className="w-full px-4 py-3 bg-page border border-border rounded-lg text-sm text-text-primary focus:border-blue focus:outline-none"
                />
              </div>
              <Button onClick={handleClientLogin} disabled={loading} className="w-full justify-center py-3">
                {loading ? 'Signing in...' : 'Sign In'}
              </Button>
            </div>
          )}
        </div>

        <div className="text-center mt-6 text-2xs text-text-dim">
          HyperCreate by Hype10 Agency
        </div>
      </div>
    </div>
  )
}
