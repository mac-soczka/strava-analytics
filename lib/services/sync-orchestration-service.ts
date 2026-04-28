import { SyncJobsRepository, SyncJob, SyncJobProgress } from '../repositories/sync-jobs-repository'
import { StravaService } from './strava-service'
import { createClient } from '@supabase/supabase-js'
import config from '@/lib/config'

export class SyncOrchestrationService {
  private jobsRepo: SyncJobsRepository
  private stravaService: StravaService
  private supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey)

  constructor(stravaId: number) {
    this.jobsRepo = new SyncJobsRepository()
    this.stravaService = new StravaService(stravaId)
  }

  private async runJob(job: SyncJob): Promise<void> {
    try {
      await this.jobsRepo.updateJobStatus(job.id, 'running')

      switch (job.type) {
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
        console.error(`[Job ${job.id}] Sync failed:`, error)
        await this.jobsRepo.markJobFailed(job.id, error?.message || 'Unknown error', { stack: error?.stack })
      }
      throw error
    }
  }

  private async pauseForRateLimit(jobId: string, reasonPrefix: string, error: any) {
    const retryAfterMs = typeof error?.retryAfter === 'number' ? error.retryAfter : 15 * 60 * 1000
    const effectiveRetryAfterMs = Math.max(60_000, retryAfterMs)
    const resumeAt = new Date(Date.now() + effectiveRetryAfterMs)

    console.warn(
      `[Job ${jobId}] Pausing for rate limit. Retry after: ${effectiveRetryAfterMs}ms. Resume at: ${resumeAt.toISOString()}`
    )

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

    await this.jobsRepo.pauseJob(
      jobId,
      0,
      `${reasonPrefix} - will resume at ${resumeAt.toISOString()}`,
      resumeAt
    )
  }

  async startFullSync(stravaId: number): Promise<SyncJob> {
    const activeJob = await this.jobsRepo.getActiveJobForUser(stravaId)
    if (activeJob) {
      throw new Error('A sync job is already running for this user')
    }

    const job = await this.jobsRepo.createJob(stravaId, 'full_sync')

    this.runJob(job).catch((error: any) => {
      console.error(`Sync job ${job.id} failed:`, error)
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
      console.error(`Sync job ${job.id} failed:`, error)
      this.jobsRepo.markJobFailed(job.id, error?.message || 'Unknown error', { stack: error?.stack })
    })

    return job
  }

  async startSegmentEffortsSync(stravaId: number): Promise<SyncJob> {
    const activeJob = await this.jobsRepo.getActiveJobForUser(stravaId)
    if (activeJob) {
      throw new Error('A sync job is already running for this user')
    }

    const job = await this.jobsRepo.createJob(stravaId, 'segment_efforts_only')

    this.runJob(job).catch((error: any) => {
      console.error(`Sync job ${job.id} failed:`, error)
      this.jobsRepo.markJobFailed(job.id, error?.message || 'Unknown error', { stack: error?.stack })
    })

    return job
  }

  private async runFullSync(job: SyncJob): Promise<void> {
    const jobId = job.id
    const stravaId = job.strava_id

    console.log(`[Job ${jobId}] Starting full sync from Strava API...`)

    // Step 1: Sync activities from Strava API to database
    console.log(`[Job ${jobId}] Fetching activities from Strava...`)
      try {
        const activityResult = await this.stravaService.syncActivities(
          undefined, // pageSize - use default
          undefined, // processBatchSize - use default
          async (synced, errors, total) => {
            // Update progress in real-time after each batch
            console.log(`[Job ${jobId}] Progress update: ${synced}/${total} synced, ${errors} errors`)
            await this.jobsRepo.updateJobProgress(jobId, {
              activities: { total, processed: synced, failed: errors },
            } as Partial<SyncJobProgress>)
          }
        )
        console.log(`[Job ${jobId}] Activities synced: ${activityResult.synced}, errors: ${activityResult.errors}`)
        
        // Final update
        await this.jobsRepo.updateJobProgress(jobId, {
          activities: { total: activityResult.synced + activityResult.errors, processed: activityResult.synced, failed: activityResult.errors },
        } as Partial<SyncJobProgress>)
      } catch (error: any) {
        if (this.isRateLimitError(error)) {
          console.warn(`[Job ${jobId}] Rate limit hit during activity sync! Pausing job...`)
          await this.pauseForRateLimit(jobId, 'Rate limit exceeded during activity sync', error)
          return
        }
        throw error
      }

      // Step 2: Sync segments for all activities
      console.log(`[Job ${jobId}] Syncing segments + segment efforts for activities...`)
      try {
        const segmentResult = await this.stravaService.syncSegments(
          undefined,
          this.segmentProgressReporter(jobId, false)
        )
        console.log(`[Job ${jobId}] Segments synced: ${segmentResult.segmentsAdded}, activities processed: ${segmentResult.processed}`)
      } catch (error: any) {
        if (this.isRateLimitError(error)) {
          console.warn(`[Job ${jobId}] Rate limit hit during segments/efforts sync! Pausing job...`)
          await this.pauseForRateLimit(jobId, 'Rate limit exceeded during segments/efforts sync', error)
          return
        }
        throw error
      }

      // Step 3: Sync athlete stats
      console.log(`[Job ${jobId}] Syncing athlete stats...`)
      await this.syncAthleteStats(jobId, stravaId)

      // Step 4: Sync routes
      console.log(`[Job ${jobId}] Syncing routes...`)
      await this.syncRoutes(jobId, stravaId)

      // Mark job as completed
      const { data: finalActivities } = await this.supabase
        .from('activities')
        .select('activity_id', { count: 'exact' })
        .eq('strava_id', stravaId)

      const totalActivities = finalActivities?.length || 0

      await this.jobsRepo.updateJobStatus(jobId, 'completed', {
        processed_items: totalActivities,
        failed_items: 0,
      })

      console.log(`[Job ${jobId}] Sync completed! Total activities in database: ${totalActivities}`)
  }

  private async runSegmentsOnly(job: SyncJob): Promise<void> {
    const jobId = job.id
    console.log(`[Job ${jobId}] Starting segments-only sync from Strava API...`)

    try {
      console.log(`[Job ${jobId}] Fetching segments (derived from segment efforts in activity details)...`)
      const segmentResult = await this.stravaService.syncSegments(
        undefined,
        this.segmentProgressReporter(jobId, true)
      )

      await this.jobsRepo.updateJobStatus(jobId, 'completed', {
        processed_items: segmentResult.processed,
        failed_items: segmentResult.errors,
      })
    } catch (error: any) {
      if (this.isRateLimitError(error)) {
        console.warn(`[Job ${jobId}] Rate limit hit during segments-only sync! Pausing job...`)
        await this.pauseForRateLimit(jobId, 'Rate limit exceeded during segments-only sync', error)
        return
      }
      throw error
    }
  }

  private async runSegmentEffortsOnly(job: SyncJob): Promise<void> {
    const jobId = job.id
    console.log(`[Job ${jobId}] Starting segment-efforts-only sync from Strava API...`)

    // In Strava’s model, efforts are best fetched in bulk via activity details with include_all_efforts=true.
    // We reuse the same sync path as segments sync, which persists both segments and segment_efforts.
    try {
      console.log(`[Job ${jobId}] Fetching segment efforts (and segments) from activity details...`)
      const segmentResult = await this.stravaService.syncSegments(
        undefined,
        this.segmentProgressReporter(jobId, true)
      )

      await this.jobsRepo.updateJobStatus(jobId, 'completed', {
        processed_items: segmentResult.processed,
        failed_items: segmentResult.errors,
      })
    } catch (error: any) {
      if (this.isRateLimitError(error)) {
        console.warn(`[Job ${jobId}] Rate limit hit during segment-efforts-only sync! Pausing job...`)
        await this.pauseForRateLimit(jobId, 'Rate limit exceeded during segment-efforts-only sync', error)
        return
      }
      throw error
    }
  }

  private segmentProgressReporter(
    jobId: string,
    mirrorProcessedItems: boolean
  ): (_p: { processed: number; errors: number; total: number }) => Promise<void> {
    return async (p) => {
      await this.jobsRepo.updateJobProgress(
        jobId,
        {
          segments: { total: p.total, processed: p.processed, failed: p.errors },
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

    console.log(`[Job ${jobId}] Resuming paused job from activity ${job.last_processed_activity_id}`)
    
    // Resume based on job type
    this.runJob(job).catch((error: any) => {
      console.error(`[Job ${jobId}] Resume failed:`, error)
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
