// ── Motion Creative Analytics Integration ────────────────────
// Maps HyperInsights brands to Motion workspace IDs
// Motion data is Meta/Facebook only

export interface MotionPerformance {
  // Sync metadata
  syncedAt: string
  dateRange: string
  workspaceId: string

  // Goal and thresholds
  goalMetric: string // e.g. 'roas', 'cpa', custom conversion
  spendThreshold: number

  // Top creatives summary
  topCreatives?: MotionCreative[]

  // Performance patterns
  winningFormats?: string[] // e.g. 'UGC video', 'static', 'carousel'
  winningHooks?: string[] // top performing hook styles
  winningAngles?: string[] // top performing angles/themes

  // Reports available
  reports?: MotionReport[]

  // Competitor intel from Motion
  competitors?: MotionCompetitor[]

  // Raw insights text (AI-generated summary)
  summary?: string
}

export interface MotionCreative {
  name: string
  format: 'video' | 'image' | 'carousel' | 'unknown'
  spend: number
  roas?: number
  cpa?: number
  ctr?: number
  cpm?: number
  hookRate?: number // 3-second video view rate
  holdRate?: number // video completion rate
  status: 'scaling' | 'testing' | 'fatiguing' | 'stable'
}

export interface MotionReport {
  id: string
  name: string
  description: string
  url: string
  type: string
  platform: string
}

export interface MotionCompetitor {
  name: string
  domain: string
  category: string
  activeAdCount: number
  productType: string
}

// ── Workspace Mapping ────────────────────────────────────────
// Maps brand names (lowercase) to Motion workspace IDs
// Organization ID: 6154d8f62889e2000687bf5a (HYPE10)
export const MOTION_ORG_ID = '6154d8f62889e2000687bf5a'

export const MOTION_WORKSPACES: Record<string, { id: string; name: string }> = {
  'abc carpet & home': { id: '6a3c5b9aaff249d1a8d9ae7e', name: 'ABC Carpet & Home' },
  'bandit running': { id: '67d01ec66b708205570b1817', name: 'Bandit Running' },
  "barkley's bag": { id: '69778841494bf77408297d99', name: "Barkley's Bag" },
  'blurrd': { id: '6a16150bd937fb9b2b8f7304', name: 'Blurrd' },
  'blush creative': { id: '677d9398ba4cc448a611abdd', name: 'Blush Creative' },
  'bonafide': { id: '689b56f3b21cda4443462bae', name: 'Bonafide' },
  'brodo': { id: '68a7646b245f4e1bb9d672a1', name: 'Brodo' },
  'carve': { id: '6526b4448387746df87fd030', name: 'Carve' },
  'clean beauty audit': { id: '6818e56873147c0edfacaa4e', name: 'Clean Beauty Audit' },
  'clean beauty collab ads': { id: '6818e59516fff9e48d0216ed', name: 'Clean Beauty Collab Ads - Audit' },
  'cleverpup': { id: '6a2a1fa6d490cb0a26c49475', name: 'Cleverpup' },
  'dagne dover': { id: '667f0889b863ec57ab21b975', name: 'Dagne Dover' },
  'dagne dover main': { id: '67eaf544943bbd4b3a81c69b', name: 'Dagne Dover Main Account' },
  'dose': { id: '624df83dc31603ff37504428', name: 'Dose' },
  'elektra': { id: '65e8cba39e294a50eb7f422b', name: 'Elektra' },
  'elix': { id: '6a1f5be8f63e32d424c091a1', name: 'Elix' },
  'floura': { id: '68e4706203f05f77c360c30a', name: 'Floura' },
  'frances valentine': { id: '67a57d27f998e60cff029e71', name: 'Frances Valentine' },
  'fullwell': { id: '691ce26af297130653af1af9', name: 'Fullwell' },
  'fulton': { id: '624df855c31603ff3750484e', name: 'Fulton' },
  'gantri': { id: '6a3183bf33d27294059abc0c', name: 'Gantri' },
  'happy viking': { id: '68ee73e70a64e587133f60bd', name: 'Happy Viking' },
  'happy wax': { id: '696fe3833e966b1417b16f8c', name: 'Happy Wax' },
  'hera fine jewelry': { id: '69be117673612aca843ad89b', name: 'Hera Fine Jewelry' },
  'impact dog crates': { id: '68bf441e65224f4c0a8b0d0c', name: 'Impact Dog Crates' },
  'legendairy milk': { id: '67ed9a0f42cea7cc8fcd2270', name: 'Legendairy Milk' },
  'lifemd sleep': { id: '6864454e4fd9a606cec5b8ff', name: 'LifeMD - Sleep' },
  'lifemd weight': { id: '689370382f707de7303873cb', name: 'LifeMD Weight - Feb' },
  'lingua franca': { id: '6881443fac77353108b3c929', name: 'Lingua Franca' },
  'mezcla': { id: '691ce309bbacce87228aa86b', name: 'Mezcla' },
  'milamend': { id: '69cd5eb6398abceaa61b97f1', name: 'Milamend' },
  'modern citizen': { id: '63f40248ab967dae136a9372', name: 'Modern Citizen' },
  'murad': { id: '67e30898a17725b5b9907586', name: 'Murad' },
  'neurogum': { id: '690b77819ea93d9141f10ad1', name: 'Neurogum' },
  'osteoboost': { id: '687526a5d16bf81d924e5f35', name: 'Osteoboost' },
  'phlur': { id: '69d944f1c05fc3d5c1f0009e', name: 'PHLUR' },
  'rally co': { id: '69d6de807598ed183f1187f7', name: 'Rally Co. Ad Account' },
  'stash': { id: '695e7d3c4f08ac4fdf0c069d', name: 'STASH - NEW ICP AD ACCOUNT' },
  'splitwise': { id: '6a3c14cd5b37eb404207d390', name: 'Splitwise' },
  'thuma': { id: '691ca78deadfa7ee6fc78eb0', name: 'Thuma' },
  'trelli': { id: '69fcf688e42616db3bc9193e', name: 'Trelli' },
  'tuttle twins': { id: '682682b281760e7d4f3b5820', name: 'Tuttle Twins' },
  'vrsn': { id: '68c33ae4605742825043ae8c', name: 'VRSN' },
  'versa gripps': { id: '69862cb442c58c60804cc42b', name: 'Versa Gripps USA' },
  'while on earth': { id: '673d056dd9c6a29a0acd5edd', name: 'while on earth' },
  'kepos': { id: '6998e2fc0543e060bc433cce', name: 'kepos' },
  'rexmd': { id: '68b9b74798cb9a1b03ee6cdb', name: 'rexMD' },
}

// Find Motion workspace for a brand (fuzzy match on name)
export function findMotionWorkspace(brandName: string): { id: string; name: string } | null {
  const lower = brandName.toLowerCase().trim()

  // Exact match
  if (MOTION_WORKSPACES[lower]) return MOTION_WORKSPACES[lower]

  // Partial match - brand name contains or is contained by workspace name
  for (const [key, workspace] of Object.entries(MOTION_WORKSPACES)) {
    if (key.includes(lower) || lower.includes(key)) return workspace
  }

  return null
}

// Build Motion context string for chat system prompt
export function buildMotionContext(motionData: MotionPerformance | null | undefined): string {
  if (!motionData) return ''

  const parts: string[] = ['\nMOTION PERFORMANCE DATA (Meta/Facebook ads):']
  parts.push(`Data synced: ${motionData.syncedAt} | Range: ${motionData.dateRange}`)
  parts.push(`Goal metric: ${motionData.goalMetric} | Spend threshold: $${motionData.spendThreshold}`)

  if (motionData.summary) {
    parts.push(`\nPerformance Summary: ${motionData.summary}`)
  }

  if (motionData.topCreatives?.length) {
    parts.push('\nTOP PERFORMING CREATIVES:')
    motionData.topCreatives.forEach((c, i) => {
      const metrics = [
        c.spend ? `$${c.spend} spend` : null,
        c.roas ? `${c.roas}x ROAS` : null,
        c.cpa ? `$${c.cpa} CPA` : null,
        c.hookRate ? `${c.hookRate}% hook rate` : null,
        c.ctr ? `${c.ctr}% CTR` : null,
      ].filter(Boolean).join(', ')
      parts.push(`  ${i + 1}. ${c.name} (${c.format}, ${c.status}) - ${metrics}`)
    })
  }

  if (motionData.winningFormats?.length) {
    parts.push(`\nWinning formats: ${motionData.winningFormats.join(', ')}`)
  }
  if (motionData.winningHooks?.length) {
    parts.push(`Winning hook styles: ${motionData.winningHooks.join(', ')}`)
  }
  if (motionData.winningAngles?.length) {
    parts.push(`Winning angles: ${motionData.winningAngles.join(', ')}`)
  }

  if (motionData.competitors?.length) {
    parts.push('\nCOMPETITOR AD INTEL:')
    motionData.competitors.forEach(c => {
      parts.push(`  - ${c.name} (${c.category}): ${c.activeAdCount} active ads - ${c.productType}`)
    })
  }

  if (motionData.reports?.length) {
    parts.push(`\n${motionData.reports.length} Motion reports available (user can view at projects.motionapp.com)`)
  }

  return parts.join('\n')
}
