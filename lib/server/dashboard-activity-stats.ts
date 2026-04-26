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
