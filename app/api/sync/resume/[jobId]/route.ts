import { NextRequest, NextResponse } from 'next/server'
import { AuthServiceServer } from '@/lib/services/auth-service-server'
import { SyncJobsRepository } from '@/lib/repositories/sync-jobs-repository'
import { SyncOrchestrationService } from '@/lib/services/sync-orchestration-service'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params

    const cookies = request.headers.get('cookie')
    const sessionToken = cookies?.split(';')
      .find((c) => c.trim().startsWith('app_session='))
      ?.split('=')[1]

    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await AuthServiceServer.getCurrentUser(sessionToken)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const jobsRepo = new SyncJobsRepository()
    const job = await jobsRepo.getJobById(jobId)

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    if (user.strava_id !== job.strava_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (job.status !== 'paused') {
      return NextResponse.json(
        { error: `Job ${jobId} is not paused (status: ${job.status})` },
        { status: 400 }
      )
    }

    const syncService = new SyncOrchestrationService(user.strava_id)
    await syncService.resumeJob(jobId)

    const refreshed = await jobsRepo.getJobById(jobId)

    return NextResponse.json({
      success: true,
      job: refreshed,
    })
  } catch (error: any) {
    console.error('Error resuming job:', error)
    return NextResponse.json(
      { error: 'Failed to resume job', details: error?.message },
      { status: 500 }
    )
  }
}

