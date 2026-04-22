import { NextRequest, NextResponse } from 'next/server'
import { AuthServiceServer } from '@/lib/services/auth-service-server'
import { SyncJobsRepository } from '@/lib/repositories/sync-jobs-repository'
import { getRateLimitService } from '@/lib/services/rate-limit-service'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    // Await params (Next.js 15 requirement)
    const { jobId } = await params
    
    // Get session token from cookies
    const cookies = request.headers.get('cookie')
    const sessionToken = cookies?.split(';')
      .find(c => c.trim().startsWith('app_session='))
      ?.split('=')[1]

    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get current user from session
    const user = await AuthServiceServer.getCurrentUser(sessionToken)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const jobsRepo = new SyncJobsRepository()
    const job = await jobsRepo.getJobById(jobId)

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    // Verify job belongs to current user
    if (user.strava_id !== job.strava_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get current rate limit status
    const rateLimitService = getRateLimitService()
    const rateLimits = rateLimitService.getStatus()

    return NextResponse.json({ 
      job,
      rateLimits: {
        requests15min: rateLimits.requests15min,
        limit15min: rateLimits.limit15min,
        remaining15min: rateLimits.remaining15min,
        requestsDay: rateLimits.requestsDay,
        limitDay: rateLimits.limitDay,
        remainingDay: rateLimits.remainingDay,
        nextReset15min: rateLimits.nextReset15min.toISOString(),
        nextResetDaily: rateLimits.nextResetDaily.toISOString(),
        lastUpdate: rateLimits.lastUpdate.toISOString()
      }
    })
  } catch (error: any) {
    console.error('Error fetching job status:', error)
    return NextResponse.json(
      { error: 'Failed to fetch job status', details: error?.message },
      { status: 500 }
    )
  }
}
