import { Suspense } from 'react'
import { createClient } from '@supabase/supabase-js'
import ProtectedRoute from '../components/ProtectedRoute'
import { SyncJobControls } from '../components/sync/SyncJobControls'
import { SyncCoveragePanel } from '../components/sync/SyncCoveragePanel'
import { getSessionStravaId } from '@/lib/server/session-strava'
import { loadSyncCoverage } from '@/lib/sync/sync-coverage'

// Force dynamic rendering to avoid ISR issues
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function ActivitiesPage() {
  return (
    <ProtectedRoute>
      <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="container mx-auto px-4 py-8">
          <div className="mb-8">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">
              🚴‍♂️ Activities
            </h1>
            <p className="text-gray-600 dark:text-gray-400 text-lg">
              Your Strava activities with segments and efforts
            </p>
            <div className="mt-4">
              <SyncJobControls
                label="Sync Activities"
                endpoint="/api/sync/start"
              />
            </div>
          </div>
          
          <Suspense fallback={<ActivitiesLoadingSkeleton />}>
            <ActivitiesContent />
          </Suspense>
        </div>
      </main>
    </ProtectedRoute>
  )
}

function ActivitiesLoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Stats Cards Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-2"></div>
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
          </div>
        ))}
      </div>
      
      {/* Activities Skeleton */}
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-48 mb-4"></div>
            <div className="space-y-2">
              {[...Array(3)].map((_, j) => (
                <div key={j} className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

async function ActivitiesContent() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const stravaId = await getSessionStravaId()

    let countQ = supabase.from('activities').select('*', { count: 'exact', head: true })
    if (stravaId) countQ = countQ.eq('strava_id', stravaId)
    const { count: totalActivities, error: countError } = await countQ

    if (countError) throw countError

    let activitiesQuery = supabase.from('activities').select(`
        *,
        segment_efforts (
          id,
          segment_id,
          elapsed_time,
          moving_time,
          start_date,
          average_watts,
          max_watts,
          segments (
            segment_id,
            name,
            distance,
            elevation_gain,
            average_grade,
            maximum_grade,
            climb_category,
            city,
            state,
            country,
            polyline
          )
        )
      `)

    if (stravaId) {
      activitiesQuery = activitiesQuery.eq('strava_id', stravaId)
    }

    const { data: activities, error: activitiesError } = await activitiesQuery
      .order('start_date', { ascending: false })
      .limit(50)

    if (activitiesError) throw activitiesError

    let typeQuery = supabase.from('activities').select('type')
    if (stravaId) typeQuery = typeQuery.eq('strava_id', stravaId)

    const { data: activityTypeCounts, error: typeCountError } = await typeQuery

    if (typeCountError) {
      console.error('Error fetching activity type counts:', typeCountError)
    }

    const activityTypes = activityTypeCounts?.reduce((acc: Record<string, number>, activity: any) => {
      acc[activity.type] = (acc[activity.type] || 0) + 1
      return acc
    }, {} as Record<string, number>) || {}

    const syncCoverage = stravaId ? await loadSyncCoverage(supabase, stravaId) : null

    const { data: legacyActivityStats } = !stravaId
      ? await supabase.rpc('get_activity_completion_stats')
      : { data: null as null }

    const legacyRow = legacyActivityStats?.[0] as
      | {
          total_activities_fetched?: number
          total_activities_available?: number
          activities_with_segments?: number
          activities_without_segments?: number
          activities_with_polyline?: number
          activities_without_polyline?: number
          completion_percentage?: number
        }
      | undefined

    const activityStats = syncCoverage
      ? {
          total_activities_fetched: syncCoverage.activities.stored,
          total_activities_available: syncCoverage.activities.estimatedTotal,
          activities_with_segments: syncCoverage.segments.activitiesCheckedForSegmentList,
          activities_without_segments: syncCoverage.segments.activitiesQueuedForSegmentList,
          activities_with_polyline: 0,
          activities_without_polyline: 0,
          completion_percentage: 0,
          activity_import_percent: syncCoverage.activities.importPercent,
          last_activities_sync_at: syncCoverage.activities.lastSyncAt,
          last_segments_sync_at: syncCoverage.segments.lastSyncAt,
          last_efforts_sync_at: syncCoverage.segmentEfforts.lastSyncAt,
        }
      : {
          total_activities_fetched: legacyRow?.total_activities_fetched ?? 0,
          total_activities_available: legacyRow?.total_activities_available ?? 0,
          activities_with_segments: legacyRow?.activities_with_segments ?? 0,
          activities_without_segments: legacyRow?.activities_without_segments ?? 0,
          activities_with_polyline: legacyRow?.activities_with_polyline ?? 0,
          activities_without_polyline: legacyRow?.activities_without_polyline ?? 0,
          completion_percentage: Number(legacyRow?.completion_percentage ?? 0),
          activity_import_percent: 0,
          last_activities_sync_at: null as string | null,
          last_segments_sync_at: null as string | null,
          last_efforts_sync_at: null as string | null,
        }

    // Calculate statistics for displayed activities only
    const totalDistance = activities?.reduce((sum: number, a: any) => sum + (a.distance || 0), 0) || 0
    const totalTime = activities?.reduce((sum: number, a: any) => sum + (a.moving_time || 0), 0) || 0
    const totalElevation = activities?.reduce((sum: number, a: any) => sum + (a.total_elevation_gain || 0), 0) || 0
    
    // Count total segments and efforts (list view only — account totals come from syncCoverage)
    const totalSegments = new Set()
    const totalEffortsInList =
      activities?.reduce((sum: number, a: any) => sum + (a.segment_efforts?.length || 0), 0) || 0

    activities?.forEach((activity: any) => {
      activity.segment_efforts?.forEach((effort: any) => {
        totalSegments.add(effort.segments?.segment_id)
      })
    })

    const stats = {
      totalActivities: totalActivities || 0,
      totalDistance,
      totalTime,
      totalElevation,
      totalSegments: totalSegments.size,
      totalEfforts: totalEffortsInList,
      accountEffortRows: syncCoverage?.segmentEfforts.effortRowsStored ?? null,
      accountDistinctSegments: syncCoverage?.segments.distinctSegmentsCrossed ?? null,
      activityTypes,
      activityCompletionStats: activityStats,
    }

    const { default: ActivitiesClient } = await import('./activities-client')

    return (
      <div className="space-y-6">
        <SyncCoveragePanel initialCoverage={syncCoverage} />
        <ActivitiesClient activities={activities || []} stats={stats} coverage={syncCoverage} />
      </div>
    )
  } catch (error) {
    console.error('Error loading activities:', error)
    
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6">
        <div className="flex items-center mb-4">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
              Error Loading Activities
            </h3>
          </div>
        </div>
        <div className="text-sm text-red-700 dark:text-red-300">
          <p>There was an error loading your activities. Please try refreshing the page.</p>
        </div>
      </div>
    )
  }
}
