import { NextRequest, NextResponse } from 'next/server'
import { AuthServiceServer } from '@/lib/services/auth-service-server'
import { SyncOrchestrationService } from '@/lib/services/sync-orchestration-service'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const targetSegmentId = Number(body?.segmentId)

    if (!Number.isFinite(targetSegmentId) || targetSegmentId <= 0) {
      return NextResponse.json({ error: 'Invalid segmentId' }, { status: 400 })
    }

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

    const syncService = new SyncOrchestrationService(user.strava_id)
    const job = await syncService.startSegmentEffortsSync(user.strava_id, {
      targetSegmentId,
    })

    return NextResponse.json({
      success: true,
      job: {
        id: job.id,
        status: job.status,
        created_at: job.created_at,
        options: job.options,
      },
    })
  } catch (error: any) {
    console.error('Error starting segment sideline effort sync job:', error)

    if (error?.message?.includes('already running')) {
      return NextResponse.json(
        { error: 'A sync job is already running. Please wait for it to complete.' },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to start sideline segment effort sync job', details: error?.message },
      { status: 500 }
    )
  }
}

