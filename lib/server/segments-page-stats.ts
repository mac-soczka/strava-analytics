import type { SupabaseClient } from '@supabase/supabase-js'

export type SegmentsPageStats = {
  totalSegments: number
  totalEfforts: number
  totalDistance: number
  totalElevation: number
  segmentsWithPolyline: number
  polylineCoveragePercent: number
  segmentsWithEfforts: number
  segmentsNeverAttempted: number
  effortCompletionRatePercent: number
  avgAttemptsPerRiddenSegment: number
  /** Present when session has a Strava user */
  yourUniqueSegmentsAttempted: number | null
  yourTotalActivities: number | null
  /** False when logged-in Strava id is known but user RPC returned no row */
  athleteStatsAvailable: boolean
  hasStravaSession: boolean
}

type SegmentStatisticsRow = {
  total_segments: number
  total_efforts: number
  total_distance: number
  total_elevation: number
}

type SegmentCompletionRow = {
  total_segments: number
  segments_with_efforts: number
  segments_without_efforts: number
  effort_completion_rate: number
}

type UserSegmentRow = {
  unique_segments_attempted: number
  total_activities: number
}

export async function loadSegmentsPageStats(
  supabase: SupabaseClient,
  stravaId: number | null
): Promise<SegmentsPageStats> {
  const [statsRes, completionRes, polylineCountRes, userRes] = await Promise.all([
    supabase.rpc('get_segment_statistics'),
    supabase.rpc('get_segment_completion_stats'),
    supabase
      .from('segments')
      .select('*', { count: 'exact', head: true })
      .not('polyline', 'is', null),
    stravaId != null
      ? supabase.rpc('get_user_segment_completion_stats', { user_strava_id: stravaId })
      : Promise.resolve({ data: null, error: null }),
  ])

  const rawBase = !statsRes.error && statsRes.data?.[0] ? (statsRes.data[0] as Record<string, unknown>) : null
  const base: SegmentStatisticsRow = rawBase
    ? {
        total_segments: Number(rawBase.total_segments ?? 0),
        total_efforts: Number(rawBase.total_efforts ?? 0),
        total_distance: Number(rawBase.total_distance ?? 0),
        total_elevation: Number(rawBase.total_elevation ?? 0),
      }
    : {
        total_segments: 0,
        total_efforts: 0,
        total_distance: 0,
        total_elevation: 0,
      }

  const rawComp =
    !completionRes.error && completionRes.data?.[0] ? (completionRes.data[0] as Record<string, unknown>) : null
  const completion: SegmentCompletionRow = rawComp
    ? {
        total_segments: Number(rawComp.total_segments ?? 0),
        segments_with_efforts: Number(rawComp.segments_with_efforts ?? 0),
        segments_without_efforts: Number(rawComp.segments_without_efforts ?? 0),
        effort_completion_rate: Number(rawComp.effort_completion_rate ?? 0),
      }
    : {
        total_segments: base.total_segments,
        segments_with_efforts: 0,
        segments_without_efforts: base.total_segments,
        effort_completion_rate: 0,
      }

  const segmentsWithPolyline = polylineCountRes.error ? 0 : polylineCountRes.count || 0
  const totalSeg = Math.max(base.total_segments, completion.total_segments)

  const totalEfforts = base.total_efforts
  const withEfforts = completion.segments_with_efforts
  const avgAttempts =
    withEfforts > 0 ? Math.round((totalEfforts / withEfforts) * 10) / 10 : 0

  const rawUser =
    !userRes.error && userRes.data?.[0] ? (userRes.data[0] as Record<string, unknown>) : null
  const userRow: UserSegmentRow | null = rawUser
    ? {
        unique_segments_attempted: Number(rawUser.unique_segments_attempted ?? 0),
        total_activities: Number(rawUser.total_activities ?? 0),
      }
    : null

  return {
    totalSegments: totalSeg,
    totalEfforts,
    totalDistance: Number(base.total_distance),
    totalElevation: Number(base.total_elevation),
    segmentsWithPolyline,
    polylineCoveragePercent:
      totalSeg > 0 ? Math.round((segmentsWithPolyline / totalSeg) * 1000) / 10 : 0,
    segmentsWithEfforts: withEfforts,
    segmentsNeverAttempted: completion.segments_without_efforts,
    effortCompletionRatePercent: Number(completion.effort_completion_rate),
    avgAttemptsPerRiddenSegment: avgAttempts,
    yourUniqueSegmentsAttempted: userRow?.unique_segments_attempted ?? null,
    yourTotalActivities: userRow?.total_activities ?? null,
    athleteStatsAvailable: userRow != null,
    hasStravaSession: stravaId != null,
  }
}
