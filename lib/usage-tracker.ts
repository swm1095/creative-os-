// Centralized usage tracking - call from any API route
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

export async function trackUsage(params: {
  service: 'anthropic' | 'gemini' | 'fal' | 'apify' | 'removebg'
  action: string
  tokensIn?: number
  tokensOut?: number
  estimatedCost?: number
  userEmail?: string
  userName?: string
  brandName?: string
}) {
  try {
    if (!supabaseUrl || !supabaseKey) return
    const supabase = createClient(supabaseUrl, supabaseKey)
    await supabase.from('usage_logs').insert({
      service: params.service,
      action: params.action,
      tokens_in: params.tokensIn || 0,
      tokens_out: params.tokensOut || 0,
      estimated_cost: params.estimatedCost || 0,
      user_email: params.userEmail || 'system',
      user_name: params.userName || 'system',
      brand_name: params.brandName || '',
    })
  } catch (e) {
    console.error('Usage tracking failed:', e)
  }
}
