type MockResponse = {
  status?: number
  json: any
  headers?: Record<string, string>
}

function withDefaultRateLimitHeaders(extra?: Record<string, string>): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'X-RateLimit-Usage': '1,10',
    'X-RateLimit-Limit': '100,1000',
    ...(extra ?? {}),
  }
}

function mkResponse(payload: MockResponse): Response {
  const status = payload.status ?? 200
  return new Response(JSON.stringify(payload.json), {
    status,
    headers: withDefaultRateLimitHeaders(payload.headers),
  })
}

function getQueryParam(url: URL, key: string): string | null {
  try {
    return url.searchParams.get(key)
  } catch {
    return null
  }
}

function buildMockActivities(): any[] {
  const baseStart = new Date('2026-01-10T10:00:00Z').getTime()
  return [1, 2, 3].map((n) => ({
    id: 900_000_000 + n,
    name: `Mock Activity ${n}`,
    distance: 10_000 + n * 100,
    moving_time: 2_000 + n * 10,
    elapsed_time: 2_100 + n * 10,
    total_elevation_gain: 120 + n,
    type: 'Run',
    start_date: new Date(baseStart - n * 24 * 60 * 60 * 1000).toISOString(),
    start_date_local: new Date(baseStart - n * 24 * 60 * 60 * 1000).toISOString(),
    average_speed: 3.2,
    max_speed: 5.1,
    average_watts: null,
    max_watts: null,
    average_heartrate: 150,
    max_heartrate: 180,
    map: { summary_polyline: 'mock_polyline' },
  }))
}

function buildMockActivityDetails(activityId: number): any {
  const segmentId = 700_000 + (activityId % 1000)
  return {
    ...(buildMockActivities().find((a) => a.id === activityId) ?? {
      id: activityId,
      name: `Mock Activity ${activityId}`,
      distance: 10_000,
      moving_time: 2_000,
      elapsed_time: 2_100,
      total_elevation_gain: 120,
      type: 'Run',
      start_date: new Date('2026-01-10T10:00:00Z').toISOString(),
      start_date_local: new Date('2026-01-10T10:00:00Z').toISOString(),
      map: { summary_polyline: 'mock_polyline' },
    }),
    map: { polyline: 'mock_polyline_full', summary_polyline: 'mock_polyline' },
    segment_efforts: [
      {
        id: String(800_000_000 + (activityId % 10_000)),
        elapsed_time: 300,
        moving_time: 295,
        distance: 1000,
        start_date: new Date('2026-01-10T10:00:00Z').toISOString(),
        start_index: 100,
        end_index: 500,
        average_watts: 250,
        max_watts: 400,
        device_watts: true,
        average_cadence: 85,
        average_heartrate: 155,
        max_heartrate: 175,
        pr_rank: 2,
        kom_rank: null,
        achievements: [{ type: 'pr', rank: 2 }],
        hidden: false,
        segment: {
          id: segmentId,
          name: `Mock Segment ${segmentId}`,
          distance: 1000,
          average_grade: 5.2,
          maximum_grade: 12.5,
          elevation_high: 100,
          elevation_low: 50,
          climb_category: 2,
          city: 'Test City',
          state: 'TS',
          country: 'Testland',
          map: { polyline: 'mock_segment_polyline' },
        },
      },
    ],
  }
}

export async function mockStravaFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url
  const parsed = new URL(url)
  const path = parsed.pathname

  if (url === 'https://www.strava.com/oauth/token') {
    return mkResponse({
      json: {
        access_token: 'mock_access_token',
        refresh_token: 'mock_refresh_token',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      },
    })
  }

  if (path === '/api/v3/athlete/activities') {
    const page = Number(getQueryParam(parsed, 'page') ?? '1')
    if (page > 1) return mkResponse({ json: [] })
    return mkResponse({ json: buildMockActivities() })
  }

  const activityMatch = path.match(/^\/api\/v3\/activities\/(\d+)$/)
  if (activityMatch) {
    const id = Number(activityMatch[1])
    const includeAll = getQueryParam(parsed, 'include_all_efforts')
    if (includeAll !== 'true') {
      return mkResponse({ status: 400, json: { message: 'Missing include_all_efforts=true in mock mode' } })
    }
    return mkResponse({ json: buildMockActivityDetails(id) })
  }

  return mkResponse({
    status: 404,
    json: { message: `Unhandled Strava mock request: ${init?.method || 'GET'} ${url}` },
  })
}

