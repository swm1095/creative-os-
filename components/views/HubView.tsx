'use client'

import { ToolId, ViewId } from '@/lib/types'
import { MOCK_STATS, MOCK_TOP_CREATORS } from '@/lib/constants'
import StatCard from '@/components/ui/StatCard'
import SectionHeader from '@/components/ui/SectionHeader'

interface HubViewProps {
  onNavigate: (tool: ToolId, view: ViewId) => void
}

export default function HubView({ onNavigate }: HubViewProps) {
  return (
    <div className="animate-fadeIn">
      {/* KPI Row */}
      <div className="grid grid-cols-4 gap-3.5 mb-6">
        <StatCard label="Total Assets Generated" value={MOCK_STATS.totalCreatives} change={`↑ ${MOCK_STATS.weeklyCreatives} this week`} />
        <StatCard label="Avg ROAS" value={`${MOCK_STATS.avgROAS}x`} change="↑ 0.3 vs last month" />
        <StatCard label="Live Signals" value={MOCK_STATS.liveSignals} change="2 actionable" changeColor="text-fulton-gold" />
        <StatCard label="QC Pass Rate" value={`${MOCK_STATS.qcPassRate}%`} change="↑ 2% vs last batch" />
      </div>

      {/* Top Creators */}
      <SectionHeader title="Top Performing Creators" subtitle="Based on ROAS across all campaigns" />
      <div className="flex gap-3 overflow-x-auto pb-2 mb-6 scrollbar-none">
        {MOCK_TOP_CREATORS.map(creator => (
          <div key={creator.name} className="shrink-0 bg-surface border border-border rounded-lg p-4 min-w-[140px] text-center">
            <div className="w-12 h-12 rounded-full mx-auto mb-2 flex items-center justify-center text-white text-sm font-black" style={{ background: creator.color }}>
              {creator.name.split(' ').map(n => n[0]).join('')}
            </div>
            <div className="text-sm font-bold truncate">{creator.name}</div>
            <div className="text-xl font-black text-green mt-0.5">{creator.roas}x</div>
            <div className="text-2xs text-text-dim">Avg ROAS · {creator.adCount} ads</div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <SectionHeader title="Quick Actions" />
      <div className="grid grid-cols-3 gap-3">
        <button
          onClick={() => onNavigate('hypeimage', 'generate')}
          className="bg-surface border border-border rounded-lg p-4 text-left hover:border-fulton/40 transition-all"
        >
          <div className="text-lg mb-1">🖼</div>
          <div className="text-sm font-bold">Generate Creatives</div>
          <div className="text-xs text-text-dim mt-0.5">AI-powered image generation with Gemini</div>
        </button>
        <button
          onClick={() => onNavigate('hypercopy', 'copy')}
          className="bg-surface border border-border rounded-lg p-4 text-left hover:border-fulton/40 transition-all"
        >
          <div className="text-lg mb-1">✍️</div>
          <div className="text-sm font-bold">Write Ad Copy</div>
          <div className="text-xs text-text-dim mt-0.5">Claude generates headlines, CTAs & body copy</div>
        </button>
        <button
          onClick={() => onNavigate('hyperchat', 'chat')}
          className="bg-surface border border-border rounded-lg p-4 text-left hover:border-fulton/40 transition-all"
        >
          <div className="text-lg mb-1">💬</div>
          <div className="text-sm font-bold">Chat with Claude</div>
          <div className="text-xs text-text-dim mt-0.5">Strategy, research & brand analysis</div>
        </button>
      </div>
    </div>
  )
}
