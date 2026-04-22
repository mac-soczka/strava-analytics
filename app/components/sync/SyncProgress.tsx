'use client'

import { useEffect, useState } from 'react'
import { CheckCircle, XCircle, Loader2 } from 'lucide-react'
import type { SyncJob } from '@/lib/repositories/sync-jobs-repository'

interface SyncProgressProps {
  jobId: string
  onComplete?: () => void
}

export function SyncProgress({ jobId, onComplete }: SyncProgressProps) {
  const [job, setJob] = useState<SyncJob | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isCancelling, setIsCancelling] = useState(false)

  useEffect(() => {
    let interval: NodeJS.Timeout

    const fetchStatus = async () => {
      try {
        const response = await fetch(`/api/sync/status/${jobId}`)
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch status')
        }

        setJob(data.job)

        if (['completed', 'failed', 'cancelled'].includes(data.job.status)) {
          clearInterval(interval)
          if (data.job.status === 'completed' && onComplete) {
            onComplete()
          }
        }
      } catch (err: any) {
        console.error('Error fetching job status:', err)
        setError(err?.message || 'Unknown error')
        clearInterval(interval)
      }
    }

    fetchStatus()

    interval = setInterval(fetchStatus, 2000)

    return () => clearInterval(interval)
  }, [jobId, onComplete])

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel this sync?')) {
      return
    }

    setIsCancelling(true)
    try {
      const response = await fetch(`/api/sync/cancel/${jobId}`, {
        method: 'POST',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to cancel job')
      }

      const data = await response.json()
      setJob(data.job)
    } catch (err: any) {
      console.error('Error cancelling job:', err)
      setError(err?.message || 'Failed to cancel')
    } finally {
      setIsCancelling(false)
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

  const progressPercentage = job.total_items > 0
    ? Math.round((job.processed_items / job.total_items) * 100)
    : 0

  return (
    <div className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {job.status === 'running' && (
            <>
              <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
              <span className="font-medium text-gray-900">Syncing...</span>
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
        <div className="flex justify-between text-gray-600">
          <span>Activities:</span>
          <span>{job.progress.activities.processed} / {job.progress.activities.total}</span>
        </div>
        <div className="flex justify-between text-gray-600">
          <span>Laps:</span>
          <span>{job.progress.laps.processed} / {job.progress.laps.total}</span>
        </div>
        <div className="flex justify-between text-gray-600">
          <span>Streams:</span>
          <span>{job.progress.streams.processed} / {job.progress.streams.total}</span>
        </div>
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
    </div>
  )
}
