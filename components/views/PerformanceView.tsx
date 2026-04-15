'use client'

import StatCard from '@/components/ui/StatCard'
import Card from '@/components/ui/Card'
import SectionHeader from '@/components/ui/SectionHeader'

export default function PerformanceView() {
  return (
    <div className="animate-fadeIn">
      <div className="grid grid-cols-4 gap-3.5 mb-6">
        <StatCard label="Total Spend" value="$24.8K" change="↑ 12% vs last month" />
        <StatCard label="Revenue" value="$102K" change="↑ 8% vs last month" />
        <StatCard label="Avg ROAS" value="4.1x" change="↑ 0.3 vs last month" />
        <StatCard label="Active Campaigns" value="12" change="3 new this week" changeColor="text-blue" />
      </div>

      <SectionHeader title="Top Performing Creatives" subtitle="Last 30 days by ROAS" />
      <div className="bg-surface border border-border rounded-lg overflow-hidden mb-6">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left text-2xs font-bold text-text-dim uppercase tracking-wider px-4 py-3">Creative</th>
              <th className="text-right text-2xs font-bold text-text-dim uppercase tracking-wider px-4 py-3">ROAS</th>
              <th className="text-right text-2xs font-bold text-text-dim uppercase tracking-wider px-4 py-3">Spend</th>
              <th className="text-right text-2xs font-bold text-text-dim uppercase tracking-wider px-4 py-3">CTR</th>
              <th className="text-right text-2xs font-bold text-text-dim uppercase tracking-wider px-4 py-3">CPC</th>
            </tr>
          </thead>
          <tbody>
            {[
              { name: 'Cheaper than PT — P1', roas: '7.6x', spend: '$1,240', ctr: '4.2%', cpc: '$0.82' },
              { name: 'Science-Backed — P4', roas: '5.1x', spend: '$890', ctr: '3.8%', cpc: '$0.91' },
              { name: 'Wasted Money — P2', roas: '4.3x', spend: '$2,100', ctr: '3.1%', cpc: '$1.12' },
              { name: 'All-Day Comfort — P3', roas: '3.9x', spend: '$1,560', ctr: '2.9%', cpc: '$1.24' },
              { name: 'Built Different — P4', roas: '3.2x', spend: '$980', ctr: '2.6%', cpc: '$1.38' },
            ].map((row, i) => (
              <tr key={i} className="border-b border-border/50 hover:bg-elevated/50 transition-colors">
                <td className="px-4 py-3 text-sm font-semibold">{row.name}</td>
                <td className="px-4 py-3 text-sm text-green font-bold text-right">{row.roas}</td>
                <td className="px-4 py-3 text-sm text-text-muted text-right">{row.spend}</td>
                <td className="px-4 py-3 text-sm text-text-muted text-right">{row.ctr}</td>
                <td className="px-4 py-3 text-sm text-text-muted text-right">{row.cpc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Card>
        <div className="flex items-center justify-center py-8 text-center">
          <div>
            <div className="text-2xl mb-2">📊</div>
            <div className="text-sm font-bold mb-1">Connect Meta & Google Ads</div>
            <div className="text-xs text-text-dim max-w-sm">Once connected, this dashboard will show real-time performance data from your ad accounts.</div>
          </div>
        </div>
      </Card>
    </div>
  )
}
