import { createServerComponentClient } from '@/lib/supabase'
import { Suspense } from 'react'
import ProtectedRoute from "../components/ProtectedRoute"
import { SyncDashboard } from '../components/sync/SyncDashboard'
import { SyncCoveragePanel } from '../components/sync/SyncCoveragePanel'
import { getSessionStravaId } from '@/lib/server/session-strava'
import { loadSyncCoverage } from '@/lib/sync/sync-coverage'
import {
  fetchAllActivitiesForMonthlyChart,
  fetchDashboardActivityTotals,
  fetchDashboardActivityTypeStats,
} from '@/lib/server/dashboard-activity-stats'

// Loading skeleton for dashboard
function DashboardLoadingSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-6"></div>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-2"></div>
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
            <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </div>
        ))}
      </div>

      {/* Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
            <div className="space-y-3">
              {[...Array(5)].map((_, j) => (
                <div key={j} className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Main dashboard content
async function DashboardContent() {
  const supabase = createServerComponentClient()
  const stravaId = await getSessionStravaId()

  try {
    const effortsCountQuery = stravaId
      ? supabase
          .from('segment_efforts')
          .select('id, activities!inner(strava_id)', { count: 'exact', head: true })
          .eq('activities.strava_id', stravaId)
      : supabase.from('segment_efforts').select('*', { count: 'exact', head: true })

    const segmentEffortsListQuery = stravaId
      ? supabase
          .from('segment_efforts')
          .select('segment_id, activities!inner(strava_id)')
          .eq('activities.strava_id', stravaId)
      : supabase.from('segment_efforts').select('segment_id')

    // 🎯 APPROACH 1: Efficient count queries for simple totals
    let activitiesCountQuery = supabase.from('activities').select('*', { count: 'exact', head: true })
    if (stravaId) activitiesCountQuery = activitiesCountQuery.eq('strava_id', stravaId)

    const [activitiesCount, segmentsCount, effortsCount] = await Promise.all([
      activitiesCountQuery,
      supabase.from('segments').select('*', { count: 'exact', head: true }),
      effortsCountQuery,
    ])

    if (activitiesCount.error) throw activitiesCount.error
    if (segmentsCount.error) throw segmentsCount.error
    if (effortsCount.error) throw effortsCount.error

    let recentActivitiesQuery = supabase
      .from('activities')
      .select('activity_id, name, distance, moving_time, total_elevation_gain, type, start_date, polyline')
      .order('start_date', { ascending: false })
      .limit(5)
    if (stravaId) recentActivitiesQuery = recentActivitiesQuery.eq('strava_id', stravaId)

    const [segments, segmentEfforts, recentActivities, totals, monthlySource] = await Promise.all([
      supabase.from('segments').select('segment_id, name, distance, elevation_gain, polyline'),
      segmentEffortsListQuery,
      recentActivitiesQuery,
      fetchDashboardActivityTotals(supabase, stravaId),
      fetchAllActivitiesForMonthlyChart(supabase, stravaId),
    ])

    if (segments.error) throw segments.error
    if (segmentEfforts.error) throw segmentEfforts.error
    if (recentActivities.error) throw recentActivities.error

    const totalDistance = totals.totalDistanceMeters
    const totalTime = totals.totalMovingSeconds
    const totalElevation = totals.totalElevationMeters

    // Calculate effort statistics efficiently
    const effortCountMap = new Map<number, number>()
    const uniqueSegmentsAttempted = new Set<number>()
    segmentEfforts.data?.forEach((effort: any) => {
      const segmentId = effort.segment_id
      effortCountMap.set(segmentId, (effortCountMap.get(segmentId) || 0) + 1)
      uniqueSegmentsAttempted.add(segmentId)
    })

    // Get top segments by effort count
    const topSegments = Array.from(effortCountMap.entries())
      .map(([segmentId, count]) => {
        const segment = segments.data?.find((s: any) => s.segment_id === segmentId)
        return {
          id: segmentId,
          name: segment?.name || 'Unknown',
          distance: segment?.distance || 0,
          elevation: segment?.elevation_gain || 0,
          effortCount: count,
          polyline: segment?.polyline || undefined,
        }
      })
      .sort((a, b) => b.effortCount - a.effortCount)
      .slice(0, 10)

    const activityTypeStats = await fetchDashboardActivityTypeStats(supabase, stravaId)
    const activityTypes = Object.fromEntries(
      Object.entries(activityTypeStats).map(([type, s]) => [type, s.count])
    )

    // Calculate monthly trends (last 12 months) - efficient approach
    const monthlyData = new Array(12).fill(0).map((_, i) => {
      const date = new Date()
      date.setMonth(date.getMonth() - i)
      const month = date.getMonth()
      const year = date.getFullYear()
      
      const monthActivities = monthlySource.filter((activity) => {
        const activityDate = new Date(activity.start_date)
        return activityDate.getMonth() === month && activityDate.getFullYear() === year
      })

      return {
        month: date.toISOString().slice(0, 7), // Use YYYY-MM format for consistency
        activities: monthActivities.length,
        distance: monthActivities.reduce((sum, a) => sum + Number(a.distance || 0), 0),
        elevation: monthActivities.reduce((sum, a) => sum + Number(a.total_elevation_gain || 0), 0)
      }
    }).reverse()

    // Calculate performance metrics
    const avgSpeed = totalDistance > 0 ? (totalDistance / 1000) / (totalTime / 3600) : 0 // km/h
    const avgElevationPerActivity = (activitiesCount.count || 0) > 0 ? totalElevation / (activitiesCount.count || 0) : 0

    const stats = {
      totalActivities: activitiesCount.count || 0,
      totalSegments: stravaId ? uniqueSegmentsAttempted.size : segmentsCount.count || 0,
      totalEfforts: effortsCount.count || 0,
      segmentsAttempted: uniqueSegmentsAttempted.size,
      totalDistance: Math.round(totalDistance / 1000 * 100) / 100, // km
      totalTime: Math.round(totalTime / 3600 * 100) / 100, // hours
      totalElevation: Math.round(totalElevation), // meters
      avgSpeed: Math.round(avgSpeed * 100) / 100, // km/h
      avgElevationPerActivity: Math.round(avgElevationPerActivity) // meters
    }

    const syncCoverage = stravaId ? await loadSyncCoverage(supabase, stravaId) : null

    const { default: DashboardClient } = await import('./dashboard-client')

    return (
      <div className="space-y-8">
        <SyncCoveragePanel initialCoverage={syncCoverage} />
        <DashboardClient 
          stats={stats}
          recentActivities={recentActivities.data || []}
          topSegments={topSegments}
          activityTypes={activityTypes}
          activityTypeStats={activityTypeStats}
          monthlyData={monthlyData}
        />
      </div>
    )
  } catch (error) {
    const msg =
      error && typeof error === 'object' && 'message' in error
        ? String((error as { message?: string }).message)
        : error instanceof Error
          ? error.message
          : String(error)
    const details =
      error && typeof error === 'object' && 'details' in error
        ? String((error as { details?: string }).details)
        : ''
    console.error('Error loading dashboard:', msg, details || error)
    
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
              Error Loading Dashboard
            </h3>
          </div>
        </div>
        <div className="text-sm text-red-700 dark:text-red-300">
          <p>There was an error loading your dashboard data. Please try refreshing the page.</p>
        </div>
      </div>
    )
  }
}

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <main className="flex min-h-screen flex-col p-8 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto w-full">
          <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">
            🚴‍♂️ Strava Dashboard
          </h1>
          
          <div className="mb-8">
            <SyncDashboard />
          </div>
          
          <Suspense fallback={<DashboardLoadingSkeleton />}>
            <DashboardContent />
          </Suspense>
        </div>
      </main>
    </ProtectedRoute>
  )
}
