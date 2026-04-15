'use client'

import { InputHTMLAttributes } from 'react'

interface FormInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
}

export default function FormInput({ label, className = '', ...props }: FormInputProps) {
  return (
    <div className={className}>
      {label && <label className="block text-2xs font-bold tracking-wider uppercase text-text-muted mb-1.5">{label}</label>}
      <input
        className="w-full px-3 py-2.5 text-base text-text-primary bg-page border border-border rounded focus:border-fulton focus:outline-none transition-colors font-medium"
        {...props}
      />
    </div>
  )
}

interface FormTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
}

export function FormTextarea({ label, className = '', ...props }: FormTextareaProps) {
  return (
    <div className={className}>
      {label && <label className="block text-2xs font-bold tracking-wider uppercase text-text-muted mb-1.5">{label}</label>}
      <textarea
        className="w-full px-3 py-2.5 text-base text-text-primary bg-page border border-border rounded focus:border-fulton focus:outline-none transition-colors font-medium resize-y min-h-[80px]"
        {...props}
      />
    </div>
  )
}
