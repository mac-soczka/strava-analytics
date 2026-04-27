import { SyncOrchestrationService } from '@/lib/services/sync-orchestration-service'

async function main() {
  const stravaId = Number(process.env.STRAVA_ID)
  const cancelJobId = String(process.env.CANCEL_JOB_ID || '')
  if (!Number.isFinite(stravaId) || stravaId <= 0) {
    throw new Error('Missing STRAVA_ID env var')
  }
  if (!cancelJobId) {
    throw new Error('Missing CANCEL_JOB_ID env var')
  }

  const svc = new SyncOrchestrationService(stravaId)
  await svc.cancelJob(cancelJobId)
  const job = await svc.startSegmentsSync(stravaId)
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ cancelled: cancelJobId, newJobId: job.id, status: job.status }))
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e)
  process.exit(1)
})

