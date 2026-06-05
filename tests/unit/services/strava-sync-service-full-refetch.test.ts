/** @jest-environment node */
import { describe, it, expect, jest } from '@jest/globals'
import { StravaSyncService } from '@/lib/services/strava-sync-service'
import type { StravaApiClient } from '@/lib/strava/strava-api-client'

function mkSummary(id: number) {
  return {
    id,
    name: `Act ${id}`,
    distance: 1000,
    moving_time: 100,
    elapsed_time: 100,
    total_elevation_gain: 10,
    type: 'Run',
    start_date: '2026-05-01T00:00:00.000Z',
    start_date_local: '2026-05-01T00:00:00.000Z',
    map: { summary_polyline: 's' },
  } as any
}

function mkDetail(summary: any) {
  return {
    ...summary,
    map: { polyline: 'full', summary_polyline: 's' },
    segment_efforts: [
      {
        id: '900' + summary.id,
        elapsed_time: 10,
        moving_time: 10,
        start_date: summary.start_date,
        segment: {
          id: 7000 + summary.id,
          name: 'Seg',
          distance: 500,
          average_grade: 1,
          maximum_grade: 2,
          elevation_high: 100,
          elevation_low: 50,
          climb_category: 0,
          city: 'c',
          state: 's',
          country: 'x',
          map: { polyline: 'sg' },
        },
      },
    ],
  } as any
}

class RefetchFakeApi implements StravaApiClient {
  constructor(private pages: any[][]) {}

  async fetchActivities(page: number, perPage: number) {
    const idx = page - 1
    const chunk = this.pages[idx]
    if (!chunk) return []
    return chunk.slice(0, perPage)
  }

  async fetchActivityDetails(activityId: number) {
    return mkDetail(mkSummary(activityId))
  }

  async fetchActivitySegmentEfforts() {
    return []
  }

  async fetchSegmentEffortsForSegment() {
    return []
  }

  async fetchSegmentById() {
    return null
  }
}

describe('StravaSyncService syncFullRefetch', () => {
  it('pages through all activities, upserts each, and checkpoints pages', async () => {
    const api = new RefetchFakeApi([[mkSummary(1), mkSummary(2)], [mkSummary(3)], []])

    const persist = jest.fn()
    const activitiesRepo = {
      getActivityById: async () => null,
      createActivity: async (row: any) => {
        persist('create', row.activity_id)
        return row
      },
      updateActivity: async (id: number, u: any) => {
        persist('update', id, u)
        return u
      },
    } as any

    const segmentsRepo = {
      bulkUpsertSegments: async () => ({ data: [], error: null }),
      batchSaveEffortsFromStravaActivity: async () => ({ saved: 1, errors: 0 }),
    } as any

    const sync = new StravaSyncService(42, api, {
      activitiesRepo,
      segmentsRepo,
      supabase: {} as any,
      sleep: async () => {},
    })

    const checkpoints: number[] = []
    const result = await sync.syncFullRefetch({
      pageSize: 10,
      maxPages: 10,
      onPageComplete: async (n) => {
        checkpoints.push(n)
      },
    })

    expect(result.processed).toBe(3)
    expect(result.errors).toBe(0)
    expect(result.segmentEfforts).toBe(3)
    expect(result.lastPage).toBe(2)
    expect(checkpoints).toEqual([2, 3])
    expect(persist.mock.calls.some((c) => c[0] === 'create' && c[1] === 1)).toBe(true)
  })

  it('propagates rate limit with refetchStravaPage', async () => {
    const summary = mkSummary(10)
    const api: StravaApiClient = {
      async fetchActivities() {
        return [summary]
      },
      async fetchActivityDetails() {
        const err: any = new Error('Rate limit exceeded')
        err.statusCode = 429
        throw err
      },
      async fetchActivitySegmentEfforts() {
        return []
      },
      async fetchSegmentEffortsForSegment() {
        return []
      },
      async fetchSegmentById() {
        return null
      },
    }

    const sync = new StravaSyncService(42, api, {
      activitiesRepo: { getActivityById: async () => null } as any,
      segmentsRepo: {} as any,
      supabase: {} as any,
      sleep: async () => {},
    })

    await expect(sync.syncFullRefetch({ maxPages: 5 })).rejects.toMatchObject({
      statusCode: 429,
      refetchStravaPage: 1,
      currentActivityId: 10,
    })
  })
})
