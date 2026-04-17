'use client'

import { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost'
type Size = 'sm' | 'md'

const variants: Record<Variant, string> = {
  primary: 'bg-blue text-white hover:bg-blue-dark hover:-translate-y-px hover:shadow-[0_0_24px_rgba(33,56,255,0.3)]',
  secondary: 'bg-surface text-text-primary border border-border hover:bg-elevated hover:border-blue hover:text-blue',
  ghost: 'bg-transparent text-text-muted border border-transparent hover:bg-surface hover:text-text-primary hover:border-border',
}

const sizes: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

export default function Button({ variant = 'primary', size = 'md', className = '', children, ...props }: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-1.5 font-bold rounded-[7px] cursor-pointer whitespace-nowrap transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
