'use client'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: React.ReactNode
  maxWidth?: string
}

export default function Modal({ open, onClose, title, subtitle, children, maxWidth = 'max-w-lg' }: ModalProps) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45" onClick={onClose}>
      <div
        className={`bg-surface border border-border rounded-lg shadow-2xl ${maxWidth} w-full mx-4 max-h-[90vh] overflow-y-auto animate-fadeIn`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h2 className="text-lg font-black tracking-tight">{title}</h2>
            {subtitle && <p className="text-xs text-text-dim mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded bg-elevated text-text-dim hover:text-text-primary transition-colors">×</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}
