import type { SupabaseClient } from '@supabase/supabase-js'

export type SyncCoverage = {
  activities: {
    stored: number
    estimatedTotal: number
    importPercent: number
    lastSyncAt: string | null
  }
  /**
   * Segment list fetch from Strava is per activity. Counts here are activity-queue + how much
   * segment-effort data we have stored (each row is one segment crossed on one activity).
   */
  segments: {
    /** Activities where segments_fetched = true (we asked Strava for this activity’s segment list) */
    activitiesCheckedForSegmentList: number
    /** Imported activities still waiting for that fetch (segments_fetched IS DISTINCT FROM true) */
    activitiesQueuedForSegmentList: number
    importedActivities: number
    /** Rows in segment_efforts for this user (segment crossings with times) */
    segmentCrossingRows: number
    /** Distinct segment_id values among those rows */
    distinctSegmentsCrossed: number
    lastSyncAt: string | null
  }
  /**
   * Same underlying table as segment crossings; framed as “efforts” for the efforts page.
   */
  segmentEfforts: {
    effortRowsStored: number
    distinctSegments: number
    activitiesWithAtLeastOneEffortRow: number
    importedActivities: number
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
        activities_without_segments?: number
        total_activities?: number
        segments_with_efforts?: number
        unique_segments_attempted?: number
        activities_with_segment_efforts?: number
        total_segment_effort_rows?: number
      }
    | undefined

  const actsChecked = row?.activities_with_segments ?? 0
  const actsQueued =
    row?.activities_without_segments ??
    Math.max(0, (row?.total_activities ?? fetched) - actsChecked)
  const rpcTotal = row?.total_activities ?? 0
  const imported = Math.max(fetched, rpcTotal, 1)
  const crossingRows = row?.total_segment_effort_rows ?? 0
  const distinctSeg = Math.max(
    row?.unique_segments_attempted ?? 0,
    row?.segments_with_efforts ?? 0
  )
  const actsWithEfforts = row?.activities_with_segment_efforts ?? 0

  return {
    activities: {
      stored: fetched,
      estimatedTotal,
      importPercent,
      lastSyncAt: lastSync.activities,
    },
    segments: {
      activitiesCheckedForSegmentList: actsChecked,
      activitiesQueuedForSegmentList: actsQueued,
      importedActivities: imported,
      segmentCrossingRows: crossingRows,
      distinctSegmentsCrossed: distinctSeg,
      lastSyncAt: lastSync.segments,
    },
    segmentEfforts: {
      effortRowsStored: crossingRows,
      distinctSegments: distinctSeg,
      activitiesWithAtLeastOneEffortRow: actsWithEfforts,
      importedActivities: imported,
      lastSyncAt: lastSync.segmentEfforts,
    },
  }
}
