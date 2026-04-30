import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const SHOULD_RUN =
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) &&
  !String(process.env.NEXT_PUBLIC_SUPABASE_URL).includes('test.supabase.co')

const TEST_STRAVA_ID = 77665544

async function cleanup() {
  await supabase.from('segment_efforts').delete().gte('effort_id_text', '800000000').lte('effort_id_text', '899999999')
  await supabase.from('segments').delete().gte('segment_id', 700_000).lte('segment_id', 999_999)
  await supabase.from('activities').delete().eq('strava_id', TEST_STRAVA_ID)
  await supabase.from('sync_jobs').delete().eq('strava_id', TEST_STRAVA_ID)
  await supabase.from('app_sessions').delete().eq('strava_id', TEST_STRAVA_ID)
  await supabase.from('strava_tokens').delete().eq('strava_id', TEST_STRAVA_ID)
  await supabase.from('users').delete().eq('strava_id', TEST_STRAVA_ID)
}

test.describe('Optimized sync API (mocked Strava, full stack)', () => {
  test.beforeEach(async ({ context }) => {
    test.skip(!SHOULD_RUN, 'Requires a real/local Supabase configured via env vars')

    await cleanup()

    await supabase.from('users').insert({
      strava_id: TEST_STRAVA_ID,
      firstname: 'E2E',
      lastname: 'User',
    })

    await supabase.from('strava_tokens').upsert(
      {
        strava_id: TEST_STRAVA_ID,
        access_token: 'e2e_access_token',
        refresh_token: 'e2e_refresh_token',
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      },
      { onConflict: 'strava_id' }
    )

    const sessionToken = `e2e_${Date.now()}_${Math.random().toString(16).slice(2)}`
    await supabase.from('app_sessions').insert({
      strava_id: TEST_STRAVA_ID,
      session_token: sessionToken,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    })

    await context.addCookies([
      {
        name: 'app_session',
        value: sessionToken,
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        sameSite: 'Lax',
      },
    ])

    // Prevent the test runner's own HTTP client from ever calling Strava
    // (server-side calls are controlled by DI/unit/integration tests).
    await context.route('https://www.strava.com/**', (route) => {
      route.fulfill({ status: 500, body: 'Strava network is disabled in tests' })
    })
  })

  test.afterEach(async () => {
    await cleanup()
  })

  test('POST /api/sync/start completes and writes activities + segment_efforts without touching Strava', async ({ request }) => {
    const startResp = await request.post('/api/sync/start')
    expect(startResp.ok()).toBeTruthy()

    const startBody = await startResp.json()
    expect(startBody.success).toBe(true)
    const jobId = startBody.job.id as string
    expect(typeof jobId).toBe('string')

    const deadline = Date.now() + 25_000
    let lastStatus: any = null

    while (Date.now() < deadline) {
      const statusResp = await request.get(`/api/sync/status/${jobId}`)
      expect(statusResp.ok()).toBeTruthy()
      lastStatus = await statusResp.json()

      const status = lastStatus?.job?.status
      if (status === 'completed') break
      if (status === 'failed') {
        throw new Error(`Job failed: ${lastStatus?.job?.error_message || 'unknown error'}`)
      }

      await new Promise((r) => setTimeout(r, 250))
    }

    expect(lastStatus?.job?.status).toBe('completed')

    const { data: activities } = await supabase
      .from('activities')
      .select('activity_id')
      .eq('strava_id', TEST_STRAVA_ID)
    expect(activities?.length).toBe(3)

    const { data: efforts } = await supabase
      .from('segment_efforts')
      .select('effort_id_text')
    expect(efforts?.length).toBe(3)
  })
})

