'use client'

export default function LoadingSpinner({ size = 20 }: { size?: number }) {
  return (
    <div
      className="border-2 border-text-subtle border-t-fulton rounded-full animate-spin"
      style={{ width: size, height: size }}
    />
  )
}
