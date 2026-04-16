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
  headlineFontSize: number
  ctaFontSize: number
  brandFontSize: number
  maxCharsPerLine: number
  lineHeight: number
  safeMargin: number
  headlineYCenter: number
  ctaBottomMargin: number
}

const FORMAT_CONFIGS: Record<AdFormat, FormatConfig> = {
  '9x16': {
    width: 1080, height: 1920,
    headlineFontSize: 52, ctaFontSize: 20, brandFontSize: 18,
    maxCharsPerLine: 24, lineHeight: 66, safeMargin: 80,
    headlineYCenter: 0.38, ctaBottomMargin: 200,
  },
  '4x5': {
    width: 1080, height: 1350,
    headlineFontSize: 46, ctaFontSize: 18, brandFontSize: 16,
    maxCharsPerLine: 26, lineHeight: 58, safeMargin: 70,
    headlineYCenter: 0.35, ctaBottomMargin: 160,
  },
  '1x1': {
    width: 1080, height: 1080,
    headlineFontSize: 40, ctaFontSize: 16, brandFontSize: 14,
    maxCharsPerLine: 28, lineHeight: 50, safeMargin: 60,
    headlineYCenter: 0.33, ctaBottomMargin: 130,
  },
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\u2014/g, '-')
    .replace(/\u2013/g, '-')
    .replace(/\u2018|\u2019/g, "'")
    .replace(/\u201C|\u201D/g, '"')
}

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const test = current ? current + ' ' + word : word
    if (test.length > maxChars && current) { lines.push(current); current = word }
    else { current = test }
  }
  if (current) lines.push(current)
  return lines
}

function buildOverlaySvg(config: FormatConfig, headline: string, cta: string, brandName: string, brandColor: string): string {
  const { width, height, headlineFontSize, ctaFontSize, brandFontSize, maxCharsPerLine, lineHeight, safeMargin, headlineYCenter, ctaBottomMargin } = config

  const headlineLines = wrapText(escapeXml(headline), maxCharsPerLine)
  const escapedCta = escapeXml(cta)
  const escapedBrand = escapeXml(brandName)

  const headlineBlockHeight = headlineLines.length * lineHeight
  const headlineStartY = (height * headlineYCenter) - (headlineBlockHeight / 2) + headlineFontSize
  const centerX = width / 2

  const headlineShadow = headlineLines.map((line, i) =>
    `<text x="${centerX}" y="${headlineStartY + i * lineHeight + 3}" text-anchor="middle" font-size="${headlineFontSize}" font-weight="900" fill="black" opacity="0.4">${line}</text>`
  ).join('\n    ')

  const headlineSvg = headlineLines.map((line, i) =>
    `<text x="${centerX}" y="${headlineStartY + i * lineHeight}" text-anchor="middle" font-size="${headlineFontSize}" font-weight="900" fill="white">${line}</text>`
  ).join('\n    ')

  const ctaTextWidth = escapedCta.length * ctaFontSize * 0.6
  const ctaWidth = Math.max(160, ctaTextWidth + 50)
  const ctaHeight = ctaFontSize * 2.8
  const ctaX = (width - ctaWidth) / 2
  const ctaY = height - ctaBottomMargin

  const topGradH = Math.round(height * 0.25)
  const botGradStart = Math.round(height * 0.6)
  const botGradH = height - botGradStart

  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="tg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="black" stop-opacity="0.5"/>
      <stop offset="100%" stop-color="black" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="black" stop-opacity="0"/>
      <stop offset="50%" stop-color="black" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="black" stop-opacity="0.6"/>
    </linearGradient>
  </defs>

  <rect x="0" y="0" width="${width}" height="${topGradH}" fill="url(#tg)"/>
  <rect x="0" y="${botGradStart}" width="${width}" height="${botGradH}" fill="url(#bg)"/>

  <text x="${safeMargin}" y="${safeMargin + brandFontSize}" font-size="${brandFontSize}" font-weight="900" fill="white" letter-spacing="3" opacity="0.85">${escapedBrand}</text>

  ${headlineShadow}
  ${headlineSvg}

  <rect x="${ctaX}" y="${ctaY}" width="${ctaWidth}" height="${ctaHeight}" rx="6" fill="${brandColor}"/>
  <text x="${centerX}" y="${ctaY + ctaHeight * 0.65}" text-anchor="middle" font-size="${ctaFontSize}" font-weight="900" fill="white">${escapedCta}</text>
</svg>`
}

export async function composeAd(options: ComposeOptions): Promise<Buffer> {
  const { imageBuffer, headline, cta, brandName = 'FULTON', brandColor = '#1B4332', format = '9x16' } = options
  const config = FORMAT_CONFIGS[format]

  const resizedImage = await sharp(imageBuffer)
    .resize(config.width, config.height, { fit: 'cover', position: 'center' })
    .toBuffer()

  const svgOverlay = buildOverlaySvg(config, headline, cta, brandName, brandColor)

  return await sharp(resizedImage)
    .composite([{ input: Buffer.from(svgOverlay), top: 0, left: 0 }])
    .png({ quality: 90 })
    .toBuffer()
}

export async function composeAllFormats(options: Omit<ComposeOptions, 'format'>): Promise<Record<AdFormat, Buffer>> {
  const formats: AdFormat[] = ['9x16', '4x5', '1x1']
  const results: Partial<Record<AdFormat, Buffer>> = {}
  for (const format of formats) {
    results[format] = await composeAd({ ...options, format })
  }
  return results as Record<AdFormat, Buffer>
}
