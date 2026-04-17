'use client'

interface TopbarProps {
  title: string
  subtitle?: string
  actions?: React.ReactNode
}

export default function Topbar({ title, subtitle, actions }: TopbarProps) {
  return (
    <div className="sticky top-0 z-5 bg-page/95 backdrop-blur-md border-b border-border px-7 py-3.5 flex items-center gap-3">
      <div className="flex-1">
        <h1 className="text-xl font-black tracking-tight">{title}</h1>
        {subtitle && <p className="text-xs text-text-muted font-medium">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
