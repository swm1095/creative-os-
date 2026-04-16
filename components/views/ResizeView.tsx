'use client'

import { useState } from 'react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import ImagePreview from '@/components/ui/ImagePreview'
import EmptyState from '@/components/ui/EmptyState'
import PageHeader from '@/components/ui/PageHeader'

interface FormatUrls {
  '9x16'?: string
  '4x5'?: string
  '1x1'?: string
}

interface ResizeViewProps {
  formats: FormatUrls
  headline?: string
  onToast: (msg: string, type: 'success' | 'error' | 'info') => void
}

const FORMAT_INFO = [
  { key: '9x16' as const, label: '9:16 Vertical', dims: '1080 x 1920', use: 'Stories, Reels, TikTok' },
  { key: '4x5' as const, label: '4:5 Portrait', dims: '1080 x 1350', use: 'Instagram Feed, Facebook Feed' },
  { key: '1x1' as const, label: '1:1 Square', dims: '1080 x 1080', use: 'Instagram Feed, Facebook, Carousel' },
]

export default function ResizeView({ formats, headline, onToast }: ResizeViewProps) {
  const [previewImage, setPreviewImage] = useState<string | null>(null)

  const downloadImage = async (url: string, filename: string) => {
    try {
      const res = await fetch(url)
      const blob = await res.blob()
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(blobUrl)
      onToast(`Downloaded ${filename}`, 'success')
    } catch {
      onToast('Download failed', 'error')
    }
  }

  const downloadAll = async () => {
    onToast('Downloading all formats...', 'info')
    for (const fmt of FORMAT_INFO) {
      const url = formats[fmt.key]
      if (url) {
        await downloadImage(url, `creative-${fmt.key}.png`)
      }
    }
  }

  const hasAnyFormat = FORMAT_INFO.some(f => formats[f.key])

  if (!hasAnyFormat) {
    return (
      <div className="animate-fadeIn">
        <EmptyState
          emoji="📐"
          title="Resize & Export"
          subtitle="Generate a creative first, then come here to preview all formats and download."
          size="lg"
        />
      </div>
    )
  }

  return (
    <div className="animate-fadeIn">
      <PageHeader
        title="All Formats"
        subtitle={headline ? `"${headline}"` : undefined}
        action={<Button onClick={downloadAll}>Download All Formats</Button>}
      />

      <div className="grid grid-cols-3 gap-4">
        {FORMAT_INFO.map(fmt => {
          const url = formats[fmt.key]
          return (
            <Card key={fmt.key} padding={false}>
              {/* Image preview */}
              <div
                className="w-full bg-elevated flex items-center justify-center p-3 cursor-pointer"
                onClick={() => url && setPreviewImage(url)}
                style={{ minHeight: fmt.key === '9x16' ? 320 : fmt.key === '4x5' ? 280 : 240 }}
              >
                {url ? (
                  <img
                    src={url}
                    alt={fmt.label}
                    className="max-w-full max-h-full object-contain rounded"
                    style={{ maxHeight: fmt.key === '9x16' ? 300 : fmt.key === '4x5' ? 260 : 220 }}
                  />
                ) : (
                  <div className="text-text-dim text-xs">Not available</div>
                )}
              </div>

              {/* Info */}
              <div className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-bold">{fmt.label}</span>
                  <span className="text-2xs text-text-dim font-mono">{fmt.dims}</span>
                </div>
                <div className="text-2xs text-text-dim mb-3">{fmt.use}</div>
                <div className="flex gap-2">
                  {url && (
                    <>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="flex-1 justify-center"
                        onClick={() => downloadImage(url, `creative-${fmt.key}.png`)}
                      >
                        Download PNG
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setPreviewImage(url)}
                      >
                        Preview
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      <ImagePreview src={previewImage || ''} open={!!previewImage} onClose={() => setPreviewImage(null)} />
    </div>
  )
}
