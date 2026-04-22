import { NextRequest, NextResponse } from 'next/server'
import { AuthServiceServer } from '@/lib/services/auth-service-server'
import { SyncJobsRepository } from '@/lib/repositories/sync-jobs-repository'

export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
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
    const job = await jobsRepo.getJobById(params.jobId)

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    // Verify job belongs to current user
    if (user.strava_id !== job.strava_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json({ job })
  } catch (error: any) {
    console.error('Error fetching job status:', error)
    return NextResponse.json(
      { error: 'Failed to fetch job status', details: error?.message },
      { status: 500 }
    )
  }
}
