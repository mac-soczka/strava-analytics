import { SyncOrchestrationService } from '@/lib/services/sync-orchestration-service'

async function main() {
  const stravaId = Number(process.env.STRAVA_ID)
  if (!Number.isFinite(stravaId) || stravaId <= 0) {
    throw new Error('Missing STRAVA_ID env var')
  }

  const svc = new SyncOrchestrationService(stravaId)
  const job = await svc.startSegmentsSync(stravaId)
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ jobId: job.id, status: job.status }))
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e)
  process.exit(1)
})

