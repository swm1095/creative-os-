'use client'

interface EmptyStateProps {
  emoji?: string
  title: string
  subtitle?: string
  action?: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
}

const sizes = {
  sm: { py: 'py-8', emoji: 'text-2xl', title: 'text-sm font-bold', subtitle: 'text-xs', mb: 'mb-2' },
  md: { py: 'py-12', emoji: 'text-4xl', title: 'text-lg font-black', subtitle: 'text-xs', mb: 'mb-3' },
  lg: { py: 'py-20', emoji: 'text-5xl', title: 'text-2xl font-black', subtitle: 'text-sm', mb: 'mb-4' },
}

export default function EmptyState({ emoji, title, subtitle, action, size = 'md' }: EmptyStateProps) {
  const s = sizes[size]
  return (
    <div className={`bg-surface border border-border rounded-lg ${s.py} px-6 flex flex-col items-center justify-center text-center`}>
      {emoji && <div className={`${s.emoji} ${s.mb}`}>{emoji}</div>}
      <h3 className={`${s.title} mb-1`}>{title}</h3>
      {subtitle && <p className={`${s.subtitle} text-text-dim max-w-md leading-relaxed`}>{subtitle}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
