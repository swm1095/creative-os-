import sharp from 'sharp'

// ── Step 1: Remove background from product photo using Remove.bg ─────────
export async function removeBackground(imageBase64: string): Promise<Buffer> {
  const apiKey = process.env.REMOVEBG_API_KEY
  if (!apiKey) throw new Error('REMOVEBG_API_KEY not configured')

  // Extract raw base64 data
  const base64Data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64
  const imageBuffer = Buffer.from(base64Data, 'base64')

  const formData = new FormData()
  formData.append('image_file', new Blob([imageBuffer]), 'product.png')
  formData.append('size', 'auto')
  formData.append('format', 'png')

  const res = await fetch('https://api.remove.bg/v1.0/removebg', {
    method: 'POST',
    headers: { 'X-Api-Key': apiKey },
    body: formData,
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Remove.bg failed: ${res.status} ${errText.slice(0, 200)}`)
  }

  const resultBuffer = Buffer.from(await res.arrayBuffer())
  console.log('Remove.bg: Background removed, output size:', Math.round(resultBuffer.length / 1024), 'KB')
  return resultBuffer
}

// ── Step 2: Composite product cutout onto background ─────────────────────
export async function compositeProductOnBackground(
  backgroundBuffer: Buffer,
  productCutoutBuffer: Buffer,
  width: number = 1080,
  height: number = 1920,
  productScale: number = 0.55,
  productYPosition: number = 0.55
): Promise<Buffer> {
  // Resize background to target dimensions
  const background = await sharp(backgroundBuffer)
    .resize(width, height, { fit: 'cover', position: 'center' })
    .toBuffer()

  // Get product dimensions
  const productMeta = await sharp(productCutoutBuffer).metadata()
  const pWidth = productMeta.width || 500
  const pHeight = productMeta.height || 500

  // Scale product to fit within the frame
  const maxProductWidth = Math.round(width * productScale)
  const maxProductHeight = Math.round(height * productScale)
  const scale = Math.min(maxProductWidth / pWidth, maxProductHeight / pHeight)
  const scaledWidth = Math.round(pWidth * scale)
  const scaledHeight = Math.round(pHeight * scale)

  const resizedProduct = await sharp(productCutoutBuffer)
    .resize(scaledWidth, scaledHeight, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer()

  // Center horizontally, position vertically based on productYPosition
  const left = Math.round((width - scaledWidth) / 2)
  const top = Math.round(height * productYPosition - scaledHeight / 2)

  const result = await sharp(background)
    .composite([{ input: resizedProduct, top: Math.max(0, top), left: Math.max(0, left) }])
    .toBuffer()

  console.log('Composite: Product placed at', left, top, 'size:', scaledWidth, 'x', scaledHeight)
  return result
}

// ── Generate background scene with Gemini ────────────────────────────────
export async function generateBackground(
  prompt: string,
  referenceImageBase64?: string
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured')

  interface GeminiPart {
    text?: string
    inlineData?: { mimeType: string; data: string }
  }

  const parts: GeminiPart[] = []

  // Add reference image if provided
  if (referenceImageBase64) {
    const match = referenceImageBase64.match(/^data:(image\/\w+);base64,(.+)$/)
    if (match) {
      parts.push({ inlineData: { mimeType: match[1], data: match[2] } })
    }
  }

  parts.push({ text: prompt })

  const models = ['gemini-2.5-flash-image', 'gemini-3.1-flash-image-preview', 'gemini-3-pro-image-preview']
  let lastError = ''

  for (const model of models) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
          }),
        }
      )

      if (!res.ok) {
        lastError = `${model}: ${res.status} ${(await res.text()).slice(0, 200)}`
        continue
      }

      const data = await res.json()
      const responseParts = data.candidates?.[0]?.content?.parts || []
      for (const part of responseParts) {
        if (part.inlineData?.mimeType?.startsWith('image/')) {
          return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`
        }
      }
      lastError = `${model}: No image in response`
    } catch (e: unknown) {
      lastError = `${model}: ${e instanceof Error ? e.message : String(e)}`
    }
  }

  throw new Error(`Background generation failed: ${lastError}`)
}
