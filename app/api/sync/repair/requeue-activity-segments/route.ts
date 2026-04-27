import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { AuthServiceServer } from '@/lib/services/auth-service-server'
import { SyncJobsRepository } from '@/lib/repositories/sync-jobs-repository'
import { config } from '@/lib/config'

export async function POST(request: NextRequest) {
  try {
    const cookies = request.headers.get('cookie')
    const sessionToken = cookies?.split(';').find((c) => c.trim().startsWith('app_session='))?.split('=')[1]

    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await AuthServiceServer.getCurrentUser(sessionToken)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await request.json().catch(() => ({}))) as { activityId?: number; reason?: string }
    const activityId = Number(body.activityId)
    const reason = (body.reason ?? 'manual requeue').slice(0, 500)

    if (!Number.isFinite(activityId) || activityId <= 0) {
      return NextResponse.json({ error: 'Invalid activityId' }, { status: 400 })
    }

    const supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey)

    const { error, count } = await supabase
      .from('activities')
      .update({
        segments_fetched: false,
        segments_fetch_status: 'pending',
        segments_fetch_error: reason,
        segments_fetched_at: null,
        segments_effort_rows_count: null,
      })
      .eq('strava_id', user.strava_id)
      .eq('activity_id', activityId)
      .select('*', { count: 'exact', head: true })

    if (error) throw error

    const jobsRepo = new SyncJobsRepository()
    const activeJob = await jobsRepo.getActiveJobForUser(user.strava_id).catch(() => null)
    if (activeJob) {
      await jobsRepo
        .logEvent({
          jobId: activeJob.id,
          stravaId: user.strava_id,
          eventType: 'repair_requeue_segments',
          entityType: 'activity',
          message: `Requeued segment fetch for activity ${activityId}: ${reason}`,
          stats: { activityId },
        })
        .catch(() => {})
    }

    return NextResponse.json({ success: true, updated: count ?? 0 })
  } catch (error: any) {
    console.error('Error requeueing activity segments:', error)
    return NextResponse.json({ error: 'Failed to requeue activity segments', details: error?.message }, { status: 500 })
  }
}

