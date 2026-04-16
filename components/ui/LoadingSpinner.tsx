'use client'

export default function LoadingSpinner({ size = 20 }: { size?: number }) {
  return (
    <div
      className="border-2 border-text-subtle border-t-fulton rounded-full animate-spin"
      style={{ width: size, height: size }}
    />
  )
}

interface LoadingStateProps {
  title?: string
  subtitle?: string
  size?: 'sm' | 'md' | 'lg'
}

const loadingSizes = {
  sm: { spinner: 16, py: 'py-8' },
  md: { spinner: 24, py: 'py-12' },
  lg: { spinner: 32, py: 'py-20' },
}

export function LoadingState({ title, subtitle, size = 'md' }: LoadingStateProps) {
  const s = loadingSizes[size]
  return (
    <div className={`flex flex-col items-center justify-center ${s.py}`}>
      <LoadingSpinner size={s.spinner} />
      {title && <div className="text-sm text-text-muted mt-4">{title}</div>}
      {subtitle && <div className="text-2xs text-text-dim mt-1">{subtitle}</div>}
    </div>
  )
}
