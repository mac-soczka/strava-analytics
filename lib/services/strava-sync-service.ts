import { createClient } from '@supabase/supabase-js'
import { config } from '@/lib/config'
import { ActivitiesRepository } from '@/lib/repositories/activities-repository'
import { SegmentsRepository } from '@/lib/repositories/segments-repository'
import type { StravaApiClient } from '@/lib/strava/strava-api-client'
import type { StravaActivity, DatabaseActivity } from '@/types/strava'
import { getLogger } from '@/lib/utils/logger'

export type StravaSyncServiceDeps = {
  supabase?: ReturnType<typeof createClient>
  activitiesRepo?: ActivitiesRepository
  segmentsRepo?: SegmentsRepository
  sleep?: (_ms: number) => Promise<void>
}

/**
 * Request-minimizing sync logic.
 * Depends on StravaApiClient so we can test the logic without touching Strava.
 */
export class StravaSyncService {
  private supabase: ReturnType<typeof createClient>
  private activitiesRepo: ActivitiesRepository
  private segmentsRepo: SegmentsRepository
  private stravaId: number
  private api: StravaApiClient
  private sleep: (_ms: number) => Promise<void>

  constructor(stravaId: number, api: StravaApiClient, deps: StravaSyncServiceDeps = {}) {
    this.stravaId = stravaId
    this.api = api
    this.supabase = deps.supabase ?? createClient(config.supabase.url, config.supabase.serviceRoleKey)
    this.activitiesRepo = deps.activitiesRepo ?? new ActivitiesRepository()
    this.segmentsRepo = deps.segmentsRepo ?? new SegmentsRepository()
    this.sleep = deps.sleep ?? (async (ms) => new Promise((r) => setTimeout(r, ms)))
  }

  async syncActivities(
    pageSize = config.stravaApiLimits.maxCrawlerBatchSize,
    processBatchSize = 20,
    onProgress?: (_synced: number, _errors: number, _total: number) => Promise<void>
  ): Promise<{ synced: number; errors: number }> {
    let synced = 0
    let errors = 0
    let page = 1
    let hasMoreActivities = true
    let totalActivitiesSeen = 0

    const logger = getLogger()
    logger.log(`Starting activity sync (page size: ${pageSize}, batch size: ${processBatchSize})`)

    while (hasMoreActivities) {
      const activities = await this.api.fetchActivities(page, pageSize)

      if (activities.length === 0) {
        hasMoreActivities = false
        break
      }

      totalActivitiesSeen += activities.length
      await onProgress?.(synced, errors, totalActivitiesSeen)

      let newActivitiesThisPage = 0

      for (let i = 0; i < activities.length; i += processBatchSize) {
        const batch = activities.slice(i, i + processBatchSize)

        for (const activity of batch) {
          try {
            const existing = await this.activitiesRepo.getActivityById(activity.id)
            if (existing) {
              synced++
              continue
            }

            newActivitiesThisPage += 1

            let detailedActivity: StravaActivity
            let hasDetailedData = false

            const fetchedDetails = await this.api.fetchActivityDetails(activity.id)
            if (fetchedDetails) {
              detailedActivity = fetchedDetails
              hasDetailedData = true
            } else {
              detailedActivity = { ...activity, strava_url: `https://www.strava.com/activities/${activity.id}` }
              hasDetailedData = false
            }

            const activityData: Omit<DatabaseActivity, 'id'> = {
              strava_id: this.stravaId,
              activity_id: detailedActivity.id,
              name: detailedActivity.name,
              distance: detailedActivity.distance,
              moving_time: detailedActivity.moving_time,
              elapsed_time: detailedActivity.elapsed_time,
              total_elevation_gain: detailedActivity.total_elevation_gain,
              type: detailedActivity.type,
              start_date: detailedActivity.start_date,
              start_date_local: detailedActivity.start_date_local,
              average_speed: detailedActivity.average_speed,
              max_speed: detailedActivity.max_speed,
              average_watts: detailedActivity.average_watts,
              max_watts: detailedActivity.max_watts,
              average_heartrate: detailedActivity.average_heartrate,
              max_heartrate: detailedActivity.max_heartrate,
              polyline: detailedActivity.map?.polyline || detailedActivity.map?.summary_polyline,
              strava_url: detailedActivity.strava_url,
              activity_synced_at: new Date().toISOString(),
              activity_details_synced_at: hasDetailedData ? new Date().toISOString() : null,
            }
            await this.activitiesRepo.createActivity(activityData)

            if (hasDetailedData && detailedActivity.segment_efforts && detailedActivity.segment_efforts.length > 0) {
              const uniqueSegments = new Map<number, any>()
              for (const effort of detailedActivity.segment_efforts) {
                if (effort.segment && !uniqueSegments.has(effort.segment.id)) {
                  uniqueSegments.set(effort.segment.id, {
                    segment_id: effort.segment.id,
                    name: effort.segment.name,
                    distance: effort.segment.distance,
                    average_grade: effort.segment.average_grade,
                    maximum_grade: effort.segment.maximum_grade,
                    elevation_gain: (effort.segment.elevation_high || 0) - (effort.segment.elevation_low || 0),
                    climb_category: effort.segment.climb_category,
                    city: effort.segment.city,
                    state: effort.segment.state,
                    country: effort.segment.country,
                  })
                }
              }

              if (uniqueSegments.size > 0) {
                await this.segmentsRepo.bulkUpsertSegments(Array.from(uniqueSegments.values()))
              }

              const effortResult = await this.segmentsRepo.batchSaveEffortsFromStravaActivity(
                detailedActivity.id,
                detailedActivity.segment_efforts
              )

              await this.activitiesRepo.updateActivity(detailedActivity.id, {
                segment_efforts_synced_at: new Date().toISOString(),
                segments_fetch_status: 'success_rows',
                segments_fetched_at: new Date().toISOString(),
                segments_effort_rows_count: effortResult.saved,
              })
            } else if (hasDetailedData) {
              await this.activitiesRepo.updateActivity(detailedActivity.id, {
                segment_efforts_synced_at: new Date().toISOString(),
                segments_fetch_status: 'success_empty',
                segments_fetched_at: new Date().toISOString(),
                segments_effort_rows_count: 0,
              })
            }

            synced++
          } catch (_e) {
            errors++
          }
        }

        await onProgress?.(synced, errors, totalActivitiesSeen)
      }

      if (newActivitiesThisPage === 0) break

      page++
      if (page > 100) break
    }

    return { synced, errors }
  }

  async syncSegments(
    batchSize = config.stravaApiLimits.maxSegmentBatchSize,
    onProgress?: (_p: {
      processed: number
      errors: number
      total: number
      segmentsProcessed: number
      segmentEffortsProcessed: number
    }) => Promise<void>
  ): Promise<{ processed: number; segmentsAdded: number; errors: number }> {
    let processed = 0
    let segmentsAdded = 0
    let errors = 0
    let hasMoreActivities = true
    let activitiesHandled = 0
    const seenSegmentIds = new Set<number>()
    let segmentEffortsProcessed = 0

    const totalActivitiesNeedingSegments = await this.activitiesRepo.getActivitiesNeedingSegmentsCount(this.stravaId)
    if (totalActivitiesNeedingSegments === 0) {
      return { processed: 0, segmentsAdded: 0, errors: 0 }
    }

    await onProgress?.({
      processed: 0,
      errors: 0,
      total: totalActivitiesNeedingSegments,
      segmentsProcessed: 0,
      segmentEffortsProcessed: 0,
    })

    while (hasMoreActivities) {
      // Always read from offset=0 because each processed activity leaves the pending set.
      // Using a moving offset would skip rows as the filtered dataset shrinks.
      const activitiesNeedingSegments = await this.activitiesRepo.getActivitiesNeedingSegments(batchSize, 0, this.stravaId)
      if (!activitiesNeedingSegments || activitiesNeedingSegments.length === 0) break

      for (const activity of activitiesNeedingSegments) {
        try {
          const segmentEfforts = await this.api.fetchActivitySegmentEfforts(activity.activity_id)

          if (segmentEfforts.length > 0) {
            for (const effort of segmentEfforts) {
              seenSegmentIds.add(effort.segment.id)
            }
            segmentEffortsProcessed += segmentEfforts.length

            const segmentsFromEfforts = segmentEfforts.map((effort) => ({
              segment_id: effort.segment.id,
              name: effort.segment.name,
              distance: effort.segment.distance,
              elevation_gain: effort.segment.elevation_high - effort.segment.elevation_low,
              average_grade: effort.segment.average_grade,
              maximum_grade: effort.segment.maximum_grade,
              climb_category: effort.segment.climb_category,
              city: effort.segment.city,
              state: effort.segment.state,
              country: effort.segment.country,
              polyline: effort.segment.map?.polyline,
            }))

            const uniqueSegmentIds = Array.from(new Set(segmentsFromEfforts.map((s) => s.segment_id)))
            const existingIdsResult = await this.segmentsRepo.getExistingSegmentIds(uniqueSegmentIds)
            if (existingIdsResult.error) throw existingIdsResult.error
            const existingIds = new Set(existingIdsResult.data)

            const segmentsToInsert = segmentsFromEfforts
              .filter((s) => !existingIds.has(s.segment_id))
              .filter((s, idx, arr) => arr.findIndex((x) => x.segment_id === s.segment_id) === idx)

            if (segmentsToInsert.length > 0) {
              await this.segmentsRepo.bulkUpsertSegments(segmentsToInsert)
            }

            const segmentsToSave = segmentEfforts.map((effort) => ({
              activity_id: activity.activity_id,
              segment_id: effort.segment.id,
              effort_id: String(effort.id),
              effort_id_text: String(effort.id),
              elapsed_time: effort.elapsed_time,
              moving_time: effort.moving_time,
              start_date: effort.start_date,
              average_watts: effort.average_watts,
              max_watts: effort.max_watts,
            }))

            const existingEfforts = await this.segmentsRepo.getSegmentEffortsByActivity(activity.activity_id)
            const existingEffortIds = new Set(
              existingEfforts.data?.map((e) => e.effort_id_text ?? String(e.effort_id)) || []
            )
            const newEfforts = segmentsToSave.filter((effort) => !existingEffortIds.has(effort.effort_id_text))

            await this.segmentsRepo.bulkUpsertSegmentEfforts(segmentsToSave)
            segmentsAdded += newEfforts.length

            await this.activitiesRepo.markSegmentsFetchSuccessRows(activity.id, segmentEfforts.length)
          } else {
            await this.activitiesRepo.markSegmentsFetchSuccessEmpty(activity.id)
          }

          processed++
        } catch (_e) {
          errors++
          await this.activitiesRepo.markSegmentsFetchFailed(activity.id, 'Failed to fetch segments').catch(() => {})
        } finally {
          activitiesHandled++
          await onProgress?.({
            processed: activitiesHandled,
            errors,
            total: totalActivitiesNeedingSegments,
            segmentsProcessed: seenSegmentIds.size,
            segmentEffortsProcessed,
          })
        }
      }

      // small yield to keep polling UI responsive when used in job runner
      await this.sleep(0)
    }

    return { processed, segmentsAdded, errors }
  }

  async syncActivitiesBackfill(options: {
    beforeEpoch: number
    pageSize?: number
    processBatchSize?: number
    maxRequests?: number
    onProgress?: (p: {
      synced: number
      scanned: number
      errors: number
      requestsUsed: number
      cursorBeforeEpoch: number
    }) => Promise<void>
  }): Promise<{ synced: number; scanned: number; errors: number; newBeforeEpoch: number }> {
    const pageSize = options.pageSize ?? config.stravaApiLimits.maxActivitiesPerRequest
    const processBatchSize = options.processBatchSize ?? 20
    const maxRequests = options.maxRequests ?? 250

    let synced = 0
    let scanned = 0
    let errors = 0
    let requestsUsed = 0
    let cursorBeforeEpoch = options.beforeEpoch

    while (requestsUsed < maxRequests) {
      const activities = await this.api.fetchActivities(1, pageSize, { before: cursorBeforeEpoch })
      requestsUsed += 1

      if (activities.length === 0) break

      scanned += activities.length
      let oldestEpoch = cursorBeforeEpoch

      for (let i = 0; i < activities.length; i += processBatchSize) {
        const batch = activities.slice(i, i + processBatchSize)
        for (const activity of batch) {
          try {
            const existing = await this.activitiesRepo.getActivityById(activity.id)
            if (existing) continue

            const activityData: Omit<DatabaseActivity, 'id'> = {
              strava_id: this.stravaId,
              activity_id: activity.id,
              name: activity.name,
              distance: activity.distance,
              moving_time: activity.moving_time,
              elapsed_time: activity.elapsed_time,
              total_elevation_gain: activity.total_elevation_gain,
              type: activity.type,
              start_date: activity.start_date,
              start_date_local: activity.start_date_local,
              average_speed: activity.average_speed,
              max_speed: activity.max_speed,
              average_watts: activity.average_watts,
              max_watts: activity.max_watts,
              average_heartrate: activity.average_heartrate,
              max_heartrate: activity.max_heartrate,
              polyline: activity.map?.summary_polyline,
              strava_url: `https://www.strava.com/activities/${activity.id}`,
              activity_synced_at: new Date().toISOString(),
              activity_details_synced_at: null,
            }

            await this.activitiesRepo.createActivity(activityData)
            synced += 1
          } catch (_e) {
            errors += 1
          }
        }
      }

      for (const a of activities) {
        const epoch = Math.floor(new Date(a.start_date).getTime() / 1000)
        if (Number.isFinite(epoch) && epoch > 0) oldestEpoch = Math.min(oldestEpoch, epoch)
      }

      const nextCursor = Math.max(0, oldestEpoch - 1)
      if (nextCursor >= cursorBeforeEpoch) break
      cursorBeforeEpoch = nextCursor

      await options.onProgress?.({ synced, scanned, errors, requestsUsed, cursorBeforeEpoch })
    }

    return { synced, scanned, errors, newBeforeEpoch: cursorBeforeEpoch }
  }

  async syncActivitiesRecent(options: {
    afterEpoch: number
    recentWindowDays: number
    pageSize?: number
    processBatchSize?: number
    maxRequests?: number
    onProgress?: (p: { synced: number; errors: number; requestsUsed: number; cursorAfterEpoch: number }) => Promise<void>
  }): Promise<{ synced: number; errors: number; newAfterEpoch: number }> {
    const pageSize = options.pageSize ?? config.stravaApiLimits.maxActivitiesPerRequest
    const processBatchSize = options.processBatchSize ?? 20
    const maxRequests = options.maxRequests ?? 100

    const nowEpoch = Math.floor(Date.now() / 1000)
    const windowAfterEpoch = nowEpoch - Math.max(1, options.recentWindowDays) * 24 * 60 * 60
    const cursorAfterEpoch = Math.max(windowAfterEpoch, options.afterEpoch)

    let synced = 0
    let errors = 0
    let requestsUsed = 0
    let newestEpochSeen = cursorAfterEpoch

    let page = 1
    while (requestsUsed < maxRequests) {
      const activities = await this.api.fetchActivities(page, pageSize, { after: cursorAfterEpoch })
      requestsUsed += 1

      if (activities.length === 0) break

      for (let i = 0; i < activities.length; i += processBatchSize) {
        const batch = activities.slice(i, i + processBatchSize)
        for (const activity of batch) {
          try {
            const existing = await this.activitiesRepo.getActivityById(activity.id)
            if (existing) continue

            const activityData: Omit<DatabaseActivity, 'id'> = {
              strava_id: this.stravaId,
              activity_id: activity.id,
              name: activity.name,
              distance: activity.distance,
              moving_time: activity.moving_time,
              elapsed_time: activity.elapsed_time,
              total_elevation_gain: activity.total_elevation_gain,
              type: activity.type,
              start_date: activity.start_date,
              start_date_local: activity.start_date_local,
              average_speed: activity.average_speed,
              max_speed: activity.max_speed,
              average_watts: activity.average_watts,
              max_watts: activity.max_watts,
              average_heartrate: activity.average_heartrate,
              max_heartrate: activity.max_heartrate,
              polyline: activity.map?.summary_polyline,
              strava_url: `https://www.strava.com/activities/${activity.id}`,
              activity_synced_at: new Date().toISOString(),
              activity_details_synced_at: null,
            }

            await this.activitiesRepo.createActivity(activityData)
            synced += 1
          } catch (_e) {
            errors += 1
          }

          const epoch = Math.floor(new Date(activity.start_date).getTime() / 1000)
          if (Number.isFinite(epoch) && epoch > 0) newestEpochSeen = Math.max(newestEpochSeen, epoch)
        }
      }

      await options.onProgress?.({ synced, errors, requestsUsed, cursorAfterEpoch: newestEpochSeen })
      page += 1
      if (page > 50) break
    }

    return { synced, errors, newAfterEpoch: newestEpochSeen }
  }
}

