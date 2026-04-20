import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 120
export const dynamic = 'force-dynamic'

const ANTHROPIC_BASE = 'https://api.anthropic.com/v1'

// POST - analyze reference image or generate creative
export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })

    const body = await req.json()
    const { action } = body

    if (action === 'analyze') {
      return analyzeReference(apiKey, body)
    } else if (action === 'generate-copy') {
      return generateCopy(apiKey, body)
    } else if (action === 'generate-creative') {
      return generateCreative(apiKey, body)
    }

    return NextResponse.json({ error: 'action required (analyze, generate-copy, generate-creative)' }, { status: 400 })
  } catch (e: unknown) {
    console.error('Design API error:', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}

// Analyze a reference ad image - extract layout, typography, palette, mood
async function analyzeReference(apiKey: string, body: { referenceImage: string }) {
  const { referenceImage } = body
  if (!referenceImage) return NextResponse.json({ error: 'referenceImage required' }, { status: 400 })

  const isUrl = referenceImage.startsWith('http')
  const imageContent = isUrl
    ? { type: 'image' as const, source: { type: 'url' as const, url: referenceImage } }
    : { type: 'image' as const, source: { type: 'base64' as const, media_type: 'image/jpeg' as const, data: referenceImage.replace(/^data:image\/\w+;base64,/, '') } }

  const res = await fetch(`${ANTHROPIC_BASE}/messages`, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'content-type': 'application/json',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          imageContent,
          {
            type: 'text',
            text: `Analyze this ad creative and extract the design system. Return a JSON object with exactly these fields:

{
  "layout": "describe the layout structure (e.g. headline-left, product-right, bullets-bottom)",
  "typography": "describe the font style (e.g. Heavy condensed display, tight tracking, ALL CAPS)",
  "palette": ["#hex1", "#hex2", "#hex3", "#hex4"],
  "mood": "describe the mood/tone (e.g. Bold, contrarian, DTC-modern)",
  "headline": "the main headline text if visible",
  "subheadline": "the subheadline text if visible",
  "cta": "the call to action text if visible",
  "benefits": ["benefit 1", "benefit 2", "benefit 3"],
  "priceOriginal": "original price if shown",
  "priceSale": "sale price if shown",
  "logoPosition": "where the logo is placed"
}

Return ONLY the JSON, no explanation.`
          }
        ]
      }]
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Claude analysis failed: ${res.status} ${err.slice(0, 200)}`)
  }

  const data = await res.json()
  const text = data.content?.find((b: { type: string }) => b.type === 'text')?.text || ''

  // Extract JSON from response
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Could not parse analysis')

  const analysis = JSON.parse(jsonMatch[0])
  return NextResponse.json({ analysis })
}

// Generate copy variants for the ad
async function generateCopy(apiKey: string, body: {
  brandName: string
  brandResearch: Record<string, unknown> | null
  persona: string
  angle: string
  referenceAnalysis: Record<string, unknown>
}) {
  const { brandName, brandResearch, persona, angle, referenceAnalysis } = body

  const r = brandResearch || {}
  const brandContext = `Brand: ${brandName}
Industry: ${(r as Record<string, string>).industry || 'N/A'}
Product: ${(r as Record<string, string>).productCategory || 'N/A'}
Voice: ${(r as Record<string, string>).brandVoice || 'Bold, direct'}
Persona: ${persona || 'General consumer'}
Angle: ${angle || 'Problem/Solution'}`

  const refStyle = referenceAnalysis
    ? `Reference ad style: ${JSON.stringify(referenceAnalysis)}`
    : ''

  const res = await fetch(`${ANTHROPIC_BASE}/messages`, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'content-type': 'application/json',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `Generate ad copy for a paid social creative.

${brandContext}
${refStyle}

Return a JSON object with these fields. For each field, provide 3 variants as an array:

{
  "hooks": ["variant1", "variant2", "variant3"],
  "subheadlines": ["variant1", "variant2", "variant3"],
  "benefits": [["benefit1", "benefit2", "benefit3", "benefit4"], ["alt1", "alt2", "alt3", "alt4"]],
  "ctas": ["variant1", "variant2", "variant3"]
}

Rules:
- Hooks should be 3-6 words, attention-grabbing, contrarian or bold
- Subheadlines should be 3-8 words, support the hook
- Benefits should be short (2-4 words each), scannable
- CTAs should be 2-4 words, action-oriented
- Match the brand voice
- Do NOT use emdashes
- Return ONLY JSON, no explanation`
      }]
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Copy generation failed: ${res.status} ${err.slice(0, 200)}`)
  }

  const data = await res.json()
  const text = data.content?.find((b: { type: string }) => b.type === 'text')?.text || ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Could not parse copy')

  const copy = JSON.parse(jsonMatch[0])
  return NextResponse.json({ copy })
}

// Generate the actual creative image using Gemini (best text rendering for ads)
async function generateCreative(_apiKey: string, body: {
  referenceImage?: string
  productImage?: string
  brandName: string
  brandColors: string[]
  hook: string
  subheadline: string
  benefits: string[]
  cta: string
  price?: string
  salePrice?: string
  aspectRatio: string
  style: Record<string, unknown>
}) {
  const geminiKey = process.env.GEMINI_API_KEY
  if (!geminiKey) return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 })

  const {
    referenceImage, productImage, brandName, brandColors,
    hook, subheadline, benefits, cta, price, salePrice,
    aspectRatio, style,
  } = body

  const dimensions: Record<string, string> = {
    '1:1': '1080x1080',
    '4:5': '1080x1350',
    '9:16': '1080x1920',
  }

  interface Part { text?: string; inlineData?: { mimeType: string; data: string } }
  const parts: Part[] = []

  // Add reference image
  if (referenceImage && !referenceImage.startsWith('http')) {
    const match = referenceImage.match(/^data:(image\/\w+);base64,(.+)$/)
    if (match) parts.push({ inlineData: { mimeType: match[1], data: match[2] } })
  }

  // Add product image
  if (productImage && !productImage.startsWith('http')) {
    const match = productImage.match(/^data:(image\/\w+);base64,(.+)$/)
    if (match) parts.push({ inlineData: { mimeType: match[1], data: match[2] } })
  }

  parts.push({
    text: `Create a paid social ad creative image for ${brandName}.

${referenceImage ? 'REFERENCE: The first image is a reference ad. Match its layout, typography style, and composition exactly. Do NOT copy its text or product - only the visual design structure.' : ''}
${productImage ? 'PRODUCT: The second image is the product. Feature it prominently in the ad.' : ''}

DESIGN SPECS:
- Dimensions: ${dimensions[aspectRatio] || '1080x1080'}
- Aspect ratio: ${aspectRatio}
- Brand colors: ${brandColors.join(', ')}
- Use these colors for backgrounds, accents, buttons, and text
${style ? `- Reference style: layout=${(style as Record<string, string>).layout || ''}, typography=${(style as Record<string, string>).typography || ''}, mood=${(style as Record<string, string>).mood || ''}` : ''}

COPY - render this text EXACTLY as written, clearly and legibly:
- Main headline (large, bold, uppercase): ${hook}
${subheadline ? `- Subheadline (medium): ${subheadline}` : ''}
- Bullet benefits: ${benefits.join(' | ')}
- CTA button: ${cta}
${price ? `- Price (crossed out): ${price}` : ''}
${salePrice ? `- Sale price (large, bold): ${salePrice}` : ''}
- Brand name: ${brandName}

CRITICAL REQUIREMENTS:
- ALL text must be perfectly legible and spelled correctly
- Bold, condensed, uppercase typography for the headline
- CTA should look like a clickable button
- This must look like a professional DTC paid social media advertisement
- Clean, modern design with clear visual hierarchy
- Generate the complete ad image`
  })

  const models = ['gemini-2.5-flash-image', 'gemini-3.1-flash-image-preview', 'gemini-3-pro-image-preview']
  let lastError = ''

  for (const model of models) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
          }),
        }
      )
      if (!res.ok) { lastError = `${model}: ${res.status}`; continue }

      const data = await res.json()
      for (const part of (data.candidates?.[0]?.content?.parts || [])) {
        if (part.inlineData?.mimeType?.startsWith('image/')) {
          return NextResponse.json({
            imageUrl: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
          })
        }
      }
      lastError = `${model}: No image in response`
    } catch (e: unknown) {
      lastError = `${model}: ${e instanceof Error ? e.message : String(e)}`
    }
  }

  return NextResponse.json({ error: `Image generation failed: ${lastError}` })
}
