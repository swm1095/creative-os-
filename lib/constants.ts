import { ToolId, ViewId, PersonaInput } from './types'

// ── Tool definitions ─────────────────────────────────────────
export interface ToolDef {
  id: ToolId
  name: string
  shortName: string
  emoji: string
  description: string
  defaultView: ViewId
  views: { id: ViewId; label: string }[]
  implemented: boolean
}

export const TOOLS: ToolDef[] = [
  {
    id: 'hyperchat',
    name: 'HyperChat',
    shortName: 'AI Chat',
    emoji: '💬',
    description: 'AI strategy assistant',
    defaultView: 'chat',
    views: [{ id: 'chat', label: 'Chat' }],
    implemented: true,
  },
  {
    id: 'hypercopy',
    name: 'HyperCopy',
    shortName: 'Ad Copy',
    emoji: '✍️',
    description: 'AI ad copy generation',
    defaultView: 'copy',
    views: [{ id: 'copy', label: 'Copy Studio' }],
    implemented: true,
  },
  {
    id: 'hyperlistening',
    name: 'HyperListening',
    shortName: 'Social Intel',
    emoji: '👂',
    description: 'Social listening & signals',
    defaultView: 'listening',
    views: [
      { id: 'listening' as const, label: 'Signals' },
      { id: 'saved-insights' as const, label: 'Saved Insights' },
    ],
    implemented: true,
  },
  {
    id: 'hyperresearch',
    name: 'HyperResearch',
    shortName: 'Research',
    emoji: '🔬',
    description: 'Brand research & analysis',
    defaultView: 'brand-research',
    views: [
      { id: 'brand-research' as const, label: 'Brand Research' },
      { id: 'competitor-research' as const, label: 'Competitor Research' },
      { id: 'saved-insights' as const, label: 'Saved Insights' },
    ],
    implemented: true,
  },
]

// ── Default Fulton personas ──────────────────────────────────
export const DEFAULT_PERSONAS: PersonaInput[] = [
  { name: 'Chronic Pain Sufferers (35–65)', angle: 'Medical alternative / cost savings', hook: 'Cheaper than physical therapy' },
  { name: 'Slipper Skeptics (28–50)', angle: 'Frustration with flat slippers', hook: "We're sorry you wasted money on slippers" },
  { name: 'WFH Workers (25–45)', angle: 'All-day home comfort & alignment', hook: 'Comfort you can wear all day without sacrificing support' },
  { name: 'Health-Conscious Active (40–60)', angle: 'Science & engineering credibility', hook: 'Fixes foot, knee & back pain at the source' },
]

// ── Default Fulton brand data ────────────────────────────────
export const DEFAULT_BRAND = {
  name: 'Fulton',
  color: '#1B4332',
  url: 'https://walkfulton.com',
  industry: 'Supportive Footwear & Insoles',
  colors: [
    { hex: '#1B4332', label: 'Primary Green' },
    { hex: '#C8922A', label: 'Gold Accent' },
    { hex: '#f7faf8', label: 'Off White' },
    { hex: '#112b20', label: 'Deep Green' },
    { hex: '#d4e4f0', label: 'Light Blue' },
  ],
  fonts: [
    { name: 'Inter Black', use: 'Headlines' },
    { name: 'Inter Regular', use: 'Body' },
    { name: 'Inter', use: 'Logo / Brand Mark' },
  ],
  tone: 'Empathetic & Credibly Science-Backed. Lead with pain-point empathy, then pivot to credible science and engineering. Never clinical — always warm, clear, and confident.',
  dos: [
    'Lead with a specific pain point the persona feels daily',
    'Use empathetic, conversational language',
    'Highlight features (cork, arch support, deep heel cup)',
    'Show product in close-up or lifestyle context',
    'Include cost-comparison angles where relevant',
  ],
  donts: [
    'Make drug or medical cure claims',
    'Use clinical/hospital imagery',
    'Use busy backgrounds or cluttered layouts',
    'Shrink the logo below legibility',
    'Use off-brand colors without approval',
  ],
}

// ── Platform options for copy generation ─────────────────────
export const PLATFORMS = ['Meta (Facebook/Instagram)', 'Google Ads', 'TikTok', 'Email', 'Landing Page']
export const TONES = ['Professional', 'Conversational', 'Urgent', 'Empathetic', 'Bold', 'Playful']
// Centralized model config - update here to auto-update across all tools
// When new models release (e.g. Opus 4.7), change the ID here and
// every tool (Chat, Copy, QC, Research, Listening) picks it up automatically
export const AI_MODELS = {
  fast: { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', provider: 'anthropic' },
  standard: { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', provider: 'anthropic' },
  premium: { id: 'claude-opus-4-6', name: 'Claude Opus 4.6', provider: 'anthropic' },
  image: { id: 'gemini-2.5-flash-image', name: 'Gemini 2.5 Flash Image', provider: 'google' },
  imageAlt: { id: 'gemini-3.1-flash-image-preview', name: 'Gemini 3.1 Flash', provider: 'google' },
}
