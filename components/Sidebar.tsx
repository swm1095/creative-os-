'use client'

import { Brand } from '@/lib/types'
import { createClient } from '@/lib/supabase-client'
import { useRouter } from 'next/navigation'

interface SidebarProps {
  brands: Brand[]
  activeBrandId: string | null
  activeView: 'gallery' | 'integrations'
  userEmail: string
  onBrandSelect: (brand: Brand) => void
  onViewChange: (view: 'gallery' | 'integrations') => void
  onAddBrand: () => void
}

const BRAND_COLORS = ['#2B4EFF','#00a86b','#d97706','#6d28d9','#dc2626','#0891b2']

function getInitials(email: string) {
  const name = email.split('@')[0]
  return name.split('.').map((p: string) => p[0]).join('').toUpperCase().slice(0, 2)
}

function getDisplayName(email: string) {
  return email.split('@')[0].split('.').map((p: string) =>
    p.charAt(0).toUpperCase() + p.slice(1)
  ).join(' ')
}

export default function Sidebar({
  brands, activeBrandId, activeView, userEmail,
  onBrandSelect, onViewChange, onAddBrand
}: SidebarProps) {
  const router = useRouter()
  const supabase = createClient()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div style={{
      width: 220, minWidth: 220, background: 'white', borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', height: '100vh'
    }}>
      {/* Header */}
      <div style={{ padding: '20px 18px 16px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{
            width: 32, height: 32, background: 'var(--blue)', borderRadius: 4,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
          }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <rect x="2" y="2" width="6" height="16" rx="1" fill="white"/>
              <rect x="10" y="2" width="8" height="7" rx="1" fill="white"/>
              <rect x="10" y="11" width="8" height="7" rx="1" fill="white" opacity="0.5"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1 }}>HYPE10</div>
            <div style={{ fontSize: 10, fontWeight: 500, color: 'var(--gray-500)', letterSpacing: '0.04em' }}>Creative OS</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <div style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
        <NavItem icon="▦" label="Gallery" active={activeView === 'gallery'} onClick={() => onViewChange('gallery')} />
        <NavItem
          icon="⬡" label="Integrations" active={activeView === 'integrations'}
          onClick={() => onViewChange('integrations')}
          badge={brands.length > 0 ? undefined : '!'}
        />
      </div>

      {/* Brand list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 0' }}>
        <div style={{ padding: '8px 18px 4px', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--gray-300)' }}>
          My brands
        </div>

        {brands.length === 0 ? (
          <div style={{ padding: '12px 18px', fontSize: 12, color: 'var(--gray-300)', fontStyle: 'italic' }}>
            No brands yet
          </div>
        ) : (
          brands.map((brand, i) => (
            <div
              key={brand.id}
              onClick={() => onBrandSelect(brand)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '7px 18px',
                cursor: 'pointer', background: activeBrandId === brand.id ? 'var(--blue-light)' : 'transparent',
                position: 'relative', transition: 'background 0.1s'
              }}
            >
              {activeBrandId === brand.id && (
                <div style={{
                  position: 'absolute', left: 0, top: 4, bottom: 4, width: 3,
                  background: 'var(--blue)', borderRadius: '0 2px 2px 0'
                }}/>
              )}
              <div style={{
                width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                background: brand.color || BRAND_COLORS[i % BRAND_COLORS.length]
              }}/>
              <span style={{
                fontSize: 13, fontWeight: activeBrandId === brand.id ? 600 : 500,
                color: activeBrandId === brand.id ? 'var(--blue)' : 'var(--gray-700)',
                flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
              }}>{brand.name}</span>
              <span style={{ fontSize: 11, color: activeBrandId === brand.id ? 'var(--blue-mid)' : 'var(--gray-300)' }}>
                {brand.creative_count || 0}
              </span>
            </div>
          ))
        )}

        <div
          onClick={onAddBrand}
          style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '7px 18px',
            cursor: 'pointer', color: 'var(--gray-300)', fontSize: 12, fontWeight: 500
          }}
          className="hover:text-blue-600"
        >
          <div style={{
            width: 20, height: 20, border: '1.5px dashed var(--gray-300)',
            borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15
          }}>+</div>
          Add brand
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 6, background: 'var(--blue)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 800, color: 'white', flexShrink: 0
          }}>
            {getInitials(userEmail)}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {getDisplayName(userEmail)}
            </div>
            <div style={{ fontSize: 11, color: 'var(--gray-500)', marginTop: 1 }}>{userEmail}</div>
          </div>
        </div>
        <span
          onClick={handleSignOut}
          style={{ fontSize: 11, color: 'var(--gray-300)', cursor: 'pointer', marginTop: 6, display: 'inline-block' }}
        >
          Sign out
        </span>
      </div>
    </div>
  )
}

function NavItem({ icon, label, active, onClick, badge }: {
  icon: string; label: string; active: boolean; onClick: () => void; badge?: string
}) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 9, padding: '7px 18px',
        cursor: 'pointer', color: active ? 'var(--blue)' : 'var(--gray-500)',
        fontSize: 13, fontWeight: active ? 600 : 500,
        background: active ? 'var(--blue-light)' : 'transparent',
        position: 'relative', transition: 'all 0.1s'
      }}
    >
      {active && (
        <div style={{
          position: 'absolute', left: 0, top: 4, bottom: 4, width: 3,
          background: 'var(--blue)', borderRadius: '0 2px 2px 0'
        }}/>
      )}
      <span style={{ width: 16, textAlign: 'center' }}>{icon}</span>
      {label}
      {badge && (
        <span style={{
          marginLeft: 'auto', fontSize: 10, fontWeight: 700,
          background: 'var(--blue)', color: 'white', padding: '1px 6px', borderRadius: 10
        }}>{badge}</span>
      )}
    </div>
  )
}
