import type { SyncCoverage } from '@/lib/sync/sync-coverage'

function formatCompletedAt(iso: string | null): string {
  if (!iso) return 'Never'
  return new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
}

function ProgressRow({ label, value, max, percent }: { label: string; value: number; max: number; percent: number }) {
  const pct = Math.min(100, Math.max(0, percent))
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-gray-600 dark:text-gray-400">{label}</span>
        <span className="font-medium text-gray-900 dark:text-white">
          {value.toLocaleString()} / {max.toLocaleString()} ({pct}%)
        </span>
      </div>
      <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
        <div
          className="h-full rounded-full bg-blue-600 dark:bg-blue-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export function SyncCoverageSummary({ coverage }: { coverage: SyncCoverage }) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Sync coverage</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Progress for your account and when each sync type last completed successfully.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white">Activities</h3>
          <ProgressRow
            label="Imported (estimate)"
            value={coverage.activities.stored}
            max={Math.max(coverage.activities.estimatedTotal, coverage.activities.stored, 1)}
            percent={coverage.activities.importPercent}
          />
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Last sync: {formatCompletedAt(coverage.activities.lastSyncAt)}
          </p>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white">Segments</h3>
          <ProgressRow
            label="Activities with segment data"
            value={coverage.segments.activitiesWithSegments}
            max={Math.max(coverage.segments.totalActivities, 1)}
            percent={Math.round(coverage.segments.percent)}
          />
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Last sync: {formatCompletedAt(coverage.segments.lastSyncAt)}
          </p>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white">Segment efforts</h3>
          <ProgressRow
            label="Segments with stored efforts"
            value={coverage.segmentEfforts.segmentsWithEfforts}
            max={Math.max(coverage.segmentEfforts.uniqueSegmentsAttempted, 1)}
            percent={Math.round(coverage.segmentEfforts.percent)}
          />
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Last sync: {formatCompletedAt(coverage.segmentEfforts.lastSyncAt)}
          </p>
        </div>
      </div>
    </div>
  )
}
