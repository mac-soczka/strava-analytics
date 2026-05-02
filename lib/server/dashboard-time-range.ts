export const DASHBOARD_TIME_RANGES = [
  { key: '7d', label: '7D', days: 7, description: 'Last 7 days' },
  { key: '30d', label: '30D', days: 30, description: 'Last 30 days' },
  { key: '90d', label: '90D', days: 90, description: 'Last 90 days' },
  { key: '365d', label: '1Y', days: 365, description: 'Last 1 year' },
  { key: 'all', label: 'All', days: null, description: 'All time' },
] as const

export type DashboardTimeRangeKey = (typeof DASHBOARD_TIME_RANGES)[number]['key']

export function resolveDashboardTimeRange(input: string | undefined): DashboardTimeRangeKey {
  return DASHBOARD_TIME_RANGES.some((range) => range.key === input)
    ? (input as DashboardTimeRangeKey)
    : '30d'
}

export function getDashboardRangeSinceIso(range: DashboardTimeRangeKey, now = new Date()): string | null {
  const config = DASHBOARD_TIME_RANGES.find((item) => item.key === range)
  if (!config || config.days == null) return null
  const since = new Date(now)
  since.setDate(since.getDate() - config.days)
  return since.toISOString()
}

export function getDashboardRangeDescription(range: DashboardTimeRangeKey): string {
  return DASHBOARD_TIME_RANGES.find((item) => item.key === range)?.description ?? 'Last 30 days'
}
