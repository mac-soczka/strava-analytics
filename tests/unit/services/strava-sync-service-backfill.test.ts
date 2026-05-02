/** @jest-environment node */
import { describe, it, expect } from '@jest/globals'
import { StravaSyncService } from '@/lib/services/strava-sync-service'
import type { StravaApiClient } from '@/lib/strava/strava-api-client'

function mkActivity(id: number, iso: string) {
  return {
    id,
    name: `Activity ${id}`,
    distance: 1000,
    moving_time: 100,
    elapsed_time: 100,
    total_elevation_gain: 10,
    type: 'Run',
    start_date: iso,
    start_date_local: iso,
    average_speed: 3.2,
    max_speed: 5.1,
    map: { summary_polyline: 'abc' },
  } as any
}

class FakeApi implements StravaApiClient {
  private pagesByBefore: Record<number, any[]>

  constructor(pagesByBefore: Record<number, any[]>) {
    this.pagesByBefore = pagesByBefore
  }

  async fetchActivities(_page: number, _perPage: number, options?: { before?: number; after?: number }) {
    const before = options?.before ?? 0
    return this.pagesByBefore[before] ?? []
  }

  async fetchActivityDetails(_activityId: number) {
    return null
  }

  async fetchActivitySegmentEfforts(_activityId: number) {
    return []
  }

  async fetchSegmentEffortsForSegment(_segmentId: number, _page: number, _perPage: number) {
    return []
  }

  async fetchSegmentById(_segmentId: number) {
    return null
  }
}

describe('StravaSyncService syncActivitiesBackfill', () => {
  it('reports scanned count and advances before cursor across windows', async () => {
    const activityA = mkActivity(1, '2026-05-01T00:00:00.000Z') // newer
    const activityB = mkActivity(2, '2026-04-01T00:00:00.000Z') // older
    const startBeforeEpoch = Math.floor(new Date('2026-06-01T00:00:00.000Z').getTime() / 1000)
    const oldestEpoch = Math.floor(new Date('2026-04-01T00:00:00.000Z').getTime() / 1000)

    const api = new FakeApi({
      [startBeforeEpoch]: [activityA, activityB],
      [oldestEpoch - 1]: [],
    })

    const seenIds = new Set<number>()
    const activitiesRepo = {
      getActivityById: async (id: number) => (seenIds.has(id) ? ({ activity_id: id } as any) : null),
      createActivity: async (row: any) => {
        seenIds.add(row.activity_id)
        return row
      },
    } as any

    const sync = new StravaSyncService(123, api, {
      activitiesRepo,
      segmentsRepo: {} as any,
      supabase: {} as any,
      sleep: async () => {},
    })

    const progress: Array<{ scanned: number; synced: number; cursorBeforeEpoch: number }> = []
    const result = await sync.syncActivitiesBackfill({
      beforeEpoch: startBeforeEpoch,
      maxRequests: 10,
      onProgress: async (p) => {
        progress.push({
          scanned: p.scanned,
          synced: p.synced,
          cursorBeforeEpoch: p.cursorBeforeEpoch,
        })
      },
    })

    expect(result.scanned).toBe(2)
    expect(result.synced).toBe(2)
    expect(result.errors).toBe(0)
    expect(result.newBeforeEpoch).toBe(oldestEpoch - 1)
    expect(progress.length).toBeGreaterThan(0)
    expect(progress[0].scanned).toBe(2)
    expect(progress[0].synced).toBe(2)
    expect(progress[0].cursorBeforeEpoch).toBe(oldestEpoch - 1)
  })
})
