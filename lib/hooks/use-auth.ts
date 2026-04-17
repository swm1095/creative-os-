'use client'

import { useState, useEffect, useCallback } from 'react'

export interface User {
  id: string
  username: string
  name: string
  email: string
  role: 'admin' | 'team' | 'client'
  brand_id?: string
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check localStorage for saved session
    const saved = localStorage.getItem('hc-user')
    if (saved) {
      try {
        setUser(JSON.parse(saved))
      } catch { /* invalid */ }
    }
    setLoading(false)
  }, [])

  const login = useCallback(async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const data = await res.json()
      if (data.error) return { success: false, error: data.error }

      setUser(data.user)
      localStorage.setItem('hc-user', JSON.stringify(data.user))
      return { success: true }
    } catch (e: unknown) {
      return { success: false, error: e instanceof Error ? e.message : String(e) }
    }
  }, [])

  const loginWithGoogle = useCallback(async (email: string) => {
    // For Google OAuth, we check if it's an @hype10agency.com email
    if (!email.endsWith('@hype10agency.com')) {
      return { success: false, error: 'Only @hype10agency.com emails allowed for Google sign-in' }
    }

    const googleUser: User = {
      id: email,
      username: email,
      name: email.split('@')[0].replace('.', ' ').replace(/\b\w/g, c => c.toUpperCase()),
      email,
      role: email === 'sam@hype10agency.com' ? 'admin' : 'team',
    }
    setUser(googleUser)
    localStorage.setItem('hc-user', JSON.stringify(googleUser))
    return { success: true }
  }, [])

  const logout = useCallback(() => {
    setUser(null)
    localStorage.removeItem('hc-user')
  }, [])

  const isAdmin = user?.role === 'admin' || user?.email === 'sam@hype10agency.com'
  const isTeam = user?.role === 'admin' || user?.role === 'team'

  return { user, loading, login, loginWithGoogle, logout, isAdmin, isTeam }
}
