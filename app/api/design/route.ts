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

// Generate the actual creative image using Claude
async function generateCreative(apiKey: string, body: {
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

  const content: Array<Record<string, unknown>> = []

  // Add reference image if provided
  if (referenceImage) {
    const isUrl = referenceImage.startsWith('http')
    content.push(isUrl
      ? { type: 'image', source: { type: 'url', url: referenceImage } }
      : { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: referenceImage.replace(/^data:image\/\w+;base64,/, '') } }
    )
  }

  // Add product image if provided
  if (productImage) {
    const isUrl = productImage.startsWith('http')
    content.push(isUrl
      ? { type: 'image', source: { type: 'url', url: productImage } }
      : { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: productImage.replace(/^data:image\/\w+;base64,/, '') } }
    )
  }

  content.push({
    type: 'text',
    text: `Create a paid social ad creative for ${brandName}.

${referenceImage ? 'REFERENCE IMAGE: Match the layout, typography style, and composition of the first image above. Do NOT copy the text or product - only the visual style.' : ''}
${productImage ? 'PRODUCT IMAGE: Use the product shown in the second image above. Feature it prominently.' : ''}

DESIGN SPECS:
- Dimensions: ${dimensions[aspectRatio] || '1080x1080'}
- Aspect ratio: ${aspectRatio}
- Brand colors: ${brandColors.join(', ')}
${style ? `- Style: ${JSON.stringify(style)}` : ''}

COPY (render this text exactly as written):
- Headline: ${hook}
${subheadline ? `- Subheadline: ${subheadline}` : ''}
- Benefits: ${benefits.join(' - ')}
- CTA button: ${cta}
${price ? `- Original price: ${price}` : ''}
${salePrice ? `- Sale price: ${salePrice}` : ''}
- Brand name/logo text: ${brandName}

IMPORTANT:
- Render ALL text clearly and legibly - text quality is the #1 priority
- Use bold, condensed, uppercase typography for the headline
- Make the CTA a button shape
- Show the product prominently
- Use the brand colors for backgrounds, accents, and buttons
- This should look like a professional DTC paid social ad, not a template

Generate the image now.`
  })

  const res = await fetch(`${ANTHROPIC_BASE}/messages`, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'content-type': 'application/json',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [{ role: 'user', content }],
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Creative generation failed: ${res.status} ${err.slice(0, 200)}`)
  }

  const data = await res.json()

  // Find image in response
  const imageBlock = data.content?.find((b: { type: string }) => b.type === 'image')
  if (imageBlock) {
    return NextResponse.json({
      imageUrl: `data:${imageBlock.source?.media_type || 'image/png'};base64,${imageBlock.source?.data}`,
    })
  }

  // If no image block, return text response for debugging
  const textBlock = data.content?.find((b: { type: string }) => b.type === 'text')
  return NextResponse.json({
    error: 'No image generated',
    debug: textBlock?.text?.slice(0, 500),
    contentTypes: data.content?.map((b: { type: string }) => b.type),
  })
}
