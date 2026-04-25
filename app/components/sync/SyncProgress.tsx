'use client'

import { useEffect, useState } from 'react'
import { CheckCircle, XCircle, Loader2 } from 'lucide-react'
import type { SyncJob } from '@/lib/repositories/sync-jobs-repository'

interface RateLimits {
  requests15min: number
  limit15min: number
  remaining15min: number
  requestsDay: number
  limitDay: number
  remainingDay: number
  nextReset15min: string
  nextResetDaily: string
  lastUpdate: string
}

function parseRateLimitHeaders(headers: Headers): Pick<
  RateLimits,
  'requests15min' | 'limit15min' | 'remaining15min' | 'requestsDay' | 'limitDay' | 'remainingDay' | 'lastUpdate'
> | null {
  const usage = headers.get('X-RateLimit-Usage')
  const limit = headers.get('X-RateLimit-Limit')
  const lastUpdate = headers.get('X-RateLimit-LastUpdate') ?? new Date().toISOString()

  if (!usage || !limit) return null

  const [requests15min, requestsDay] = usage.split(',').map((n) => Number(n))
  const [limit15min, limitDay] = limit.split(',').map((n) => Number(n))

  if (![requests15min, requestsDay, limit15min, limitDay].every(Number.isFinite)) return null

  return {
    requests15min,
    limit15min,
    remaining15min: Math.max(0, limit15min - requests15min),
    requestsDay,
    limitDay,
    remainingDay: Math.max(0, limitDay - requestsDay),
    lastUpdate,
  }
}

interface SyncProgressProps {
  jobId: string
  onComplete?: () => void
}

export function SyncProgress({ jobId, onComplete }: SyncProgressProps) {
  const [job, setJob] = useState<SyncJob | null>(null)
  const [rateLimits, setRateLimits] = useState<RateLimits | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isCancelling, setIsCancelling] = useState(false)

  useEffect(() => {
    let timeoutId: NodeJS.Timeout
    let pollIntervalMs = 2000 // Start with 2 seconds
    const maxPollIntervalMs = 30000
    const jitter = (ms: number) => {
      // +/- 15% jitter to avoid synchronized polling.
      const r = 0.85 + Math.random() * 0.3
      return Math.round(ms * r)
    }
    let lastSignature: string | null = null
    let resumeAttempted = false

    const fetchStatus = async () => {
      try {
        const response = await fetch(`/api/sync/status/${jobId}`)
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch status')
        }

        setJob(data.job)
        const headerLimits = parseRateLimitHeaders(response.headers)
        setRateLimits(
          headerLimits
            ? {
                ...headerLimits,
                // These reset timestamps are informational; if we need them later we can
                // add explicit headers. For now keep them as best-effort.
                nextReset15min: data.rateLimits?.nextReset15min ?? new Date().toISOString(),
                nextResetDaily: data.rateLimits?.nextResetDaily ?? new Date().toISOString(),
              }
            : null
        )

        // If the job is paused and the resume time has passed, proactively ask the server to resume it.
        // This prevents jobs from getting stuck in paused state when no external cron is configured.
        if (data.job.status === 'paused' && data.job.resume_at && !resumeAttempted) {
          const resumeTime = new Date(data.job.resume_at).getTime()
          if (Number.isFinite(resumeTime) && Date.now() >= resumeTime) {
            resumeAttempted = true
            // Fire-and-forget: the next poll will pick up the new status (running/paused/failed).
            fetch(`/api/sync/resume/${jobId}`, { method: 'POST' }).catch(() => {})
          }
        }

        if (['completed', 'failed', 'cancelled'].includes(data.job.status)) {
          // Job finished, stop polling
          return
        }

        // Exponential backoff: if nothing changes, we back off (up to a cap).
        // If something changes, reset to fast polling.
        const signature = [
          data.job.status,
          data.job.processed_items,
          data.job.failed_items,
          data.job.updated_at,
        ].join('|')

        const changed = lastSignature !== signature
        lastSignature = signature

        // Base interval by status (before backoff tuning).
        let baseIntervalMs = 5000
        if (data.job.status === 'running') baseIntervalMs = 2000
        if (data.job.status === 'pending') baseIntervalMs = 5000

        // Special-case paused: schedule around resume_at (more practical than blind backoff).
        if (data.job.status === 'paused' && data.job.resume_at) {
          const resumeTime = new Date(data.job.resume_at).getTime()
          const now = Date.now()
          const msUntilResume = resumeTime - now

          if (msUntilResume > 60000) {
            baseIntervalMs = 60000
          } else if (msUntilResume > 10000) {
            baseIntervalMs = 5000
          } else {
            baseIntervalMs = 2000
          }

          pollIntervalMs = baseIntervalMs
        } else if (changed) {
          pollIntervalMs = baseIntervalMs
        } else {
          // No change: exponential backoff from current interval.
          pollIntervalMs = Math.min(maxPollIntervalMs, Math.max(baseIntervalMs, pollIntervalMs * 2))
        }

        // Schedule next poll
        timeoutId = setTimeout(fetchStatus, jitter(pollIntervalMs))

        if (data.job.status === 'completed' && onComplete) {
          onComplete()
        }
      } catch (err: any) {
        console.error('Error fetching job status:', err)
        setError(err?.message || 'Unknown error')
      }
    }

    fetchStatus()

    return () => {
      if (timeoutId) clearTimeout(timeoutId)
    }
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

  // Some jobs (older rows / partial updates) may have missing progress or missing
  // nested keys (e.g. `{}`), so guard each field we render.
  const zero = { total: 0, processed: 0, failed: 0 }
  const activities = job.progress?.activities ?? zero
  const laps = job.progress?.laps ?? zero
  const streams = job.progress?.streams ?? zero

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
          <span>{activities.processed} / {activities.total}</span>
        </div>
        <div className="flex justify-between text-gray-600">
          <span>Laps:</span>
          <span>{laps.processed} / {laps.total}</span>
        </div>
        <div className="flex justify-between text-gray-600">
          <span>Streams:</span>
          <span>{streams.processed} / {streams.total}</span>
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
