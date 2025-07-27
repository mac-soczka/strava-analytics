import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { RateLimitAnalyzer } from '@/lib/services/rate-limit-analyzer'

export async function GET(request) {
  try {
    // Create Supabase client with service role key for server-side operations
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    // For now, skip authentication check since this is a debug endpoint
    // In production, you might want to add proper authentication

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