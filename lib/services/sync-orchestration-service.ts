import { SyncJobsRepository, SyncJob, SyncJobProgress } from '../repositories/sync-jobs-repository'
import { StravaService } from './strava-service'
import { createClient } from '@supabase/supabase-js'
import config from '@/lib/config'
import { StravaSyncStateRepository } from '@/lib/repositories/strava-sync-state-repository'
import { getLogger } from '@/lib/utils/logger'

export class SyncOrchestrationService {
  private jobsRepo: SyncJobsRepository
  private stravaService: StravaService
  private syncStateRepo: StravaSyncStateRepository
  private supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey)
  private logger = getLogger()

  constructor(stravaId: number, deps?: { stravaService?: StravaService }) {
    this.jobsRepo = new SyncJobsRepository()
    this.stravaService = deps?.stravaService ?? new StravaService(stravaId)
    this.syncStateRepo = new StravaSyncStateRepository()
  }

  private async getDbActivityCount(stravaId: number): Promise<number> {
    const { count, error } = await this.supabase
      .from('activities')
      .select('activity_id', { count: 'exact', head: true })
      .eq('strava_id', stravaId)
    if (error) return 0
    return count || 0
  }

  private async runJob(job: SyncJob): Promise<void> {
    try {
      await this.jobsRepo.updateJobStatus(job.id, 'running')

      switch (job.type) {
        case 'activities_only':
          await this.runActivitiesOnly(job)
          break
        case 'segment_efforts_only':
          await this.runSegmentEffortsOnly(job)
          break
        case 'segments_only':
          await this.runSegmentsOnly(job)
          break
        case 'full_sync':
        default:
          await this.runFullSync(job)
          break
      }
    } catch (error: any) {
      // Rate limits are expected and are handled via pauseJob inside run steps.
      if (job.status !== 'paused') {
        this.logger.error(`[Job ${job.id}] Sync failed`, error)
        await this.jobsRepo.updateJobStatus(job.id, 'failed', {
          current_phase: 'failed',
          error_message: error?.message || 'Unknown error',
          error_details: { stack: error?.stack },
        })
      }
      throw error
    }
  }

  private async setPhase(jobId: string, phase: 'discover_activities' | 'ensure_segments' | 'ensure_segment_efforts' | 'completed' | 'failed') {
    await this.jobsRepo.updateJobStatus(jobId, 'running', { current_phase: phase })
  }

  private async pauseForRateLimit(
    jobId: string,
    reasonPrefix: string,
    error: any,
    stateUpdates?: Partial<SyncJob>
  ) {
    const retryAfterMs = typeof error?.retryAfter === 'number' ? error.retryAfter : 15 * 60 * 1000
    const effectiveRetryAfterMs = Math.max(60_000, retryAfterMs)
    const resumeAt = new Date(Date.now() + effectiveRetryAfterMs)

    this.logger.warn(
      `[Job ${jobId}] Pausing for rate limit. Retry after: ${effectiveRetryAfterMs}ms. Resume at: ${resumeAt.toISOString()}`
    )
    const rateLimitStatus = this.stravaService.getRateLimitStatus()

    const job = await this.jobsRepo.getJobById(jobId)
    if (job) {
      const entityType =
        reasonPrefix.toLowerCase().includes('activity') ? 'activities'
        : reasonPrefix.toLowerCase().includes('segment effort') ? 'segment_efforts'
        : reasonPrefix.toLowerCase().includes('segment') ? 'segments'
        : 'unknown'

      await this.jobsRepo.logEvent({
        jobId,
        stravaId: job.strava_id,
        eventType: 'rate_limit_paused',
        entityType,
        message: `${reasonPrefix} - will resume at ${resumeAt.toISOString()}`,
        stats: {
          status: job.status,
          type: job.type,
          processed_items: job.processed_items,
          failed_items: job.failed_items,
          progress: job.progress,
          last_processed_activity_id: job.last_processed_activity_id ?? null,
        },
        rateLimit: {
          retryAfterMs: effectiveRetryAfterMs,
          resumeAt: resumeAt.toISOString(),
          raw: typeof error === 'object' ? { ...error } : String(error),
        },
      })
    }

    const lastProcessedActivityId = Number(stateUpdates?.last_processed_activity_id ?? 0) || 0
    await this.jobsRepo.pauseJob(
      jobId,
      lastProcessedActivityId,
      `${reasonPrefix} - will resume at ${resumeAt.toISOString()}`,
      resumeAt
    )
    await this.jobsRepo.updateJobStatus(jobId, 'paused', {
      ...(stateUpdates ?? {}),
      requests_used_15m: rateLimitStatus.requests15min,
      requests_used_daily: rateLimitStatus.requestsDay,
      rate_limit_15m_reset_at: rateLimitStatus.nextReset15min.toISOString(),
      rate_limit_daily_reset_at: rateLimitStatus.nextResetDaily.toISOString(),
    })
  }

  async startFullSync(stravaId: number): Promise<SyncJob> {
    const activeJob = await this.jobsRepo.getActiveJobForUser(stravaId)
    if (activeJob) {
      throw new Error('A sync job is already running for this user')
    }

    const job = await this.jobsRepo.createJob(stravaId, 'full_sync')

    this.runJob(job).catch((error: any) => {
      this.logger.error(`Sync job ${job.id} failed`, error)
      this.jobsRepo.markJobFailed(job.id, error?.message || 'Unknown error', { stack: error?.stack })
    })

    return job
  }

  async startSegmentsSync(stravaId: number): Promise<SyncJob> {
    const activeJob = await this.jobsRepo.getActiveJobForUser(stravaId)
    if (activeJob) {
      throw new Error('A sync job is already running for this user')
    }

    const job = await this.jobsRepo.createJob(stravaId, 'segments_only')

    this.runJob(job).catch((error: any) => {
      this.logger.error(`Sync job ${job.id} failed`, error)
      this.jobsRepo.markJobFailed(job.id, error?.message || 'Unknown error', { stack: error?.stack })
    })

    return job
  }

  async startActivitiesBackfillSync(stravaId: number): Promise<SyncJob> {
    const activeJob = await this.jobsRepo.getActiveJobForUser(stravaId)
    if (activeJob) {
      throw new Error('A sync job is already running for this user')
    }

    const job = await this.jobsRepo.createJob(stravaId, 'activities_only', { mode: 'backfill' })

    this.runJob(job).catch((error: any) => {
      this.logger.error(`Sync job ${job.id} failed`, error)
      this.jobsRepo.markJobFailed(job.id, error?.message || 'Unknown error', { stack: error?.stack })
    })

    return job
  }

  async startActivitiesRecentSync(stravaId: number, recentWindowDays: number = 30): Promise<SyncJob> {
    const activeJob = await this.jobsRepo.getActiveJobForUser(stravaId)
    if (activeJob) {
      throw new Error('A sync job is already running for this user')
    }

    const job = await this.jobsRepo.createJob(stravaId, 'activities_only', {
      mode: 'recent',
      recentWindowDays,
    })

    this.runJob(job).catch((error: any) => {
      this.logger.error(`Sync job ${job.id} failed`, error)
      this.jobsRepo.markJobFailed(job.id, error?.message || 'Unknown error', { stack: error?.stack })
    })

    return job
  }

  async startSegmentEffortsSync(
    stravaId: number,
    options?: { targetSegmentId?: number }
  ): Promise<SyncJob> {
    const activeJob = await this.jobsRepo.getActiveJobForUser(stravaId)
    if (activeJob) {
      throw new Error('A sync job is already running for this user')
    }

    const job = await this.jobsRepo.createJob(
      stravaId,
      'segment_efforts_only',
      options?.targetSegmentId ? { targetSegmentId: options.targetSegmentId } : undefined
    )

    this.runJob(job).catch((error: any) => {
      this.logger.error(`Sync job ${job.id} failed`, error)
      this.jobsRepo.markJobFailed(job.id, error?.message || 'Unknown error', { stack: error?.stack })
    })

    return job
  }

  private async runFullSync(job: SyncJob): Promise<void> {
    const jobId = job.id
    const stravaId = job.strava_id
    const startingPhase = job.current_phase ?? 'discover_activities'

    this.logger.log(`[Job ${jobId}] Starting full sync from Strava API (phase=${startingPhase})`)

    // For UI display: show progress as scanned/total-known (DB), not scanned/scanned.
    const baseDbTotalActivities = await this.getDbActivityCount(stravaId)

    // Step 1: Sync activities from Strava API to database
    // Resume behavior: if job was already in ensure_* phase, skip activity discovery.
    if (startingPhase === 'discover_activities') {
      await this.setPhase(jobId, 'discover_activities')
      this.logger.log(`[Job ${jobId}] Fetching activities oldest-first (entity=activities)`)
      const state = await this.syncStateRepo.getOrCreate(stravaId)
      const startBeforeEpoch =
        job.cursor_before_epoch ??
        state.backfill_cursor_before ??
        Math.floor(Date.now() / 1000)
      let latestCursorBeforeEpoch = startBeforeEpoch
      try {
        const activityResult = await this.stravaService.syncActivitiesBackfill({
          beforeEpoch: startBeforeEpoch,
          maxRequests: 10_000,
          onProgress: async (p) => {
            latestCursorBeforeEpoch = p.cursorBeforeEpoch
            this.logger.log(
              `[Job ${jobId}] Progress update: scanned=${p.scanned}, new=${p.synced}, errors=${p.errors}`
            )
            await this.syncStateRepo.update(stravaId, {
              backfill_cursor_before: latestCursorBeforeEpoch,
            })
            await this.jobsRepo.updateJobProgress(jobId, {
              // Show scanned activity volume in discover phase; this prevents false 0/N perception
              // when no new inserts are needed for this page window.
              activities: { total: baseDbTotalActivities, processed: p.scanned, failed: p.errors },
            } as Partial<SyncJobProgress>)
          },
        })
        this.logger.log(
          `[Job ${jobId}] Activities scanned: ${activityResult.scanned}, new: ${activityResult.synced}, errors: ${activityResult.errors}`
        )
        await this.syncStateRepo.update(stravaId, {
          backfill_cursor_before: latestCursorBeforeEpoch,
        })

        // Final update
        const finalDbTotalActivities = await this.getDbActivityCount(stravaId)
        await this.jobsRepo.updateJobProgress(jobId, {
          activities: {
            total: finalDbTotalActivities,
            processed: activityResult.scanned,
            failed: activityResult.errors,
          },
        } as Partial<SyncJobProgress>)
      } catch (error: any) {
        if (this.isRateLimitError(error)) {
          this.logger.warn(`[Job ${jobId}] Rate limit hit during activity sync. Pausing job`)
          await this.syncStateRepo.update(stravaId, {
            backfill_cursor_before: latestCursorBeforeEpoch,
          })
          await this.pauseForRateLimit(jobId, 'Rate limit exceeded during activity sync', error, {
            cursor_before_epoch: latestCursorBeforeEpoch,
          })
          return
        }
        throw error
      }
    }

    // Step 2: Sync segments for all activities
    if (startingPhase === 'discover_activities' || startingPhase === 'ensure_segments' || startingPhase === 'ensure_segment_efforts') {
      await this.setPhase(jobId, 'ensure_segments')
      this.logger.log(`[Job ${jobId}] Syncing segment efforts (and segments) (entity=segment_efforts,segments)`)
      try {
        const segmentResult = await this.stravaService.syncSegments(
          undefined,
          this.segmentProgressReporter(jobId, false)
        )
        this.logger.log(`[Job ${jobId}] Segments synced: ${segmentResult.segmentsAdded}, activities processed: ${segmentResult.processed}`)

        // Segment efforts and segments are fetched from the same activity-details flow.
        await this.setPhase(jobId, 'ensure_segment_efforts')
        await this.jobsRepo.updateJobProgress(
          jobId,
          {
            segment_efforts: { total: segmentResult.processed, processed: segmentResult.processed, failed: segmentResult.errors },
          } as Partial<SyncJobProgress>
        )

        const { count: remainingNeedingSegments } = await this.supabase
          .from('activities')
          .select('activity_id', { count: 'exact', head: true })
          .eq('strava_id', stravaId)
          .neq('activity_sync_state', 'completed')
        const { count: inconsistentCompletedRows } = await this.supabase
          .from('activities')
          .select('activity_id', { count: 'exact', head: true })
          .eq('strava_id', stravaId)
          .eq('segments_fetch_status', 'success_rows')
          .is('segment_efforts_synced_at', null)
        if ((remainingNeedingSegments ?? 0) > 0) {
          await this.jobsRepo.updateJobStatus(jobId, 'failed', {
            current_phase: 'failed',
            error_message: `Sync incomplete: ${remainingNeedingSegments} activities still need segment effort sync`,
          })
          return
        }
        if ((inconsistentCompletedRows ?? 0) > 0) {
          await this.jobsRepo.updateJobStatus(jobId, 'failed', {
            current_phase: 'failed',
            error_message: `Sync inconsistent: ${inconsistentCompletedRows} activities marked success_rows without segment_efforts checkpoint`,
          })
          return
        }
      } catch (error: any) {
        if (this.isRateLimitError(error)) {
          this.logger.warn(`[Job ${jobId}] Rate limit hit during segments/efforts sync. Pausing job`)
          await this.pauseForRateLimit(jobId, 'Rate limit exceeded during segments/efforts sync', error, {
            last_processed_activity_id: error?.currentActivityId ?? job.last_processed_activity_id,
          })
          return
        }
        throw error
      }
    }

      // Step 3: Sync athlete stats
      this.logger.log(`[Job ${jobId}] Syncing athlete stats`)
      await this.syncAthleteStats(jobId, stravaId)

      // Step 4: Sync routes
      this.logger.log(`[Job ${jobId}] Syncing routes`)
      await this.syncRoutes(jobId, stravaId)

      // Mark job as completed
      const { count: completedActivitiesCount } = await this.supabase
        .from('activities')
        .select('activity_id', { count: 'exact', head: true })
        .eq('strava_id', stravaId)
        .eq('activity_sync_state', 'completed')

      const { count: totalActivitiesCount } = await this.supabase
        .from('activities')
        .select('activity_id', { count: 'exact', head: true })
        .eq('strava_id', stravaId)

      const totalActivities = totalActivitiesCount ?? 0
      const completedActivities = completedActivitiesCount ?? totalActivities

      await this.jobsRepo.updateJobProgress(jobId, {
        activities: {
          total: totalActivities,
          processed: completedActivities,
          failed: 0,
        },
      } as Partial<SyncJobProgress>)

      await this.jobsRepo.updateJobStatus(jobId, 'completed', {
        current_phase: 'completed',
        processed_items: totalActivities,
        failed_items: 0,
      })

      this.logger.log(`[Job ${jobId}] Sync completed. Total activities in database: ${totalActivities}`)
  }

  private async runSegmentsOnly(job: SyncJob): Promise<void> {
    const jobId = job.id
    this.logger.log(`[Job ${jobId}] Starting segments-only sync from Strava API`)

    try {
      await this.setPhase(jobId, 'ensure_segments')
      this.logger.log(`[Job ${jobId}] Fetching segments (derived from segment efforts in activity details)`)
      const segmentResult = await this.stravaService.syncSegments(
        undefined,
        this.segmentProgressReporter(jobId, true)
      )

      await this.jobsRepo.updateJobStatus(jobId, 'completed', {
        current_phase: 'completed',
        processed_items: segmentResult.processed,
        failed_items: segmentResult.errors,
      })
    } catch (error: any) {
      if (this.isRateLimitError(error)) {
        this.logger.warn(`[Job ${jobId}] Rate limit hit during segments-only sync. Pausing job`)
        await this.pauseForRateLimit(jobId, 'Rate limit exceeded during segments-only sync', error)
        return
      }
      throw error
    }
  }

  private async runActivitiesOnly(job: SyncJob): Promise<void> {
    const mode = (job.options?.mode as string | undefined) ?? 'recent'
    if (mode === 'backfill') return this.runActivitiesBackfill(job)
    return this.runActivitiesRecent(job)
  }

  private async runActivitiesRecent(job: SyncJob): Promise<void> {
    const jobId = job.id
    const stravaId = job.strava_id
    const recentWindowDays = Number(job.options?.recentWindowDays ?? 30)

    this.logger.log(`[Job ${jobId}] Starting recent activities sync (activities_only, last ${recentWindowDays}d) from Strava API`)

    const state = await this.syncStateRepo.getOrCreate(stravaId)
    const nowEpoch = Math.floor(Date.now() / 1000)
    const windowAfterEpoch = nowEpoch - Math.max(1, recentWindowDays) * 24 * 60 * 60
    const afterEpoch = Math.max(windowAfterEpoch, state.activities_after ?? 0)

    try {
      await this.setPhase(jobId, 'discover_activities')
      const baseDbTotalActivities = await this.getDbActivityCount(stravaId)
      const result = await this.stravaService.syncActivitiesRecent({
        afterEpoch,
        recentWindowDays,
        maxRequests: 100,
        onProgress: async (p) => {
          await this.jobsRepo.updateJobProgress(
            jobId,
            { activities: { total: baseDbTotalActivities, processed: p.synced, failed: p.errors } } as Partial<SyncJobProgress>,
            p.synced
          )
        },
      })

      await this.syncStateRepo.update(stravaId, { activities_after: result.newAfterEpoch })
      const rateLimitStatus = this.stravaService.getRateLimitStatus()

      await this.jobsRepo.updateJobStatus(jobId, 'completed', {
        current_phase: 'completed',
        cursor_after_epoch: result.newAfterEpoch,
        requests_used_15m: rateLimitStatus.requests15min,
        requests_used_daily: rateLimitStatus.requestsDay,
        rate_limit_15m_reset_at: rateLimitStatus.nextReset15min.toISOString(),
        rate_limit_daily_reset_at: rateLimitStatus.nextResetDaily.toISOString(),
        processed_items: result.synced,
        failed_items: result.errors,
      })
    } catch (error: any) {
      if (this.isRateLimitError(error)) {
        this.logger.warn(`[Job ${jobId}] Rate limit hit during recent activities sync. Pausing job`)
        await this.pauseForRateLimit(jobId, 'Rate limit exceeded during recent activities sync', error)
        return
      }
      throw error
    }
  }

  private async runActivitiesBackfill(job: SyncJob): Promise<void> {
    const jobId = job.id
    const stravaId = job.strava_id

    this.logger.log(`[Job ${jobId}] Starting activities backfill (activities_only) from Strava API`)

    const state = await this.syncStateRepo.getOrCreate(stravaId)
    const nowEpoch = Math.floor(Date.now() / 1000)
    const beforeEpoch = state.backfill_cursor_before ?? nowEpoch

    let latestCursorBeforeEpoch = beforeEpoch
    try {
      await this.setPhase(jobId, 'discover_activities')
      const baseDbTotalActivities = await this.getDbActivityCount(stravaId)
      const result = await this.stravaService.syncActivitiesBackfill({
        beforeEpoch,
        maxRequests: 250,
        onProgress: async (p) => {
          latestCursorBeforeEpoch = p.cursorBeforeEpoch
          await this.syncStateRepo.update(stravaId, { backfill_cursor_before: p.cursorBeforeEpoch })
          await this.jobsRepo.updateJobProgress(
            jobId,
            { activities: { total: baseDbTotalActivities, processed: p.scanned, failed: p.errors } } as Partial<SyncJobProgress>,
            p.scanned
          )
        },
      })

      await this.syncStateRepo.update(stravaId, { backfill_cursor_before: result.newBeforeEpoch })
      const rateLimitStatus = this.stravaService.getRateLimitStatus()

      await this.jobsRepo.updateJobStatus(jobId, 'completed', {
        current_phase: 'completed',
        cursor_before_epoch: result.newBeforeEpoch,
        requests_used_15m: rateLimitStatus.requests15min,
        requests_used_daily: rateLimitStatus.requestsDay,
        rate_limit_15m_reset_at: rateLimitStatus.nextReset15min.toISOString(),
        rate_limit_daily_reset_at: rateLimitStatus.nextResetDaily.toISOString(),
        processed_items: result.scanned,
        failed_items: result.errors,
      })
    } catch (error: any) {
      if (this.isRateLimitError(error)) {
        this.logger.warn(`[Job ${jobId}] Rate limit hit during activities backfill. Pausing job`)
        await this.pauseForRateLimit(jobId, 'Rate limit exceeded during activities backfill', error, {
          cursor_before_epoch: latestCursorBeforeEpoch,
        })
        return
      }
      throw error
    }
  }

  private async runSegmentEffortsOnly(job: SyncJob): Promise<void> {
    const jobId = job.id
    this.logger.log(`[Job ${jobId}] Starting segment-efforts-only sync from Strava API`)

    const targetSegmentIdRaw = Number(job.options?.targetSegmentId)
    const hasTargetSegment =
      Number.isFinite(targetSegmentIdRaw) && targetSegmentIdRaw > 0

    // In Strava’s model, efforts are best fetched in bulk via activity details with include_all_efforts=true.
    // We reuse the same sync path as segments sync, which persists both segments and segment_efforts.
    try {
      await this.setPhase(jobId, 'ensure_segment_efforts')

      if (hasTargetSegment) {
        this.logger.log(
          `[Job ${jobId}] Fetching segment efforts for target segment ${targetSegmentIdRaw}...`
        )
        const result = await this.stravaService.syncSegmentEffortsForSegment(
          targetSegmentIdRaw,
          async (p) => {
            await this.jobsRepo.updateJobProgress(
              jobId,
              {
                segments: { total: 1, processed: 1, failed: 0 },
                segment_efforts: { total: p.total, processed: p.saved, failed: p.errors },
              } as Partial<SyncJobProgress>,
              p.processed
            )
          }
        )

        await this.jobsRepo.updateJobStatus(jobId, 'completed', {
          current_phase: 'completed',
          processed_items: result.processed,
          failed_items: result.errors,
        })
      } else {
        this.logger.log(`[Job ${jobId}] Fetching segment efforts (and segments) from activity details`)
        const segmentResult = await this.stravaService.syncSegments(
          undefined,
          this.segmentProgressReporter(jobId, true)
        )

        await this.jobsRepo.updateJobProgress(
          jobId,
          {
            segment_efforts: {
              total: segmentResult.processed,
              processed: segmentResult.processed,
              failed: segmentResult.errors,
            },
          } as Partial<SyncJobProgress>
        )

        await this.jobsRepo.updateJobStatus(jobId, 'completed', {
          current_phase: 'completed',
          processed_items: segmentResult.processed,
          failed_items: segmentResult.errors,
        })
      }
    } catch (error: any) {
      if (this.isRateLimitError(error)) {
        this.logger.warn(`[Job ${jobId}] Rate limit hit during segment-efforts-only sync. Pausing job`)
        await this.pauseForRateLimit(jobId, 'Rate limit exceeded during segment-efforts-only sync', error)
        return
      }
      throw error
    }
  }

  private segmentProgressReporter(
    jobId: string,
    mirrorProcessedItems: boolean
  ): (_p: {
    processed: number
    errors: number
    total: number
    segmentsProcessed: number
    segmentEffortsProcessed: number
  }) => Promise<void> {
    return async (p) => {
      await this.jobsRepo.updateJobProgress(
        jobId,
        {
          activities: { total: p.total, processed: p.processed, failed: p.errors },
          // Segments and segment efforts move at different rates; track them separately.
          // Totals are unknown until the scan completes, so keep them at 0.
          // The UI renders these as live counts when total is unknown.
          segments: { total: 0, processed: p.segmentsProcessed, failed: p.errors },
          segment_efforts: { total: 0, processed: p.segmentEffortsProcessed, failed: p.errors },
        } as Partial<SyncJobProgress>,
        mirrorProcessedItems ? p.processed : undefined
      )
    }
  }

  private isRateLimitError(error: any): boolean {
    if (!error) return false
    const message = error.message || error.toString()
    return (
      message.includes('Rate limit') || 
      message.includes('429') || 
      error.status === 429 ||
      error.statusCode === 429
    )
  }

  async resumeJob(jobId: string): Promise<void> {
    const job = await this.jobsRepo.getJobById(jobId)
    if (!job) {
      throw new Error(`Job ${jobId} not found`)
    }

    if (job.status !== 'paused') {
      // Idempotency: resume can be triggered concurrently (cron + UI polling).
      // If it already resumed, there's nothing to do.
      return
    }

    this.logger.log(`[Job ${jobId}] Resuming paused job from activity ${job.last_processed_activity_id}`)
    
    // Resume based on job type
    this.runJob(job).catch((error: any) => {
      this.logger.error(`[Job ${jobId}] Resume failed`, error)
      this.jobsRepo.markJobFailed(jobId, error?.message || 'Unknown error', { stack: error?.stack })
    })
  }

  private async syncAthleteStats(jobId: string, _stravaId: number): Promise<void> {
    await this.jobsRepo.updateJobProgress(jobId, {
      stats: { total: 1, processed: 1, failed: 0 },
    } as Partial<SyncJobProgress>)
  }

  private async syncRoutes(jobId: string, _stravaId: number): Promise<void> {
    await this.jobsRepo.updateJobProgress(jobId, {
      routes: { total: 1, processed: 1, failed: 0 },
    } as Partial<SyncJobProgress>)
  }

  private async syncActivityDetails(_activityId: number, _stravaId: number): Promise<void> {
  }

  async getJobStatus(jobId: string): Promise<SyncJob | null> {
    return this.jobsRepo.getJobById(jobId)
  }

  async cancelJob(jobId: string): Promise<void> {
    await this.jobsRepo.updateJobStatus(jobId, 'cancelled')
  }
}
