import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { createClient } from '@supabase/supabase-js'
import { SyncJobsRepository } from '@/lib/repositories/sync-jobs-repository'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

describe('SyncJobsRepository', () => {
  let repo: SyncJobsRepository
  let testStravaId: number
  let createdJobIds: string[] = []

  beforeEach(async () => {
    repo = new SyncJobsRepository()
    testStravaId = 12345678

    await supabase.from('users').upsert({
      strava_id: testStravaId,
      firstname: 'Test',
      lastname: 'User',
    })
  })

  afterEach(async () => {
    if (createdJobIds.length > 0) {
      await supabase.from('sync_jobs').delete().in('id', createdJobIds)
    }
    createdJobIds = []
  })

  it('should create a new sync job', async () => {
    const job = await repo.createJob(testStravaId, 'full_sync')
    createdJobIds.push(job.id)

    expect(job).toBeDefined()
    expect(job.strava_id).toBe(testStravaId)
    expect(job.type).toBe('full_sync')
    expect(job.status).toBe('pending')
  })

  it('should get job by ID', async () => {
    const created = await repo.createJob(testStravaId)
    createdJobIds.push(created.id)

    const fetched = await repo.getJobById(created.id)

    expect(fetched).toBeDefined()
    expect(fetched?.id).toBe(created.id)
  })

  it('should get active job for user', async () => {
    const job = await repo.createJob(testStravaId)
    createdJobIds.push(job.id)

    const active = await repo.getActiveJobForUser(testStravaId)

    expect(active).toBeDefined()
    expect(active?.id).toBe(job.id)
    expect(active?.status).toBe('pending')
  })

  it('should update job status', async () => {
    const job = await repo.createJob(testStravaId)
    createdJobIds.push(job.id)

    const updated = await repo.updateJobStatus(job.id, 'running')

    expect(updated.status).toBe('running')
    expect(updated.started_at).toBeDefined()
  })

  it('should update job progress', async () => {
    const job = await repo.createJob(testStravaId)
    createdJobIds.push(job.id)

    const updated = await repo.updateJobProgress(job.id, {
      activities: { total: 100, processed: 50, failed: 0 },
    })

    expect(updated.progress.activities.total).toBe(100)
    expect(updated.progress.activities.processed).toBe(50)
  })

  it('should mark job as failed', async () => {
    const job = await repo.createJob(testStravaId)
    createdJobIds.push(job.id)

    const failed = await repo.markJobFailed(job.id, 'Test error', { detail: 'test' })

    expect(failed.status).toBe('failed')
    expect(failed.error_message).toBe('Test error')
    expect(failed.completed_at).toBeDefined()
  })

  it('should get recent jobs for user', async () => {
    const job1 = await repo.createJob(testStravaId)
    const job2 = await repo.createJob(testStravaId)
    createdJobIds.push(job1.id, job2.id)

    const jobs = await repo.getRecentJobsForUser(testStravaId, 10)

    expect(jobs.length).toBeGreaterThanOrEqual(2)
    expect(jobs[0].created_at >= jobs[1].created_at).toBe(true)
  })
})
