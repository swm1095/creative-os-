import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60

// POST - analyze a reference video with Gemini and generate a brand-specific recreation prompt
export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 })

    const { videoUrl, style, brandName, brandResearch } = await req.json()
    if (!videoUrl) return NextResponse.json({ error: 'videoUrl required' }, { status: 400 })

    // Download the video and convert to base64 for Gemini
    const videoRes = await fetch(videoUrl)
    if (!videoRes.ok) throw new Error(`Could not fetch video: ${videoRes.status}`)

    const videoBuffer = await videoRes.arrayBuffer()
    const base64Video = Buffer.from(videoBuffer).toString('base64')

    // Determine MIME type from URL
    const ext = videoUrl.split('.').pop()?.split('?')[0]?.toLowerCase() || 'mp4'
    const mimeType = ext === 'mov' ? 'video/quicktime' : 'video/mp4'

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
Phrases to Avoid: ${(r.avoidPhrases || []).slice(0, 3).join(', ')}`
    } else if (brandName) {
      brandBlock = `CURRENT CLIENT: ${brandName}`
    }

    const promptText = `You are a creative director at a performance marketing agency. You are analyzing a reference video to recreate a similar ad for a specific client.

YOUR JOB: Watch this reference video, extract the production techniques (camera, lighting, pacing, style), then write a video generation prompt that recreates the same look and feel BUT for the client's brand and products.

Do NOT describe the reference video's product or brand. Instead, adapt the production style for this client:

${brandBlock}

Extract and adapt these elements from the reference:
- Camera work (movement, angle, speed) - keep the same techniques
- Lighting and color grade - match the mood
- Pacing and transitions - match the rhythm
- Subject framing and composition - adapt for this client's product/audience
- Environment and setting - adapt to fit this brand's aesthetic

${style ? `Target style: ${style}` : ''}

IMPORTANT RULES:
- Replace the reference video's product/brand with the client's product
- Use the client's target audience and personas to inform who appears in the video
- Match the client's brand voice and aesthetic
- Write 100-200 words as a single prompt paragraph
- Be specific and complete, every sentence must be finished
- Do NOT use emdashes, use commas or hyphens instead
- Write ONLY the prompt, no labels, no explanations, no intro`

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  inlineData: {
                    mimeType,
                    data: base64Video,
                  },
                },
                { text: promptText },
              ],
            },
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
