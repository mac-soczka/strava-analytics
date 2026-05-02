'use client'

import DashboardClient from '@/app/dashboard/dashboard-client'

const stats = {
  totalActivities: 128,
  totalSegments: 342,
  totalEfforts: 901,
  segmentsAttempted: 211,
  totalDistance: 1850,
  totalTime: 162,
  totalElevation: 24500,
  avgSpeed: 24.1,
  avgElevationPerActivity: 191,
}

const recentActivities = [
  {
    activity_id: 1,
    name: 'Morning Ride',
    distance: 32450,
    moving_time: 4120,
    total_elevation_gain: 420,
    type: 'ride',
    start_date: '2026-04-28T07:12:00.000Z',
    polyline: null,
  },
]

const topSegments = [
  {
    id: 11,
    name: 'River Climb',
    distance: 1200,
    elevation: 96,
    effortCount: 24,
    polyline: null,
  },
]

const activityTypes = {
  ride: 80,
  run: 28,
  hike: 20,
}

const activityTypeStats = {
  ride: {
    count: 80,
    distanceMeters: 1320000,
    movingSeconds: 432000,
    elevationMeters: 19400,
  },
  run: {
    count: 28,
    distanceMeters: 320000,
    movingSeconds: 142000,
    elevationMeters: 3700,
  },
  hike: {
    count: 20,
    distanceMeters: 210000,
    movingSeconds: 98000,
    elevationMeters: 1400,
  },
}

const monthlyData = [
  { month: '2026-01', activities: 22, distance: 280000, elevation: 3600 },
  { month: '2026-02', activities: 24, distance: 310000, elevation: 4200 },
  { month: '2026-03', activities: 27, distance: 345000, elevation: 4800 },
  { month: '2026-04', activities: 31, distance: 390000, elevation: 5300 },
]

export default function DashboardVisualCluesE2eClient() {
  return (
    <div data-testid="dashboard-visual-clues-fixture">
      <DashboardClient
        stats={stats}
        recentActivities={recentActivities}
        topSegments={topSegments}
        activityTypes={activityTypes}
        activityTypeStats={activityTypeStats}
        monthlyData={monthlyData}
        mostRecentSyncAt="2026-04-29T11:40:00.000Z"
      />
    </div>
  )
}
