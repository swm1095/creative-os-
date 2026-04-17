'use client'

interface CardProps {
  title?: string
  subtitle?: string
  children: React.ReactNode
  className?: string
  padding?: boolean
}

export default function Card({ title, subtitle, children, className = '', padding = true }: CardProps) {
  return (
    <div className={`bg-surface border border-border rounded-lg transition-colors ${padding ? 'p-5' : ''} ${className}`}>
      {title && (
        <div className={padding ? 'mb-3' : 'px-5 pt-5 mb-3'}>
          <h4 className="text-sm font-bold">{title}</h4>
          {subtitle && <p className="text-xs text-text-dim mt-0.5">{subtitle}</p>}
        </div>
      )}
      {children}
    </div>
  )
}
