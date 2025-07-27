'use client'

import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Target,
  Activity,
  Mountain,
  ExternalLink
} from 'lucide-react'

interface SegmentEffort {
  id: string
  segment_id: number
  elapsed_time: number
  moving_time: number
  start_date: string
  average_watts?: number
  max_watts?: number
  segments: {
    segment_id: number
    name: string
    distance: number
    elevation_gain: number
    average_grade: number
    maximum_grade: number
    climb_category: number
    city: string
    state: string
    country: string
  }
}

interface Activity {
  activity_id: number
  name: string
  type: string
  distance: number
  moving_time: number
  elapsed_time: number
  total_elevation_gain: number
  start_date: string
  start_date_local: string
  segment_efforts: SegmentEffort[]
  strava_url?: string
  polyline?: string
}

interface ActivitiesStats {
  totalActivities: number
  totalDistance: number
  totalTime: number
  totalElevation: number
  totalSegments: number
  totalEfforts: number
}

interface ActivitiesClientProps {
  activities: Activity[]
  stats: ActivitiesStats
}

export default function ActivitiesClient({ activities, stats }: ActivitiesClientProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedType, setSelectedType] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'date' | 'distance' | 'time' | 'segments'>('date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  // Get unique activity types for filter
  const activityTypes = useMemo(() => {
    const types = new Set(activities.map(a => a.type))
    return Array.from(types).sort()
  }, [activities])

  // Filter and sort activities
  const filteredAndSortedActivities = useMemo(() => {
    let filtered = activities.filter(activity => {
      const matchesSearch = activity.name.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesType = selectedType === 'all' || activity.type === selectedType
      return matchesSearch && matchesType
    })

    // Sort activities
    filtered.sort((a, b) => {
      let aValue: any, bValue: any

      switch (sortBy) {
        case 'date':
          aValue = new Date(a.start_date).getTime()
          bValue = new Date(b.start_date).getTime()
          break
        case 'distance':
          aValue = a.distance
          bValue = b.distance
          break
        case 'time':
          aValue = a.moving_time
          bValue = b.moving_time
          break
        case 'segments':
          aValue = a.segment_efforts?.length || 0
          bValue = b.segment_efforts?.length || 0
          break
        default:
          aValue = new Date(a.start_date).getTime()
          bValue = new Date(b.start_date).getTime()
      }

      if (sortOrder === 'asc') {
        return aValue - bValue
      } else {
        return bValue - aValue
      }
    })

    return filtered
  }, [activities, searchTerm, selectedType, sortBy, sortOrder])

  // Format time helper
  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    if (h > 0) {
      return `${h}h ${m}m ${s}s`
    } else if (m > 0) {
      return `${m}m ${s}s`
    } else {
      return `${s}s`
    }
  }

  // Format distance helper
  const formatDistance = (meters: number) => {
    return (meters / 1000).toFixed(2)
  }

  // Format date helper
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString()
  }

  // Group segments by segment_id to avoid duplicates
  const getUniqueSegments = (efforts: SegmentEffort[]) => {
    const uniqueSegments = new Map()
    efforts?.forEach(effort => {
      if (effort.segments && !uniqueSegments.has(effort.segments.segment_id)) {
        uniqueSegments.set(effort.segments.segment_id, effort.segments)
      }
    })
    return Array.from(uniqueSegments.values())
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div
          className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Activities</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalActivities.toLocaleString()}</p>
            </div>
            <Activity className="h-8 w-8 text-blue-500" />
          </div>
        </motion.div>

        <motion.div
          className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Distance</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{(stats.totalDistance / 1000).toFixed(1)} km</p>
            </div>
            <MapPin className="h-8 w-8 text-green-500" />
          </div>
        </motion.div>

        <motion.div
          className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Time</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatTime(stats.totalTime)}</p>
            </div>
            <Clock className="h-8 w-8 text-purple-500" />
          </div>
        </motion.div>

        <motion.div
          className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Segments</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalSegments.toLocaleString()}</p>
            </div>
            <Target className="h-8 w-8 text-orange-500" />
          </div>
        </motion.div>
      </div>

      {/* Filters */}
      <motion.div
        className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search activities..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Activity Type Filter */}
          <div className="flex-shrink-0">
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Types</option>
              {activityTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          {/* Sort */}
          <div className="flex-shrink-0">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="date">Date</option>
              <option value="distance">Distance</option>
              <option value="time">Time</option>
              <option value="segments">Segments</option>
            </select>
          </div>

          {/* Sort Order */}
          <div className="flex-shrink-0">
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </button>
          </div>
        </div>
      </motion.div>

      {/* Activities List */}
      <div className="space-y-4">
        {filteredAndSortedActivities.map((activity, index) => {
          const uniqueSegments = getUniqueSegments(activity.segment_efforts)
          
          return (
            <motion.div
              key={activity.activity_id}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 * index }}
            >
              {/* Activity Header */}
              <div className="p-6 border-b border-gray-100 dark:border-gray-700">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {activity.name}
                      </h3>
                      {activity.strava_url && (
                        <a
                          href={activity.strava_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300 transition-colors"
                        >
                          <ExternalLink className="h-4 w-4" />
                          View on Strava
                        </a>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {formatDate(activity.start_date)}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        {formatDistance(activity.distance)} km
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {formatTime(activity.moving_time)}
                      </span>
                      {activity.total_elevation_gain > 0 && (
                        <span className="flex items-center gap-1">
                          <Mountain className="h-4 w-4" />
                          {Math.round(activity.total_elevation_gain)}m
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Target className="h-4 w-4" />
                        {uniqueSegments.length} segments
                      </span>
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                      {activity.type}
                    </span>
                  </div>
                </div>
              </div>

              {/* Segments List */}
              {uniqueSegments.length > 0 && (
                <div className="p-6">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Segments ({uniqueSegments.length})
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {uniqueSegments.map((segment: any) => (
                      <Link
                        key={segment.segment_id}
                        href={`/segments/${segment.segment_id}`}
                        className="block p-4 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <h5 className="font-medium text-gray-900 dark:text-white text-sm line-clamp-2">
                            {segment.name}
                          </h5>
                          <ExternalLink className="h-4 w-4 text-gray-400 flex-shrink-0 ml-2" />
                        </div>
                        <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                          <div className="flex justify-between">
                            <span>Distance:</span>
                            <span>{(segment.distance / 1000).toFixed(2)} km</span>
                          </div>
                          {segment.elevation_gain > 0 && (
                            <div className="flex justify-between">
                              <span>Elevation:</span>
                              <span>{Math.round(segment.elevation_gain)}m</span>
                            </div>
                          )}
                          {segment.average_grade !== 0 && (
                            <div className="flex justify-between">
                              <span>Grade:</span>
                              <span>{segment.average_grade.toFixed(1)}%</span>
                            </div>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* No Segments Message */}
              {uniqueSegments.length === 0 && (
                <div className="p-6 text-center text-gray-500 dark:text-gray-400">
                  <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No segments found for this activity</p>
                </div>
              )}
            </motion.div>
          )
        })}
      </div>

      {/* No Results */}
      {filteredAndSortedActivities.length === 0 && (
        <motion.div
          className="text-center py-12"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <Activity className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No activities found</h3>
          <p className="text-gray-600 dark:text-gray-400">Try adjusting your search or filters</p>
        </motion.div>
      )}
    </div>
  )
} 