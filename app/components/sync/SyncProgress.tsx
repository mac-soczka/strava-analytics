'use client'

import { useEffect } from 'react'
import { CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { useSyncStore } from '@/app/state/useSyncStore'

interface SyncProgressProps {
  jobId: string
  onComplete?: () => void
}

export function SyncProgress({ jobId, onComplete }: SyncProgressProps) {
  const job = useSyncStore((s) => s.job)
  const rateLimits = useSyncStore((s) => s.rateLimits)
  const error = useSyncStore((s) => s.error)
  const isCancelling = useSyncStore((s) => s.isCancelling)
  const cancelActiveJob = useSyncStore((s) => s.cancelActiveJob)
  const startPolling = useSyncStore((s) => s.startPolling)
  const stopPolling = useSyncStore((s) => s.stopPolling)

  const jobEntityLabel = (() => {
    if (!job) return 'data'
    switch (job.type) {
      case 'activities_only':
        return 'activities'
      case 'segments_only':
        return 'segments'
      case 'segment_efforts_only':
        return 'segment efforts'
      case 'routes_only':
        return 'routes'
      case 'stats_only':
        return 'stats'
      case 'full_sync':
      default:
        return 'data'
    }
  })()

  useEffect(() => {
    startPolling(jobId)
    return () => stopPolling()
  }, [jobId, startPolling, stopPolling])

  useEffect(() => {
    if (!job) return
    if (job.id !== jobId) return
    if (job.status === 'completed' && onComplete) onComplete()
  }, [job, jobId, onComplete])

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel this sync?')) {
      return
    }
    try {
      await cancelActiveJob()
    } catch (err: any) {
      console.error('Error cancelling job:', err)
    }
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-center gap-2 text-red-700">
          <XCircle className="w-5 h-5" />
          <span className="font-medium">Error</span>
        </div>
        <p className="mt-1 text-sm text-red-600">{error}</p>
      </div>
    )
  }

  if (!job) {
    return (
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <div className="flex items-center gap-2 text-gray-600">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Loading sync status...</span>
        </div>
      </div>
    )
  }

  if (job.id !== jobId) {
    return (
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <div className="flex items-center gap-2 text-gray-600">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Loading sync status...</span>
        </div>
      </div>
    )
  }

  const zero = { total: 0, processed: 0, failed: 0 }
  const activities = job.progress?.activities ?? zero
  const segmentEfforts = job.progress?.streams ?? zero
  const segments = job.progress?.segments ?? zero

  const segmentFocused =
    job.type === 'segments_only' || job.type === 'segment_efforts_only'

  const progressPercentage = (() => {
    if (job.total_items > 0) {
      return Math.round((job.processed_items / job.total_items) * 100)
    }
    if (segmentFocused && segments.total > 0) {
      return Math.round((segments.processed / segments.total) * 100)
    }
    if (activities.total > 0) {
      return Math.round((activities.processed / activities.total) * 100)
    }
    return 0
  })()

  // Some jobs (older rows / partial updates) may have missing progress or missing
  // nested keys (e.g. `{}`), so guard each field we render.

  return (
    <div className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {job.status === 'running' && (
            <>
              <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
              <span className="font-medium text-gray-900">Syncing {jobEntityLabel}...</span>
            </>
          )}
          {job.status === 'completed' && (
            <>
              <CheckCircle className="w-5 h-5 text-green-500" />
              <span className="font-medium text-gray-900">Sync Complete!</span>
            </>
          )}
          {job.status === 'failed' && (
            <>
              <XCircle className="w-5 h-5 text-red-500" />
              <span className="font-medium text-gray-900">Sync Failed</span>
            </>
          )}
          {job.status === 'pending' && (
            <>
              <Loader2 className="w-5 h-5 text-gray-400" />
              <span className="font-medium text-gray-900">Starting...</span>
            </>
          )}
          {job.status === 'paused' && (
            <>
              <Loader2 className="w-5 h-5 text-yellow-500" />
              <span className="font-medium text-gray-900">Paused</span>
            </>
          )}
          {job.status === 'cancelled' && (
            <>
              <XCircle className="w-5 h-5 text-gray-500" />
              <span className="font-medium text-gray-900">Cancelled</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">{progressPercentage}%</span>
          {(job.status === 'running' || job.status === 'paused' || job.status === 'pending') && (
            <button
              onClick={handleCancel}
              disabled={isCancelling}
              className="px-3 py-1 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded border border-red-300 hover:border-red-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCancelling ? 'Cancelling...' : 'Cancel'}
            </button>
          )}
        </div>
      </div>

      {job.status === 'paused' && job.resume_at && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
          <p className="text-sm text-yellow-800">
            ⏸️ Sync paused due to rate limiting. Will automatically resume at{' '}
            {new Date(job.resume_at).toLocaleTimeString()}
          </p>
          {job.pause_reason && (
            <p className="text-xs text-yellow-700 mt-1">{job.pause_reason}</p>
          )}
        </div>
      )}

      <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
        <div
          className="bg-blue-500 h-2 rounded-full transition-all duration-300"
          style={{ width: `${progressPercentage}%` }}
        />
      </div>

      <div className="space-y-2 text-sm">
        {segmentFocused ? (
          <div className="flex justify-between text-gray-600">
            <span>
              Activities (fetching {job.type === 'segment_efforts_only' ? 'segment efforts' : 'segments'}):
            </span>
            <span>{segments.processed} / {segments.total}</span>
          </div>
        ) : (
          <>
            <div className="flex justify-between text-gray-600">
              <span>Activities:</span>
              <span>{activities.processed} / {activities.total}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Segment Efforts:</span>
              <span>{segmentEfforts.processed} / {segmentEfforts.total}</span>
            </div>
            {(job.type === 'full_sync' || segments.total > 0) && (
              <div className="flex justify-between text-gray-600">
                <span>Segments:</span>
                <span>{segments.processed} / {segments.total}</span>
              </div>
            )}
          </>
        )}
        {job.failed_items > 0 && (
          <div className="flex justify-between text-red-600">
            <span>Failed:</span>
            <span>{job.failed_items}</span>
          </div>
        )}
      </div>

      {job.status === 'failed' && job.error_message && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded">
          <p className="text-sm text-red-700">{job.error_message}</p>
        </div>
      )}

      {rateLimits && (job.status === 'running' || job.status === 'paused') && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
          <h4 className="text-sm font-medium text-blue-900 mb-2">Strava API Rate Limits</h4>
          <div className="space-y-2">
            <div>
              <div className="flex justify-between text-xs text-blue-700 mb-1">
                <span>15-minute window:</span>
                <span className="font-medium">{rateLimits.requests15min} / {rateLimits.limit15min}</span>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-1.5">
                <div
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    rateLimits.remaining15min <= 10 ? 'bg-red-500' :
                    rateLimits.remaining15min <= 30 ? 'bg-yellow-500' :
                    'bg-blue-500'
                  }`}
                  style={{ width: `${(rateLimits.requests15min / rateLimits.limit15min) * 100}%` }}
                />
              </div>
              <p className="text-xs text-blue-600 mt-0.5">{rateLimits.remaining15min} remaining</p>
            </div>
            <div>
              <div className="flex justify-between text-xs text-blue-700 mb-1">
                <span>Daily window:</span>
                <span className="font-medium">{rateLimits.requestsDay} / {rateLimits.limitDay}</span>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-1.5">
                <div
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    rateLimits.remainingDay <= 50 ? 'bg-red-500' :
                    rateLimits.remainingDay <= 200 ? 'bg-yellow-500' :
                    'bg-blue-500'
                  }`}
                  style={{ width: `${(rateLimits.requestsDay / rateLimits.limitDay) * 100}%` }}
                />
              </div>
              <p className="text-xs text-blue-600 mt-0.5">{rateLimits.remainingDay} remaining</p>
            </div>
            <div className="pt-1 border-t border-blue-200">
              <p className="text-xs text-blue-600">
                Last updated: {new Date(rateLimits.lastUpdate).toLocaleTimeString()}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
