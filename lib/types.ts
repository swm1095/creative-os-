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
