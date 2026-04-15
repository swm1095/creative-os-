import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient as createClient } from '@/lib/supabase-server'
import { QCNote, QCResult, QCStatus } from '@/lib/types'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const QC_PROMPTS = {
  spelling: `You are a professional proofreader. Examine this advertising creative image carefully.
Read ALL visible text in the image — headlines, body copy, CTAs, disclaimers, and any other text.
Check for: spelling mistakes, typos, grammatical errors, punctuation errors, inconsistent capitalization.

Respond in this exact JSON format:
{
  "status": "pass" | "fail" | "warning",
  "message": "Brief summary (1 sentence)",
  "detail": "Specific issues found, or null if none"
}

If no text is visible, respond with status "pass" and message "No text found in image to check."`,

  brand: `You are a brand compliance expert. Examine this advertising creative image.
Check whether the visual style, colors, fonts, and overall aesthetic appear professional and consistent.
Look for: inconsistent styling, clashing colors, unprofessional typography, misaligned elements.

Note: You may not have the specific brand guide, so assess general visual quality and professionalism.

Respond in this exact JSON format:
{
  "status": "pass" | "warning" | "fail",
  "message": "Brief summary (1 sentence)",
  "detail": "Specific observations about visual consistency, or null"
}`,

  claims: `You are a fact-checking expert for advertising content. Examine this advertising creative image.
Read all visible text and look for:
- Specific statistics or percentages without attribution
- Superlative claims ("best", "#1", "most effective") without clear evidence
- Medical or health claims that require substantiation
- Pricing claims that seem unusual
- Any other potentially unverifiable factual claims

Respond in this exact JSON format:
{
  "status": "pass" | "warning" | "fail",
  "message": "Brief summary (1 sentence)",
  "detail": "List any flagged claims, or null if none found"
}`,
}

async function fetchImageAsBase64(url: string): Promise<{ data: string; mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' }> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`)
  const buffer = Buffer.from(await res.arrayBuffer())
  const contentType = res.headers.get('content-type') || 'image/png'
  const mediaType = (['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(contentType)
    ? contentType
    : 'image/png') as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
  return { data: buffer.toString('base64'), mediaType }
}

async function runCheck(
  checkKey: 'spelling' | 'brand' | 'claims',
  imageUrl: string
): Promise<QCNote> {
  try {
    const { data, mediaType } = await fetchImageAsBase64(imageUrl)
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data },
          },
          {
            type: 'text',
            text: QC_PROMPTS[checkKey],
          },
        ],
      }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''

    // Parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('Invalid response format')

    const parsed = JSON.parse(jsonMatch[0])
    return {
      check: checkKey,
      status: (parsed.status || 'pass') as QCStatus,
      message: parsed.message || 'Check complete',
      detail: parsed.detail || undefined,
    }
  } catch (e: any) {
    // If image can't be loaded or API fails, return a warning
    return {
      check: checkKey,
      status: 'warning',
      message: `Check could not complete: ${e.message}`,
      detail: 'Manual review recommended',
    }
  }
}

function computeOverall(spelling: QCNote, brand: QCNote, claims: QCNote): QCStatus {
  const statuses = [spelling.status, brand.status, claims.status]
  if (statuses.includes('fail')) return 'fail'
  if (statuses.includes('warning')) return 'warning'
  return 'pass'
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured. Add it in your .env.local file.' }, { status: 500 })
    }

    const { imageUrl, creativeId, onlyCheck } = await req.json()
    if (!imageUrl) return NextResponse.json({ error: 'imageUrl required' }, { status: 400 })

    let spelling: QCNote, brandCheck: QCNote, claims: QCNote

    if (onlyCheck) {
      const singleResult = await runCheck(onlyCheck, imageUrl)
      // Fetch existing results for the other checks if creativeId provided
      if (creativeId) {
        const { data: existing } = await supabase.from('creatives').select('qc_notes').eq('id', creativeId).single()
        const existingNotes: QCNote[] = existing?.qc_notes || []
        spelling = existingNotes.find(n => n.check === 'spelling') || { check: 'spelling', status: 'pending', message: 'Not yet checked' }
        brandCheck = existingNotes.find(n => n.check === 'brand') || { check: 'brand', status: 'pending', message: 'Not yet checked' }
        claims = existingNotes.find(n => n.check === 'claims') || { check: 'claims', status: 'pending', message: 'Not yet checked' }
        if (onlyCheck === 'spelling') spelling = singleResult
        if (onlyCheck === 'brand') brandCheck = singleResult
        if (onlyCheck === 'claims') claims = singleResult
      } else {
        spelling = onlyCheck === 'spelling' ? singleResult : { check: 'spelling', status: 'pending', message: 'Not yet checked' }
        brandCheck = onlyCheck === 'brand' ? singleResult : { check: 'brand', status: 'pending', message: 'Not yet checked' }
        claims = onlyCheck === 'claims' ? singleResult : { check: 'claims', status: 'pending', message: 'Not yet checked' }
      }
    } else {
      // Run all three checks in parallel
      ;[spelling, brandCheck, claims] = await Promise.all([
        runCheck('spelling', imageUrl),
        runCheck('brand', imageUrl),
        runCheck('claims', imageUrl),
      ])
    }

    const overallStatus = computeOverall(spelling, brandCheck, claims)

    const result: QCResult = {
      spelling,
      brand: brandCheck,
      claims,
      overallStatus,
    }

    // Persist results to database
    if (creativeId) {
      const notes = [spelling, brandCheck, claims]
      await supabase.from('creatives').update({
        qc_spelling: spelling.status,
        qc_brand: brandCheck.status,
        qc_claims: claims.status,
        qc_notes: notes,
      }).eq('id', creativeId)
    }

    return NextResponse.json(result)
  } catch (e: any) {
    console.error('QC error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
