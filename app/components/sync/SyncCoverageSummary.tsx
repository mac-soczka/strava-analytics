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

function StatLines({ lines }: { lines: { label: string; value: string }[] }) {
  return (
    <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
      {lines.map(({ label, value }) => (
        <li key={label} className="flex justify-between gap-3">
          <span className="text-gray-600 dark:text-gray-400">{label}</span>
          <span className="font-medium text-gray-900 dark:text-white text-right">{value}</span>
        </li>
      ))}
    </ul>
  )
}

export function SyncCoverageSummary({ coverage }: { coverage: SyncCoverage }) {
  const seg = coverage.segments
  const eff = coverage.segmentEfforts
  const n = (v: number | undefined) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Sync coverage</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Activities are imported first. Segment lists and effort rows are fetched per activity—many segments (or none)
          can appear on a single ride, and each stored crossing is one database row.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white">Activities</h3>
          <ProgressRow
            label="Imported (estimate)"
            value={n(coverage.activities.stored)}
            max={Math.max(
              n(coverage.activities.estimatedTotal),
              n(coverage.activities.stored),
              1
            )}
            percent={n(coverage.activities.importPercent)}
          />
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Last sync: {formatCompletedAt(coverage.activities.lastSyncAt)}
          </p>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white">Segment lists</h3>
          <StatLines
            lines={[
              {
                label: 'Activities checked',
                value: `${n(seg?.activitiesCheckedForSegmentList).toLocaleString()} / ${n(seg?.importedActivities).toLocaleString()}`,
              },
              {
                label: 'Still queued',
                value: n(seg?.activitiesQueuedForSegmentList).toLocaleString(),
              },
              {
                label: 'Crossings stored',
                value: `${n(seg?.segmentCrossingRows).toLocaleString()} rows · ${n(seg?.distinctSegmentsCrossed).toLocaleString()} segments`,
              },
            ]}
          />
          <p className="text-xs text-gray-500 dark:text-gray-400">
            “Checked” means we requested this activity’s segment list from Strava. Crossings are stored segment-effort
            rows (each ride × segment appearance).
            <span className="block mt-1">Last sync: {formatCompletedAt(seg?.lastSyncAt ?? null)}</span>
          </p>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white">Segment efforts</h3>
          <StatLines
            lines={[
              {
                label: 'Effort rows stored',
                value: n(eff?.effortRowsStored).toLocaleString(),
              },
              {
                label: 'Distinct segments',
                value: n(eff?.distinctSegments).toLocaleString(),
              },
              {
                label: 'Activities with ≥1 row',
                value: `${n(eff?.activitiesWithAtLeastOneEffortRow).toLocaleString()} / ${n(eff?.importedActivities).toLocaleString()}`,
              },
            ]}
          />
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Row count is the meaningful volume metric; activity counts only describe how many rides include at least one
            crossing.
            <span className="block mt-1">Last sync: {formatCompletedAt(eff?.lastSyncAt ?? null)}</span>
          </p>
        </div>
      </div>
    </div>
  )
}
