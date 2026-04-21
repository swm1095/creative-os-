'use client'

import { ToolId, ViewId } from '@/lib/types'
import { MOCK_STATS, MOCK_TOP_CREATORS } from '@/lib/constants'
import StatCard from '@/components/ui/StatCard'
import SectionHeader from '@/components/ui/SectionHeader'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Pill from '@/components/ui/Pill'

interface HubViewProps {
  onNavigate: (tool: ToolId, view: ViewId) => void
}

const MOCK_TOP_ADS = [
  { id: '1', name: 'Cheaper Than PT - P1 Static', format: 'Static', roas: '7.6x', spend: '$1,240', platform: 'Meta', persona: 'Chronic Pain' },
  { id: '2', name: 'Science-Backed Relief - P4 Video', format: 'UGC Video', roas: '5.1x', spend: '$890', platform: 'Meta', persona: 'Health-Conscious' },
  { id: '3', name: 'Wasted Money on Slippers - P2', format: 'Static', roas: '4.3x', spend: '$2,100', platform: 'Meta', persona: 'Slipper Skeptics' },
  { id: '4', name: 'All-Day WFH Comfort - P3', format: 'Carousel', roas: '3.9x', spend: '$1,560', platform: 'Google', persona: 'WFH Workers' },
]

export default function HubView({ onNavigate }: HubViewProps) {
  return (
    <div className="animate-fadeIn">
      <div className="bg-blue/5 border border-blue/20 rounded-lg px-4 py-2 mb-4 text-xs text-blue">
        Dashboard stats are placeholder data. Connect Meta/Google Ads to see real performance metrics.
      </div>
      {/* KPI Row */}
      <div className="grid grid-cols-4 gap-3.5 mb-6">
        <StatCard label="Total Assets Generated" value={MOCK_STATS.totalCreatives} change={`↑ ${MOCK_STATS.weeklyCreatives} this week`} />
        <StatCard label="Avg ROAS" value={`${MOCK_STATS.avgROAS}x`} change="↑ 0.3 vs last month" />
        <StatCard label="Live Signals" value={MOCK_STATS.liveSignals} change="2 actionable" changeColor="text-fulton-gold" />
        <StatCard label="QC Pass Rate" value={`${MOCK_STATS.qcPassRate}%`} change="↑ 2% vs last batch" />
      </div>

      {/* Top Creators */}
      <SectionHeader title="Top Performing Creators" subtitle="Based on ROAS across all campaigns" />
      <div className="flex gap-3 overflow-x-auto pb-2 mb-8 scrollbar-none">
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

      {/* HyperIntelligence - Top Performing Creative */}
      <SectionHeader
        title="Top Performing Creative"
        subtitle="Across all connected ad accounts"
        action={<Pill variant="blue">HyperIntelligence</Pill>}
      />
      <div className="space-y-2 mb-6">
        {MOCK_TOP_ADS.map(ad => (
          <Card key={ad.id} className="hover:border-blue/30 transition-colors">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-elevated border border-border rounded-lg flex items-center justify-center shrink-0">
                <span className="text-2xl">{ad.format === 'UGC Video' ? '🎬' : ad.format === 'Carousel' ? '📱' : '🖼'}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold">{ad.name}</div>
                <div className="flex items-center gap-2 mt-1">
                  <Pill variant="gray">{ad.format}</Pill>
                  <Pill variant="gray">{ad.platform}</Pill>
                  <Pill variant="gray">{ad.persona}</Pill>
                </div>
              </div>
              <div className="text-right shrink-0 mr-4">
                <div className="text-xl font-black text-green">{ad.roas}</div>
                <div className="text-2xs text-text-dim">{ad.spend} spend</div>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button size="sm" variant="secondary" onClick={() => onNavigate('hypercopy', 'copy')}>
                  Recreate Script
                </Button>
                <Button size="sm" variant="secondary" onClick={() => onNavigate('hypeimage', 'generate')}>
                  Recreate Image
                </Button>
              </div>
            </div>
          </Card>
        ))}
        <div className="text-center pt-2">
          <span className="text-xs text-text-dim">Connect Meta and Google Ads to see real performance data</span>
        </div>
      </div>
    </div>
  )
}
