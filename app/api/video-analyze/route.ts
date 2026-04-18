import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60

const MODEL_GUIDES: Record<string, string> = {
  seedance: `PROMPT FORMAT RULES FOR SEEDANCE 2.0:
- Lead with subject/action, then environment, then style/mood, then camera movement LAST
- Keep it 1-3 sentences (30-75 words). Shorter is better. Too long dilutes focus.
- Use commas to separate descriptive elements. Write as one flowing description, NOT a list.
- Explicitly describe motion ("walking," "turning," "pouring," "wind blowing through hair")
- Use cinematic keywords: "cinematic," "film grain," "shallow depth of field," "4K," "photorealistic"
- Use lighting terms: "golden hour," "volumetric lighting," "backlit," "natural lighting"
- Camera directions go at the END: "dolly in," "pan left," "tracking shot," "crane shot," "static wide shot"
- AVOID: abstract concepts without visual anchors, multiple scene changes, conflicting styles, negative prompts
- EXAMPLE FORMAT: "A woman unboxing a vitamin bottle at her kitchen counter, morning light through window, warm tones, shallow depth of field, handheld camera slowly pushing in"`,

  kling: `PROMPT FORMAT RULES FOR KLING V3:
- Lead with detailed subject description, then environment, then mood, then camera
- Keep it 2-4 sentences (40-80 words). Kling handles slightly longer prompts well.
- Use commas between elements, periods between distinct conceptual groups
- Front-load the most important visual element
- Describe subject details: color, texture, size, material
- Environmental context is important: "rainy city street," "misty forest," "clean white studio"
- Quality boosters: "cinematic," "high quality," "detailed," "professional lighting"
- Specific physical actions work best: "pouring water," "smoke rising," "fabric draping"
- Camera: simple terms are more reliable - "close-up," "bird's eye view," "first-person POV," "wide shot"
- AVOID: rapid multi-subject interactions, text/typography requests, overly technical cinematography jargon
- EXAMPLE FORMAT: "Close-up of hands opening a sleek supplement bottle on a marble countertop, soft morning light from the left. The camera slowly pulls back to reveal a minimal kitchen with plants, warm color grade, high production quality."`,
}

// POST - analyze a reference video with Gemini and generate a brand-specific recreation prompt
export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 })

    const { videoUrl, style, brandName, brandResearch, model, productName, productPhonetic, productImageUrls } = await req.json()
    if (!videoUrl) return NextResponse.json({ error: 'videoUrl required' }, { status: 400 })

    // Download the video and convert to base64 for Gemini
    const videoRes = await fetch(videoUrl)
    if (!videoRes.ok) throw new Error(`Could not fetch video: ${videoRes.status}`)

    const videoBuffer = await videoRes.arrayBuffer()
    const base64Video = Buffer.from(videoBuffer).toString('base64')

    // Determine MIME type from URL
    const ext = videoUrl.split('.').pop()?.split('?')[0]?.toLowerCase() || 'mp4'
    const mimeType = ext === 'mov' ? 'video/quicktime' : 'video/mp4'

    // Get model-specific prompting guide
    const modelKey = model === 'kling' ? 'kling' : 'seedance'
    const modelGuide = MODEL_GUIDES[modelKey]

    // Build brand context from research
    let brandBlock = ''
    if (brandResearch) {
      const r = brandResearch
      const personas = (r.personas || []).map((p: { name: string; description?: string; hook?: string }) =>
        `${p.name}: ${p.description || ''} - hook: "${p.hook || ''}"`
      ).join('\n  ')

      brandBlock = `
CURRENT CLIENT: ${brandName || 'Unknown'}
Industry: ${r.industry || 'N/A'}
Product Category: ${r.productCategory || 'N/A'}
Price Range: ${r.priceRange || 'N/A'}
Brand Voice: ${r.brandVoice || 'N/A'}
Target Personas:
  ${personas}
Key Pain Points: ${(r.painPoints || []).slice(0, 5).join('; ')}
Key Motivators: ${(r.motivators || []).slice(0, 5).join('; ')}
Key Phrases to Use: ${(r.keyPhrases || []).slice(0, 5).join(', ')}
Phrases to Avoid: ${(r.avoidPhrases || []).slice(0, 3).join(', ')}
${productName ? `SPECIFIC PRODUCT: ${productName}${productPhonetic ? ` (pronounced: ${productPhonetic})` : ''}` : ''}
${productImageUrls?.length ? `Product reference images are provided - the product in the video must match these images exactly.` : ''}`
    } else if (brandName) {
      brandBlock = `CURRENT CLIENT: ${brandName}${productName ? `\nSPECIFIC PRODUCT: ${productName}` : ''}`
    }

    const promptText = `You are a creative director at a performance marketing agency who specializes in AI video generation. You are analyzing a reference video to recreate a similar ad for a specific client using ${modelKey === 'seedance' ? 'Seedance 2.0' : 'Kling v3'}.

YOUR JOB: Watch this reference video, extract the production techniques (camera, lighting, pacing, style), then write a video generation prompt that recreates the same look and feel BUT for the client's brand and products.

${modelGuide}

Do NOT describe the reference video's product or brand. Instead, adapt the production style for this client:

${brandBlock}

Extract and adapt these elements from the reference:
- Camera work (movement, angle, speed) - keep the same techniques but use the model's preferred camera terms
- Lighting and color grade - match the mood using the model's preferred lighting keywords
- Subject and action - replace with this client's product and target audience
- Environment - adapt to fit this brand's aesthetic
- Always specify the dominant motion in the scene, these models default to minimal movement otherwise

${style ? `Target style: ${style}` : ''}

CRITICAL:
- You are writing a prompt FOR ${modelKey === 'seedance' ? 'Seedance 2.0' : 'Kling v3'}, follow its format rules exactly
- Replace the reference video's product/brand with the client's product
- Use the client's target audience to inform who appears in the video
- Be specific and complete, every sentence must be finished
- Do NOT use emdashes, use commas or hyphens instead
- Write ONLY the prompt, no labels, no explanations, no intro
- Follow the word count guidelines for this model
${productName ? `- The product in the video is "${productName}" - name it specifically in the prompt` : ''}
${productImageUrls?.length ? `- Product reference images are included below - describe the product's actual appearance (shape, color, packaging) in the prompt so the video model renders it accurately` : ''}`

    // Build content parts: video + product images + prompt text
    const parts: { inlineData?: { mimeType: string; data: string }; text?: string }[] = [
      { inlineData: { mimeType, data: base64Video } },
    ]

    // Add product images so Gemini can see the actual product
    if (productImageUrls?.length) {
      for (const imgUrl of productImageUrls.slice(0, 3)) {
        try {
          const imgRes = await fetch(imgUrl)
          if (imgRes.ok) {
            const imgBuf = await imgRes.arrayBuffer()
            const imgBase64 = Buffer.from(imgBuf).toString('base64')
            const imgType = imgUrl.match(/\.png/i) ? 'image/png' : 'image/jpeg'
            parts.push({ inlineData: { mimeType: imgType, data: imgBase64 } })
          }
        } catch { /* skip failed image fetches */ }
      }
    }

    parts.push({ text: promptText })

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            { parts },
          ],
          generationConfig: {
            maxOutputTokens: 2048,
            temperature: 0.7,
          },
        }),
      }
    )

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Gemini API error: ${res.status} ${err.slice(0, 300)}`)
    }

    const data = await res.json()
    const prompt = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim()

    if (!prompt) throw new Error('No prompt generated from video analysis')

    return NextResponse.json({ prompt })
  } catch (e: unknown) {
    console.error('Video analysis error:', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
