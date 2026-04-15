'use client'

interface ImagePreviewProps {
  src: string
  alt?: string
  open: boolean
  onClose: () => void
}

export default function ImagePreview({ src, alt, open, onClose }: ImagePreviewProps) {
  if (!open || !src) return null
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 cursor-pointer"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full bg-black/50 text-white text-xl hover:bg-black/70 transition-colors"
      >
        x
      </button>
      <img
        src={src}
        alt={alt || 'Preview'}
        className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl animate-fadeIn"
        onClick={e => e.stopPropagation()}
      />
    </div>
  )
}
