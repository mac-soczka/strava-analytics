import type { StravaActivity, StravaSegmentEffort } from '@/types/strava'

export type StravaListActivitiesOptions = {
  before?: number
  after?: number
}

/**
 * The only layer allowed to touch the Strava network.
 * Sync logic should depend on this interface so it can be tested with a mock client.
 */
export interface StravaApiClient {
  fetchActivities(page: number, perPage: number, options?: StravaListActivitiesOptions): Promise<StravaActivity[]>
  fetchActivityDetails(activityId: number): Promise<StravaActivity | null>
  fetchActivitySegmentEfforts(activityId: number): Promise<StravaSegmentEffort[]>
}

