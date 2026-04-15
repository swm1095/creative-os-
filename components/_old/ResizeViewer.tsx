'use client'

import { useEffect, useRef, useState } from 'react'
import { Creative } from '@/lib/types'

interface ResizeViewerProps {
  creative: Creative
  onClose: () => void
}

const FORMATS = [
  { key: '1x1' as const,  label: '1×1',  width: 1080, height: 1080, displayW: 180, displayH: 180 },
  { key: '4x5' as const,  label: '4×5',  width: 1080, height: 1350, displayW: 180, displayH: 225 },
  { key: '9x16' as const, label: '9×16', width: 1080, height: 1920, displayW: 180, displayH: 320 },
]

function drawToCanvas(
  canvas: HTMLCanvasElement,
  img: HTMLImageElement,
  targetW: number,
  targetH: number
) {
  canvas.width = targetW
  canvas.height = targetH
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, targetW, targetH)
  // Cover-fit (crop center)
  const scale = Math.max(targetW / img.naturalWidth, targetH / img.naturalHeight)
  const sw = targetW / scale
  const sh = targetH / scale
  const sx = (img.naturalWidth - sw) / 2
  const sy = (img.naturalHeight - sh) / 2
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetW, targetH)
}

export default function ResizeViewer({ creative, onClose }: ResizeViewerProps) {
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([])
  const [imgLoaded, setImgLoaded] = useState(false)
  const [imgError, setImgError] = useState(false)
  const imgRef = useRef<HTMLImageElement | null>(null)

  useEffect(() => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = creative.image_url
    img.onload = () => {
      imgRef.current = img
      setImgLoaded(true)
      FORMATS.forEach((fmt, i) => {
        const canvas = canvasRefs.current[i]
        if (canvas) drawToCanvas(canvas, img, fmt.width, fmt.height)
      })
    }
    img.onerror = () => setImgError(true)
  }, [creative.image_url])

  const downloadCanvas = (index: number, format: typeof FORMATS[0]) => {
    const canvas = canvasRefs.current[index]
    if (!canvas) return
    const link = document.createElement('a')
    link.download = `${creative.title}-${format.label.replace('×','x')}.png`
    link.href = canvas.toDataURL('image/png', 1.0)
    link.click()
  }

  const downloadAll = () => {
    FORMATS.forEach((fmt, i) => {
      setTimeout(() => downloadCanvas(i, fmt), i * 200)
    })
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400
    }}>
      <div style={{
        background: 'white', borderRadius: 12, border: '1px solid var(--border)',
        width: 820, maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 24px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 12
        }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.02em' }}>Resize & export</div>
            <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2 }}>{creative.title}</div>
          </div>
          <div style={{ flex: 1 }}/>
          <button className="btn-ghost" onClick={downloadAll}>⬇ Download all</button>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--gray-500)', padding: '0 4px' }}>×</button>
        </div>

        {/* Content */}
        <div style={{ padding: 24 }}>
          {imgError ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--red)' }}>
              Could not load image. Check that the URL is accessible.
            </div>
          ) : (
            <>
              {!imgLoaded && (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--gray-300)' }}>
                  <Spinner /> Loading image...
                </div>
              )}

              <div style={{ display: 'flex', gap: 20, justifyContent: 'center', flexWrap: 'wrap' }}>
                {FORMATS.map((fmt, i) => (
                  <div key={fmt.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                    {/* Canvas preview */}
                    <div style={{
                      border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden',
                      background: 'var(--gray-50)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: fmt.displayW + 2, height: fmt.displayH + 2, flexShrink: 0
                    }}>
                      <canvas
                        ref={el => { canvasRefs.current[i] = el }}
                        style={{
                          width: fmt.displayW, height: fmt.displayH,
                          display: imgLoaded ? 'block' : 'none'
                        }}
                      />
                      {!imgLoaded && <div style={{ color: 'var(--gray-300)', fontSize: 12 }}>...</div>}
                    </div>

                    {/* Info */}
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: '-0.02em' }}>{fmt.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>{fmt.width}×{fmt.height}px</div>
                    </div>

                    {/* Download button */}
                    <button
                      className="btn-ghost"
                      onClick={() => downloadCanvas(i, fmt)}
                      disabled={!imgLoaded}
                      style={{ width: '100%' }}
                    >
                      ⬇ Download {fmt.label}
                    </button>

                    {/* Existing URL if saved */}
                    {creative[`image_${fmt.key}_url` as keyof Creative] && (
                      <div style={{ fontSize: 10, color: 'var(--green)', fontWeight: 600 }}>✓ Saved to gallery</div>
                    )}
                  </div>
                ))}
              </div>

              {imgLoaded && (
                <div style={{ marginTop: 24, padding: '14px 18px', background: 'var(--blue-light)', borderRadius: 8, fontSize: 12, color: 'var(--blue)', fontWeight: 500 }}>
                  <strong>Tip:</strong> All three formats are cropped to center from the original image. For best results, generate with the target aspect ratio selected.
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function Spinner() {
  return (
    <div style={{
      width: 20, height: 20, border: '3px solid var(--border)',
      borderTopColor: 'var(--blue)', borderRadius: '50%',
      animation: 'spin 0.7s linear infinite', display: 'inline-block', marginRight: 8,
      verticalAlign: 'middle'
    }}/>
  )
}
