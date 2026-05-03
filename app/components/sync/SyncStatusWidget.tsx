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
  const exactState = useSyncStore((s) => s.exactState)
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
  const [startFrom, setStartFrom] = useState<'oldest' | 'newest'>('newest')
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
  const activityQueue = exactState?.activityQueue
  const segmentsQueue = exactState?.segmentsQueue
  const activityQueueList = exactState?.activityQueueList ?? []
  const segmentQueueList = exactState?.segmentQueueList ?? []
  const activityQueueHeldCount = activityQueue
    ? Math.max(activityQueueList.length, activityQueue.pending + activityQueue.in_progress + activityQueue.failed)
    : activityQueueList.length
  const segmentsQueueHeldCount = segmentsQueue
    ? Math.max(
        segmentQueueList.length,
        segmentsQueue.pending + segmentsQueue.in_progress + segmentsQueue.failed
      )
    : segmentQueueList.length
  const currentActivity = exactState?.currentActivity
  const currentActivityStep =
    job?.current_phase === 'ensure_segments'
      ? 'fetch_details/persist_segments/persist_efforts'
      : job?.current_phase === 'ensure_segment_efforts'
        ? 'mark_completed'
        : job?.current_phase === 'discover_activities'
          ? 'discover_activities'
          : 'idle'
  const formatDateTime = (value: string | null | undefined) => {
    if (!value) return '-'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return '-'
    return date.toLocaleString()
  }
  const renderProgress = (processed: number, total: number) =>
    total > 0 ? `${processed}/${total}` : `${processed}`

  const status = job?.status ?? 'idle'
  const activityDisplayProcessed =
    status === 'completed' && activityQueue ? Math.max(activities.processed, activityQueue.completed) : activities.processed
  const activityDisplayTotal =
    status === 'completed' && activityQueue
      ? Math.max(activities.total, activityQueue.pending + activityQueue.in_progress + activityQueue.completed + activityQueue.failed)
      : activities.total
  const progressDisplayProcessed = job?.total_items && job.total_items > 0 ? job.processed_items : activities.processed
  const progressDisplayTotal =
    job?.total_items && job.total_items > 0
      ? job.total_items
      : activities.total > 0
        ? activities.total
        : activityQueue
          ? activityQueue.pending + activityQueue.in_progress + activityQueue.completed + activityQueue.failed
          : 0
  const progressDisplayText =
    progressDisplayTotal > 0
      ? `${progressDisplayProcessed}/${progressDisplayTotal}`
      : `${progressDisplayProcessed}`
  const percentage = useMemo(() => {
    if (!job) return 0
    if (progressDisplayTotal > 0) {
      return Math.round((progressDisplayProcessed / progressDisplayTotal) * 100)
    }
    return 0
  }, [job, progressDisplayProcessed, progressDisplayTotal])
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
    await startSync('/api/sync/start', { start_from: startFrom })
  }

  const onCancel = async () => {
    if (!confirm('Cancel the current sync?')) return
    await cancelActiveJob()
  }

  const onRestart = async () => {
    if (!confirm('Restart sync now? This will cancel the current job and start a new one.')) return
    await cancelActiveJob()
    await startSync('/api/sync/start', { start_from: startFrom })
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
                  ? `${activityDisplayProcessed}/${activityDisplayTotal || job.total_items || 0} activities scanned`
                  : `${activityDisplayProcessed}/${activityDisplayTotal || job.total_items || 0} activities`
                : 'Start a sync job from dashboard'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="sync-start-from" className="text-xs text-gray-500 dark:text-gray-400">
            Start from
          </label>
          <select
            id="sync-start-from"
            value={startFrom}
            onChange={(e) => setStartFrom(e.target.value === 'oldest' ? 'oldest' : 'newest')}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
          </select>
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
            <span>{progressDisplayText}</span>
          </div>
        </div>
      )}

      {variant === 'detailed' && (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg border border-gray-200 p-2 text-xs dark:border-gray-700">
              <p className="text-gray-500">Activities</p>
              <p className="font-semibold text-gray-900 dark:text-white">{activityDisplayProcessed}/{activityDisplayTotal}</p>
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

          {activityQueue && (
            <div className="rounded-lg border border-gray-200 p-3 text-xs dark:border-gray-700">
              <div className="mb-1 flex items-center justify-between gap-2">
                <p className="font-medium text-gray-900 dark:text-white">Activity Queue</p>
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-200">
                  Live held: {activityQueueHeldCount}
                </span>
              </div>
              <p className="text-gray-600 dark:text-gray-300">
                Pending {activityQueue.pending} · In progress {activityQueue.in_progress} · Completed {activityQueue.completed} · Failed {activityQueue.failed}
              </p>
              {currentActivity && (
                <p className="mt-1 text-gray-500 dark:text-gray-400">
                  Current activity #{currentActivity.activityId}
                  {currentActivity.name ? ` (${currentActivity.name})` : ''} · Step {currentActivityStep}
                </p>
              )}
              {activityQueueList.length > 0 && (
                <div className="mt-2 max-h-44 overflow-auto rounded border border-gray-100 dark:border-gray-700">
                  {activityQueueList.map((item, index) => (
                    <div
                      key={`${item.activityId}-${index}`}
                      className="flex items-center justify-between border-b border-gray-100 px-2 py-1 last:border-b-0 dark:border-gray-700"
                    >
                      <span className="truncate text-gray-700 dark:text-gray-200">
                        {index + 1}. #{item.activityId} {item.name ? `· ${item.name}` : ''}
                      </span>
                      <span className="ml-2 shrink-0 text-gray-500 dark:text-gray-400">
                        {item.state || 'pending'} · {formatDateTime(item.startDate)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {segmentsQueue && (
            <div className="rounded-lg border border-gray-200 p-3 text-xs dark:border-gray-700">
              <div className="mb-1 flex items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Segments queue</p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    Activities still needing segment effort sync (counts update from your Strava-linked rows).
                  </p>
                </div>
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-200">
                  Live held: {segmentsQueueHeldCount}
                </span>
              </div>
              <p className="text-gray-600 dark:text-gray-300">
                Pending {segmentsQueue.pending} · In progress {segmentsQueue.in_progress} · Completed{' '}
                {segmentsQueue.completed} · Failed {segmentsQueue.failed}
              </p>
              {segmentQueueList.length > 0 && (
                <div className="mt-2 max-h-44 overflow-auto rounded border border-gray-100 dark:border-gray-700">
                  {segmentQueueList.map((item, index) => (
                    <div
                      key={`${item.activityId}-${index}`}
                      className="flex items-center justify-between border-b border-gray-100 px-2 py-1 last:border-b-0 dark:border-gray-700"
                    >
                      <span className="truncate text-gray-700 dark:text-gray-200">
                        {index + 1}. #{item.activityId} {item.name ? `· ${item.name}` : ''}
                      </span>
                      <span className="ml-2 shrink-0 text-gray-500 dark:text-gray-400">
                        {item.segmentsFetchStatus || 'pending'}
                        {item.activitySyncState ? ` · sync ${item.activitySyncState}` : ''} · {formatDateTime(item.startDate ?? item.queuedAt)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

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
