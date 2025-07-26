import { Suspense } from 'react'
import { createClient } from '@supabase/supabase-js'

// Force dynamic rendering to avoid ISR issues
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function SegmentsPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-red-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent mb-2">
            🏁 Segments
          </h1>
          <p className="text-gray-600 dark:text-gray-400 text-lg">
            Your Strava segment efforts and performance tracking
          </p>
        </div>
        
        <Suspense fallback={<SegmentsLoadingSkeleton />}>
          <SegmentsContent />
        </Suspense>
      </div>
    </main>
  )
}

function SegmentsLoadingSkeleton() {
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
      
      {/* Segment Picker Skeleton */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-4"></div>
          <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
        </div>
      </div>
    </div>
  )
}

async function SegmentsContent() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    
    // 🎯 APPROACH 1: Using RPC with custom functions (MOST EFFICIENT)
    let { data: stats, error: statsError } = await supabase
      .rpc('get_segment_statistics')

    if (statsError) {
      console.warn('RPC failed, falling back to manual queries:', statsError)
      
      // 🎯 APPROACH 2: Manual aggregate queries (FALLBACK)
      const [segmentsCount, effortsCount, distanceSum, elevationSum] = await Promise.all([
        supabase.from('segments').select('*', { count: 'exact', head: true }),
        supabase.from('segment_efforts').select('*', { count: 'exact', head: true }),
        supabase.from('segments').select('distance'),
        supabase.from('segments').select('elevation_gain')
      ])

      if (segmentsCount.error) throw segmentsCount.error
      if (effortsCount.error) throw effortsCount.error
      if (distanceSum.error) throw distanceSum.error
      if (elevationSum.error) throw elevationSum.error

      // Calculate totals
      const totalDistance = distanceSum.data?.reduce((sum: number, s: any) => sum + (s.distance || 0), 0) || 0
      const totalElevation = elevationSum.data?.reduce((sum: number, s: any) => sum + (s.elevation_gain || 0), 0) || 0
      
      stats = {
        total_segments: segmentsCount.count || 0,
        total_efforts: effortsCount.count || 0,
        total_distance: totalDistance,
        total_elevation: totalElevation
      }
    }
    
    // 🎯 APPROACH 3: Using RPC for segments with effort counts
    const { data: segmentsWithCounts, error: segmentsError } = await supabase
      .rpc('get_segments_with_effort_counts', { limit_count: 200 })

    if (segmentsError) {
      console.warn('RPC for segments failed, falling back to manual query:', segmentsError)
      
      // 🎯 APPROACH 4: Manual query with joins (FALLBACK)
      const { data: segments, error: segmentsQueryError } = await supabase
        .from('segments')
        .select(`
          *,
          segment_efforts (
            id,
            activity_id,
            elapsed_time,
            moving_time,
            start_date,
            average_watts,
            max_watts
          )
        `)
        .order('name')
        .limit(200)

      if (segmentsQueryError) throw segmentsQueryError

      // Get effort counts for each segment
      const { data: effortCounts, error: countError } = await supabase
        .from('segment_efforts')
        .select('segment_id')
        .order('segment_id')

      if (countError) throw countError

      // Calculate effort counts per segment
      const effortCountMap = new Map<number, number>()
      effortCounts?.forEach((effort: any) => {
        const segmentId = effort.segment_id
        effortCountMap.set(segmentId, (effortCountMap.get(segmentId) || 0) + 1)
      })

      // Transform segments to match expected format
      const transformedSegments = segments?.map((segment: any) => ({
        id: segment.segment_id,
        name: segment.name,
        distance: segment.distance,
        elevation_high: segment.elevation_gain + (segment.elevation_low || 0),
        elevation_low: segment.elevation_low || 0,
        average_grade: segment.average_grade,
        maximum_grade: segment.maximum_grade,
        climb_category: segment.climb_category,
        city: segment.city,
        state: segment.state,
        country: segment.country,
        map: segment.polyline ? { polyline: segment.polyline } : undefined,
        segment_efforts: segment.segment_efforts?.map((effort: any) => ({
          id: effort.id,
          activity_id: effort.activity_id,
          elapsed_time: effort.elapsed_time,
          moving_time: effort.moving_time,
          start_date: effort.start_date,
          average_watts: effort.average_watts,
          max_watts: effort.max_watts,
          segment: {
            id: segment.segment_id,
            name: segment.name,
            distance: segment.distance,
            elevation_high: segment.elevation_gain + (segment.elevation_low || 0),
            elevation_low: segment.elevation_low || 0,
            average_grade: segment.average_grade,
            maximum_grade: segment.maximum_grade,
            climb_category: segment.climb_category,
            city: segment.city,
            state: segment.state,
            country: segment.country,
            map: segment.polyline ? { polyline: segment.polyline } : undefined
          }
        })) || [],
        total_effort_count: effortCountMap.get(segment.segment_id) || 0
      })) || []

      const { default: SegmentsClient } = await import('./segments-client')

      return (
        <SegmentsClient 
          segments={transformedSegments}
          stats={{
            totalSegments: stats.total_segments,
            totalEfforts: stats.total_efforts,
            totalDistance: stats.total_distance,
            totalElevation: stats.total_elevation
          }}
        />
      )
    }

    // Use RPC result
    const transformedSegments = segmentsWithCounts?.map((segment: any) => ({
      id: segment.segment_id,
      name: segment.name,
      distance: segment.distance,
      elevation_high: segment.elevation_gain + (segment.elevation_low || 0),
      elevation_low: segment.elevation_low || 0,
      average_grade: segment.average_grade,
      maximum_grade: segment.maximum_grade,
      climb_category: segment.climb_category,
      city: segment.city,
      state: segment.state,
      country: segment.country,
      map: segment.polyline ? { polyline: segment.polyline } : undefined,
      segment_efforts: [], // RPC doesn't include nested efforts
      total_effort_count: segment.effort_count || 0
    })) || []

    const { default: SegmentsClient } = await import('./segments-client')

    return (
      <SegmentsClient 
        segments={transformedSegments}
        stats={{
          totalSegments: stats.total_segments,
          totalEfforts: stats.total_efforts,
          totalDistance: stats.total_distance,
          totalElevation: stats.total_elevation
        }}
      />
    )
  } catch (error) {
    console.error('Error loading segments:', error)
    
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
              Error Loading Segments
            </h3>
          </div>
        </div>
        <div className="text-sm text-red-700 dark:text-red-300">
          <p>There was an error loading your segments. Please try refreshing the page or check your connection.</p>
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
