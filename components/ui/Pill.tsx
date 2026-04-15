'use client'

type PillVariant = 'green' | 'amber' | 'red' | 'blue' | 'gray' | 'gold'

const styles: Record<PillVariant, string> = {
  green: 'bg-green-light text-green',
  amber: 'bg-amber-light text-amber',
  red: 'bg-red-light text-red',
  blue: 'bg-blue-light text-blue',
  gray: 'bg-elevated text-text-dim',
  gold: 'bg-fulton-gold-light text-fulton-gold',
}

interface PillProps {
  variant?: PillVariant
  children: React.ReactNode
  className?: string
}

export default function Pill({ variant = 'gray', children, className = '' }: PillProps) {
  return (
    <span className={`inline-flex items-center text-2xs font-bold tracking-wider uppercase px-2.5 py-1 rounded ${styles[variant]} ${className}`}>
      {children}
    </span>
  )
}
