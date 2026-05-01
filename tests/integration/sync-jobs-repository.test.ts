/** @jest-environment node */
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { createClient } from '@supabase/supabase-js'
import { SyncJobsRepository } from '@/lib/repositories/sync-jobs-repository'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const SHOULD_RUN = Boolean(SUPABASE_URL && SUPABASE_KEY && !String(SUPABASE_URL).includes('test.supabase.co'))

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

;(SHOULD_RUN ? describe : describe.skip)('SyncJobsRepository', () => {
  let repo: SyncJobsRepository
  let testStravaId: number
  let createdJobIds: string[] = []

  beforeEach(async () => {
    repo = new SyncJobsRepository()
    testStravaId = 12345678

    // Ensure no leftover active jobs from prior runs violate one-active-job constraint.
    await supabase.from('sync_jobs').delete().eq('strava_id', testStravaId)

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
    expect(job.current_phase).toBe('discover_activities')
  })

  it('should set phase defaults by job type', async () => {
    const segmentsJob = await repo.createJob(testStravaId, 'segments_only')
    createdJobIds.push(segmentsJob.id)
    await repo.updateJobStatus(segmentsJob.id, 'completed')

    const effortsJob = await repo.createJob(testStravaId, 'segment_efforts_only')
    createdJobIds.push(effortsJob.id)

    expect(segmentsJob.current_phase).toBe('ensure_segments')
    expect(effortsJob.current_phase).toBe('ensure_segment_efforts')
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

  it('should merge progress entities instead of replacing the whole progress object', async () => {
    const job = await repo.createJob(testStravaId)
    createdJobIds.push(job.id)

    await repo.updateJobProgress(job.id, {
      activities: { total: 100, processed: 10, failed: 0 },
    })
    const merged = await repo.updateJobProgress(job.id, {
      segments: { total: 2000, processed: 42, failed: 1 },
    })

    expect(merged.progress.activities.processed).toBe(10)
    expect(merged.progress.segments.total).toBe(2000)
    expect(merged.progress.segments.processed).toBe(42)
    expect(merged.progress.segments.failed).toBe(1)
  })

  it('should support segment_efforts progress updates', async () => {
    const job = await repo.createJob(testStravaId)
    createdJobIds.push(job.id)

    const updated = await repo.updateJobProgress(job.id, {
      segment_efforts: { total: 50, processed: 25, failed: 2 },
    })

    expect(updated.progress.segment_efforts.total).toBe(50)
    expect(updated.progress.segment_efforts.processed).toBe(25)
    expect(updated.progress.segment_efforts.failed).toBe(2)
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
    createdJobIds.push(job1.id)
    await repo.updateJobStatus(job1.id, 'completed')

    const job2 = await repo.createJob(testStravaId)
    createdJobIds.push(job2.id)

    const jobs = await repo.getRecentJobsForUser(testStravaId, 10)

    expect(jobs.length).toBeGreaterThanOrEqual(2)
    expect(jobs[0].created_at >= jobs[1].created_at).toBe(true)
  })
})
