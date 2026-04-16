'use client'

import { Creative, ViewId } from '@/lib/types'
import { MOCK_STATS } from '@/lib/constants'
import StatCard from '@/components/ui/StatCard'
import SectionHeader from '@/components/ui/SectionHeader'
import CreativeCard from '@/components/ui/CreativeCard'
import Button from '@/components/ui/Button'
import EmptyState from '@/components/ui/EmptyState'

interface ImageDashboardViewProps {
  creatives: Creative[]
  onNavigate: (view: ViewId) => void
  onSelectCreative: (creative: Creative) => void
}

export default function ImageDashboardView({ creatives, onNavigate, onSelectCreative }: ImageDashboardViewProps) {
  return (
    <div className="animate-fadeIn">
      <div className="grid grid-cols-4 gap-3.5 mb-6">
        <StatCard label="Total Creatives" value={creatives.length || MOCK_STATS.totalCreatives} change={`↑ ${MOCK_STATS.weeklyCreatives} this week`} />
        <StatCard label="QC Pass Rate" value={`${MOCK_STATS.qcPassRate}%`} change="↑ 2% vs last batch" />
        <StatCard label="Active Brands" value={MOCK_STATS.activeBrands} change="2 updated today" changeColor="text-blue" />
        <StatCard label="Formats Generated" value="567" change="3 formats per creative" changeColor="text-text-dim" />
      </div>

      <SectionHeader
        title="Recent Creatives"
        subtitle="Latest generated assets"
        action={<Button variant="ghost" size="sm" onClick={() => onNavigate('generate')}>+ New Generation</Button>}
      />

      {creatives.length > 0 ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-3.5 mb-6">
          {creatives.slice(0, 12).map(c => (
            <CreativeCard key={c.id} creative={c} onClick={() => onSelectCreative(c)} />
          ))}
        </div>
      ) : (
        <EmptyState
          emoji="🖼"
          title="No creatives yet"
          subtitle="Generate your first AI-powered ad creative"
          action={<Button onClick={() => onNavigate('generate')}>Generate Creatives</Button>}
        />
      )}
    </div>
  )
}
