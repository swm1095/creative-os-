'use client'

import { useState, useEffect } from 'react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Pill from '@/components/ui/Pill'
import PageHeader from '@/components/ui/PageHeader'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

interface HealthResult {
  service: string
  status: 'healthy' | 'degraded' | 'down'
  responseTime?: number
  error?: string
}

interface DataConnectionsViewProps {
  onToast: (msg: string, type: 'success' | 'error' | 'info') => void
}

const CONNECTIONS = [
  {
    id: 'meta',
    name: 'Meta Ads (H10 API)',
    description: 'Connect via Hype10\'s own Meta API integration. Pull ad performance data, creative analytics, and audience insights directly.',
    icon: '📱',
    status: 'not_connected' as const,
    fields: ['ROAS', 'CTR', 'CPC', 'CPM', 'Spend', 'Impressions', 'Reach', 'Frequency'],
    tools: ['HyperIntelligence', 'HyperInsights', 'HyperListening'],
  },
  {
    id: 'google',
    name: 'Google Ads',
    description: 'Connect Google Ads for search, shopping, and performance max campaign data.',
    icon: '🔍',
    status: 'not_connected' as const,
    fields: ['Clicks', 'Impressions', 'Cost', 'Conversions', 'Conv. Rate', 'CPA'],
    tools: ['HyperIntelligence', 'HyperInsights'],
  },
  {
    id: 'apify',
    name: 'Apify',
    description: 'Social scraping for TikTok, Amazon reviews, and Reddit. Powers HyperListening deep signal collection.',
    icon: '🕷',
    status: (typeof window === 'undefined' ? 'connected' : 'connected') as 'connected' | 'not_connected',
    fields: ['TikTok Content', 'Amazon Reviews', 'Reddit Deep', 'Twitter/X'],
    tools: ['HyperListening'],
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    description: 'AI image generation and brand analysis via Nano Banana 2.',
    icon: '🤖',
    status: 'connected' as const,
    fields: ['Image Generation', 'Brand Analysis', 'PDF Processing'],
    tools: ['HyperImage', 'HyperResearch'],
  },
  {
    id: 'anthropic',
    name: 'Claude (Anthropic)',
    description: 'AI creative strategist, QC checks, copy generation, UGC scripts, and chat.',
    icon: '🧠',
    status: 'connected' as const,
    fields: ['Chat', 'Copy', 'QC', 'UGC Scripts', 'Analysis'],
    tools: ['HyperChat', 'HyperCopy', 'HyperListening', 'HyperResearch'],
  },
]

export default function DataConnectionsView({ onToast }: DataConnectionsViewProps) {
  const [healthResults, setHealthResults] = useState<HealthResult[]>([])
  const [checkingHealth, setCheckingHealth] = useState(false)

  const runHealthCheck = async () => {
    setCheckingHealth(true)
    try {
      const res = await fetch('/api/cron/health-check')
      const data = await res.json()
      if (data.results) setHealthResults(data.results)
      const downCount = (data.downServices || []).length
      if (downCount > 0) onToast(`${downCount} service${downCount > 1 ? 's' : ''} down`, 'error')
      else onToast('All connections healthy', 'success')
    } catch { onToast('Health check failed', 'error') }
    setCheckingHealth(false)
  }

  useEffect(() => { runHealthCheck() }, [])

  const getHealthStatus = (serviceName: string) => {
    return healthResults.find(r => r.service === serviceName)
  }

  return (
    <div className="animate-fadeIn">
      <PageHeader
        title="Data Connections"
        subtitle="Connect your ad platforms and tools to power HyperCreate"
        action={
          <Button variant="secondary" size="sm" onClick={runHealthCheck} disabled={checkingHealth}>
            {checkingHealth ? <><LoadingSpinner size={12} /> Checking...</> : 'Run Health Check'}
          </Button>
        }
      />

      <div className="space-y-4">
        {CONNECTIONS.map(conn => (
          <Card key={conn.id}>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-elevated border border-border rounded-lg flex items-center justify-center text-2xl shrink-0">
                {conn.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-bold">{conn.name}</span>
                  <Pill variant={conn.status === 'connected' ? 'green' : 'gray'}>
                    {conn.status === 'connected' ? 'Connected' : 'Not Connected'}
                  </Pill>
                  {(() => {
                    const health = getHealthStatus(conn.name.replace(' (H10 API)', ''))
                    if (!health) return null
                    return (
                      <Pill variant={health.status === 'healthy' ? 'green' : health.status === 'degraded' ? 'amber' : 'red'}>
                        {health.status === 'healthy' ? `${health.responseTime}ms` : health.status}
                      </Pill>
                    )
                  })()}
                </div>
                <p className="text-xs text-text-dim mb-3">{conn.description}</p>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {conn.fields.map((f, i) => (
                    <span key={i} className="text-2xs bg-elevated border border-border px-2 py-0.5 rounded">{f}</span>
                  ))}
                </div>
                <div className="text-2xs text-text-dim">
                  Used by: {conn.tools.join(', ')}
                </div>
              </div>
              <div className="shrink-0">
                {conn.status === 'connected' ? (
                  <Button size="sm" variant="ghost">Manage</Button>
                ) : (
                  <Button size="sm" onClick={() => onToast(`${conn.name} connection coming soon. Your API will plug in here.`, 'info')}>
                    Connect
                  </Button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
