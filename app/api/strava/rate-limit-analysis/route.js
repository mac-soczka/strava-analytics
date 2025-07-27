import { createRouteHandlerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { RateLimitAnalyzer } from '@/lib/services/rate-limit-analyzer'

export async function GET(request) {
  try {
    // Authenticate the user
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('📊 Rate limit analysis requested')

    // Initialize the rate limit analyzer
    const analyzer = new RateLimitAnalyzer()

    // Get the analysis
    const analysis = await analyzer.analyzeRateLimits()
    
    // Get the human-readable summary
    const summary = await analyzer.getRateLimitSummary()

    console.log('✅ Rate limit analysis completed')

    return NextResponse.json({
      success: true,
      analysis,
      summary,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Rate limit analysis error:', error)
    
    return NextResponse.json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
} 