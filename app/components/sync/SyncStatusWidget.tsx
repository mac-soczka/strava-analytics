'use client'

import { useEffect, useMemo } from 'react'
import { Activity, CheckCircle, Loader2, PauseCircle, XCircle } from 'lucide-react'
import { useSyncStore } from '@/app/state/useSyncStore'

interface SyncStatusWidgetProps {
  variant?: 'compact' | 'detailed'
}

const zeroProgress = { total: 0, processed: 0, failed: 0 }

export function SyncStatusWidget({ variant = 'compact' }: SyncStatusWidgetProps) {
  const activeJobId = useSyncStore((s) => s.activeJobId)
  const job = useSyncStore((s) => s.job)
  const error = useSyncStore((s) => s.error)
  const isStarting = useSyncStore((s) => s.isStarting)
  const startSync = useSyncStore((s) => s.startSync)
  const hydrate = useSyncStore((s) => s.hydrate)
  const startPolling = useSyncStore((s) => s.startPolling)
  const stopPolling = useSyncStore((s) => s.stopPolling)

  useEffect(() => {
    void hydrate()
  }, [hydrate])

  useEffect(() => {
    if (activeJobId) {
      startPolling(activeJobId)
      return () => stopPolling()
    }
  }, [activeJobId, startPolling, stopPolling])

  const activities = job?.progress?.activities ?? zeroProgress
  const segments = job?.progress?.segments ?? zeroProgress
  const segmentEfforts = job?.progress?.streams ?? zeroProgress

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

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <StatusIcon className={`h-5 w-5 ${status === 'running' || status === 'pending' ? 'animate-spin text-blue-500' : meta.tone}`} />
          <div>
            <p className={`text-sm font-semibold ${meta.tone}`}>{meta.text}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {job ? `${activities.processed}/${activities.total || job.total_items || 0} activities` : 'Start a sync job from dashboard'}
            </p>
          </div>
        </div>

        {!isActive && (
          <button
            onClick={onStart}
            disabled={isStarting}
            className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isStarting ? 'Starting...' : 'Start Sync'}
          </button>
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
        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="rounded-lg border border-gray-200 p-2 text-xs dark:border-gray-700">
            <p className="text-gray-500">Activities</p>
            <p className="font-semibold text-gray-900 dark:text-white">{activities.processed}/{activities.total}</p>
          </div>
          <div className="rounded-lg border border-gray-200 p-2 text-xs dark:border-gray-700">
            <p className="text-gray-500">Segments</p>
            <p className="font-semibold text-gray-900 dark:text-white">{segments.processed}/{segments.total}</p>
          </div>
          <div className="rounded-lg border border-gray-200 p-2 text-xs dark:border-gray-700">
            <p className="text-gray-500">Segment Efforts</p>
            <p className="font-semibold text-gray-900 dark:text-white">{segmentEfforts.processed}/{segmentEfforts.total}</p>
          </div>
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
