import { NextResponse } from 'next/server'
import { StravaCrawlerService } from '@/lib/services/strava-crawler-service'

export async function POST(request) {
  try {
    console.log('🚀 Manual crawler trigger requested')

    // Initialize the crawler service
    const crawlerService = new StravaCrawlerService()

    // Get request body for options
    const body = await request.json().catch(() => ({}))
    const options = {
      skip_invalid_tokens: body.skip_invalid_tokens || false,
      include_segments: body.include_segments !== false, // default to true
      batch_size: body.batch_size || undefined,
      segment_batch_size: body.segment_batch_size || undefined
    }

    console.log('📋 Crawler options:', options)

    // Run the actual crawler service
    const result = await crawlerService.crawlStravaData(options)

    console.log('✅ Crawler completed:', {
      success: result.success,
      users_processed: result.users_processed,
      users_successful: result.users_successful,
      total_activities: result.total_activities,
      total_segments: result.total_segments
    })

    return NextResponse.json({
      success: result.success,
      message: `Strava crawler completed: ${result.users_successful}/${result.users_processed} users successful, ${result.total_activities} activities, ${result.total_segments} segments`,
      data: result,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Crawler API error:', error)
    
    return NextResponse.json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

export async function GET(req) {
  return serverlessTrigger(req)
} 