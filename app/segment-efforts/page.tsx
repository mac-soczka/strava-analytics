import { Suspense } from 'react'
import { createClient } from '@supabase/supabase-js'

// Force dynamic rendering to avoid ISR issues
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function SegmentEffortsPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-red-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            Segment Efforts
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            All your segment attempts across all activities
          </p>
        </div>
        
        <Suspense fallback={<SegmentEffortsLoadingSkeleton />}>
          <SegmentEffortsContent />
        </Suspense>
      </div>
    </main>
  )
}

function SegmentEffortsLoadingSkeleton() {
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
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-4"></div>
        <div className="space-y-3">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="h-12 bg-gray-200 dark:bg-gray-700 rounded"></div>
          ))}
        </div>
      </div>
    </div>
  )
}

async function SegmentEffortsContent() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Fetch all segment efforts with segment and activity details
    const { data: efforts, error: effortsError } = await supabase
      .from('segment_efforts')
      .select(`
        *,
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
          country
        ),
        activities (
          activity_id,
          name,
          type,
          start_date,
          distance,
          moving_time
        )
      `)
      .order('start_date', { ascending: false })
      .limit(1000) // Limit for performance

    if (effortsError) throw effortsError

    // Calculate overall statistics
    const totalEfforts = efforts?.length || 0
    const uniqueSegments = new Set(efforts?.map(e => e.segment_id) || []).size
    const totalDistance = efforts?.reduce((sum, e) => sum + (e.segments?.distance || 0), 0) || 0
    const totalElevation = efforts?.reduce((sum, e) => sum + (e.segments?.elevation_gain || 0), 0) || 0

    // Find personal records (best times for each segment)
    const segmentPRs = new Map()
    efforts?.forEach(effort => {
      const segmentId = effort.segment_id
      const currentPR = segmentPRs.get(segmentId)
      if (!currentPR || effort.elapsed_time < currentPR.elapsed_time) {
        segmentPRs.set(segmentId, effort)
      }
    })

    const personalRecords = Array.from(segmentPRs.values())
    const totalPRs = personalRecords.length

    const stats = {
      totalEfforts,
      uniqueSegments,
      totalDistance: Math.round(totalDistance / 1000 * 100) / 100, // Convert to km
      totalElevation: Math.round(totalElevation),
      totalPRs
    }

    const { default: SegmentEffortsClient } = await import('./segment-efforts-client')

    return (
      <SegmentEffortsClient
        efforts={efforts || []}
        stats={stats}
        personalRecords={personalRecords}
      />
    )
  } catch (error) {
    console.error('Error loading segment efforts:', error)
    
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
              Error Loading Segment Efforts
            </h3>
          </div>
        </div>
        <div className="text-sm text-red-700 dark:text-red-300">
          <p>There was an error loading the segment efforts. Please try refreshing the page or check your connection.</p>
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