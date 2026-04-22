import { NextRequest, NextResponse } from 'next/server'
import { AuthServiceServer } from '@/lib/services/auth-service-server'
import { SyncOrchestrationService } from '@/lib/services/sync-orchestration-service'

export async function POST(request: NextRequest) {
  try {
    const cookies = request.headers.get('cookie')
    const sessionToken = cookies?.split(';')
      .find(c => c.trim().startsWith('app_session='))
      ?.split('=')[1]

    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await AuthServiceServer.getCurrentUser(sessionToken)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const syncService = new SyncOrchestrationService(user.strava_id)
    const job = await syncService.startSegmentEffortsSync(user.strava_id)

    return NextResponse.json({
      success: true,
      job: {
        id: job.id,
        status: job.status,
        created_at: job.created_at,
      },
    })
  } catch (error: any) {
    console.error('Error starting segment efforts sync job:', error)

    if (error?.message?.includes('already running')) {
      return NextResponse.json(
        { error: 'A sync job is already running. Please wait for it to complete.' },
        { status: 409 }
      )
    }

    if (error?.code === '22P02' && `${error?.message || ''}`.includes('sync_job_type')) {
      return NextResponse.json(
        {
          error: 'Database schema is out of date',
          details: 'Missing enum value "segment_efforts_only" in sync_job_type. Apply latest migrations (supabase db push / apply migration).',
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to start segment efforts sync job', details: error?.message },
      { status: 500 }
    )
  }
}

