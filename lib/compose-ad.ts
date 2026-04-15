import sharp from 'sharp'

interface ComposeOptions {
  imageBuffer: Buffer
  headline: string
  cta: string
  brandName?: string
  brandColor?: string
  width?: number
  height?: number
}

export async function composeAd(options: ComposeOptions): Promise<Buffer> {
  const {
    imageBuffer,
    headline,
    cta,
    brandName = 'FULTON',
    brandColor = '#1B4332',
    width = 1080,
    height = 1080,
  } = options

  // Resize the base image to target dimensions
  const resizedImage = await sharp(imageBuffer)
    .resize(width, height, { fit: 'cover' })
    .toBuffer()

  // Build SVG overlay with headline, CTA, and brand name
  const escapedHeadline = headline
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/—/g, '-')
    .replace(/–/g, '-')

  const escapedCta = cta
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  const escapedBrand = brandName
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  // Word wrap headline - roughly 20 chars per line at this font size
  const words = escapedHeadline.split(' ')
  const headlineLines: string[] = []
  let currentLine = ''
  for (const word of words) {
    if ((currentLine + ' ' + word).trim().length > 22) {
      headlineLines.push(currentLine.trim())
      currentLine = word
    } else {
      currentLine = currentLine ? currentLine + ' ' + word : word
    }
  }
  if (currentLine.trim()) headlineLines.push(currentLine.trim())

  const lineHeight = 72
  const headlineY = height * 0.35
  const headlineSvgLines = headlineLines.map((line, i) =>
    `<text x="${width / 2}" y="${headlineY + i * lineHeight}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="60" font-weight="900" fill="white" style="text-shadow: 0 2px 8px rgba(0,0,0,0.5)">${line}</text>`
  ).join('\n    ')

  // CTA button dimensions
  const ctaWidth = Math.max(200, escapedCta.length * 22 + 60)
  const ctaHeight = 56
  const ctaX = (width - ctaWidth) / 2
  const ctaY = height - 140

  const svgOverlay = `
  <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <!-- Dark gradient overlay for text readability -->
    <defs>
      <linearGradient id="topGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="black" stop-opacity="0.5"/>
        <stop offset="100%" stop-color="black" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="bottomGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="black" stop-opacity="0"/>
        <stop offset="100%" stop-color="black" stop-opacity="0.6"/>
      </linearGradient>
    </defs>

    <!-- Top gradient for brand name -->
    <rect x="0" y="0" width="${width}" height="${Math.round(height * 0.2)}" fill="url(#topGrad)"/>

    <!-- Bottom gradient for CTA -->
    <rect x="0" y="${Math.round(height * 0.7)}" width="${width}" height="${Math.round(height * 0.3)}" fill="url(#bottomGrad)"/>

    <!-- Brand name top-left -->
    <text x="48" y="64" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="800" fill="white" letter-spacing="4" opacity="0.9">${escapedBrand}</text>

    <!-- Headline centered -->
    ${headlineSvgLines}

    <!-- CTA button -->
    <rect x="${ctaX}" y="${ctaY}" width="${ctaWidth}" height="${ctaHeight}" rx="8" fill="${brandColor}"/>
    <text x="${width / 2}" y="${ctaY + 37}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="700" fill="white">${escapedCta}</text>
  </svg>`

  // Composite the SVG overlay on top of the base image
  const result = await sharp(resizedImage)
    .composite([
      {
        input: Buffer.from(svgOverlay),
        top: 0,
        left: 0,
      },
    ])
    .png()
    .toBuffer()

  return result
}
