'use client'

import { Creative } from '@/lib/types'

interface CreativeCardProps {
  creative: Creative
  onClick?: () => void
}

const statusColor: Record<string, string> = {
  pass: 'bg-green',
  warning: 'bg-amber',
  fail: 'bg-red',
  pending: 'bg-text-subtle',
}

export default function CreativeCard({ creative, onClick }: CreativeCardProps) {
  const overallStatus = creative.qc_spelling === 'fail' || creative.qc_brand === 'fail' || creative.qc_claims === 'fail'
    ? 'fail'
    : creative.qc_spelling === 'warning' || creative.qc_brand === 'warning' || creative.qc_claims === 'warning'
    ? 'warning'
    : creative.qc_spelling === 'pass' && creative.qc_brand === 'pass' && creative.qc_claims === 'pass'
    ? 'pass'
    : 'pending'

  return (
    <div
      className="bg-surface border border-border rounded-lg overflow-hidden cursor-pointer transition-all duration-200 hover:border-fulton/40 hover:shadow-lg hover:-translate-y-0.5"
      onClick={onClick}
    >
      <div className="w-full aspect-square relative overflow-hidden bg-elevated">
        {creative.image_url ? (
          <img src={creative.image_url} alt={creative.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-text-dim text-xs">No image</div>
        )}
      </div>
      <div className="px-3 py-2.5">
        <div className="text-sm font-bold truncate mb-0.5">{creative.title}</div>
        <div className="text-xs text-text-muted flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${statusColor[overallStatus]}`} />
          <span className="capitalize">{overallStatus}</span>
          <span className="text-text-subtle">·</span>
          <span className="capitalize">{creative.generator}</span>
        </div>
      </div>
    </div>
  )
}
