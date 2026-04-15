'use client'

import { Toast as ToastType } from '@/lib/types'

const typeStyles: Record<string, string> = {
  success: 'bg-fulton-dark border-fulton text-white',
  error: 'bg-red-light border-red text-red',
  info: 'bg-surface border-border text-text-primary',
}

interface ToastContainerProps {
  toasts: ToastType[]
  onDismiss: (id: string) => void
}

export default function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (!toasts.length) return null
  return (
    <div className="fixed bottom-5 right-5 z-[200] flex flex-col gap-2">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`animate-toastIn px-4 py-3 rounded-lg border text-sm font-semibold shadow-xl cursor-pointer max-w-sm ${typeStyles[t.type] || typeStyles.info}`}
          onClick={() => onDismiss(t.id)}
        >
          {t.message}
        </div>
      ))}
    </div>
  )
}
