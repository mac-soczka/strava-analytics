import { StravaCrawlerService } from '@/lib/services/strava-crawler-service'

export async function GET() {
  try {
    const crawlerService = new StravaCrawlerService()
    const stats = await crawlerService.getCrawlerStats()
    
    return Response.json({
      success: true,
      stats
    })
  } catch (error) {
    console.error('Error fetching crawler stats:', error)
    return Response.json(
      {
        success: false,
        error: error.message
      },
      { status: 500 }
    )
  }
} 