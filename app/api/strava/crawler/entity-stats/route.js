import { StravaCrawlerService } from '@/lib/services/strava-crawler-service'

export async function GET() {
  try {
    const crawlerService = new StravaCrawlerService()
    const stats = await crawlerService.getEntityStats()
    
    return Response.json({
      success: true,
      stats
    })
  } catch (error) {
    console.error('Failed to get entity stats:', error)
    
    return Response.json({
      success: false,
      error: error?.message || 'Unknown error'
    }, { status: 500 })
  }
} 