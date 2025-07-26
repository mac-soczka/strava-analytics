import { StravaCrawlerService } from '@/lib/services/strava-crawler-service'

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url)
    const limit = parseInt(searchParams.get('limit') || '10')
    
    const crawlerService = new StravaCrawlerService()
    const logs = await crawlerService.getRecentLogs(limit)
    
    return Response.json({
      success: true,
      logs,
      count: logs.length
    })
  } catch (error) {
    console.error('Error fetching crawler logs:', error)
    return Response.json(
      {
        success: false,
        error: error.message
      },
      { status: 500 }
    )
  }
} 