import {
  getDashboardRangeSinceIso,
  resolveDashboardTimeRange,
} from '@/lib/server/dashboard-time-range'

describe('dashboard time range helpers', () => {
  it('defaults to 30d for unknown values', () => {
    expect(resolveDashboardTimeRange(undefined)).toBe('30d')
    expect(resolveDashboardTimeRange('bad-value')).toBe('30d')
  })

  it('returns null since date for all time', () => {
    expect(getDashboardRangeSinceIso('all')).toBeNull()
  })

  it('computes since date for day-based ranges', () => {
    const now = new Date('2026-05-02T08:00:00.000Z')
    expect(getDashboardRangeSinceIso('7d', now)).toBe('2026-04-25T08:00:00.000Z')
    expect(getDashboardRangeSinceIso('30d', now)).toBe('2026-04-02T08:00:00.000Z')
  })
})
