import type { SupabaseClient } from '@supabase/supabase-js'

export type SyncCoverage = {
  activities: {
    stored: number
    estimatedTotal: number
    importPercent: number
    lastSyncAt: string | null
  }
  segments: {
    activitiesWithSegments: number
    totalActivities: number
    percent: number
    lastSyncAt: string | null
  }
  segmentEfforts: {
    segmentsWithEfforts: number
    uniqueSegmentsAttempted: number
    percent: number
    lastSyncAt: string | null
  }
}

async function maxCompletedAt(
  supabase: SupabaseClient,
  stravaId: number,
  types: string[]
): Promise<string | null> {
  const { data, error } = await supabase
    .from('sync_jobs')
    .select('completed_at')
    .eq('strava_id', stravaId)
    .eq('status', 'completed')
    .in('type', types)
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data?.completed_at) return null
  return data.completed_at
}

export async function fetchLastSyncTimestamps(
  supabase: SupabaseClient,
  stravaId: number
): Promise<{
  activities: string | null
  segments: string | null
  segmentEfforts: string | null
}> {
  const [activities, segments, segmentEfforts] = await Promise.all([
    maxCompletedAt(supabase, stravaId, ['full_sync', 'activities_only']),
    maxCompletedAt(supabase, stravaId, ['full_sync', 'segments_only']),
    maxCompletedAt(supabase, stravaId, ['full_sync', 'segment_efforts_only']),
  ])
  return { activities, segments, segmentEfforts }
}

export async function loadSyncCoverage(
  supabase: SupabaseClient,
  stravaId: number
): Promise<SyncCoverage> {
  const [lastSync, userSegRes, actCountRes] = await Promise.all([
    fetchLastSyncTimestamps(supabase, stravaId),
    supabase.rpc('get_user_segment_completion_stats', { user_strava_id: stravaId }),
    supabase
      .from('activities')
      .select('*', { count: 'exact', head: true })
      .eq('strava_id', stravaId),
  ])

  const fetched = actCountRes.count ?? 0
  const estimatedTotal =
    fetched > 0 ? fetched + Math.max(10, Math.floor(fetched * 0.05)) : 0
  const importPercent =
    estimatedTotal > 0 ? Math.min(100, Math.round((fetched / estimatedTotal) * 100)) : 0

  const row = userSegRes.data?.[0] as
    | {
        activities_with_segments?: number
        total_activities?: number
        segment_completion_rate?: number
        segments_with_efforts?: number
        unique_segments_attempted?: number
        effort_completion_rate?: number
      }
    | undefined

  return {
    activities: {
      stored: fetched,
      estimatedTotal,
      importPercent,
      lastSyncAt: lastSync.activities,
    },
    segments: {
      activitiesWithSegments: row?.activities_with_segments ?? 0,
      totalActivities: row?.total_activities ?? 0,
      percent: Number(row?.segment_completion_rate ?? 0),
      lastSyncAt: lastSync.segments,
    },
    segmentEfforts: {
      segmentsWithEfforts: row?.segments_with_efforts ?? 0,
      uniqueSegmentsAttempted: row?.unique_segments_attempted ?? 0,
      percent: Number(row?.effort_completion_rate ?? 0),
      lastSyncAt: lastSync.segmentEfforts,
    },
  }
}
