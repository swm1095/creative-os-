// ── Core types ───────────────────────────────────────────────
export type AspectRatio = '1x1' | '4x5' | '9x16'
export type Generator = 'kling' | 'ideogram' | 'stability' | 'gemini'
export type QCStatus = 'pass' | 'fail' | 'pending' | 'warning'
export type JobStatus = 'queued' | 'running' | 'done' | 'error'

// ── Navigation ───────────────────────────────────────────────
export type ToolId = 'hypeimage' | 'hyperchat' | 'hypercopy' | 'hyperinsights' | 'hyperlistening' | 'hyperresearch' | 'hypervideo' | null
export type ViewId =
  | 'hub'
  | 'image-dashboard' | 'generate' | 'resize' | 'qc' | 'brand' | 'integrations'
  | 'chat'
  | 'copy'
  | 'performance'
  | 'tracker'
  | 'listening'
  | 'video'
  | 'brand-research'
  | 'saved-insights'
  | 'coming-soon'

// ── Brand ────────────────────────────────────────────────────
export interface Brand {
  id: string
  user_id?: string | null
  name: string
  url?: string
  color: string
  brand_colors?: string[]
  brand_fonts?: string[]
  brand_guidelines_url?: string
  logo_url?: string
  tone_notes?: string
  created_at: string
  creative_count?: number
  // Deep research fields
  research?: BrandResearch | null
  research_completed?: boolean
  // Scan cadence
  scan_cadence?: string
  last_scanned_at?: string
  assigned_to?: string
  // Competitor product URLs for Amazon review mining
  competitor_urls?: string[]
}

export interface BrandResearch {
  // Core identity
  industry: string
  productCategory: string
  priceRange: string
  targetDemo: string
  // Positioning
  valueProps: string[]
  differentiators: string[]
  competitors: string[]
  // Audience insights
  personas: ResearchPersona[]
  painPoints: string[]
  motivators: string[]
  objections: string[]
  // Voice and messaging
  brandVoice: string
  messagingThemes: string[]
  keyPhrases: string[]
  avoidPhrases: string[]
  // Social listening config
  searchKeywords: string[]
  subreddits: string[]
  hashTags: string[]
  // Meta
  websiteUrl: string
  researchDate: string
  summary: string
}

export interface ResearchPersona {
  name: string
  age: string
  description: string
  painPoints: string[]
  motivators: string[]
  channels: string[]
  hook: string
}

// ── Social Listening ─────────────────────────────────────────
export interface SocialSignal {
  id: string
  source: string
  title: string
  content: string
  url?: string
  score?: number
  date: string
  sentiment: 'positive' | 'negative' | 'neutral'
  relevance: number
}

export interface ListeningInsight {
  id: string
  type: 'trend' | 'pain_point' | 'competitor' | 'opportunity' | 'language'
  title: string
  detail: string
  signals: string[]
  actionable: string
  priority: 'high' | 'medium' | 'low'
}

// ── Creative ─────────────────────────────────────────────────
export interface Creative {
  id: string
  brand_id: string
  user_id?: string | null
  title: string
  concept?: string
  persona?: string
  angle?: string
  image_url: string
  image_1x1_url?: string
  image_4x5_url?: string
  image_9x16_url?: string
  format: AspectRatio
  generator: Generator
  qc_spelling?: QCStatus
  qc_brand?: QCStatus
  qc_claims?: QCStatus
  qc_notes?: QCNote[]
  created_at: string
}

// ── QC ───────────────────────────────────────────────────────
export interface QCNote {
  check: 'spelling' | 'brand' | 'claims'
  status: QCStatus
  message: string
  detail?: string
}

export interface QCResult {
  spelling: QCNote
  brand: QCNote
  claims: QCNote
  overallStatus: QCStatus
}

// ── Persona ──────────────────────────────────────────────────
export interface Persona {
  id: string
  brand_id: string
  name: string
  angle: string
  hook?: string
  theme?: string
  source: 'manual' | 'sheets'
}

export interface PersonaInput {
  name: string
  angle: string
  hook?: string
}

// ── Generate ─────────────────────────────────────────────────
export interface GenerateRequest {
  concept: string
  personas: PersonaInput[]
  aspectRatio: AspectRatio
  generator: Generator
  brandId: string
}

export interface GenerateResult {
  persona: PersonaInput
  imageUrl: string
  error?: string
  jobId?: string
  formats?: {
    '9x16'?: string
    '4x5'?: string
    '1x1'?: string
  }
}

// ── Brand Analysis ───────────────────────────────────────────
export interface BrandAnalysis {
  colors: string[]
  fonts: string[]
  tone: string
  styleNotes: string
  logoDescription?: string
}

// ── Chat ─────────────────────────────────────────────────────
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

// ── Ad Copy ──────────────────────────────────────────────────
export interface CopyVariant {
  headline: string
  body: string
  cta: string
  persona: string
  platform: string
}

export interface CopyRequest {
  persona: string
  tone: string
  platform: string
  prompt: string
  brandContext?: string
}

export interface CopyResult {
  variants: CopyVariant[]
}

// ── Toast ────────────────────────────────────────────────────
export interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
}

// ── Job ──────────────────────────────────────────────────────
export interface Job {
  id: string
  brand_id: string
  user_id?: string | null
  name: string
  status: JobStatus
  progress: number
  total: number
  detail?: string
  created_at: string
}

// ── Sheets ───────────────────────────────────────────────────
export interface SheetsImportResult {
  personas: PersonaInput[]
  source: string
  rowCount: number
}
