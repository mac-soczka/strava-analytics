import { NextRequest, NextResponse } from 'next/server'
import { AuthServiceServer } from '@/lib/services/auth-service-server'
import { SyncJobsRepository } from '@/lib/repositories/sync-jobs-repository'
import { getRateLimitService } from '@/lib/services/rate-limit-service'
import { createClient } from '@supabase/supabase-js'
import config from '@/lib/config'

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
    const adaptiveDelayMs = rateLimitService.getAdaptiveDelay()
    const recommendedWaitMs = rateLimitService.getRecommendedWaitTime()

    const supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey)
    const { data: activeState } = await supabase
      .from('active_sync_job_state')
      .select('*')
      .eq('job_id', jobId)
      .maybeSingle()

    const [{ count: pendingCount }, { count: inProgressCount }, { count: completedCount }, { count: failedCount }] =
      await Promise.all([
        supabase
          .from('activities')
          .select('activity_id', { count: 'exact', head: true })
          .eq('strava_id', job.strava_id)
          .eq('activity_sync_state', 'pending'),
        supabase
          .from('activities')
          .select('activity_id', { count: 'exact', head: true })
          .eq('strava_id', job.strava_id)
          .eq('activity_sync_state', 'in_progress'),
        supabase
          .from('activities')
          .select('activity_id', { count: 'exact', head: true })
          .eq('strava_id', job.strava_id)
          .eq('activity_sync_state', 'completed'),
        supabase
          .from('activities')
          .select('activity_id', { count: 'exact', head: true })
          .eq('strava_id', job.strava_id)
          .eq('activity_sync_state', 'failed'),
      ])

    const activityQueue = {
      pending: pendingCount ?? 0,
      in_progress: inProgressCount ?? 0,
      completed: completedCount ?? 0,
      failed: failedCount ?? 0,
    }

    const { data: inProgressActivity } = await supabase
      .from('activities')
      .select('activity_id,name,activity_sync_started_at')
      .eq('strava_id', job.strava_id)
      .eq('activity_sync_state', 'in_progress')
      .order('activity_sync_started_at', { ascending: true, nullsFirst: true })
      .order('start_date', { ascending: true })
      .limit(1)
      .maybeSingle()

    // Expose current Strava rate limit state via HTTP headers so clients can treat
    // the response as the source of truth (mirrors Strava's header format).
    const headers = new Headers()
    headers.set('X-RateLimit-Usage', `${rateLimits.requests15min},${rateLimits.requestsDay}`)
    headers.set('X-RateLimit-Limit', `${rateLimits.limit15min},${rateLimits.limitDay}`)
    headers.set('X-RateLimit-LastUpdate', rateLimits.lastUpdate.toISOString())

    return NextResponse.json(
      {
        job,
        exactState: {
          phase: job.current_phase,
          checkpoints: {
            lastProcessedActivityId: job.last_processed_activity_id ?? null,
            lastProcessedSegmentId: job.last_processed_segment_id ?? null,
            stravaPage: job.strava_page ?? null,
            cursorAfterEpoch: job.cursor_after_epoch ?? null,
            cursorBeforeEpoch: job.cursor_before_epoch ?? null,
          },
          requestBudget: {
            requestsUsed15m: job.requests_used_15m ?? null,
            requestsUsedDaily: job.requests_used_daily ?? null,
            reset15mAt: job.rate_limit_15m_reset_at ?? null,
            resetDailyAt: job.rate_limit_daily_reset_at ?? null,
          },
          activeState: activeState ?? null,
          activityQueue,
          currentActivity: inProgressActivity
            ? {
                activityId: inProgressActivity.activity_id,
                name: inProgressActivity.name,
                startedAt: inProgressActivity.activity_sync_started_at,
              }
            : null,
        },
        // Keep body fields for backward compatibility; clients should prefer headers.
        rateLimits: {
          requests15min: rateLimits.requests15min,
          limit15min: rateLimits.limit15min,
          remaining15min: rateLimits.remaining15min,
          requestsDay: rateLimits.requestsDay,
          limitDay: rateLimits.limitDay,
          remainingDay: rateLimits.remainingDay,
          adaptiveDelayMs,
          recommendedWaitMs,
          nextReset15min: rateLimits.nextReset15min.toISOString(),
          nextResetDaily: rateLimits.nextResetDaily.toISOString(),
          lastUpdate: rateLimits.lastUpdate.toISOString(),
        },
      },
      { headers }
    )
  } catch (error: any) {
    console.error('Error fetching job status:', error)
    return NextResponse.json(
      { error: 'Failed to fetch job status', details: error?.message },
      { status: 500 }
    )
  }
}
