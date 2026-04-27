import { NextRequest, NextResponse } from 'next/server'
import { AuthServiceServer } from '@/lib/services/auth-service-server'
import { SyncJobsRepository } from '@/lib/repositories/sync-jobs-repository'

export async function GET(request: NextRequest) {
  try {
    const cookies = request.headers.get('cookie')
    const sessionToken = cookies
      ?.split(';')
      .find((c) => c.trim().startsWith('app_session='))
      ?.split('=')[1]

    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await AuthServiceServer.getCurrentUser(sessionToken)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(request.url)
    const jobId = url.searchParams.get('jobId')
    const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit') ?? 50)))

    const repo = new SyncJobsRepository()
    const job = jobId ? await repo.getJobById(jobId) : await repo.getActiveJobForUser(user.strava_id)

    if (!job) {
      return NextResponse.json({ job: null, events: [] })
    }

    if (job.strava_id !== user.strava_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const events = await repo.getRecentEventsForJob(job.id, limit)
    return NextResponse.json({ job, events })
  } catch (error: any) {
    console.error('Error fetching sync logs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch sync logs', details: error?.message },
      { status: 500 }
    )
  }
}

