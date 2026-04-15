'use client'

import { Suspense, useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'

const ALLOWED_DOMAIN = 'hype10agency.com'

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  )
}

function LoginContent() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const searchParams = useSearchParams()
  const router = useRouter()

  useEffect(() => {
    const err = searchParams.get('error')
    if (err === 'domain') setError(`Access restricted to @${ALLOWED_DOMAIN} accounts.`)
    if (err === 'auth') setError('Authentication failed. Please try again.')
  }, [searchParams])

  const supabase = createClient()

  const handleGoogle = async () => {
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback`,
        queryParams: { hd: ALLOWED_DOMAIN },
      },
    })
    if (error) { setError(error.message); setLoading(false) }
  }

  const handleEmail = async () => {
    if (!email.trim()) { setError('Please enter your email.'); return }
    if (!email.toLowerCase().endsWith(`@${ALLOWED_DOMAIN}`)) {
      setError(`Access restricted to @${ALLOWED_DOMAIN} accounts.`)
      return
    }
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/api/auth/callback` },
    })
    if (error) { setError(error.message); setLoading(false) }
    else setSent(true)
    setLoading(false)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'var(--gray-50)'
    }}>
      <div style={{
        background: 'white', border: '1px solid var(--border)', borderRadius: 12,
        padding: '40px 40px 36px', width: 400, display: 'flex',
        flexDirection: 'column', alignItems: 'center'
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
          <div style={{
            width: 38, height: 38, background: 'var(--blue)', borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <rect x="2" y="2" width="7" height="18" rx="1.5" fill="white"/>
              <rect x="11" y="2" width="9" height="8" rx="1.5" fill="white"/>
              <rect x="11" y="12" width="9" height="8" rx="1.5" fill="white" opacity="0.5"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1 }}>HYPE10</div>
            <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--gray-500)', letterSpacing: '0.04em' }}>Creative OS</div>
          </div>
        </div>

        <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.03em', marginBottom: 6, textAlign: 'center' }}>Sign in</div>
        <div style={{ fontSize: 13, color: 'var(--gray-500)', textAlign: 'center', marginBottom: 28, lineHeight: 1.5 }}>
          Access is limited to <br /><strong>@{ALLOWED_DOMAIN}</strong> accounts.
        </div>

        {sent ? (
          <div style={{
            background: 'var(--green-light)', border: '1px solid #bbf7d0', borderRadius: 8,
            padding: '16px 20px', textAlign: 'center', width: '100%'
          }}>
            <div style={{ fontSize: 20, marginBottom: 8 }}>📬</div>
            <div style={{ fontWeight: 700, color: 'var(--green)', marginBottom: 4 }}>Check your email</div>
            <div style={{ fontSize: 12, color: 'var(--gray-500) '}}>
              We sent a magic link to <strong>{email}</strong>
            </div>
          </div>
        ) : (
          <>
            {/* Google button */}
            <button onClick={handleGoogle} disabled={loading} style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 10, padding: '11px 20px', background: 'white', border: '1.5px solid var(--border)',
              borderRadius: 6, fontFamily: 'inherit', fontSize: 14, fontWeight: 600, cursor: 'pointer',
              marginBottom: 16, transition: 'all 0.15s',
            }}>
              <svg width="18" height="18" viewBox="0 0 18 18">
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
                <path d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </button>

            {/* Divider */}
            <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }}/>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-300)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>or</span>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }}/>
            </div>

            {/* Error */}
            {error && (
              <div style={{
                fontSize: 12, fontWeight: 500, color: 'var(--red)', background: 'var(--red-light)',
                border: '1px solid #fecaca', borderRadius: 5, padding: '8px 12px',
                width: '100%', marginBottom: 12, textAlign: 'center'
              }}>{error}</div>
            )}

            {/* Email input */}
            <input
              className="input-base"
              type="email"
              placeholder={`you@${ALLOWED_DOMAIN}`}
              value={email}
              onChange={e => { setEmail(e.target.value); setError('') }}
              onKeyDown={e => e.key === 'Enter' && handleEmail()}
              style={{ marginBottom: 8 }}
            />
            <div style={{ fontSize: 11, color: 'var(--gray-300)', marginBottom: 12, alignSelf: 'flex-start', paddingLeft: 2 }}>
              Work email only — @{ALLOWED_DOMAIN} required
            </div>

            <button className="btn-primary" onClick={handleEmail} disabled={loading} style={{ width: '100%' }}>
              {loading ? 'Sending...' : 'Continue with email'}
            </button>
          </>
        )}

        <div style={{ marginTop: 24, fontSize: 11, color: 'var(--gray-300)', textAlign: 'center', lineHeight: 1.6 }}>
          By signing in you agree to Hype10's terms of service.<br />
          Access restricted to Hype10 team members.
        </div>
      </div>
    </div>
  )
}
