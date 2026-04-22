import { NextRequest, NextResponse } from 'next/server'
import { SyncJobsRepository } from '@/lib/repositories/sync-jobs-repository'
import { SyncOrchestrationService } from '@/lib/services/sync-orchestration-service'

export async function POST(request: NextRequest) {
  try {
    const jobsRepo = new SyncJobsRepository()
    
    const pausedJobs = await jobsRepo.getPausedJobsReadyToResume()
    
    console.log(`[Resume Worker] Found ${pausedJobs.length} paused jobs ready to resume`)
    
    const results = []
    
    for (const job of pausedJobs) {
      try {
        console.log(`[Resume Worker] Resuming job ${job.id} for user ${job.strava_id}`)
        
        const syncService = new SyncOrchestrationService(job.strava_id)
        await syncService.resumeJob(job.id)
        
        results.push({
          jobId: job.id,
          status: 'resumed',
        })
      } catch (error: any) {
        console.error(`[Resume Worker] Failed to resume job ${job.id}:`, error)
        results.push({
          jobId: job.id,
          status: 'failed',
          error: error?.message,
        })
      }
    }
    
    return NextResponse.json({
      success: true,
      resumedCount: results.filter(r => r.status === 'resumed').length,
      failedCount: results.filter(r => r.status === 'failed').length,
      results,
    })
  } catch (error: any) {
    console.error('[Resume Worker] Error:', error)
    return NextResponse.json(
      { error: 'Failed to resume paused jobs', details: error?.message },
      { status: 500 }
    )
  }
}
