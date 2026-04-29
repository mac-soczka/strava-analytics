import { buildDashboardTrendSummary } from '@/lib/server/dashboard-activity-stats'

describe('buildDashboardTrendSummary', () => {
  const now = new Date('2026-04-29T12:00:00.000Z')

  it('computes up/down/flat directions for 30-day windows', () => {
    const rows = [
      { start_date: '2026-04-20T10:00:00.000Z', distance: 10000, total_elevation_gain: 200 },
      { start_date: '2026-04-05T10:00:00.000Z', distance: 5000, total_elevation_gain: 50 },
      { start_date: '2026-03-15T10:00:00.000Z', distance: 4000, total_elevation_gain: 180 },
      { start_date: '2026-03-10T10:00:00.000Z', distance: 3000, total_elevation_gain: 120 },
    ]

    const summary = buildDashboardTrendSummary(rows, 30, now)

    expect(summary.windowDays).toBe(30)
    expect(summary.activities.current).toBe(2)
    expect(summary.activities.previous).toBe(2)
    expect(summary.activities.direction).toBe('flat')

    expect(summary.distanceMeters.current).toBe(15000)
    expect(summary.distanceMeters.previous).toBe(7000)
    expect(summary.distanceMeters.direction).toBe('up')

    expect(summary.elevationMeters.current).toBe(250)
    expect(summary.elevationMeters.previous).toBe(300)
    expect(summary.elevationMeters.direction).toBe('down')
  })

  it('returns null percentage when previous window has no data', () => {
    const rows = [
      { start_date: '2026-04-28T10:00:00.000Z', distance: 1000, total_elevation_gain: 20 },
    ]

    const summary = buildDashboardTrendSummary(rows, 30, now)

    expect(summary.activities.previous).toBe(0)
    expect(summary.activities.deltaPercent).toBeNull()
    expect(summary.distanceMeters.deltaPercent).toBeNull()
    expect(summary.elevationMeters.deltaPercent).toBeNull()
  })

  it('ignores invalid or out-of-window rows', () => {
    const rows = [
      { start_date: 'invalid-date', distance: 9999, total_elevation_gain: 999 },
      { start_date: '2025-01-01T00:00:00.000Z', distance: 9999, total_elevation_gain: 999 },
      { start_date: '2026-04-10T00:00:00.000Z', distance: 2000, total_elevation_gain: 40 },
    ]

    const summary = buildDashboardTrendSummary(rows, 30, now)

    expect(summary.activities.current).toBe(1)
    expect(summary.distanceMeters.current).toBe(2000)
    expect(summary.elevationMeters.current).toBe(40)
  })
})
