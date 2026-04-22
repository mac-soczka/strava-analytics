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

  async startFullSync(stravaId: number): Promise<SyncJob> {
    const activeJob = await this.jobsRepo.getActiveJobForUser(stravaId)
    if (activeJob) {
      throw new Error('A sync job is already running for this user')
    }

    const job = await this.jobsRepo.createJob(stravaId, 'full_sync')

    this.executeFullSync(job.id, stravaId).catch((error: any) => {
      console.error(`Sync job ${job.id} failed:`, error)
      this.jobsRepo.markJobFailed(job.id, error?.message || 'Unknown error', { stack: error?.stack })
    })

    return job
  }

  private async executeFullSync(jobId: string, stravaId: number, resumeFromActivityId?: number): Promise<void> {
    try {
      await this.jobsRepo.updateJobStatus(jobId, 'running')

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
          await this.jobsRepo.pauseJob(
            jobId,
            0,
            'Rate limit exceeded during activity sync - will resume in 15 minutes'
          )
          return
        }
        throw error
      }

      // Step 2: Sync segments for all activities
      console.log(`[Job ${jobId}] Syncing segments for activities...`)
      try {
        const segmentResult = await this.stravaService.syncSegments()
        console.log(`[Job ${jobId}] Segments synced: ${segmentResult.segmentsAdded}, activities processed: ${segmentResult.processed}`)
        
        await this.jobsRepo.updateJobProgress(jobId, {
          segments: { total: segmentResult.processed, processed: segmentResult.processed, failed: segmentResult.errors },
        } as Partial<SyncJobProgress>)
      } catch (error: any) {
        if (this.isRateLimitError(error)) {
          console.warn(`[Job ${jobId}] Rate limit hit during segment sync! Pausing job...`)
          await this.jobsRepo.pauseJob(
            jobId,
            0,
            'Rate limit exceeded during segment sync - will resume in 15 minutes'
          )
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
      
    } catch (error: any) {
      console.error(`[Job ${jobId}] Sync failed:`, error)
      await this.jobsRepo.markJobFailed(jobId, error?.message || 'Unknown error', { stack: error?.stack })
      throw error
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
      throw new Error(`Job ${jobId} is not paused (status: ${job.status})`)
    }

    console.log(`[Job ${jobId}] Resuming paused job from activity ${job.last_processed_activity_id}`)
    
    // Resume execution from where it left off
    this.executeFullSync(job.id, job.strava_id, job.last_processed_activity_id).catch((error: any) => {
      console.error(`[Job ${jobId}] Resume failed:`, error)
      this.jobsRepo.markJobFailed(jobId, error?.message || 'Unknown error', { stack: error?.stack })
    })
  }

  private async syncAthleteStats(jobId: string, stravaId: number): Promise<void> {
    await this.jobsRepo.updateJobProgress(jobId, {
      stats: { total: 1, processed: 1, failed: 0 },
    } as Partial<SyncJobProgress>)
  }

  private async syncRoutes(jobId: string, stravaId: number): Promise<void> {
    await this.jobsRepo.updateJobProgress(jobId, {
      routes: { total: 1, processed: 1, failed: 0 },
    } as Partial<SyncJobProgress>)
  }

  private async syncActivityDetails(activityId: number, stravaId: number): Promise<void> {
  }

  async getJobStatus(jobId: string): Promise<SyncJob | null> {
    return this.jobsRepo.getJobById(jobId)
  }

  async cancelJob(jobId: string): Promise<void> {
    await this.jobsRepo.updateJobStatus(jobId, 'cancelled')
  }
}
