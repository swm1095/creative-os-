export type AspectRatio = '1x1' | '4x5' | '9x16'
export type Generator = 'kling' | 'ideogram' | 'stability' | 'gemini'
export type QCStatus = 'pass' | 'fail' | 'pending' | 'warning'
export type JobStatus = 'queued' | 'running' | 'done' | 'error'

export interface Brand {
  id: string
  user_id: string
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

export interface Creative {
  id: string
  brand_id: string
  user_id: string
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

export interface QCNote {
  check: 'spelling' | 'brand' | 'claims'
  status: QCStatus
  message: string
  detail?: string
}

export interface Persona {
  id: string
  brand_id: string
  name: string
  angle: string
  hook?: string
  theme?: string
  source: 'manual' | 'sheets'
}

export interface GenerateRequest {
  concept: string
  personas: PersonaInput[]
  aspectRatio: AspectRatio
  generator: Generator
  brandId: string
}

export interface PersonaInput {
  name: string
  angle: string
  hook?: string
}

export interface GenerateResult {
  persona: PersonaInput
  imageUrl: string
  jobId?: string
}

export interface QCRequest {
  imageUrl: string
  brandId?: string
  creativeId?: string
}

export interface QCResult {
  spelling: QCNote
  brand: QCNote
  claims: QCNote
  overallStatus: QCStatus
}

export interface BrandAnalysis {
  colors: string[]
  fonts: string[]
  tone: string
  styleNotes: string
  logoDescription?: string
}

export interface Job {
  id: string
  brand_id: string
  user_id: string
  name: string
  status: JobStatus
  progress: number
  total: number
  detail?: string
  created_at: string
}

export interface SheetsImportResult {
  personas: PersonaInput[]
  source: string
  rowCount: number
}
