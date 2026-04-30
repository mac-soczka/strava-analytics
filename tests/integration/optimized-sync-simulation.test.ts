/** @jest-environment node */
import { describe, it, expect, beforeAll, beforeEach, afterEach, jest } from '@jest/globals'
import { createClient } from '@supabase/supabase-js/dist/main/index.js'
import { RealStravaApiClient } from '@/lib/strava/real-strava-api-client'
import { StravaSyncService } from '@/lib/services/strava-sync-service'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const SHOULD_RUN = Boolean(SUPABASE_URL && SUPABASE_KEY && !SUPABASE_URL.includes('test.supabase.co'))

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const TEST_STRAVA_ID = 88776655

async function cleanup() {
  await supabase.from('segment_efforts').delete().gte('effort_id_text', '910000000').lte('effort_id_text', '919999999')
  await supabase.from('segments').delete().gte('segment_id', 810_000).lte('segment_id', 819_999)
  await supabase.from('activities').delete().eq('strava_id', TEST_STRAVA_ID)
  await supabase.from('strava_tokens').delete().eq('strava_id', TEST_STRAVA_ID)
  await supabase.from('users').delete().eq('strava_id', TEST_STRAVA_ID)
}

function mkActivitySummary(n: number) {
  const id = 910_000_000 + n
  return {
    id,
    name: `Sim Activity ${n}`,
    distance: 5000,
    moving_time: 1500,
    elapsed_time: 1550,
    total_elevation_gain: 20,
    type: 'Run',
    start_date: new Date(Date.now() - n * 60_000).toISOString(),
    start_date_local: new Date(Date.now() - n * 60_000).toISOString(),
    average_speed: 3.3,
    max_speed: 5.0,
    average_heartrate: 150,
    max_heartrate: 180,
    map: { summary_polyline: 'poly' },
  }
}

function mkActivityDetails(activityId: number) {
  const segId = 810_000 + (activityId % 1000)
  return {
    ...mkActivitySummary(activityId % 100),
    id: activityId,
    map: { polyline: 'poly_full', summary_polyline: 'poly' },
    segment_efforts: [
      {
        id: String(910_100_000 + (activityId % 1000)),
        elapsed_time: 300,
        moving_time: 295,
        distance: 1000,
        start_date: new Date().toISOString(),
        start_index: 10,
        end_index: 20,
        average_watts: 200,
        max_watts: 300,
        device_watts: true,
        average_cadence: 80,
        average_heartrate: 155,
        max_heartrate: 175,
        pr_rank: null,
        kom_rank: null,
        achievements: [],
        hidden: false,
        segment: {
          id: segId,
          name: `Sim Segment ${segId}`,
          distance: 1000,
          average_grade: 1.0,
          maximum_grade: 2.0,
          elevation_high: 10,
          elevation_low: 0,
          climb_category: 0,
          city: 'X',
          state: 'Y',
          country: 'Z',
        },
      },
    ],
  }
}

;(SHOULD_RUN ? describe : describe.skip)('Simulation: request-efficiency (no Strava network)', () => {
  beforeAll(() => {
    jest.useRealTimers()
  })

  beforeEach(async () => {
    await cleanup()

    await supabase.from('users').insert({
      strava_id: TEST_STRAVA_ID,
      firstname: 'Test',
      lastname: 'User',
    })

    await supabase.from('strava_tokens').upsert(
      {
        strava_id: TEST_STRAVA_ID,
        access_token: 'test_access_token',
        refresh_token: 'test_refresh_token',
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      },
      { onConflict: 'strava_id' }
    )

    const activities = Array.from({ length: 10 }, (_, i) => mkActivitySummary(i + 1))

    const realFetch = global.fetch

    ;(global.fetch as any) = jest.fn(async (url: string, init?: RequestInit) => {
      if (url.startsWith('https://www.strava.com/api/v3/athlete/activities')) {
        const u = new URL(url)
        const page = Number(u.searchParams.get('page') ?? '1')
        return new Response(JSON.stringify(page === 1 ? activities : []), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Usage': '1,10',
            'X-RateLimit-Limit': '100,1000',
          },
        })
      }

      const match = url.match(/^https:\/\/www\.strava\.com\/api\/v3\/activities\/(\d+)\?include_all_efforts=true$/)
      if (match) {
        const id = Number(match[1])
        return new Response(JSON.stringify(mkActivityDetails(id)), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Usage': '1,10',
            'X-RateLimit-Limit': '100,1000',
          },
        })
      }

      // Allow Supabase / other HTTP calls to proceed normally.
      return realFetch(url as any, init as any)
    })
  })

  afterEach(async () => {
    await cleanup()
  })

  it('makes exactly 1 list request + 1 details request per new activity (no extra segment_efforts endpoints)', async () => {
    const api = new RealStravaApiClient(TEST_STRAVA_ID, {
      fetchFn: global.fetch as any,
      sleep: async () => {},
    })
    const sync = new StravaSyncService(TEST_STRAVA_ID, api, { sleep: async () => {} })

    const result = await sync.syncActivities(200, 50)
    expect(result.errors).toBe(0)
    expect(result.synced).toBe(10)

    const calls = (global.fetch as any).mock.calls.map((c: any[]) => String(c[0]))
    const listCalls = calls.filter((u: string) => u.includes('/api/v3/athlete/activities'))
    const detailCalls = calls.filter((u: string) => u.includes('/api/v3/activities/') && u.includes('include_all_efforts=true'))
    const badCalls = calls.filter((u: string) => u.includes('/segment_efforts') || u.includes('/laps') || u.includes('/streams'))

    expect(listCalls).toHaveLength(2) // page=1 + page=2 (empty terminator)
    expect(detailCalls).toHaveLength(10)
    expect(badCalls).toHaveLength(0)
  })
})

