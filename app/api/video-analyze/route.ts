import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 90

// POST - analyze a reference video with Gemini and generate a brand-specific recreation prompt
export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 })

    const { videoUrl, style, brandName, brandResearch, model, productName, productImageUrls } = await req.json()
    if (!videoUrl) return NextResponse.json({ error: 'videoUrl required' }, { status: 400 })

    // Download the video and convert to base64 for Gemini
    const videoRes = await fetch(videoUrl)
    if (!videoRes.ok) throw new Error(`Could not fetch video: ${videoRes.status}`)

    const videoBuffer = await videoRes.arrayBuffer()
    const base64Video = Buffer.from(videoBuffer).toString('base64')

    const ext = videoUrl.split('.').pop()?.split('?')[0]?.toLowerCase() || 'mp4'
    const mimeType = ext === 'mov' ? 'video/quicktime' : 'video/mp4'

    const modelLabel = model === 'kling' ? 'Kling v3' : 'Seedance 2.0'

    // Step 1: Have Gemini analyze the video first
    const analysisParts: { inlineData?: { mimeType: string; data: string }; text?: string }[] = [
      { inlineData: { mimeType, data: base64Video } },
      { text: `Watch this video carefully and describe exactly what you see in detail:
1. What is the subject/product shown?
2. What actions or movements happen?
3. What are the camera movements? (pan, dolly, zoom, static, tracking, handheld, etc.)
4. What is the lighting? (natural, studio, golden hour, backlit, etc.)
5. What is the color grade/mood? (warm, cool, cinematic, bright, moody, etc.)
6. What is the environment/background?
7. What is the pacing? (slow, fast, dramatic reveals, etc.)
8. What is the overall production quality level?

Be very specific about what you actually see. Do not make things up.` },
    ]

    const analysisRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: analysisParts }],
          generationConfig: {
            maxOutputTokens: 4096,
            temperature: 0.3,
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
      }
    )

    if (!analysisRes.ok) {
      const err = await analysisRes.text()
      throw new Error(`Gemini analysis error: ${analysisRes.status} ${err.slice(0, 300)}`)
    }

    const analysisData = await analysisRes.json()
    const videoDescription = analysisData.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
    if (!videoDescription) throw new Error('Could not analyze the video')

    // Step 2: Build the rewrite prompt with brand context
    let brandInfo = brandName || 'the client'
    if (brandResearch) {
      const r = brandResearch
      brandInfo = `${brandName || 'the client'} (${r.industry || ''}, ${r.productCategory || ''}, ${r.priceRange || ''}). Brand voice: ${r.brandVoice || 'professional'}. Target audience: ${(r.personas || []).map((p: { name: string }) => p.name).join(', ') || 'general consumers'}.`
    }

    const productDesc = productName || brandName || 'the product'

    // Add product image descriptions
    let productVisualNote = ''
    if (productImageUrls?.length) {
      // Fetch and include product images in a second call
      const productParts: { inlineData?: { mimeType: string; data: string }; text?: string }[] = []
      for (const imgUrl of productImageUrls.slice(0, 2)) {
        try {
          const imgRes = await fetch(imgUrl)
          if (imgRes.ok) {
            const imgBuf = await imgRes.arrayBuffer()
            const imgBase64 = Buffer.from(imgBuf).toString('base64')
            const imgType = imgUrl.match(/\.png/i) ? 'image/png' : 'image/jpeg'
            productParts.push({ inlineData: { mimeType: imgType, data: imgBase64 } })
          }
        } catch { /* skip */ }
      }

      if (productParts.length > 0) {
        productParts.push({ text: 'Describe this product in one sentence: its shape, color, packaging, and size.' })

        const prodRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: productParts }],
              generationConfig: {
                maxOutputTokens: 500,
                temperature: 0.2,
                thinkingConfig: { thinkingBudget: 0 },
              },
            }),
          }
        )

        if (prodRes.ok) {
          const prodData = await prodRes.json()
          productVisualNote = prodData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || ''
        }
      }
    }

    const modelRules = model === 'kling'
      ? '2-4 sentences (40-80 words). Lead with subject details. Use simple camera terms (close-up, wide shot, bird\'s eye view). Add "cinematic, high quality, detailed" as quality boosters.'
      : '1-3 sentences (30-75 words). Lead with subject/action. Camera movement goes at the end (dolly in, tracking shot, pan left). Add "cinematic, shallow depth of field, 4K" as quality boosters.'

    const rewritePrompt = `I analyzed a reference video and here is exactly what I observed:

${videoDescription}

Now I need you to write a video generation prompt for ${modelLabel} that recreates this EXACT same style but for a different product.

NEW PRODUCT: ${productDesc}
${productVisualNote ? `PRODUCT LOOKS LIKE: ${productVisualNote}` : ''}
CLIENT: ${brandInfo}
${style ? `STYLE: ${style}` : ''}

FORMAT RULES: ${modelRules}

IMPORTANT:
- Only include visual details that were ACTUALLY observed in the reference breakdown above
- Do NOT invent new visual elements, effects, or concepts that weren't in the reference
- Replace the original product with "${productDesc}" but keep everything else the same
- Describe real camera moves, real lighting, real environments from the reference
- Write as a single complete paragraph, no labels
- Do not use emdashes, use commas or hyphens
- Every sentence must end completely, do not trail off

Write ONLY the prompt, nothing else:`

    const rewriteRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: rewritePrompt }] }],
          generationConfig: {
            maxOutputTokens: 4096,
            temperature: 0.4,
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
      }
    )

    if (!rewriteRes.ok) {
      const err = await rewriteRes.text()
      throw new Error(`Gemini rewrite error: ${rewriteRes.status} ${err.slice(0, 300)}`)
    }

    const rewriteData = await rewriteRes.json()
    const prompt = rewriteData.candidates?.[0]?.content?.parts?.[0]?.text?.trim()

    if (!prompt) throw new Error('No prompt generated')

    return NextResponse.json({ prompt, analysis: videoDescription })
  } catch (e: unknown) {
    console.error('Video analysis error:', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
