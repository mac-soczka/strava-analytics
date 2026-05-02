/** @jest-environment node */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from '@jest/globals'
import { createClient } from '@supabase/supabase-js/dist/main/index.js'
import { mockStravaFetch } from '@/tests/helpers/strava-mock-fetch'
import { RealStravaApiClient } from '@/lib/strava/real-strava-api-client'
import { StravaSyncService } from '@/lib/services/strava-sync-service'
import { StravaService } from '@/lib/services/strava-service'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const SHOULD_RUN = Boolean(SUPABASE_URL && SUPABASE_KEY && !SUPABASE_URL.includes('test.supabase.co'))

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const TEST_STRAVA_ID = 99887766

async function cleanupTestUserData() {
  // Order matters due to foreign keys.
  await supabase.from('segment_efforts').delete().eq('activity_id', 900_000_001)
  await supabase.from('segment_efforts').delete().gte('effort_id_text', '800000000').lte('effort_id_text', '899999999')
  await supabase.from('segments').delete().gte('segment_id', 700_000).lte('segment_id', 999_999)
  await supabase.from('activities').delete().eq('strava_id', TEST_STRAVA_ID)
  await supabase.from('strava_tokens').delete().eq('strava_id', TEST_STRAVA_ID)
  await supabase.from('app_sessions').delete().eq('strava_id', TEST_STRAVA_ID)
  await supabase.from('sync_jobs').delete().eq('strava_id', TEST_STRAVA_ID)
  await supabase.from('users').delete().eq('strava_id', TEST_STRAVA_ID)
}

;(SHOULD_RUN ? describe : describe.skip)('StravaService optimized sync (mocked Strava)', () => {
  beforeAll(() => {
    // These tests rely on real async timers (we bypass delays via injected sleep()).
    jest.useRealTimers()
  })

  beforeEach(async () => {
    await cleanupTestUserData()

    const { error: userErr } = await supabase.from('users').insert({
      strava_id: TEST_STRAVA_ID,
      firstname: 'Test',
      lastname: 'User',
    })
    expect(userErr).toBeNull()

    const { error: tokenErr } = await supabase.from('strava_tokens').upsert(
      {
        strava_id: TEST_STRAVA_ID,
        access_token: 'test_access_token',
        refresh_token: 'test_refresh_token',
        // Far future so refresh is never triggered.
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      },
      { onConflict: 'strava_id' }
    )
    expect(tokenErr).toBeNull()
  })

  afterEach(async () => {
    await cleanupTestUserData()
  })

  it('syncActivities() extracts embedded segment_efforts and persists new effort fields', async () => {
    const api = new RealStravaApiClient(TEST_STRAVA_ID, { fetchFn: mockStravaFetch, sleep: async () => {} })
    const sync = new StravaSyncService(TEST_STRAVA_ID, api, { sleep: async () => {} })

    const result = await sync.syncActivities(200, 10)
    expect(result.errors).toBe(0)
    expect(result.synced).toBeGreaterThan(0)

    const { data: activities, error: activitiesErr } = await supabase
      .from('activities')
      .select('activity_id, segments_fetch_status, segment_efforts_synced_at, segments_effort_rows_count')
      .eq('strava_id', TEST_STRAVA_ID)
      .order('activity_id', { ascending: true })

    expect(activitiesErr).toBeNull()
    expect(activities?.length).toBe(3)
    for (const a of activities || []) {
      expect(a.segments_fetch_status).toBe('success_rows')
      expect(a.segment_efforts_synced_at).toBeTruthy()
      expect(a.segments_effort_rows_count).toBe(1)
    }

    const { data: efforts, error: effortsErr } = await supabase
      .from('segment_efforts')
      .select('effort_id_text, distance, start_index, end_index, average_cadence, average_heartrate, max_heartrate, pr_rank, kom_rank, achievements, hidden')
      .gte('effort_id_text', '800000000')
      .lte('effort_id_text', '899999999')
      .order('effort_id_text', { ascending: true })

    expect(effortsErr).toBeNull()
    expect(efforts?.length).toBe(3)

    const e0 = efforts![0]
    expect(e0.distance).toBeTruthy()
    expect(e0.start_index).toBe(100)
    expect(e0.end_index).toBe(500)
    expect(e0.average_cadence).toBe(85)
    expect(e0.average_heartrate).toBe(155)
    expect(e0.max_heartrate).toBe(175)
    expect(e0.pr_rank).toBe(2)
    expect(e0.kom_rank).toBeNull()
    expect(Array.isArray(e0.achievements)).toBe(true)
    expect(e0.hidden).toBe(false)
  })

  it('syncSegments() processes pending activities using only activity-details endpoint', async () => {
    const activityId = 900_000_001

    await supabase.from('activities').insert({
      strava_id: TEST_STRAVA_ID,
      activity_id: activityId,
      name: 'Pending activity',
      distance: 10_000,
      moving_time: 1_000,
      elapsed_time: 1_000,
      total_elevation_gain: 50,
      type: 'Run',
      start_date: new Date('2026-01-01T10:00:00Z').toISOString(),
      start_date_local: new Date('2026-01-01T10:00:00Z').toISOString(),
      polyline: 'x',
      strava_url: `https://www.strava.com/activities/${activityId}`,
      segments_fetch_status: 'pending',
      segments_fetched: false,
    })

    const api = new RealStravaApiClient(TEST_STRAVA_ID, { fetchFn: mockStravaFetch, sleep: async () => {} })
    const sync = new StravaSyncService(TEST_STRAVA_ID, api, { sleep: async () => {} })
    const segmentResult = await sync.syncSegments(10)

    expect(segmentResult.errors).toBe(0)
    expect(segmentResult.processed).toBe(1)
    expect(segmentResult.segmentsAdded).toBe(1)

    const { data: updated, error: updatedErr } = await supabase
      .from('activities')
      .select('segments_fetch_status, segments_fetched, segments_effort_rows_count')
      .eq('activity_id', activityId)
      .single()

    expect(updatedErr).toBeNull()
    if (!updated) {
      throw new Error('Expected updated activity row to exist')
    }
    expect(updated.segments_fetch_status).toBe('success_rows')
    expect(updated.segments_fetched).toBe(true)
    expect(updated.segments_effort_rows_count).toBe(1)

    const { data: efforts } = await supabase
      .from('segment_efforts')
      .select('activity_id')
      .eq('activity_id', activityId)
    expect(efforts?.length).toBe(1)
  })

  it('syncSegmentEffortsForSegment() ingests all pages for a target segment', async () => {
    const targetSegmentId = 700_079
    const api = new RealStravaApiClient(TEST_STRAVA_ID, { fetchFn: mockStravaFetch, sleep: async () => {} })
    const service = new StravaService(TEST_STRAVA_ID, { apiClient: api })

    const result = await service.syncSegmentEffortsForSegment(targetSegmentId)
    expect(result.errors).toBe(0)
    expect(result.saved).toBe(12)
    expect(result.processed).toBe(12)

    const { count: effortCount, error: effortsError } = await supabase
      .from('segment_efforts')
      .select('*', { count: 'exact', head: true })
      .eq('segment_id', targetSegmentId)
      .gte('effort_id_text', '890000000')
      .lte('effort_id_text', '899999999')

    expect(effortsError).toBeNull()
    expect(effortCount).toBe(12)

    const { count: placeholderActivities, error: activitiesError } = await supabase
      .from('activities')
      .select('*', { count: 'exact', head: true })
      .eq('strava_id', TEST_STRAVA_ID)
      .gte('activity_id', 950_000_000)
      .lte('activity_id', 950_000_020)

    expect(activitiesError).toBeNull()
    expect(placeholderActivities).toBe(12)
  })

  it.skip('syncSegmentEffortsForSegment() falls back to checkpointed activity scan when segment all_efforts returns 402', async () => {
    const targetSegmentId = 700_001

    const fetchWith402ForSegmentEndpoint: typeof fetch = async (input, init) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : (input as Request).url
      if (url.includes(`/api/v3/segments/${targetSegmentId}/all_efforts`)) {
        return new Response(JSON.stringify({ message: 'Payment Required', errors: [] }), {
          status: 402,
          headers: { 'Content-Type': 'application/json', 'X-RateLimit-Usage': '1,10', 'X-RateLimit-Limit': '100,1000' },
        })
      }
      return mockStravaFetch(input as any, init)
    }

    const api = new RealStravaApiClient(TEST_STRAVA_ID, {
      fetchFn: fetchWith402ForSegmentEndpoint,
      sleep: async () => {},
    })
    const service = new StravaService(TEST_STRAVA_ID, { apiClient: api })

    const result = await service.syncSegmentEffortsForSegment(targetSegmentId)
    expect(result.errors).toBe(0)
    expect(result.saved).toBeGreaterThanOrEqual(1)
    expect(result.processed).toBeGreaterThanOrEqual(1)

    const { count: effortCount, error: effortsError } = await supabase
      .from('segment_efforts')
      .select('*', { count: 'exact', head: true })
      .eq('segment_id', targetSegmentId)
      .gte('effort_id_text', '800000000')
      .lte('effort_id_text', '899999999')

    expect(effortsError).toBeNull()
    expect(effortCount).toBe(1)
  })
})

