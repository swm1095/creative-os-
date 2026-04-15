import sharp from 'sharp'

type AdFormat = '9x16' | '4x5' | '1x1'

interface ComposeOptions {
  imageBuffer: Buffer
  headline: string
  cta: string
  brandName?: string
  brandColor?: string
  format?: AdFormat
}

interface FormatConfig {
  width: number
  height: number
  fontSize: number
  ctaFontSize: number
  brandFontSize: number
  headlineY: number      // fraction of height where headline starts
  ctaY: number           // fraction of height where CTA sits
  brandX: number         // px from left
  brandY: number         // px from top
  maxCharsPerLine: number
  lineHeight: number
  padding: number        // horizontal padding for text
}

const FORMAT_CONFIGS: Record<AdFormat, FormatConfig> = {
  '9x16': {
    width: 1080,
    height: 1920,
    fontSize: 64,
    ctaFontSize: 22,
    brandFontSize: 22,
    headlineY: 0.42,
    ctaY: 0.82,
    brandX: 48,
    brandY: 64,
    maxCharsPerLine: 20,
    lineHeight: 78,
    padding: 60,
  },
  '4x5': {
    width: 1080,
    height: 1350,
    fontSize: 56,
    ctaFontSize: 20,
    brandFontSize: 20,
    headlineY: 0.38,
    ctaY: 0.80,
    brandX: 44,
    brandY: 56,
    maxCharsPerLine: 22,
    lineHeight: 68,
    padding: 50,
  },
  '1x1': {
    width: 1080,
    height: 1080,
    fontSize: 48,
    ctaFontSize: 18,
    brandFontSize: 18,
    headlineY: 0.32,
    ctaY: 0.78,
    brandX: 40,
    brandY: 48,
    maxCharsPerLine: 24,
    lineHeight: 58,
    padding: 44,
  },
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\u2014/g, '-')  // emdash
    .replace(/\u2013/g, '-')  // endash
    .replace(/\u2018|\u2019/g, "'")  // smart quotes
    .replace(/\u201C|\u201D/g, '"')  // smart double quotes
}

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let current = ''

  for (const word of words) {
    const test = current ? current + ' ' + word : word
    if (test.length > maxChars && current) {
      lines.push(current)
      current = word
    } else {
      current = test
    }
  }
  if (current) lines.push(current)
  return lines
}

function buildOverlaySvg(config: FormatConfig, headline: string, cta: string, brandName: string, brandColor: string): string {
  const { width, height, fontSize, ctaFontSize, brandFontSize, headlineY, ctaY, brandX, brandY, maxCharsPerLine, lineHeight, padding } = config

  const headlineLines = wrapText(escapeXml(headline), maxCharsPerLine)
  const escapedCta = escapeXml(cta)
  const escapedBrand = escapeXml(brandName)

  const headlineStartY = height * headlineY
  const headlineSvg = headlineLines.map((line, i) =>
    `<text x="${width / 2}" y="${headlineStartY + i * lineHeight}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="900" fill="white">
      <tspan>${line}</tspan>
    </text>`
  ).join('\n    ')

  // Drop shadow for headline
  const headlineShadow = headlineLines.map((line, i) =>
    `<text x="${width / 2 + 2}" y="${headlineStartY + i * lineHeight + 3}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="900" fill="rgba(0,0,0,0.4)">
      <tspan>${line}</tspan>
    </text>`
  ).join('\n    ')

  const ctaWidth = Math.max(180, escapedCta.length * (ctaFontSize * 0.7) + 60)
  const ctaHeight = ctaFontSize * 2.6
  const ctaXPos = (width - ctaWidth) / 2
  const ctaYPos = height * ctaY

  const topGradHeight = Math.round(height * 0.18)
  const bottomGradStart = Math.round(height * 0.65)
  const bottomGradHeight = height - bottomGradStart

  return `
  <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="topGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="black" stop-opacity="0.45"/>
        <stop offset="100%" stop-color="black" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="bottomGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="black" stop-opacity="0"/>
        <stop offset="60%" stop-color="black" stop-opacity="0.35"/>
        <stop offset="100%" stop-color="black" stop-opacity="0.55"/>
      </linearGradient>
    </defs>

    <!-- Top gradient -->
    <rect x="0" y="0" width="${width}" height="${topGradHeight}" fill="url(#topGrad)"/>

    <!-- Bottom gradient -->
    <rect x="0" y="${bottomGradStart}" width="${width}" height="${bottomGradHeight}" fill="url(#bottomGrad)"/>

    <!-- Brand name -->
    <text x="${brandX}" y="${brandY}" font-family="Arial, Helvetica, sans-serif" font-size="${brandFontSize}" font-weight="800" fill="white" letter-spacing="3" opacity="0.85">${escapedBrand}</text>

    <!-- Headline shadow -->
    ${headlineShadow}

    <!-- Headline -->
    ${headlineSvg}

    <!-- CTA button -->
    <rect x="${ctaXPos}" y="${ctaYPos}" width="${ctaWidth}" height="${ctaHeight}" rx="8" fill="${brandColor}"/>
    <text x="${width / 2}" y="${ctaYPos + ctaHeight * 0.65}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${ctaFontSize}" font-weight="700" fill="white">${escapedCta}</text>
  </svg>`
}

export async function composeAd(options: ComposeOptions): Promise<Buffer> {
  const {
    imageBuffer,
    headline,
    cta,
    brandName = 'FULTON',
    brandColor = '#1B4332',
    format = '9x16',
  } = options

  const config = FORMAT_CONFIGS[format]

  // Resize base image to target format
  const resizedImage = await sharp(imageBuffer)
    .resize(config.width, config.height, { fit: 'cover', position: 'center' })
    .toBuffer()

  // Build and composite the text overlay
  const svgOverlay = buildOverlaySvg(config, headline, cta, brandName, brandColor)

  const result = await sharp(resizedImage)
    .composite([
      {
        input: Buffer.from(svgOverlay),
        top: 0,
        left: 0,
      },
    ])
    .png({ quality: 90 })
    .toBuffer()

  return result
}

// Generate all three formats from one base image
export async function composeAllFormats(options: Omit<ComposeOptions, 'format'>): Promise<Record<AdFormat, Buffer>> {
  const formats: AdFormat[] = ['9x16', '4x5', '1x1']
  const results: Partial<Record<AdFormat, Buffer>> = {}

  for (const format of formats) {
    results[format] = await composeAd({ ...options, format })
  }

  return results as Record<AdFormat, Buffer>
}
