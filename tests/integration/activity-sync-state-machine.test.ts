/** @jest-environment node */
import { describe, it, expect, beforeEach } from '@jest/globals'
import { createClient } from '@supabase/supabase-js'
import { ActivitiesRepository } from '@/lib/repositories/activities-repository'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const SHOULD_RUN = Boolean(SUPABASE_URL && SUPABASE_KEY && !String(SUPABASE_URL).includes('test.supabase.co'))

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const TEST_STRAVA_ID = 66554433

async function cleanup() {
  await supabase
    .from('segment_efforts')
    .delete()
    .in('activity_id', [991001, 991002, 991003, 991004, 991005, 991006, 991010, 991011, 991020, 991021, 991022, 991023])
  await supabase.from('activities').delete().eq('strava_id', TEST_STRAVA_ID)
  await supabase.from('users').delete().eq('strava_id', TEST_STRAVA_ID)
}

;(SHOULD_RUN ? describe : describe.skip)('Activity sync state machine', () => {
  beforeEach(async () => {
    await cleanup()
    await supabase.from('users').upsert({
      strava_id: TEST_STRAVA_ID,
      firstname: 'State',
      lastname: 'Machine',
    })
  })

  it('claims newest pending activities first and marks completed', async () => {
    const repo = new ActivitiesRepository()
    await supabase.from('activities').insert([
      {
        strava_id: TEST_STRAVA_ID,
        activity_id: 991001,
        name: 'Oldest',
        distance: 1000,
        moving_time: 100,
        elapsed_time: 100,
        total_elevation_gain: 10,
        type: 'Run',
        start_date: '2020-01-01T00:00:00Z',
        start_date_local: '2020-01-01T00:00:00Z',
        strava_url: 'https://www.strava.com/activities/991001',
      },
      {
        strava_id: TEST_STRAVA_ID,
        activity_id: 991002,
        name: 'Middle',
        distance: 1000,
        moving_time: 100,
        elapsed_time: 100,
        total_elevation_gain: 10,
        type: 'Run',
        start_date: '2021-01-01T00:00:00Z',
        start_date_local: '2021-01-01T00:00:00Z',
        strava_url: 'https://www.strava.com/activities/991002',
      },
      {
        strava_id: TEST_STRAVA_ID,
        activity_id: 991003,
        name: 'Newest',
        distance: 1000,
        moving_time: 100,
        elapsed_time: 100,
        total_elevation_gain: 10,
        type: 'Run',
        start_date: '2022-01-01T00:00:00Z',
        start_date_local: '2022-01-01T00:00:00Z',
        strava_url: 'https://www.strava.com/activities/991003',
      },
    ])

    const c1 = await repo.claimNextActivityForSegmentSync(TEST_STRAVA_ID)
    expect(c1?.activity_id).toBe(991003)
    await repo.markSegmentsFetchSuccessRows(String(c1?.id), 2)

    const c2 = await repo.claimNextActivityForSegmentSync(TEST_STRAVA_ID)
    expect(c2?.activity_id).toBe(991002)
    await repo.markSegmentsFetchSuccessEmpty(String(c2?.id))

    const c3 = await repo.claimNextActivityForSegmentSync(TEST_STRAVA_ID)
    expect(c3?.activity_id).toBe(991001)
    await repo.markSegmentsFetchSuccessRows(String(c3?.id), 1)

    const c4 = await repo.claimNextActivityForSegmentSync(TEST_STRAVA_ID)
    expect(c4).toBeNull()
  })

  it('claims oldest pending activities first when requested', async () => {
    const repo = new ActivitiesRepository()
    await supabase.from('activities').insert([
      {
        strava_id: TEST_STRAVA_ID,
        activity_id: 991001,
        name: 'Oldest',
        distance: 1000,
        moving_time: 100,
        elapsed_time: 100,
        total_elevation_gain: 10,
        type: 'Run',
        start_date: '2020-01-01T00:00:00Z',
        start_date_local: '2020-01-01T00:00:00Z',
        strava_url: 'https://www.strava.com/activities/991001',
      },
      {
        strava_id: TEST_STRAVA_ID,
        activity_id: 991002,
        name: 'Middle',
        distance: 1000,
        moving_time: 100,
        elapsed_time: 100,
        total_elevation_gain: 10,
        type: 'Run',
        start_date: '2021-01-01T00:00:00Z',
        start_date_local: '2021-01-01T00:00:00Z',
        strava_url: 'https://www.strava.com/activities/991002',
      },
      {
        strava_id: TEST_STRAVA_ID,
        activity_id: 991003,
        name: 'Newest',
        distance: 1000,
        moving_time: 100,
        elapsed_time: 100,
        total_elevation_gain: 10,
        type: 'Run',
        start_date: '2022-01-01T00:00:00Z',
        start_date_local: '2022-01-01T00:00:00Z',
        strava_url: 'https://www.strava.com/activities/991003',
      },
    ])

    const c1 = await repo.claimNextActivityForSegmentSync(TEST_STRAVA_ID, 'oldest')
    expect(c1?.activity_id).toBe(991001)
    await repo.markSegmentsFetchSuccessRows(String(c1?.id), 1)

    const c2 = await repo.claimNextActivityForSegmentSync(TEST_STRAVA_ID, 'oldest')
    expect(c2?.activity_id).toBe(991002)
    await repo.markSegmentsFetchSuccessRows(String(c2?.id), 1)

    const c3 = await repo.claimNextActivityForSegmentSync(TEST_STRAVA_ID, 'oldest')
    expect(c3?.activity_id).toBe(991003)
    await repo.markSegmentsFetchSuccessRows(String(c3?.id), 1)
  })

  it('resumes in-progress activity before pending queue', async () => {
    const repo = new ActivitiesRepository()
    await supabase.from('activities').insert([
      {
        strava_id: TEST_STRAVA_ID,
        activity_id: 991004,
        name: 'Pending oldest',
        distance: 1000,
        moving_time: 100,
        elapsed_time: 100,
        total_elevation_gain: 10,
        type: 'Run',
        start_date: '2019-01-01T00:00:00Z',
        start_date_local: '2019-01-01T00:00:00Z',
        strava_url: 'https://www.strava.com/activities/991004',
        activity_sync_state: 'pending',
      },
      {
        strava_id: TEST_STRAVA_ID,
        activity_id: 991005,
        name: 'In progress newer',
        distance: 1000,
        moving_time: 100,
        elapsed_time: 100,
        total_elevation_gain: 10,
        type: 'Run',
        start_date: '2020-01-01T00:00:00Z',
        start_date_local: '2020-01-01T00:00:00Z',
        strava_url: 'https://www.strava.com/activities/991005',
        activity_sync_state: 'in_progress',
        activity_sync_started_at: new Date().toISOString(),
      },
    ])

    const claimed = await repo.claimNextActivityForSegmentSync(TEST_STRAVA_ID)
    expect(claimed?.activity_id).toBe(991005)
  })

  it('retries failed activity deterministically', async () => {
    const repo = new ActivitiesRepository()
    await supabase.from('activities').insert({
      strava_id: TEST_STRAVA_ID,
      activity_id: 991006,
      name: 'Retry me',
      distance: 1000,
      moving_time: 100,
      elapsed_time: 100,
      total_elevation_gain: 10,
      type: 'Run',
      start_date: '2018-01-01T00:00:00Z',
      start_date_local: '2018-01-01T00:00:00Z',
      strava_url: 'https://www.strava.com/activities/991006',
      activity_sync_state: 'failed',
      activity_sync_error: 'transient error',
    })

    const claimed = await repo.claimNextActivityForSegmentSync(TEST_STRAVA_ID)
    expect(claimed?.activity_id).toBe(991006)
    await repo.markSegmentsFetchSuccessRows(String(claimed?.id), 3)

    const { data: row } = await supabase
      .from('activities')
      .select('activity_sync_state,activity_sync_attempts,activity_sync_completed_at')
      .eq('activity_id', 991006)
      .maybeSingle()

    expect(row?.activity_sync_state).toBe('completed')
    expect((row?.activity_sync_attempts ?? 0) > 0).toBe(true)
    expect(row?.activity_sync_completed_at).toBeTruthy()
  })

  it('prioritizes pending over failed so one failed item cannot stall the queue', async () => {
    const repo = new ActivitiesRepository()
    await supabase.from('activities').insert([
      {
        strava_id: TEST_STRAVA_ID,
        activity_id: 991010,
        name: 'Failed oldest',
        distance: 1000,
        moving_time: 100,
        elapsed_time: 100,
        total_elevation_gain: 10,
        type: 'Run',
        start_date: '2018-01-01T00:00:00Z',
        start_date_local: '2018-01-01T00:00:00Z',
        strava_url: 'https://www.strava.com/activities/991010',
        activity_sync_state: 'failed',
        activity_sync_error: 'transient',
      },
      {
        strava_id: TEST_STRAVA_ID,
        activity_id: 991011,
        name: 'Pending newer',
        distance: 1000,
        moving_time: 100,
        elapsed_time: 100,
        total_elevation_gain: 10,
        type: 'Run',
        start_date: '2020-01-01T00:00:00Z',
        start_date_local: '2020-01-01T00:00:00Z',
        strava_url: 'https://www.strava.com/activities/991011',
        activity_sync_state: 'pending',
      },
    ])

    const claimed = await repo.claimNextActivityForSegmentSync(TEST_STRAVA_ID, 'oldest')
    expect(claimed?.activity_id).toBe(991011)
  })

  it('segments sync queue counts reflect activities needing fetch (not global segment deficit)', async () => {
    await supabase.from('activities').insert([
      {
        strava_id: TEST_STRAVA_ID,
        activity_id: 991020,
        name: 'Segments done',
        distance: 1000,
        moving_time: 100,
        elapsed_time: 100,
        total_elevation_gain: 10,
        type: 'Run',
        start_date: '2020-01-01T00:00:00Z',
        start_date_local: '2020-01-01T00:00:00Z',
        strava_url: 'https://www.strava.com/activities/991020',
        activity_sync_state: 'completed',
        segments_fetch_status: 'success_rows',
        segments_fetched: true,
        segment_efforts_synced_at: '2025-01-01T00:00:00Z',
      },
      {
        strava_id: TEST_STRAVA_ID,
        activity_id: 991021,
        name: 'Needs fetch',
        distance: 1000,
        moving_time: 100,
        elapsed_time: 100,
        total_elevation_gain: 10,
        type: 'Run',
        start_date: '2024-06-01T00:00:00Z',
        start_date_local: '2024-06-01T00:00:00Z',
        strava_url: 'https://www.strava.com/activities/991021',
        activity_sync_state: 'pending',
        segments_fetch_status: 'pending',
        segments_fetched: false,
        segment_efforts_synced_at: null,
      },
      {
        strava_id: TEST_STRAVA_ID,
        activity_id: 991022,
        name: 'Fetch failed',
        distance: 1000,
        moving_time: 100,
        elapsed_time: 100,
        total_elevation_gain: 10,
        type: 'Run',
        start_date: '2024-06-02T00:00:00Z',
        start_date_local: '2024-06-02T00:00:00Z',
        strava_url: 'https://www.strava.com/activities/991022',
        activity_sync_state: 'failed',
        segments_fetch_status: 'failed',
        segments_fetched: false,
        segment_efforts_synced_at: null,
        segments_fetch_error: 'boom',
      },
      {
        strava_id: TEST_STRAVA_ID,
        activity_id: 991023,
        name: 'In progress fetch',
        distance: 1000,
        moving_time: 100,
        elapsed_time: 100,
        total_elevation_gain: 10,
        type: 'Run',
        start_date: '2025-06-02T12:00:00Z',
        start_date_local: '2025-06-02T12:00:00Z',
        strava_url: 'https://www.strava.com/activities/991023',
        activity_sync_state: 'in_progress',
        activity_sync_started_at: '2026-05-03T12:00:00Z',
        segments_fetch_status: 'pending',
        segments_fetched: false,
        segment_efforts_synced_at: null,
      },
      {
        strava_id: TEST_STRAVA_ID,
        activity_id: 991024,
        name: 'Activity row completed but segments still pending',
        distance: 1000,
        moving_time: 100,
        elapsed_time: 100,
        total_elevation_gain: 10,
        type: 'Run',
        start_date: '2023-06-01T00:00:00Z',
        start_date_local: '2023-06-01T00:00:00Z',
        strava_url: 'https://www.strava.com/activities/991024',
        activity_sync_state: 'completed',
        activity_sync_completed_at: '2026-05-03T10:00:00Z',
        segments_fetch_status: 'pending',
        segments_fetched: false,
        segment_efforts_synced_at: null,
      },
    ])

    const { data: countsRaw, error: countsError } = await supabase
      .rpc('get_user_segments_sync_queue_counts', { p_strava_id: TEST_STRAVA_ID })
      .maybeSingle()
    expect(countsError).toBeNull()
    const counts = countsRaw as {
      pending?: number | string | null
      in_progress?: number | string | null
      completed?: number | string | null
      failed?: number | string | null
    }

    expect(Number(counts.pending)).toBe(2)
    expect(Number(counts.in_progress)).toBe(1)
    expect(Number(counts.completed)).toBe(1)
    expect(Number(counts.failed)).toBe(1)

    const { data: preview, error: previewError } = await supabase.rpc('get_user_segments_sync_queue_preview', {
      p_strava_id: TEST_STRAVA_ID,
      p_order: 'desc',
      p_limit: 10,
    })
    expect(previewError).toBeNull()
    const rows = preview || []
    expect(rows.length >= 3).toBe(true)
    expect(Number(rows[0]?.activity_id)).toBe(991023)
    expect(rows.some((r: any) => Number(r.activity_id) === 991020)).toBe(false)
  })
})
