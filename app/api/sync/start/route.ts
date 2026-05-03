import { NextRequest, NextResponse } from 'next/server'
import { AuthServiceServer } from '@/lib/services/auth-service-server'
import { SyncOrchestrationService } from '@/lib/services/sync-orchestration-service'
import { StravaService } from '@/lib/services/strava-service'
import { MockStravaApiClient } from '@/lib/strava/mock-strava-api-client'
import type { StravaActivity } from '@/types/strava'

function buildMockActivities(): StravaActivity[] {
  const now = Date.now()
  return [1, 2, 3].map((n) => ({
    id: 930000000 + n,
    name: `E2E Mock Activity ${n}`,
    distance: 10000 + n * 100,
    moving_time: 2000 + n * 10,
    elapsed_time: 2100 + n * 10,
    total_elevation_gain: 100 + n,
    type: 'Run',
    start_date: new Date(now - n * 24 * 60 * 60 * 1000).toISOString(),
    start_date_local: new Date(now - n * 24 * 60 * 60 * 1000).toISOString(),
    average_speed: 3.2,
    max_speed: 5.1,
    average_watts: null,
    max_watts: null,
    average_heartrate: 150,
    max_heartrate: 180,
    map: { summary_polyline: 'mock_polyline' },
    strava_url: `https://www.strava.com/activities/${930000000 + n}`,
  } as unknown as StravaActivity))
}

function buildMockDetails(activities: StravaActivity[]) {
  const detailsById = new Map<number, StravaActivity>()
  const segmentEffortsByActivityId = new Map<number, any[]>()

  activities.forEach((a, idx) => {
    const segmentId = 730000 + idx
    const effort = {
      id: String(830000000 + idx),
      elapsed_time: 300,
      moving_time: 295,
      distance: 1000,
      start_date: a.start_date,
      start_index: 100,
      end_index: 500,
      average_watts: 250,
      max_watts: 400,
      device_watts: true,
      average_cadence: 85,
      average_heartrate: 155,
      max_heartrate: 175,
      pr_rank: 2,
      kom_rank: null,
      achievements: [{ type: 'pr', rank: 2 }],
      hidden: false,
      segment: {
        id: segmentId,
        name: `E2E Mock Segment ${segmentId}`,
        distance: 1000,
        average_grade: 5.2,
        maximum_grade: 12.5,
        elevation_high: 100,
        elevation_low: 50,
        climb_category: 2,
        city: 'Test City',
        state: 'TS',
        country: 'Testland',
        map: { polyline: 'mock_segment_polyline' },
      },
    }

    const details = {
      ...a,
      map: { polyline: 'mock_polyline_full', summary_polyline: 'mock_polyline' },
      segment_efforts: [effort],
    } as unknown as StravaActivity

    detailsById.set(a.id, details)
    segmentEffortsByActivityId.set(a.id, [effort])
  })

  return { detailsById, segmentEffortsByActivityId }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const startFrom =
      body?.start_from === 'oldest' || body?.start_from === 'newest'
        ? body.start_from
        : 'newest'

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

    const useMockStrava = process.env.NODE_ENV === 'test' || body?.use_mock_strava === true

    const syncService = (() => {
      if (!useMockStrava) {
        return new SyncOrchestrationService(user.strava_id)
      }

      const activities = buildMockActivities()
      const details = buildMockDetails(activities)
      const apiClient = new MockStravaApiClient({
        activities,
        detailsById: details.detailsById,
        segmentEffortsByActivityId: details.segmentEffortsByActivityId,
      })
      const stravaService = new StravaService(user.strava_id, { apiClient })
      return new SyncOrchestrationService(user.strava_id, { stravaService })
    })()

    const job = await syncService.startFullSync(user.strava_id, { startFrom })

    return NextResponse.json({
      success: true,
      job: {
        id: job.id,
        status: job.status,
        created_at: job.created_at,
      },
    })
  } catch (error: any) {
    console.error('Error starting sync job:', error)
    
    if (error?.message?.includes('already running')) {
      return NextResponse.json(
        { error: 'A sync job is already running. Please wait for it to complete.' },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to start sync job', details: error?.message },
      { status: 500 }
    )
  }
}
