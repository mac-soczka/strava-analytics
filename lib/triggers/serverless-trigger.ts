import { StravaCrawlerService } from '../services/strava-crawler-service'
import { AuthServiceServer } from '../services/auth-service-server'

/**
 * Serverless function trigger for Strava data crawling
 * This function can be called via HTTP requests (user-triggered)
 */
export async function serverlessTrigger(req: Request) {
  console.log('🔗 Serverless function triggered at:', new Date().toISOString())
  
  try {
    // Get user from session (if triggered from your app)
    const sessionToken = req.headers.get('authorization')?.replace('Bearer ', '')
    let userId: number | undefined
    
    if (sessionToken) {
      try {
        const user = await AuthServiceServer.getCurrentUser(sessionToken)
        if (user) {
          userId = user.strava_id
          console.log(`👤 Processing for authenticated user: ${user.firstname} (${user.strava_id})`)
        }
      } catch (authError) {
        console.warn('⚠️ Authentication failed, will process all users:', authError)
      }
    }
    
    const crawlerService = new StravaCrawlerService()
    
    // Process user(s) based on authentication context
    const results = await crawlerService.crawlStravaData({
      user_id: userId, // If undefined, will process all users
      batch_size: 80,
      include_segments: true
    })
    
    console.log(`✅ Serverless function completed. Processed ${results.length} user(s)`)
    
    // Log summary
    const successful = results.filter(r => r.success).length
    const totalActivities = results.reduce((sum, r) => sum + r.activities_fetched, 0)
    const totalSegments = results.reduce((sum, r) => sum + r.segments_fetched, 0)
    
    const response = {
      success: true,
      user_id: userId,
      users_processed: results.length,
      users_successful: successful,
      total_activities: totalActivities,
      total_segments: totalSegments,
      results,
      timestamp: new Date().toISOString()
    }
    
    return Response.json(response)
    
  } catch (error: any) {
    console.error('❌ Serverless function failed:', error)
    
    return Response.json({
      success: false,
      error: error?.message || 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

// Export for Supabase Edge Functions
export default serverlessTrigger 