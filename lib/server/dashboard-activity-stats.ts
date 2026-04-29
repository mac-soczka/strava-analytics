import type { SupabaseClient } from '@supabase/supabase-js'

const PAGE = 1000

type MonthlyRow = {
  start_date: string
  distance: number | null
  total_elevation_gain: number | null
}

export type DashboardActivityTotals = {
  totalDistanceMeters: number
  totalMovingSeconds: number
  totalElevationMeters: number
}

export type DashboardActivityTypeStats = Record<
  string,
  {
    count: number
    distanceMeters: number
    movingSeconds: number
    elevationMeters: number
  }
>

export type TrendDirection = 'up' | 'down' | 'flat'

export type DashboardTrendMetric = {
  current: number
  previous: number
  delta: number
  deltaPercent: number | null
  direction: TrendDirection
}

export type DashboardTrendSummary = {
  windowDays: number
  activities: DashboardTrendMetric
  distanceMeters: DashboardTrendMetric
  elevationMeters: DashboardTrendMetric
}

function resolveDirection(delta: number): TrendDirection {
  if (delta > 0) return 'up'
  if (delta < 0) return 'down'
  return 'flat'
}

function buildMetric(current: number, previous: number): DashboardTrendMetric {
  const delta = current - previous
  const deltaPercent = previous > 0 ? (delta / previous) * 100 : null
  return {
    current,
    previous,
    delta,
    deltaPercent,
    direction: resolveDirection(delta),
  }
}

export function buildDashboardTrendSummary(
  rows: MonthlyRow[],
  windowDays = 30,
  now = new Date()
): DashboardTrendSummary {
  const nowMs = now.getTime()
  const dayMs = 24 * 60 * 60 * 1000
  const windowMs = windowDays * dayMs
  const currentWindowStart = nowMs - windowMs
  const previousWindowStart = nowMs - (windowMs * 2)

  let currentActivities = 0
  let previousActivities = 0
  let currentDistanceMeters = 0
  let previousDistanceMeters = 0
  let currentElevationMeters = 0
  let previousElevationMeters = 0

  for (const row of rows) {
    const ts = new Date(row.start_date).getTime()
    if (!Number.isFinite(ts) || ts > nowMs || ts < previousWindowStart) continue

    const distance = Number(row.distance ?? 0)
    const elevation = Number(row.total_elevation_gain ?? 0)

    if (ts >= currentWindowStart) {
      currentActivities += 1
      currentDistanceMeters += distance
      currentElevationMeters += elevation
      continue
    }

    previousActivities += 1
    previousDistanceMeters += distance
    previousElevationMeters += elevation
  }

  return {
    windowDays,
    activities: buildMetric(currentActivities, previousActivities),
    distanceMeters: buildMetric(currentDistanceMeters, previousDistanceMeters),
    elevationMeters: buildMetric(currentElevationMeters, previousElevationMeters),
  }
}

function mapActivityTotalsRow(row: Record<string, unknown> | null | undefined): DashboardActivityTotals {
  return {
    totalDistanceMeters: Number(row?.total_distance ?? 0),
    totalMovingSeconds: Math.round(Number(row?.total_moving_time ?? 0)),
    totalElevationMeters: Number(row?.total_elevation ?? 0),
  }
}

async function fetchTotalsViaPagination(
  supabase: SupabaseClient,
  stravaId: number | null
): Promise<DashboardActivityTotals> {
  const cols = 'distance, moving_time, total_elevation_gain'

  let totalDistanceMeters = 0
  let totalMovingSeconds = 0
  let totalElevationMeters = 0
  let offset = 0

  for (;;) {
    let q = supabase.from('activities').select(cols).order('activity_id', { ascending: true }).range(offset, offset + PAGE - 1)
    if (stravaId != null) q = q.eq('strava_id', stravaId)

    const { data, error } = await q
    if (error) throw error

    const batch = (data || []) as Array<{
      distance?: number | null
      moving_time?: number | null
      total_elevation_gain?: number | null
    }>

    for (const a of batch) {
      totalDistanceMeters += Number(a.distance ?? 0)
      totalMovingSeconds += Number(a.moving_time ?? 0)
      totalElevationMeters += Number(a.total_elevation_gain ?? 0)
    }

    if (batch.length < PAGE) break
    offset += PAGE
  }

  return {
    totalDistanceMeters,
    totalMovingSeconds: Math.round(totalMovingSeconds),
    totalElevationMeters,
  }
}

const ACTIVITY_AGGREGATE_SELECT =
  'total_distance:distance.sum(), total_moving_time:moving_time.sum(), total_elevation:total_elevation_gain.sum()'

/**
 * Activity distance/time/elevation (optionally filtered by athlete).
 */
export async function fetchDashboardActivityTotals(
  supabase: SupabaseClient,
  stravaId: number | null
): Promise<DashboardActivityTotals> {
  let q = supabase.from('activities').select(ACTIVITY_AGGREGATE_SELECT)
  if (stravaId != null) q = q.eq('strava_id', stravaId)

  const { data, error } = await q.maybeSingle()

  if (error) {
    return fetchTotalsViaPagination(supabase, stravaId)
  }

  return mapActivityTotalsRow(data as unknown as Record<string, unknown>)
}

/**
 * All activities' distance/elevation by month need every row; paginate past the 1000-row API cap.
 */
export async function fetchAllActivitiesForMonthlyChart(
  supabase: SupabaseClient,
  stravaId: number | null
): Promise<MonthlyRow[]> {
  const out: MonthlyRow[] = []
  let offset = 0

  for (;;) {
    let q = supabase
      .from('activities')
      .select('start_date, distance, total_elevation_gain')
      .order('start_date', { ascending: true })
      .range(offset, offset + PAGE - 1)

    if (stravaId != null) q = q.eq('strava_id', stravaId)

    const { data, error } = await q
    if (error) throw error

    const batch = (data || []) as MonthlyRow[]
    out.push(...batch)

    if (batch.length < PAGE) break
    offset += PAGE
  }

  return out
}

/**
 * Per-activity-type totals, computed by paginating the activities table to avoid
 * the 1000-row API cap.
 */
export async function fetchDashboardActivityTypeStats(
  supabase: SupabaseClient,
  stravaId: number | null
): Promise<DashboardActivityTypeStats> {
  const out: DashboardActivityTypeStats = {}
  let offset = 0

  for (;;) {
    let q = supabase
      .from('activities')
      .select('type, distance, moving_time, total_elevation_gain')
      .order('activity_id', { ascending: true })
      .range(offset, offset + PAGE - 1)

    if (stravaId != null) q = q.eq('strava_id', stravaId)

    const { data, error } = await q
    if (error) throw error

    const batch = (data || []) as Array<{
      type?: string | null
      distance?: number | null
      moving_time?: number | null
      total_elevation_gain?: number | null
    }>

    for (const a of batch) {
      const type = String(a.type ?? 'unknown')
      const cur = out[type] ?? { count: 0, distanceMeters: 0, movingSeconds: 0, elevationMeters: 0 }
      cur.count += 1
      cur.distanceMeters += Number(a.distance ?? 0)
      cur.movingSeconds += Number(a.moving_time ?? 0)
      cur.elevationMeters += Number(a.total_elevation_gain ?? 0)
      out[type] = cur
    }

    if (batch.length < PAGE) break
    offset += PAGE
  }

  return out
}
