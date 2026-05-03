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
  await supabase.from('segment_efforts').delete().in('activity_id', [991001, 991002, 991003, 991004, 991005, 991006])
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
})
