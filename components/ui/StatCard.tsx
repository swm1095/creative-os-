'use client'

interface StatCardProps {
  label: string
  value: string | number
  change?: string
  changeColor?: string
}

export default function StatCard({ label, value, change, changeColor = 'text-green' }: StatCardProps) {
  return (
    <div className="bg-surface border border-border rounded-lg p-5 flex flex-col gap-1">
      <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">{label}</span>
      <span className="text-3xl font-black tracking-tight">{value}</span>
      {change && <span className={`text-xs font-semibold ${changeColor}`}>{change}</span>}
    </div>
  )
}
