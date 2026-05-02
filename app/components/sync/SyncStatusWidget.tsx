'use client'

import { useEffect, useMemo, useState } from 'react'
import { Activity, CheckCircle, Loader2, PauseCircle, XCircle } from 'lucide-react'
import { useSyncStore } from '@/app/state/useSyncStore'

interface SyncStatusWidgetProps {
  variant?: 'compact' | 'detailed'
}

const zeroProgress = { total: 0, processed: 0, failed: 0 }
type SegmentSuggestion = {
  segmentId: number
  name: string
  city?: string | null
  state?: string | null
  country?: string | null
}

type SegmentLookup = {
  segmentId: number
  name: string
  distance: number
  elevationGain: number
  averageGrade: number
  maximumGrade: number
  city?: string | null
  state?: string | null
  country?: string | null
  totalEfforts: number
}

export function SyncStatusWidget({ variant = 'compact' }: SyncStatusWidgetProps) {
  const activeJobId = useSyncStore((s) => s.activeJobId)
  const job = useSyncStore((s) => s.job)
  const error = useSyncStore((s) => s.error)
  const isStarting = useSyncStore((s) => s.isStarting)
  const isCancelling = useSyncStore((s) => s.isCancelling)
  const startSync = useSyncStore((s) => s.startSync)
  const cancelActiveJob = useSyncStore((s) => s.cancelActiveJob)
  const hydrate = useSyncStore((s) => s.hydrate)
  const startPolling = useSyncStore((s) => s.startPolling)
  const stopPolling = useSyncStore((s) => s.stopPolling)
  const [segmentQuery, setSegmentQuery] = useState('')
  const [segmentSuggestions, setSegmentSuggestions] = useState<SegmentSuggestion[]>([])
  const [selectedSegment, setSelectedSegment] = useState<SegmentSuggestion | null>(null)
  const [isSearchingSegments, setIsSearchingSegments] = useState(false)
  const [segmentLookup, setSegmentLookup] = useState<SegmentLookup | null>(null)
  const [isLookingUpSegment, setIsLookingUpSegment] = useState(false)
  const [segmentLookupError, setSegmentLookupError] = useState<string | null>(null)

  useEffect(() => {
    void hydrate()
  }, [hydrate])

  useEffect(() => {
    if (activeJobId) {
      startPolling(activeJobId)
      return () => stopPolling()
    }
  }, [activeJobId, startPolling, stopPolling])

  useEffect(() => {
    if (segmentQuery.trim().length < 2) {
      setSegmentSuggestions([])
      return
    }

    let cancelled = false
    const timeout = setTimeout(async () => {
      setIsSearchingSegments(true)
      try {
        const response = await fetch(
          `/api/segments/suggest?q=${encodeURIComponent(segmentQuery.trim())}&limit=8`,
          { credentials: 'include' }
        )
        if (!response.ok) throw new Error('Failed to load segment suggestions')
        const data = (await response.json()) as { suggestions?: SegmentSuggestion[] }
        if (!cancelled) {
          setSegmentSuggestions(data.suggestions || [])
        }
      } catch {
        if (!cancelled) setSegmentSuggestions([])
      } finally {
        if (!cancelled) setIsSearchingSegments(false)
      }
    }, 250)

    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
  }, [segmentQuery])

  useEffect(() => {
    const segmentIdFromInput = Number(segmentQuery.trim())
    const segmentId =
      selectedSegment?.segmentId ??
      (Number.isFinite(segmentIdFromInput) && segmentIdFromInput > 0 ? Math.floor(segmentIdFromInput) : null)

    if (!segmentId) {
      setSegmentLookup(null)
      setSegmentLookupError(null)
      return
    }

    let cancelled = false
    const timeout = setTimeout(async () => {
      setIsLookingUpSegment(true)
      setSegmentLookupError(null)
      try {
        const response = await fetch(`/api/segments/lookup?segmentId=${segmentId}`, {
          credentials: 'include',
        })
        const data = (await response.json()) as {
          segment?: SegmentLookup | null
          error?: string
        }
        if (!response.ok) {
          throw new Error(data.error || 'Failed to load segment details')
        }
        if (!cancelled) {
          if (data.segment) {
            setSegmentLookup(data.segment)
          } else {
            setSegmentLookup(null)
            setSegmentLookupError(`Segment #${segmentId} was not found in your synced catalog yet.`)
          }
        }
      } catch (error: any) {
        if (!cancelled) {
          setSegmentLookup(null)
          setSegmentLookupError(
            typeof error?.message === 'string' && error.message.length > 0
              ? error.message
              : 'Unable to load segment details right now.'
          )
        }
      } finally {
        if (!cancelled) setIsLookingUpSegment(false)
      }
    }, 200)

    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
  }, [segmentQuery, selectedSegment])

  const activities = job?.progress?.activities ?? zeroProgress
  const segments = job?.progress?.segments ?? zeroProgress
  const segmentEfforts = job?.progress?.segment_efforts ?? job?.progress?.streams ?? zeroProgress
  const renderProgress = (processed: number, total: number) =>
    total > 0 ? `${processed}/${total}` : `${processed}`

  const percentage = useMemo(() => {
    if (!job) return 0
    if (job.total_items > 0) {
      return Math.round((job.processed_items / job.total_items) * 100)
    }
    if (activities.total > 0) {
      return Math.round((activities.processed / activities.total) * 100)
    }
    return 0
  }, [job, activities.total, activities.processed])

  const status = job?.status ?? 'idle'
  const isActive = status === 'running' || status === 'pending' || status === 'paused'

  const statusMeta = {
    idle: { icon: CheckCircle, text: 'No active sync', tone: 'text-gray-700' },
    pending: { icon: Loader2, text: 'Preparing sync', tone: 'text-blue-700' },
    running: { icon: Loader2, text: 'Sync in progress', tone: 'text-blue-700' },
    paused: { icon: PauseCircle, text: 'Sync paused', tone: 'text-yellow-700' },
    completed: { icon: CheckCircle, text: 'Sync completed', tone: 'text-green-700' },
    failed: { icon: XCircle, text: 'Sync failed', tone: 'text-red-700' },
    cancelled: { icon: XCircle, text: 'Sync cancelled', tone: 'text-gray-700' },
  } as const

  const meta = statusMeta[status as keyof typeof statusMeta] ?? statusMeta.idle
  const StatusIcon = meta.icon

  const onStart = async () => {
    await startSync('/api/sync/start')
  }

  const onCancel = async () => {
    if (!confirm('Cancel the current sync?')) return
    await cancelActiveJob()
  }

  const onRestart = async () => {
    if (!confirm('Restart sync now? This will cancel the current job and start a new one.')) return
    await cancelActiveJob()
    await startSync('/api/sync/start')
  }

  const selectedSegmentId = segmentLookup?.segmentId ?? null

  const onStartSegmentSideline = async () => {
    if (!selectedSegmentId) return
    await startSync('/api/sync/start-segment-efforts-sideline', {
      segmentId: selectedSegmentId,
    })
    setSegmentSuggestions([])
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <StatusIcon className={`h-5 w-5 ${status === 'running' || status === 'pending' ? 'animate-spin text-blue-500' : meta.tone}`} />
          <div>
            <p className={`text-sm font-semibold ${meta.tone}`}>{meta.text}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {job
                ? job.current_phase === 'discover_activities'
                  ? `${activities.processed}/${activities.total || job.total_items || 0} activities scanned`
                  : `${activities.processed}/${activities.total || job.total_items || 0} activities`
                : 'Start a sync job from dashboard'}
            </p>
          </div>
        </div>

        {!isActive ? (
          <button
            onClick={onStart}
            disabled={isStarting}
            className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isStarting ? 'Starting...' : 'Start Sync'}
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={onCancel}
              disabled={isCancelling || isStarting}
              className="rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isCancelling ? 'Cancelling...' : 'Cancel'}
            </button>
            <button
              onClick={onRestart}
              disabled={isCancelling || isStarting}
              className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Restart
            </button>
          </div>
        )}
      </div>

      {isActive && (
        <div className="mt-3">
          <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700">
            <div className="h-2 rounded-full bg-blue-500 transition-all" style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }} />
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
            <span>{percentage}%</span>
            <span>{job?.processed_items ?? 0}/{job?.total_items ?? 0}</span>
          </div>
        </div>
      )}

      {variant === 'detailed' && (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg border border-gray-200 p-2 text-xs dark:border-gray-700">
              <p className="text-gray-500">Activities</p>
              <p className="font-semibold text-gray-900 dark:text-white">{activities.processed}/{activities.total}</p>
            </div>
            <div className="rounded-lg border border-gray-200 p-2 text-xs dark:border-gray-700">
              <p className="text-gray-500">Segments</p>
              <p className="font-semibold text-gray-900 dark:text-white">{renderProgress(segments.processed, segments.total)}</p>
            </div>
            <div className="rounded-lg border border-gray-200 p-2 text-xs dark:border-gray-700">
              <p className="text-gray-500">Segment Efforts</p>
              <p className="font-semibold text-gray-900 dark:text-white">{renderProgress(segmentEfforts.processed, segmentEfforts.total)}</p>
            </div>
          </div>

          {!isActive && (
            <div className="rounded-lg border border-gray-200 p-3 text-xs dark:border-gray-700">
              <p className="mb-2 font-medium text-gray-900 dark:text-white">
                Segment Efforts Sideline Sync
              </p>
              <div className="relative">
                <input
                  type="text"
                  value={segmentQuery}
                  onChange={(e) => {
                    setSegmentQuery(e.target.value)
                    setSelectedSegment(null)
                    setSegmentLookup(null)
                    setSegmentLookupError(null)
                  }}
                  placeholder="Search existing segments or type segment ID"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-xs text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
                {segmentSuggestions.length > 0 && (
                  <div className="absolute z-20 mt-1 max-h-52 w-full overflow-auto rounded-md border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
                    {segmentSuggestions.map((suggestion) => (
                      <button
                        key={suggestion.segmentId}
                        type="button"
                        className="w-full px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700"
                        onClick={() => {
                          setSelectedSegment(suggestion)
                          setSegmentQuery(`${suggestion.name} (${suggestion.segmentId})`)
                          setSegmentSuggestions([])
                        }}
                      >
                        <p className="font-medium text-gray-900 dark:text-white">{suggestion.name}</p>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400">
                          #{suggestion.segmentId}
                          {suggestion.city ? ` · ${suggestion.city}` : ''}
                          {suggestion.state ? `, ${suggestion.state}` : ''}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {segmentLookup && (
                <div className="mt-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-[11px] text-gray-700 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-200">
                  <p className="font-medium">{segmentLookup.name}</p>
                  <p>
                    #{segmentLookup.segmentId} · {(segmentLookup.distance / 1000).toFixed(2)} km ·{' '}
                    {Math.round(segmentLookup.elevationGain)} m · avg {segmentLookup.averageGrade.toFixed(1)}%
                  </p>
                  <p>
                    {segmentLookup.city ? `${segmentLookup.city}, ` : ''}
                    {segmentLookup.state || segmentLookup.country || 'Unknown location'} ·{' '}
                    {segmentLookup.totalEfforts} stored efforts
                  </p>
                </div>
              )}
              <div className="mt-2 flex items-center justify-between gap-3">
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  {segmentLookupError
                    ? segmentLookupError
                    : isLookingUpSegment
                      ? 'Loading segment details...'
                      : selectedSegmentId
                    ? `Target segment: ${selectedSegmentId}`
                    : isSearchingSegments
                      ? 'Searching...'
                      : 'Pick a segment suggestion or provide numeric ID'}
                </p>
                <button
                  type="button"
                  onClick={onStartSegmentSideline}
                  disabled={isStarting || !selectedSegmentId}
                  className="rounded-md bg-orange-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Start Segment Sync
                </button>
              </div>
            </div>
          )}
          {isActive && job?.type === 'segment_efforts_only' && job?.options?.targetSegmentId && (
            <div className="rounded-md border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-800 dark:border-orange-800 dark:bg-orange-900/30 dark:text-orange-200">
              Running sideline segment-efforts sync for segment #{job.options.targetSegmentId}
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="mt-3 text-xs text-red-600">{error}</p>
      )}

      {!job && (
        <div className="mt-3 flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
          <Activity className="h-3.5 w-3.5" />
          <span>Sync will appear here once started.</span>
        </div>
      )}
    </div>
  )
}
