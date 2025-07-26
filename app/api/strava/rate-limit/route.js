import { StravaService } from '@/lib/services/strava-service'

export async function GET() {
  try {
    const stravaService = new StravaService()
    const status = stravaService.getRateLimitStatus()
    
    return Response.json({
      success: true,
      data: status,
      limits: {
        requestsPer15Min: 100,
        requestsPerDay: 1000,
      },
      usage: {
        percent15Min: Math.round((status.requests15min / 100) * 100),
        percentDay: Math.round((status.requestsDay / 1000) * 100),
      }
    })
  } catch (error) {
    console.error('Error getting rate limit status:', error)
    return Response.json(
      { 
        success: false, 
        error: error.message 
      },
      { status: 500 }
    )
  }
} 