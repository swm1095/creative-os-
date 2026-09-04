'use client'

interface NavItemProps {
  label: string
  icon?: string
  emoji?: string
  active?: boolean
  badge?: string
  badgeVariant?: 'green' | 'gold' | 'blue'
  onClick: () => void
}

const badgeStyles: Record<string, string> = {
  green: 'bg-fulton text-white',
  gold: 'bg-fulton-gold text-white',
  blue: 'bg-blue text-white',
}

// Line icons (stroke inherits currentColor so they follow the active/muted text color)
const icons: Record<string, React.ReactNode> = {
  home: <><path d="M3 10.5L12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /></>,
  brand: <><circle cx="13.5" cy="6.5" r="2.5" /><circle cx="6.5" cy="12" r="2.5" /><circle cx="15" cy="15" r="2.5" /><path d="M3 21c0-3 2-5 5-5" /></>,
  ugcteam: <><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13A4 4 0 0116 11" /></>,
  connections: <><path d="M9 12l2 2 4-4" /><circle cx="12" cy="12" r="9" /></>,
  admin: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-2.7 1.1V21a2 2 0 01-4 0v-.1A1.6 1.6 0 007 19.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1A1.6 1.6 0 004 13.6a2 2 0 010-4 1.6 1.6 0 001.5-1.7L5.4 7.8a2 2 0 112.8-2.8l.1.1A1.6 1.6 0 0011 3.4V3a2 2 0 014 0v.1a1.6 1.6 0 002.7 1.2l.1-.1a2 2 0 112.8 2.8l-.1.1a1.6 1.6 0 00-.3 1.8V9a1.6 1.6 0 001.5 1h.1a2 2 0 010 4h-.1a1.6 1.6 0 00-1.1.9z" /></>,
  hyperchat: <><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></>,
  hypercopy: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" /></>,
  hyperlistening: <><path d="M3 18v-6a9 9 0 0118 0v6" /><path d="M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3zM3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3z" /></>,
  hyperresearch: <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></>,
  'saved-insights': <><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" /></>,
}

export default function NavItem({ label, icon, emoji, active, badge, badgeVariant = 'green', onClick }: NavItemProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-[7px] cursor-pointer transition-all duration-150 text-left mb-px
        ${active
          ? 'bg-blue-light text-blue font-bold'
          : 'text-text-muted font-semibold hover:bg-surface hover:text-text-primary'
        }`}
    >
      {icon && icons[icon] ? (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
          {icons[icon]}
        </svg>
      ) : emoji ? (
        <span className="text-sm w-4 text-center shrink-0">{emoji}</span>
      ) : null}
      <span className="text-[12.5px] flex-1 truncate">{label}</span>
      {badge && (
        <span className={`text-2xs font-bold px-1.5 py-0.5 rounded-full ml-auto ${badgeStyles[badgeVariant]}`}>
          {badge}
        </span>
      )}
    </button>
  )
}
