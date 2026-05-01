import type { StravaActivity, StravaSegment, StravaSegmentEffort } from '@/types/strava'
import type { StravaApiClient, StravaListActivitiesOptions } from './strava-api-client'

export type MockStravaData = {
  activities: StravaActivity[]
  detailsById: Map<number, StravaActivity>
  segmentEffortsByActivityId: Map<number, StravaSegmentEffort[]>
}

/**
 * In-memory mock client for tests. Never touches network.
 */
export class MockStravaApiClient implements StravaApiClient {
  private data: MockStravaData

  constructor(data: MockStravaData) {
    this.data = data
  }

  async fetchActivities(page: number, perPage: number, options?: StravaListActivitiesOptions): Promise<StravaActivity[]> {
    let rows = this.data.activities.slice()

    if (typeof options?.after === 'number') {
      rows = rows.filter((a) => Math.floor(new Date(a.start_date).getTime() / 1000) >= options.after!)
    }
    if (typeof options?.before === 'number') {
      rows = rows.filter((a) => Math.floor(new Date(a.start_date).getTime() / 1000) <= options.before!)
    }

    const start = (page - 1) * perPage
    const end = start + perPage
    return rows.slice(start, end)
  }

  async fetchActivityDetails(activityId: number): Promise<StravaActivity | null> {
    return this.data.detailsById.get(activityId) ?? null
  }

  async fetchActivitySegmentEfforts(activityId: number): Promise<StravaSegmentEffort[]> {
    return this.data.segmentEffortsByActivityId.get(activityId) ?? []
  }

  async fetchSegmentEffortsForSegment(
    segmentId: number,
    page: number,
    perPage: number
  ): Promise<StravaSegmentEffort[]> {
    const all = Array.from(this.data.segmentEffortsByActivityId.values())
      .flat()
      .filter((effort) => effort.segment?.id === segmentId)
    const start = (page - 1) * perPage
    const end = start + perPage
    return all.slice(start, end)
  }

  async fetchSegmentById(segmentId: number): Promise<StravaSegment | null> {
    const match = Array.from(this.data.segmentEffortsByActivityId.values())
      .flat()
      .find((effort) => effort.segment?.id === segmentId)
    return match?.segment ?? null
  }
}

