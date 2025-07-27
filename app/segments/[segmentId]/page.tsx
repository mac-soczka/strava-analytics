import { Suspense } from 'react'
import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'

// Force dynamic rendering to avoid ISR issues
export const dynamic = 'force-dynamic'
export const revalidate = 0

interface SegmentDetailPageProps {
  params: Promise<{
    segmentId: string
  }>
}

export default async function SegmentDetailPage({ params }: SegmentDetailPageProps) {
  const { segmentId } = await params
  
  return (
    <main className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-red-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="container mx-auto px-4 py-8">
        <Suspense fallback={<SegmentDetailLoadingSkeleton />}>
          <SegmentDetailContent segmentId={segmentId} />
        </Suspense>
      </div>
    </main>
  )
}

function SegmentDetailLoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-64 mb-4"></div>
        <div className="flex gap-2 mb-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
          ))}
        </div>
      </div>

      {/* Stats Cards Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-2"></div>
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
          </div>
        ))}
      </div>

      {/* Map Skeleton */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-4"></div>
        <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded"></div>
      </div>

      {/* Efforts Table Skeleton */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-4"></div>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 bg-gray-200 dark:bg-gray-700 rounded"></div>
          ))}
        </div>
      </div>
    </div>
  )
}

async function SegmentDetailContent({ segmentId }: { segmentId: string }) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Fetch the specific segment
    const { data: segment, error: segmentError } = await supabase
      .from('segments')
      .select('*')
      .eq('segment_id', parseInt(segmentId))
      .single()

    if (segmentError || !segment) {
      notFound()
    }

    // Fetch all efforts for this segment
    const { data: efforts, error: effortsError } = await supabase
      .from('segment_efforts')
      .select(`
        *,
        activities (
          activity_id,
          name,
          type,
          start_date
        )
      `)
      .eq('segment_id', parseInt(segmentId))
      .order('start_date', { ascending: false })

    if (effortsError) throw effortsError

    // Calculate statistics
    const totalEfforts = efforts?.length || 0
    const times = efforts?.map(e => e.elapsed_time) || []
    const bestTime = times.length > 0 ? Math.min(...times) : 0
    const worstTime = times.length > 0 ? Math.max(...times) : 0
    const averageTime = times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0
    const elevationGain = segment.elevation_gain || 0
    const steepness = segment.distance > 0 ? (elevationGain / segment.distance) * 100 : 0

    // Calculate percentiles for each effort
    const effortsWithPercentile = efforts?.map((effort: any) => {
      const betterCount = times.filter(time => time < effort.elapsed_time).length
      const percentile = totalEfforts > 1 ? 100 * (betterCount / (totalEfforts - 1)) : 0
      return { ...effort, percentile: Math.round(percentile) }
    }).sort((a: any, b: any) => b.elapsed_time - a.elapsed_time) || []

    // Find PR (best effort)
    const pr = efforts?.reduce((best: any, effort: any) => 
      !best || effort.elapsed_time < best.elapsed_time ? effort : best, null
    )

    // Find most recent effort
    const mostRecent = efforts?.sort((a: any, b: any) => 
      new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
    )[0]

    const stats = {
      totalEfforts,
      bestTime,
      worstTime,
      averageTime,
      elevationGain,
      steepness,
      distance: segment.distance
    }

    const { default: SegmentDetailClient } = await import('./segment-detail-client')

    return (
      <SegmentDetailClient
        segment={segment}
        efforts={effortsWithPercentile}
        stats={stats}
        pr={pr}
        mostRecent={mostRecent}
      />
    )
  } catch (error) {
    console.error('Error loading segment details:', error)
    
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
              Error Loading Segment Details
            </h3>
          </div>
        </div>
        <div className="text-sm text-red-700 dark:text-red-300">
          <p>There was an error loading the segment details. Please try refreshing the page or check your connection.</p>
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