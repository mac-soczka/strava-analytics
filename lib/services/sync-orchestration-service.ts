import { SyncJobsRepository, SyncJob, SyncJobProgress } from '../repositories/sync-jobs-repository'
import { StravaService } from './strava-service'
import { createClientComponentClient } from '@/lib/supabase'

export class SyncOrchestrationService {
  private jobsRepo: SyncJobsRepository
  private stravaService: StravaService
  private supabase = createClientComponentClient()

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

      console.log(`[Job ${jobId}] Syncing athlete stats...`)
      await this.syncAthleteStats(jobId, stravaId)

      console.log(`[Job ${jobId}] Syncing routes...`)
      await this.syncRoutes(jobId, stravaId)

      console.log(`[Job ${jobId}] Fetching activities list...`)
      const { data: activities, error } = await this.supabase
        .from('activities')
        .select('activity_id')
        .eq('strava_id', stravaId)
        .order('start_date', { ascending: false })

      if (error) throw error

      const totalActivities = activities?.length || 0
      console.log(`[Job ${jobId}] Found ${totalActivities} activities`)

      // If resuming, find the index to start from
      let startIndex = 0
      if (resumeFromActivityId) {
        startIndex = activities?.findIndex(a => a.activity_id === resumeFromActivityId) || 0
        if (startIndex > 0) {
          console.log(`[Job ${jobId}] Resuming from activity ${resumeFromActivityId} (index ${startIndex})`)
        }
      }

      await this.jobsRepo.updateJobProgress(jobId, {
        activities: { total: totalActivities, processed: startIndex, failed: 0 },
        laps: { total: totalActivities, processed: startIndex, failed: 0 },
        streams: { total: totalActivities, processed: startIndex, failed: 0 },
      } as Partial<SyncJobProgress>)

      let processedCount = startIndex
      let failedCount = 0

      for (let i = startIndex; i < (activities?.length || 0); i++) {
        const activity = activities![i]
        
        try {
          console.log(`[Job ${jobId}] Syncing activity ${activity.activity_id} (${processedCount + 1}/${totalActivities})`)
          
          await this.syncActivityDetails(activity.activity_id, stravaId)
          
          processedCount++
          
          await this.jobsRepo.incrementProgress(jobId, 'activities', 1)
          await this.jobsRepo.incrementProgress(jobId, 'laps', 1)
          await this.jobsRepo.incrementProgress(jobId, 'streams', 1)
          
        } catch (error: any) {
          // Check if it's a rate limit error
          if (this.isRateLimitError(error)) {
            console.warn(`[Job ${jobId}] Rate limit hit! Pausing job...`)
            await this.jobsRepo.pauseJob(
              jobId,
              activity.activity_id,
              'Rate limit exceeded - will resume in 15 minutes'
            )
            console.log(`[Job ${jobId}] Job paused. Will resume from activity ${activity.activity_id}`)
            return // Exit gracefully - job will be resumed by worker
          }
          
          console.error(`[Job ${jobId}] Failed to sync activity ${activity.activity_id}:`, error)
          failedCount++
        }
      }

      await this.jobsRepo.updateJobStatus(jobId, 'completed', {
        processed_items: processedCount,
        failed_items: failedCount,
      })

      console.log(`[Job ${jobId}] Sync completed! Processed: ${processedCount}, Failed: ${failedCount}`)
      
    } catch (error: any) {
      console.error(`[Job ${jobId}] Sync failed:`, error)
      await this.jobsRepo.markJobFailed(jobId, error?.message || 'Unknown error', { stack: error?.stack })
      throw error
    }
  }

  private isRateLimitError(error: any): boolean {
    if (!error) return false
    const message = error.message || error.toString()
    return message.includes('Rate limit') || message.includes('429') || error.status === 429
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
