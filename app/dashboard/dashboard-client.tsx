'use client'

import Link from 'next/link'
import {
  Activity,
  Mountain,
  Target,
  Clock,
  TrendingUp,
  MapPin,
  Calendar,
  BarChart3,
  Trophy,
  Zap,
} from 'lucide-react'
import PolylineMap from '@/app/components/PolylineMap'
import { SyncStatusWidget } from '@/app/components/sync/SyncStatusWidget'
import type { DashboardActivityTypeStats } from '@/lib/server/dashboard-activity-stats'

interface DashboardStats {
  totalActivities: number
  totalSegments: number
  totalEfforts: number
  segmentsAttempted: number
  totalDistance: number
  totalTime: number
  totalElevation: number
  avgSpeed: number
  avgElevationPerActivity: number
}

interface RecentActivity {
  activity_id: number
  name: string
  distance: number
  moving_time: number
  total_elevation_gain: number
  type: string
  start_date: string
  polyline?: string | null
}

interface TopSegment {
  id: number
  name: string
  distance: number
  elevation: number
  effortCount: number
  polyline?: string | null
}

interface MonthlyData {
  month: string
  activities: number
  distance: number
  elevation: number
}

interface DashboardClientProps {
  stats: DashboardStats
  recentActivities: RecentActivity[]
  topSegments: TopSegment[]
  activityTypes: Record<string, number>
  activityTypeStats: DashboardActivityTypeStats
  monthlyData: MonthlyData[]
  mostRecentSyncAt: string | null
}

export default function DashboardClient({
  stats,
  recentActivities,
  topSegments,
  activityTypes,
  activityTypeStats,
  monthlyData,
  mostRecentSyncAt,
}: DashboardClientProps) {
  const formatDistance = (meters: number) => `${(meters / 1000).toFixed(1)} km`
  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return `${hours}h ${minutes}m`
  }
  const formatElevation = (meters: number) => `${Math.round(meters)}m`
  const formatSpeed = (kmh: number) => `${kmh.toFixed(1)} km/h`
  const formatRelativeSync = (iso: string | null) => {
    if (!iso) return 'No sync yet'
    const ms = Date.now() - new Date(iso).getTime()
    const minutes = Math.floor(ms / 60000)
    if (minutes < 1) return 'Synced just now'
    if (minutes < 60) return `Synced ${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `Synced ${hours}h ago`
    return `Synced ${Math.floor(hours / 24)}d ago`
  }

  const freshnessTone = (() => {
    if (!mostRecentSyncAt) return 'bg-gray-100 text-gray-700 border-gray-200'
    const ageMs = Date.now() - new Date(mostRecentSyncAt).getTime()
    if (ageMs <= 6 * 60 * 60 * 1000) return 'bg-green-100 text-green-700 border-green-200'
    if (ageMs <= 24 * 60 * 60 * 1000) return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    return 'bg-red-100 text-red-700 border-red-200'
  })()

  const statCards = [
    {
      title: 'Total Activities',
      value: stats.totalActivities.toLocaleString(),
      icon: Activity,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20'
    },
    {
      title: 'Total Distance',
      value: formatDistance(stats.totalDistance * 1000),
      icon: MapPin,
      color: 'text-green-600',
      bgColor: 'bg-green-50 dark:bg-green-900/20'
    },
    {
      title: 'Total Time',
      value: formatTime(stats.totalTime * 3600),
      icon: Clock,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50 dark:bg-purple-900/20'
    },
    {
      title: 'Total Elevation',
      value: formatElevation(stats.totalElevation),
      icon: Mountain,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50 dark:bg-orange-900/20'
    }
  ]

  const performanceCards = [
    {
      title: 'Avg Speed',
      value: formatSpeed(stats.avgSpeed),
      icon: Zap,
      color: 'text-red-600',
      bgColor: 'bg-red-50 dark:bg-red-900/20'
    },
    {
      title: 'Segments Attempted',
      value: stats.segmentsAttempted.toLocaleString(),
      icon: Target,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50 dark:bg-indigo-900/20'
    },
    {
      title: 'Segment Efforts',
      value: stats.totalEfforts.toLocaleString(),
      icon: TrendingUp,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50 dark:bg-emerald-900/20'
    },
    {
      title: 'Avg Elevation/Activity',
      value: formatElevation(stats.avgElevationPerActivity),
      icon: BarChart3,
      color: 'text-cyan-600',
      bgColor: 'bg-cyan-50 dark:bg-cyan-900/20'
    }
  ]

  return (
    <div className="space-y-8">
      {/* Sync Status */}
      <SyncStatusWidget variant="detailed" />

      <div className="flex flex-wrap items-center gap-3">
        <span
          data-testid="dashboard-sync-freshness"
          className={`rounded-full border px-3 py-1 text-xs font-medium ${freshnessTone}`}
        >
          {formatRelativeSync(mostRecentSyncAt)}
        </span>
      </div>

      {/* Main Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card, index) => (
          <div key={index} className={`${card.bgColor} rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{card.title}</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{card.value}</p>
              </div>
              <div className={`${card.color} p-3 rounded-lg bg-white dark:bg-gray-800 shadow-sm`}>
                <card.icon className="h-6 w-6" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {performanceCards.map((card, index) => (
          <div key={index} className={`${card.bgColor} rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{card.title}</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{card.value}</p>
              </div>
              <div className={`${card.color} p-3 rounded-lg bg-white dark:bg-gray-800 shadow-sm`}>
                <card.icon className="h-6 w-6" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Activity Types Distribution */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <BarChart3 className="h-5 w-5 mr-2 text-blue-600" />
            Activity Types
          </h3>
          <div className="space-y-3">
            {Object.entries(activityTypes)
              .sort(([,a], [,b]) => b - a)
              .slice(0, 8)
              .map(([type, count]) => (
                <div key={type} className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">
                    {type.replace('_', ' ')}
                  </span>
                  <div className="flex items-center space-x-2">
                    <div className="w-24 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full" 
                        style={{ width: `${(count / stats.totalActivities) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm text-gray-600 dark:text-gray-400 w-8 text-right">
                      {count}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* Activity Type Totals */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <Activity className="h-5 w-5 mr-2 text-indigo-600" />
            Activity type totals
          </h3>
          <div className="space-y-3">
            {Object.entries(activityTypeStats)
              .sort(([, a], [, b]) => b.distanceMeters - a.distanceMeters)
              .slice(0, 8)
              .map(([type, s]) => {
                const hours = s.movingSeconds / 3600
                const km = s.distanceMeters / 1000
                const avgKm = s.count > 0 ? km / s.count : 0
                const avgMin = s.count > 0 ? (s.movingSeconds / 60) / s.count : 0
                const avgElev = s.count > 0 ? s.elevationMeters / s.count : 0
                return (
                  <div key={type} className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-gray-900 dark:text-white capitalize truncate">
                          {type.replace('_', ' ')}
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-300">
                          {s.count.toLocaleString()} activities · {km.toFixed(1)} km · {hours.toFixed(1)} h · {Math.round(s.elevationMeters).toLocaleString()} m
                        </div>
                      </div>
                      <div className="text-right text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        avg {avgKm.toFixed(1)} km · {avgMin.toFixed(0)} min · {Math.round(avgElev).toLocaleString()} m
                      </div>
                    </div>
                  </div>
                )
              })}
          </div>
        </div>

        {/* Weekly Trends */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <TrendingUp className="h-5 w-5 mr-2 text-green-600" />
            Weekly Trends
          </h3>
          <div className="space-y-3">
            {monthlyData.slice(0, 6).map((month, index) => (
              <div key={index} className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {month.month}
                </span>
                <div className="flex items-center space-x-4">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {month.activities} activities
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {formatDistance(month.distance)}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {formatElevation(month.elevation)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tables Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activities */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <Calendar className="h-5 w-5 mr-2 text-purple-600" />
            Recent Activities
          </h3>
          <div className="space-y-3">
            {recentActivities.slice(0, 5).map((activity) => (
              <div
                key={activity.activity_id}
                className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
              >
                <div className="flex-1 min-w-0">
                  <Link
                    href="/activities"
                    className="text-sm font-medium text-gray-900 dark:text-white truncate hover:text-blue-600 dark:hover:text-blue-400 block"
                  >
                    {activity.name}
                  </Link>
                  <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                    {activity.type.replace('_', ' ')} •{' '}
                    {new Date(activity.start_date).toISOString().split('T')[0]}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-1 text-xs text-gray-600 dark:text-gray-400">
                    <span>{formatDistance(activity.distance)}</span>
                    <span>{formatTime(activity.moving_time)}</span>
                    <span>{formatElevation(activity.total_elevation_gain)}</span>
                  </div>
                </div>
                {activity.polyline ? (
                  <div className="flex-shrink-0 self-center sm:self-center">
                    <PolylineMap polyline={activity.polyline} />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        {/* Top Segments */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <Trophy className="h-5 w-5 mr-2 text-yellow-600" />
            Top Segments
          </h3>
          <div className="space-y-3">
            {topSegments.slice(0, 5).map((segment, index) => (
              <div
                key={segment.id}
                className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
              >
                <div className="flex items-center space-x-3 min-w-0 flex-1">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                      index === 0
                        ? 'bg-yellow-100 text-yellow-800'
                        : index === 1
                          ? 'bg-gray-100 text-gray-800'
                          : index === 2
                            ? 'bg-orange-100 text-orange-800'
                            : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/segments/${segment.id}`}
                      className="text-sm font-medium text-gray-900 dark:text-white truncate hover:text-orange-600 dark:hover:text-orange-400 block"
                    >
                      {segment.name}
                    </Link>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {formatDistance(segment.distance)} • {formatElevation(segment.elevation)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {segment.polyline ? <PolylineMap polyline={segment.polyline} /> : null}
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      {segment.effortCount}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">attempts</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Summary Insights */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl p-6 border border-blue-200 dark:border-blue-800">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          🎯 Performance Insights
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="text-center">
            <p className="text-gray-600 dark:text-gray-400">Average Speed</p>
            <p className="text-xl font-bold text-blue-600">{formatSpeed(stats.avgSpeed)}</p>
          </div>
          <div className="text-center">
            <p className="text-gray-600 dark:text-gray-400">Most Active Sport</p>
            <p className="text-xl font-bold text-purple-600 capitalize">
              {Object.entries(activityTypes).sort(([,a], [,b]) => b - a)[0]?.[0].replace('_', ' ') || 'N/A'}
            </p>
          </div>
          <div className="text-center">
            <p className="text-gray-600 dark:text-gray-400">Favorite Segment</p>
            <p className="text-xl font-bold text-green-600">
              {topSegments[0]?.name || 'N/A'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}