import { createClient } from '@supabase/supabase-js'
import { config } from '@/lib/config'
import { ActivitiesRepository } from '@/lib/repositories/activities-repository'
import { SegmentsRepository } from '@/lib/repositories/segments-repository'
import type { StravaActivity, StravaSegment, StravaSegmentEffort, DatabaseActivity } from '@/types/strava'
import { RealStravaApiClient, type RealStravaApiClientDeps } from '@/lib/strava/real-strava-api-client'
import type { StravaApiClient } from '@/lib/strava/strava-api-client'
import { StravaSyncService } from '@/lib/services/strava-sync-service'
import { getRateLimitService } from '@/lib/services/rate-limit-service'
import { SegmentTargetSyncStateRepository } from '@/lib/repositories/segment-target-sync-state-repository'

export type StravaServiceDeps = {
  apiClient?: StravaApiClient
  apiClientDeps?: RealStravaApiClientDeps
  syncService?: StravaSyncService
}

/**
 * Backwards-compatible facade.
 *
 * - Network calls are isolated in StravaApiClient (Real vs Mock).
 * - Request-minimizing sync logic lives in StravaSyncService.
 */
export class StravaService {
  private supabase: ReturnType<typeof createClient>
  private activitiesRepo: ActivitiesRepository
  private segmentsRepo: SegmentsRepository
  private apiClient: StravaApiClient
  private sync: StravaSyncService
  private userId?: number

  constructor(userId?: number, deps: StravaServiceDeps = {}) {
    this.supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey)
    this.activitiesRepo = new ActivitiesRepository()
    this.segmentsRepo = new SegmentsRepository()
    this.userId = userId

    if (!deps.apiClient) {
      if (!userId) throw new Error('userId is required for StravaService')
    }

    this.apiClient = deps.apiClient ?? new RealStravaApiClient(userId!, deps.apiClientDeps)
    this.sync = deps.syncService ?? new StravaSyncService(userId!, this.apiClient)
  }

  getRateLimitStatus() {
    return getRateLimitService().getStatus()
  }

  fetchActivities(
    page = 1,
    perPage = config.stravaApiLimits.maxActivitiesPerRequest,
    options?: { before?: number; after?: number }
  ): Promise<StravaActivity[]> {
    return this.apiClient.fetchActivities(page, perPage, options)
  }

  fetchActivityDetails(activityId: number): Promise<StravaActivity | null> {
    return this.apiClient.fetchActivityDetails(activityId)
  }

  fetchActivitySegments(activityId: number): Promise<StravaSegmentEffort[]> {
    return this.apiClient.fetchActivitySegmentEfforts(activityId)
  }

  fetchSegmentById(segmentId: number): Promise<StravaSegment | null> {
    return this.apiClient.fetchSegmentById(segmentId)
  }

  syncActivitiesBackfill(options: {
    beforeEpoch: number
    pageSize?: number
    processBatchSize?: number
    maxRequests?: number
    onProgress?: (p: { synced: number; errors: number; requestsUsed: number; cursorBeforeEpoch: number }) => Promise<void>
  }) {
    return this.sync.syncActivitiesBackfill(options)
  }

  syncActivitiesRecent(options: {
    afterEpoch: number
    recentWindowDays: number
    pageSize?: number
    processBatchSize?: number
    maxRequests?: number
    onProgress?: (p: { synced: number; errors: number; requestsUsed: number; cursorAfterEpoch: number }) => Promise<void>
  }) {
    return this.sync.syncActivitiesRecent(options)
  }

  /**
   * Check current sync status and data coverage
   */
  async getSyncStatus() {
    try {
      const [totalActivities, activitiesNeedingSegments, totalSegments] = await Promise.all([
        this.activitiesRepo.getActivityStats(),
        this.activitiesRepo.getActivitiesNeedingSegmentsCount(this.userId),
        this.segmentsRepo.getSegmentStats()
      ])

      // Get total segment efforts count
      const { count: totalSegmentEfforts } = await this.supabase
        .from('segment_efforts')
        .select('*', { count: 'exact', head: true })

      const activitiesWithSegments = totalActivities.totalActivities - activitiesNeedingSegments
      const segmentCoverage = totalActivities.totalActivities > 0 
        ? Math.round((activitiesWithSegments / totalActivities.totalActivities) * 100) 
        : 0

      return {
        activities: {
          total: totalActivities.totalActivities,
          needingSegments: activitiesNeedingSegments,
          withSegments: activitiesWithSegments,
          coverage: `${segmentCoverage}%`
        },
        segments: {
          total: totalSegments.data?.total_segments || 0,
          efforts: totalSegmentEfforts || 0
        },
        summary: {
          needsSync: activitiesNeedingSegments > 0,
          syncRequired: activitiesNeedingSegments > 0 ? `Need to fetch segments for ${activitiesNeedingSegments} activities` : 'All activities have segments fetched',
          dataComplete: activitiesNeedingSegments === 0
        }
      }
    } catch (error) {
      console.error('Error getting sync status:', error)
      throw error
    }
  }

  /**
   * Comprehensive sync: Fetch ALL activities, then ALL segments for ALL activities
   * This ensures complete data coverage
   */
  async syncAllData(): Promise<{
    activities: { synced: number; errors: number }
    segments: { processed: number; segmentsAdded: number; errors: number }
    segmentEfforts: { total: number }
    totalExecutionTime: number
  }> {
    const startTime = Date.now()
    
    console.log('Starting comprehensive Strava data sync...')
    console.log('Sequence: 1. Fetch ALL activities -> 2. Fetch ALL segments for ALL activities')
    
    try {
      // Step 1: Sync ALL activities
      console.log('\nSTEP 1: Syncing ALL activities from Strava...')
      const activityResult = await this.syncActivities()
      
      // Step 2: Sync ALL segments for ALL activities
      console.log('\nSTEP 2: Syncing ALL segments for ALL activities...')
      const segmentResult = await this.syncSegments()
      
      // Step 3: Get total segment efforts count
      const { count: totalSegmentEfforts } = await this.supabase
        .from('segment_efforts')
        .select('*', { count: 'exact', head: true })
      
      const totalExecutionTime = Date.now() - startTime
      
      const summary = {
        activities: activityResult,
        segments: segmentResult,
        segmentEfforts: { total: totalSegmentEfforts || 0 },
        totalExecutionTime
      }
      
      console.log('\nComprehensive sync completed!')
      console.log(`Summary:`)
      console.log(`   Activities: ${activityResult.synced} synced, ${activityResult.errors} errors`)
      console.log(`   Segments: ${segmentResult.processed} activities processed, ${segmentResult.segmentsAdded} segments added, ${segmentResult.errors} errors`)
      console.log(`   Segment Efforts: ${totalSegmentEfforts || 0} total efforts`)
      console.log(`   Total time: ${Math.round(totalExecutionTime / 1000)}s`)
      
      return summary
      
    } catch (error) {
      console.error('Error in comprehensive sync:', error)
      throw error
    }
  }

  /**
   * Sync activities from Strava to database
   * Fetches activities in pages and processes in batches
   */
  async syncActivities(
    pageSize = config.stravaApiLimits.maxCrawlerBatchSize,
    processBatchSize = 20, // Process 20 activities at a time
    onProgress?: (_synced: number, _errors: number, _total: number) => Promise<void>
  ): Promise<{ synced: number; errors: number }> {
    return this.sync.syncActivities(pageSize, processBatchSize, onProgress)
  }

  /**
   * Sync segment efforts for activities that don't have them yet
   * Uses embedded data from activity response - no extra requests!
   */
  async syncPendingSegmentEfforts(
    batchSize = 20,
    onProgress?: (processed: number, total: number) => Promise<void>
  ): Promise<{ processed: number; errors: number }> {
    let processed = 0
    let errors = 0
    
    try {
      // Get activities that need segment efforts (status = 'pending')
      const { data: pendingActivities, error } = await this.supabase
        .from('activities')
        .select('activity_id, name')
        .eq('segments_fetch_status', 'pending')
        .order('start_date', { ascending: false })
      
      if (error) {
        console.error('Error fetching pending activities:', error)
        throw error
      }
      
      if (!pendingActivities || pendingActivities.length === 0) {
        console.log('No pending activities found')
        return { processed: 0, errors: 0 }
      }
      
      const total = pendingActivities.length
      console.log(`Found ${total} activities needing segment efforts`)
      
      // Process in batches
      for (let i = 0; i < pendingActivities.length; i += batchSize) {
        const batch = pendingActivities.slice(i, i + batchSize)
        
        for (const activity of batch) {
          try {
            // Fetch detailed activity (includes segment_efforts)
            const detailed = await this.fetchActivityDetails(activity.activity_id as number)
            
            if (!detailed) {
              console.log(`Rate limit reached, skipping activity ${activity.activity_id}`)
              continue
            }
            
            // Extract and save segment efforts if present
            if (detailed.segment_efforts && detailed.segment_efforts.length > 0) {
              console.log(`Extracting ${detailed.segment_efforts.length} segment efforts for activity ${detailed.id}...`)
              
              // Save segments first
              const uniqueSegments = new Map()
              for (const effort of detailed.segment_efforts) {
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
              
              // Save segment efforts with ALL fields
              const effortResult = await this.segmentsRepo.batchSaveEffortsFromStravaActivity(
                detailed.id,
                detailed.segment_efforts
              )
              console.log(`Saved ${effortResult.saved} segment efforts (${effortResult.errors} errors)`)
              
              // Update activity sync status
              await this.activitiesRepo.updateActivity(detailed.id, {
                segment_efforts_synced_at: new Date().toISOString(),
                segments_fetch_status: 'success_rows',
                segments_fetched_at: new Date().toISOString(),
                segments_effort_rows_count: effortResult.saved
              })
            } else {
              // Activity has no segment efforts
              await this.activitiesRepo.updateActivity(detailed.id, {
                segment_efforts_synced_at: new Date().toISOString(),
                segments_fetch_status: 'success_empty',
                segments_fetched_at: new Date().toISOString(),
                segments_effort_rows_count: 0
              })
            }
            
            processed++
            
            // Report progress
            if (onProgress) {
              await onProgress(processed, total)
            }
          } catch (error) {
            console.error(`Error syncing efforts for activity ${activity.activity_id}:`, error)
            errors++
          }
        }
      }
      
      console.log(`Pending segment efforts sync complete: ${processed} processed, ${errors} errors`)
    } catch (error) {
      console.error('Error in syncPendingSegmentEfforts:', error)
      throw error
    }
    
    return { processed, errors }
  }

  /**
   * Sync segments for ALL activities that need them
   * Processes ALL activities, not just a limited batch
   */
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
    return this.sync.syncSegments(batchSize, onProgress)
  }

  async syncSegmentEffortsForSegment(
    segmentId: number,
    onProgress?: (_p: { processed: number; saved: number; errors: number; total: number }) => Promise<void>
  ): Promise<{ processed: number; saved: number; errors: number }> {
    const pageSize = 200
    const maxPages = 200
    let page = 1
    let processed = 0
    let saved = 0
    let errors = 0
    let total = 0
    let segmentUpserted = false
    const knownActivities = new Set<number>()

    const ensureActivityExists = async (activityId: number, effortDate: string) => {
      if (knownActivities.has(activityId)) return true

      const existingActivity = await this.activitiesRepo.getActivityById(activityId)
      if (!existingActivity) {
        if (!this.userId) return false
        await this.activitiesRepo.createActivity({
          strava_id: this.userId,
          activity_id: activityId,
          name: `Segment Effort Activity ${activityId}`,
          distance: 0,
          moving_time: 0,
          elapsed_time: 0,
          total_elevation_gain: 0,
          type: 'Unknown',
          start_date: effortDate,
          start_date_local: effortDate,
          strava_url: `https://www.strava.com/activities/${activityId}`,
          activity_synced_at: new Date().toISOString(),
          activity_details_synced_at: null,
        })
      }
      knownActivities.add(activityId)
      return true
    }

    const ensureActivityFromSummary = async (activity: StravaActivity) => {
      if (!this.userId) return false
      const existingActivity = await this.activitiesRepo.getActivityById(activity.id)
      if (existingActivity) {
        knownActivities.add(activity.id)
        return true
      }
      await this.activitiesRepo.createActivity({
        strava_id: this.userId,
        activity_id: activity.id,
        name: activity.name || `Activity ${activity.id}`,
        distance: activity.distance || 0,
        moving_time: activity.moving_time || 0,
        elapsed_time: activity.elapsed_time || 0,
        total_elevation_gain: activity.total_elevation_gain || 0,
        type: activity.type || 'Unknown',
        start_date: activity.start_date || new Date().toISOString(),
        start_date_local: activity.start_date_local || activity.start_date || new Date().toISOString(),
        strava_url: `https://www.strava.com/activities/${activity.id}`,
        activity_synced_at: new Date().toISOString(),
        activity_details_synced_at: null,
      })
      knownActivities.add(activity.id)
      return true
    }

    const getCoveredActivityIds = async (activityIds: number[]): Promise<Set<number>> => {
      if (!this.userId || activityIds.length === 0) return new Set<number>()
      const { data } = await this.supabase
        .from('activities')
        .select('activity_id, segments_fetch_status, segment_efforts_synced_at')
        .eq('strava_id', this.userId)
        .in('activity_id', activityIds)
      const covered = new Set<number>()
      for (const row of data || []) {
        const status = (row as any).segments_fetch_status
        const syncedAt = (row as any).segment_efforts_synced_at
        if ((status === 'success_rows' || status === 'success_empty') && syncedAt) {
          covered.add((row as any).activity_id)
        }
      }
      return covered
    }

    const persistNonTargetEffortsForActivity = async (
      activityId: number,
      allEfforts: StravaSegmentEffort[],
      targetSegmentId: number
    ) => {
      const nonTargetEfforts = allEfforts.filter((effort) => effort.segment?.id !== targetSegmentId)
      if (nonTargetEfforts.length === 0) return

      const nonTargetSegments = new Map<number, any>()
      for (const effort of nonTargetEfforts) {
        const segment = effort.segment
        if (!segment || nonTargetSegments.has(segment.id)) continue
        nonTargetSegments.set(segment.id, {
          segment_id: segment.id,
          name: segment.name,
          distance: segment.distance,
          average_grade: segment.average_grade,
          maximum_grade: segment.maximum_grade,
          elevation_gain: (segment.elevation_high || 0) - (segment.elevation_low || 0),
          climb_category: segment.climb_category,
          city: segment.city,
          state: segment.state,
          country: segment.country,
          polyline: segment.map?.polyline,
        })
      }
      if (nonTargetSegments.size > 0) {
        await this.segmentsRepo.bulkUpsertSegments(Array.from(nonTargetSegments.values()))
      }
      await this.segmentsRepo.batchSaveEffortsFromStravaActivity(activityId, nonTargetEfforts)
    }

    const persistEfforts = async (efforts: StravaSegmentEffort[]) => {
      if (efforts.length === 0) return

      if (!segmentUpserted) {
        const segment = efforts.find((e) => e.segment?.id === segmentId)?.segment
        if (segment) {
          await this.segmentsRepo.upsertSegment({
            segment_id: segment.id,
            name: segment.name,
            distance: segment.distance,
            average_grade: segment.average_grade,
            maximum_grade: segment.maximum_grade,
            elevation_gain: (segment.elevation_high || 0) - (segment.elevation_low || 0),
            climb_category: segment.climb_category,
            city: segment.city,
            state: segment.state,
            country: segment.country,
            polyline: segment.map?.polyline,
          })
          segmentUpserted = true
        }
      }

      for (const effort of efforts) {
        processed += 1
        try {
          const activityId = Number((effort as any)?.activity?.id)
          if (!Number.isFinite(activityId) || activityId <= 0) {
            errors += 1
            continue
          }

          const effortDate = effort.start_date || new Date().toISOString()
          const ready = await ensureActivityExists(activityId, effortDate)
          if (!ready) {
            errors += 1
            continue
          }

          const result = await this.segmentsRepo.saveEffortFromStravaActivity(activityId, effort)
          if (result.error) {
            errors += 1
          } else {
            saved += 1
          }
        } catch (_error) {
          errors += 1
        }
      }
    }

    let useActivityFallback = false
    while (page <= maxPages) {
      if (useActivityFallback) break

      let efforts: StravaSegmentEffort[] = []
      try {
        efforts = await this.apiClient.fetchSegmentEffortsForSegment(segmentId, page, pageSize)
      } catch (error: any) {
        if (error?.statusCode === 402) {
          // Some Strava accounts cannot access /segments/{id}/all_efforts.
          // Fallback to recent-first activity scan and extract matching efforts.
          useActivityFallback = true
          break
        }
        throw error
      }
      if (efforts.length === 0) break

      total += efforts.length
      await persistEfforts(efforts)

      await onProgress?.({ processed, saved, errors, total })

      if (efforts.length < pageSize) break
      page += 1
    }

    if (useActivityFallback) {
      if (!this.userId) {
        throw new Error('userId is required for segment-target fallback sync')
      }

      const stateRepo = new SegmentTargetSyncStateRepository()
      const activitiesPageSize = 200
      const maxPagesPerWindow = 30
      const maxWindowsPerRun = 6
      const oneDaySeconds = 24 * 60 * 60
      const monthlyWindowSeconds = 30 * oneDaySeconds
      const fiveYearsSeconds = 5 * 365 * oneDaySeconds
      const nowEpoch = Math.floor(Date.now() / 1000)
      const fiveYearsAgoEpoch = Math.max(0, nowEpoch - fiveYearsSeconds)

      const { data: latestKnownEffort } = await this.supabase
        .from('segment_efforts')
        .select('start_date')
        .eq('segment_id', segmentId)
        .order('start_date', { ascending: false })
        .limit(1)
        .maybeSingle()

      const syncState = await stateRepo.getOrCreate(this.userId, segmentId, nowEpoch, fiveYearsAgoEpoch)
      let fallbackMode = syncState.mode

      const backfillAfterSeed = syncState.backfill_after_epoch ?? fiveYearsAgoEpoch
      if (backfillAfterSeed >= nowEpoch) {
        fallbackMode = 'incremental'
      }

      if (latestKnownEffort?.start_date && typeof latestKnownEffort.start_date === 'string') {
        const epoch = Math.floor(new Date(latestKnownEffort.start_date).getTime() / 1000)
        if (Number.isFinite(epoch) && epoch > 0) {
          await stateRepo.update(this.userId, segmentId, {
            incremental_after_epoch:
              syncState.incremental_after_epoch ?? Math.max(fiveYearsAgoEpoch, epoch - oneDaySeconds),
          })
        }
      }

      if (fallbackMode === 'incremental') {
        const fallbackAfterEpoch = Math.max(
          fiveYearsAgoEpoch,
          (syncState.incremental_after_epoch ?? fiveYearsAgoEpoch) - oneDaySeconds
        )
        let activitiesPage = 1
        while (activitiesPage <= maxPagesPerWindow) {
          const activities = await this.apiClient.fetchActivities(activitiesPage, activitiesPageSize, {
            after: fallbackAfterEpoch,
          })
          if (activities.length === 0) break

          const coveredIds = await getCoveredActivityIds(activities.map((a) => a.id))

          for (const activity of activities) {
            try {
              await ensureActivityFromSummary(activity)
              if (coveredIds.has(activity.id)) continue

              const details = await this.apiClient.fetchActivityDetails(activity.id)
              if (!details || !details.segment_efforts || details.segment_efforts.length === 0) {
                await this.activitiesRepo.updateActivity(activity.id, {
                  activity_details_synced_at: new Date().toISOString(),
                  segment_efforts_synced_at: new Date().toISOString(),
                  segments_fetch_status: 'success_empty',
                  segments_fetched_at: new Date().toISOString(),
                  segments_fetched: true,
                  segments_effort_rows_count: 0,
                } as any)
                continue
              }

              const matchingEfforts = details.segment_efforts
                .filter((effort) => effort.segment?.id === segmentId)
                .map((effort) => ({
                  ...effort,
                  activity: { id: details.id },
                }))

              total += matchingEfforts.length
              await persistEfforts(matchingEfforts)
              await persistNonTargetEffortsForActivity(details.id, details.segment_efforts, segmentId)
              await this.activitiesRepo.updateActivity(details.id, {
                activity_details_synced_at: new Date().toISOString(),
                segment_efforts_synced_at: new Date().toISOString(),
                segments_fetch_status: details.segment_efforts.length > 0 ? 'success_rows' : 'success_empty',
                segments_fetched_at: new Date().toISOString(),
                segments_fetched: true,
                segments_effort_rows_count: details.segment_efforts.length,
              } as any)
            } catch (error: any) {
              if (error?.statusCode === 429) throw error
              errors += 1
            }
          }

          await onProgress?.({ processed, saved, errors, total })

          if (activities.length < activitiesPageSize) break
          activitiesPage += 1
        }

        await stateRepo.update(this.userId, segmentId, {
          mode: 'incremental',
          incremental_after_epoch: nowEpoch,
        })
      } else {
        // Oldest-first strategy:
        // walk forward from 5 years ago in monthly windows and checkpoint each window.
        let backfillAfterEpoch = syncState.backfill_after_epoch ?? fiveYearsAgoEpoch
        let windowsProcessed = 0

        while (backfillAfterEpoch < nowEpoch && windowsProcessed < maxWindowsPerRun) {
          const windowBeforeEpoch = Math.min(nowEpoch, backfillAfterEpoch + monthlyWindowSeconds)
          let activitiesPage = 1

          while (activitiesPage <= maxPagesPerWindow) {
            const activities = await this.apiClient.fetchActivities(activitiesPage, activitiesPageSize, {
              before: windowBeforeEpoch,
              after: backfillAfterEpoch,
            })
            if (activities.length === 0) break

            const coveredIds = await getCoveredActivityIds(activities.map((a) => a.id))

            for (const activity of activities) {
              try {
                await ensureActivityFromSummary(activity)
                if (coveredIds.has(activity.id)) continue

                const details = await this.apiClient.fetchActivityDetails(activity.id)
                if (!details || !details.segment_efforts || details.segment_efforts.length === 0) {
                  await this.activitiesRepo.updateActivity(activity.id, {
                    activity_details_synced_at: new Date().toISOString(),
                    segment_efforts_synced_at: new Date().toISOString(),
                    segments_fetch_status: 'success_empty',
                    segments_fetched_at: new Date().toISOString(),
                    segments_fetched: true,
                    segments_effort_rows_count: 0,
                  } as any)
                  continue
                }

                const matchingEfforts = details.segment_efforts
                  .filter((effort) => effort.segment?.id === segmentId)
                  .map((effort) => ({
                    ...effort,
                    activity: { id: details.id },
                  }))

                total += matchingEfforts.length
                await persistEfforts(matchingEfforts)
                await persistNonTargetEffortsForActivity(details.id, details.segment_efforts, segmentId)
                await this.activitiesRepo.updateActivity(details.id, {
                  activity_details_synced_at: new Date().toISOString(),
                  segment_efforts_synced_at: new Date().toISOString(),
                  segments_fetch_status: details.segment_efforts.length > 0 ? 'success_rows' : 'success_empty',
                  segments_fetched_at: new Date().toISOString(),
                  segments_fetched: true,
                  segments_effort_rows_count: details.segment_efforts.length,
                } as any)
              } catch (error: any) {
                if (error?.statusCode === 429) throw error
                errors += 1
              }
            }

            await stateRepo.update(this.userId, segmentId, {
              mode: 'backfill',
              backfill_after_epoch: backfillAfterEpoch,
              backfill_before_epoch: windowBeforeEpoch,
              last_activity_id: activities[activities.length - 1]?.id ?? null,
            })

            await onProgress?.({ processed, saved, errors, total })

            if (activities.length < activitiesPageSize) break
            activitiesPage += 1
          }

          backfillAfterEpoch = windowBeforeEpoch
          windowsProcessed += 1

          await stateRepo.update(this.userId, segmentId, {
            mode: 'backfill',
            backfill_after_epoch: backfillAfterEpoch,
            backfill_before_epoch: windowBeforeEpoch,
            last_activity_id: null,
          })
        }

        if (backfillAfterEpoch >= nowEpoch) {
          await stateRepo.update(this.userId, segmentId, {
            mode: 'incremental',
            backfill_after_epoch: nowEpoch,
            backfill_before_epoch: nowEpoch,
            incremental_after_epoch: nowEpoch,
            last_activity_id: null,
          })
        }
      }
    }

    return { processed, saved, errors }
  }

  /**
   * Get comprehensive activity statistics
   */
  async getActivityStatistics() {
    const [activityStats, segmentStats] = await Promise.all([
      this.activitiesRepo.getActivityStats(),
      this.segmentsRepo.getSegmentStats()
    ])

    return {
      activities: activityStats,
      segments: segmentStats.data,
      summary: {
        totalActivities: activityStats.totalActivities,
        totalDistance: activityStats.totalDistance,
        totalTime: activityStats.totalTime,
        totalElevation: activityStats.totalElevation,
        totalSegments: segmentStats.data?.total_segments || 0,
        uniqueSegments: segmentStats.data?.total_segments || 0,
      }
    }
  }

  /**
   * Search activities by name
   */
  async searchActivities(searchTerm: string, limit = 20) {
    const { data, error } = await this.supabase
      .from('activities')
      .select('*')
      .ilike('name', `%${searchTerm}%`)
      .order('start_date', { ascending: false })
      .limit(limit)

    if (error) throw error
    return data
  }

  /**
   * Update existing activities with missing polyline and strava_url data
   * This is a separate process that can be run independently
   */
  async updateActivitiesWithMissingData(limit = 10): Promise<{ updated: number; errors: number }> {
    let updated = 0
    let errors = 0

    try {
      console.log(`🔄 Starting update of activities with missing data (limit: ${limit})`)
      
      // Get activities that are missing polyline or strava_url
      const { data: activitiesNeedingUpdate, error } = await this.supabase
        .from('activities')
        .select('activity_id, name')
        .or('polyline.is.null,strava_url.is.null')
        .eq('strava_id', this.userId!)
        .limit(limit)

      if (error) throw error

      if (!activitiesNeedingUpdate || activitiesNeedingUpdate.length === 0) {
        console.log('No activities need updating')
        return { updated: 0, errors: 0 }
      }

      console.log(`Found ${activitiesNeedingUpdate.length} activities needing updates`)

      for (const activity of activitiesNeedingUpdate) {
        try {
          console.log(`Updating activity ${activity.activity_id}...`)
          
          // Fetch detailed activity data
          const detailedActivity = await this.fetchActivityDetails(activity.activity_id as number)
          
          if (!detailedActivity) {
            console.log(`Rate limit reached, skipping update for activity ${activity.activity_id}`)
            continue
          }
          
          // Update the activity with missing data
          const updateData: Partial<DatabaseActivity> = {
            average_speed: detailedActivity.average_speed,
            max_speed: detailedActivity.max_speed,
            average_watts: detailedActivity.average_watts,
            max_watts: detailedActivity.max_watts,
            average_heartrate: detailedActivity.average_heartrate,
            max_heartrate: detailedActivity.max_heartrate,
            polyline: detailedActivity.map?.polyline || detailedActivity.map?.summary_polyline,
            strava_url: detailedActivity.strava_url,
          }

          const { error: updateError } = await this.supabase
            .from('activities')
            .update(updateData)
            .eq('activity_id', activity.activity_id as number)

          if (updateError) throw updateError

          updated++
          console.log(`Updated activity: ${activity.name}`)

        } catch (error) {
          console.error(`Error updating activity ${activity.activity_id}:`, error)
          errors++
        }
      }

      console.log(`Activity update completed: ${updated} updated, ${errors} errors`)
    } catch (error) {
      console.error('Error in updateActivitiesWithMissingData:', error)
      throw error
    }

    return { updated, errors }
  }

  /**
   * Get activity with full details including segments
   */
  async getActivityDetails(activityId: number) {
    const activity = await this.activitiesRepo.getActivityWithSegments(activityId)
    
    if (!activity) {
      throw new Error(`Activity ${activityId} not found`)
    }

    return activity
  }
}