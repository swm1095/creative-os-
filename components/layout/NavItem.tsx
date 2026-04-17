'use client'

interface NavItemProps {
  label: string
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

export default function NavItem({ label, emoji, active, badge, badgeVariant = 'green', onClick }: NavItemProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-[7px] cursor-pointer transition-all duration-150 text-left mb-px
        ${active
          ? 'bg-blue-light text-blue font-bold'
          : 'text-text-muted font-semibold hover:bg-surface hover:text-text-primary'
        }`}
    >
      {emoji && <span className="text-sm w-4 text-center shrink-0">{emoji}</span>}
      <span className="text-[12.5px] flex-1 truncate">{label}</span>
      {badge && (
        <span className={`text-2xs font-bold px-1.5 py-0.5 rounded-full ml-auto ${badgeStyles[badgeVariant]}`}>
          {badge}
        </span>
      )}
    </button>
  )
}
