import { createClientComponentClient } from '@/lib/supabase'

export type SyncJobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'paused'
export type SyncJobType = 'full_sync' | 'activities_only' | 'routes_only' | 'stats_only'

export interface SyncJobProgress {
  activities: { total: number; processed: number; failed: number }
  laps: { total: number; processed: number; failed: number }
  streams: { total: number; processed: number; failed: number }
  segments: { total: number; processed: number; failed: number }
  routes: { total: number; processed: number; failed: number }
  stats: { total: number; processed: number; failed: number }
}

export interface SyncJob {
  id: string
  strava_id: number
  type: SyncJobType
  status: SyncJobStatus
  total_items: number
  processed_items: number
  failed_items: number
  progress: SyncJobProgress
  error_message?: string
  error_details?: any
  started_at?: string
  completed_at?: string
  estimated_completion_at?: string
  triggered_by: string
  created_at: string
  updated_at: string
  last_processed_activity_id?: number
  paused_at?: string
  resume_at?: string
  pause_reason?: string
}

export class SyncJobsRepository {
  private supabase = createClientComponentClient()

  async createJob(stravaId: number, type: SyncJobType = 'full_sync'): Promise<SyncJob> {
    const { data, error } = await this.supabase
      .from('sync_jobs')
      .insert({
        strava_id: stravaId,
        type,
        status: 'pending',
      })
      .select()
      .single()

    if (error) throw error
    return data
  }

  async getJobById(jobId: string): Promise<SyncJob | null> {
    const { data, error } = await this.supabase
      .from('sync_jobs')
      .select('*')
      .eq('id', jobId)
      .single()

    if (error && error.code !== 'PGRST116') throw error
    return data
  }

  async getActiveJobForUser(stravaId: number): Promise<SyncJob | null> {
    const { data, error } = await this.supabase
      .from('sync_jobs')
      .select('*')
      .eq('strava_id', stravaId)
      .in('status', ['pending', 'running'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error && error.code !== 'PGRST116') throw error
    return data
  }

  async getRecentJobsForUser(stravaId: number, limit: number = 10): Promise<SyncJob[]> {
    const { data, error } = await this.supabase
      .from('sync_jobs')
      .select('*')
      .eq('strava_id', stravaId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return data || []
  }

  async updateJobStatus(
    jobId: string,
    status: SyncJobStatus,
    updates?: Partial<SyncJob>
  ): Promise<SyncJob> {
    const payload: any = { status, ...updates }

    if (status === 'running' && !updates?.started_at) {
      payload.started_at = new Date().toISOString()
    }

    if (['completed', 'failed', 'cancelled'].includes(status) && !updates?.completed_at) {
      payload.completed_at = new Date().toISOString()
    }

    const { data, error } = await this.supabase
      .from('sync_jobs')
      .update(payload)
      .eq('id', jobId)
      .select()
      .single()

    if (error) throw error
    return data
  }

  async updateJobProgress(
    jobId: string,
    progress: Partial<SyncJobProgress>,
    processedItems?: number
  ): Promise<SyncJob> {
    const updates: any = { progress }
    
    if (processedItems !== undefined) {
      updates.processed_items = processedItems
    }

    const { data, error } = await this.supabase
      .from('sync_jobs')
      .update(updates)
      .eq('id', jobId)
      .select()
      .single()

    if (error) throw error
    return data
  }

  async incrementProgress(
    jobId: string,
    entityType: keyof SyncJobProgress,
    increment: number = 1
  ): Promise<void> {
    const { error } = await this.supabase.rpc('increment_sync_job_progress', {
      job_id: jobId,
      entity_type: entityType,
      increment_by: increment,
    })

    if (error) throw error
  }

  async markJobFailed(jobId: string, errorMessage: string, errorDetails?: any): Promise<SyncJob> {
    return this.updateJobStatus(jobId, 'failed', {
      error_message: errorMessage,
      error_details: errorDetails,
    })
  }

  async pauseJob(
    jobId: string,
    lastProcessedActivityId: number,
    reason: string = 'Rate limit exceeded'
  ): Promise<SyncJob> {
    const { data, error } = await this.supabase.rpc('pause_sync_job', {
      job_id: jobId,
      last_activity_id: lastProcessedActivityId,
      reason: reason,
    })

    if (error) throw error
    return data
  }

  async resumeJob(jobId: string): Promise<SyncJob> {
    const { data, error } = await this.supabase.rpc('resume_sync_job', {
      job_id: jobId,
    })

    if (error) throw error
    return data
  }

  async getPausedJobsReadyToResume(): Promise<SyncJob[]> {
    const { data, error } = await this.supabase.rpc('get_paused_jobs_ready_to_resume')

    if (error) throw error
    return data || []
  }
}
