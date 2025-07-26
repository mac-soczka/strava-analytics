import { Suspense } from 'react'
import { createClient } from '@supabase/supabase-js'

// Force dynamic rendering to avoid ISR issues
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function ActivitiesPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">
            🚴‍♂️ Activities
          </h1>
          <p className="text-gray-600 dark:text-gray-400 text-lg">
            Your Strava activities synced in real-time
          </p>
        </div>
        
        <Suspense fallback={<ActivitiesLoadingSkeleton />}>
          <ActivitiesContent />
        </Suspense>
      </div>
    </main>
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
      
      {/* Table Skeleton */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-4"></div>
          <div className="flex gap-4">
            <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-48"></div>
            <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
            <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
          </div>
        </div>
        <div className="p-6">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex gap-4 mb-4">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-48"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-12"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
            </div>
          ))}
        </div>
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
    
    // Fetch activities with pagination
    const { data: activities, error: activitiesError } = await supabase
      .from('activities')
      .select(`
        *,
        segment_efforts (
          id,
          segment_id,
          elapsed_time,
          moving_time
        )
      `)
      .order('start_date', { ascending: false })
      .limit(50)

    if (activitiesError) throw activitiesError

    // Fetch statistics
    const { data: statsData, error: statsError } = await supabase
      .from('activities')
      .select('distance, moving_time, total_elevation_gain, type')

    if (statsError) throw statsError

    // Calculate statistics
    const stats = {
      totalActivities: statsData.length,
      totalDistance: statsData.reduce((sum: number, a: any) => sum + (a.distance || 0), 0),
      totalTime: statsData.reduce((sum: number, a: any) => sum + (a.moving_time || 0), 0),
      totalElevation: statsData.reduce((sum: number, a: any) => sum + (a.total_elevation_gain || 0), 0),
      bySportType: statsData.reduce((acc: Record<string, number>, a: any) => {
        acc[a.type] = (acc[a.type] || 0) + 1
        return acc
      }, {} as Record<string, number>)
    }

    // Transform activities to match expected format
    const transformedActivities = activities?.map((activity: any) => ({
      id: activity.activity_id,
      name: activity.name,
      distance: activity.distance,
      moving_time: activity.moving_time,
      elapsed_time: activity.elapsed_time,
      total_elevation_gain: activity.total_elevation_gain,
      type: activity.type,
      start_date: activity.start_date,
      start_date_local: activity.start_date_local,
      segment_efforts: activity.segment_efforts || []
    })) || []

    const { default: ActivitiesClient } = await import('./activities-client')

    return (
      <ActivitiesClient 
        initialActivities={transformedActivities} 
        stats={stats}
        totalCount={stats.totalActivities}
      />
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
          <p>There was an error loading your activities. Please try refreshing the page or check your connection.</p>
          <details className="mt-2">
            <summary className="cursor-pointer text-red-600 dark:text-red-400">Technical Details</summary>
            <pre className="mt-2 text-xs bg-red-100 dark:bg-red-900 p-2 rounded overflow-auto">
              {error instanceof Error ? error.message : 'Unknown error'}
            </pre>
          </details>
        </div>
      </div>
    )
  }
}
