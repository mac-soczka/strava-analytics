'use client'

import React, { useState, useMemo, useEffect, useCallback } from 'react'
import { StravaActivity } from '@/types/strava'
import { createClient } from '@supabase/supabase-js'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Search, 
  MapPin, 
  Clock, 
  TrendingUp,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Mountain,
  Calendar,
  Activity
} from 'lucide-react'

interface ActivitiesClientProps {
  initialActivities: (StravaActivity & { segment_efforts?: any[] })[]
  stats: {
    totalActivities: number
    totalDistance: number
    totalTime: number
    totalElevation: number
    bySportType: Record<string, number>
  }
  totalCount: number
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function ActivitiesClient({ initialActivities, stats, totalCount }: ActivitiesClientProps) {
  const [activities, setActivities] = useState(initialActivities)
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [sportTypeFilter, setSportTypeFilter] = useState('all')
  const [sortBy, setSortBy] = useState<'date' | 'distance' | 'time' | 'elevation'>('date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [currentPage, setCurrentPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [showFilters, setShowFilters] = useState(false)
  const [lastSync, setLastSync] = useState<string>('')

  const itemsPerPage = 20

  // Load more activities
  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return

    setLoading(true)
    try {
      const offset = currentPage * itemsPerPage
      const { data: newActivities, error } = await supabase
        .from('activities')
        .select(`
          *,
          segment_efforts (
            id,
            segment_id,
            elapsed_time,
            moving_time
          )
        `)
        .order('start_date', { ascending: sortOrder === 'asc' })
        .range(offset, offset + itemsPerPage - 1)

      if (error) throw error

      if (newActivities && newActivities.length > 0) {
        const transformed = newActivities.map((activity: any) => ({
          id: activity.activity_id,
          name: activity.name,
          distance: activity.distance,
          moving_time: activity.moving_time,
          elapsed_time: activity.elapsed_time,
          total_elevation_gain: activity.total_elevation_gain,
          type: activity.type,
          start_date: activity.start_date,
          start_date_local: activity.start_date_local,
          segment_efforts: activity.segment_efforts || []
        }))

        setActivities(prev => [...prev, ...transformed])
        setCurrentPage(prev => prev + 1)
        setHasMore(newActivities.length === itemsPerPage)
      } else {
        setHasMore(false)
      }
    } catch (error) {
      console.error('Error loading more activities:', error)
    } finally {
      setLoading(false)
    }
  }, [currentPage, loading, hasMore, sortOrder])

  // Refresh activities
  const refreshActivities = async () => {
    setLoading(true)
    try {
      const { data: newActivities, error } = await supabase
        .from('activities')
        .select(`
          *,
          segment_efforts (
            id,
            segment_id,
            elapsed_time,
            moving_time
          )
        `)
        .order('start_date', { ascending: false })
        .limit(itemsPerPage)

      if (error) throw error

      if (newActivities) {
        const transformed = newActivities.map((activity: any) => ({
          id: activity.activity_id,
          name: activity.name,
          distance: activity.distance,
          moving_time: activity.moving_time,
          elapsed_time: activity.elapsed_time,
          total_elevation_gain: activity.total_elevation_gain,
          type: activity.type,
          start_date: activity.start_date,
          start_date_local: activity.start_date_local,
          segment_efforts: activity.segment_efforts || []
        }))

        setActivities(transformed)
        setCurrentPage(1)
        setHasMore(true)
        setLastSync(new Date().toLocaleTimeString())
      }
    } catch (error) {
      console.error('Error refreshing activities:', error)
    } finally {
      setLoading(false)
    }
  }

  // Client-side filtering and sorting
  const filteredAndSortedActivities = useMemo(() => {
    let filtered = activities

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(activity =>
        activity.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Apply sport type filter
    if (sportTypeFilter !== 'all') {
      filtered = filtered.filter(activity =>
        activity.type === sportTypeFilter
      )
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0
      switch (sortBy) {
        case 'distance':
          comparison = b.distance - a.distance
          break
        case 'time':
          comparison = b.moving_time - a.moving_time
          break
        case 'elevation':
          comparison = (b.total_elevation_gain || 0) - (a.total_elevation_gain || 0)
          break
        case 'date':
        default:
          comparison = new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
          break
      }
      return sortOrder === 'asc' ? -comparison : comparison
    })

    return filtered
  }, [activities, searchTerm, sportTypeFilter, sortBy, sortOrder])

  // Format statistics for display
  const formattedStats = useMemo(() => ({
    totalDistance: (stats.totalDistance / 1000).toFixed(1), // km
    totalTime: Math.round(stats.totalTime / 3600), // hours
    totalElevation: Math.round(stats.totalElevation), // meters
    sportTypes: Object.entries(stats.bySportType)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
  }), [stats])

  // Format time helper
  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    return h > 0 ? `${h}h ${m}m` : `${m}m`
  }

  // Format date helper
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffTime = Math.abs(now.getTime() - date.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays === 1) return 'Today'
    if (diffDays === 2) return 'Yesterday'
    if (diffDays <= 7) return `${diffDays - 1} days ago`
    return date.toLocaleDateString()
  }

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <motion.div 
        className="grid grid-cols-1 md:grid-cols-4 gap-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <motion.div 
          className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow"
          whileHover={{ scale: 1.02 }}
          transition={{ type: "spring", stiffness: 300 }}
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Activities</h3>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalActivities}</p>
            </div>
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <Activity className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </motion.div>

        <motion.div 
          className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow"
          whileHover={{ scale: 1.02 }}
          transition={{ type: "spring", stiffness: 300 }}
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Distance</h3>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{formattedStats.totalDistance} km</p>
            </div>
            <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
              <MapPin className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </motion.div>

        <motion.div 
          className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow"
          whileHover={{ scale: 1.02 }}
          transition={{ type: "spring", stiffness: 300 }}
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Time</h3>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{formattedStats.totalTime}h</p>
            </div>
            <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
              <Clock className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
        </motion.div>

        <motion.div 
          className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow"
          whileHover={{ scale: 1.02 }}
          transition={{ type: "spring", stiffness: 300 }}
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Elevation</h3>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{formattedStats.totalElevation}m</p>
            </div>
            <div className="p-2 bg-orange-100 dark:bg-orange-900 rounded-lg">
              <Mountain className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* Controls Bar */}
      <motion.div 
        className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
          <div className="flex flex-col sm:flex-row gap-4 flex-1">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search activities..."
                className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              />
            </div>

            {/* Sport Type Filter */}
            <select
              value={sportTypeFilter}
              onChange={(e) => setSportTypeFilter(e.target.value)}
              className="px-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            >
              <option value="all">All Types</option>
              {formattedStats.sportTypes.map(([type, count]) => (
                <option key={type} value={type}>
                  {type} ({count})
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2">
            {/* Sort Controls */}
            <div className="flex items-center gap-2">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white text-sm"
              >
                <option value="date">Date</option>
                <option value="distance">Distance</option>
                <option value="time">Time</option>
                <option value="elevation">Elevation</option>
              </select>
              <button
                onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                className="p-2 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                {sortOrder === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            </div>

            {/* Refresh Button */}
            <button
              onClick={refreshActivities}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Last Sync Info */}
        {lastSync && (
          <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
            Last synced: {lastSync}
          </div>
        )}
      </motion.div>

      {/* Activities List */}
      <motion.div 
        className="space-y-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <AnimatePresence>
          {filteredAndSortedActivities.map((activity, index) => (
            <motion.div
              key={activity.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 hover:shadow-md transition-all duration-200"
            >
              <div className="flex flex-col lg:flex-row gap-4">
                {/* Activity Info */}
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white line-clamp-2">
                      {activity.name}
                    </h3>
                    <a
                      href={`https://www.strava.com/activities/${activity.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mb-3">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {formatDate(activity.start_date_local)}
                    </div>
                    <div className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      {(activity.distance / 1000).toFixed(1)} km
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {formatTime(activity.moving_time)}
                    </div>
                    {activity.total_elevation_gain > 0 && (
                      <div className="flex items-center gap-1">
                        <Mountain className="h-4 w-4" />
                        {Math.round(activity.total_elevation_gain)}m
                      </div>
                    )}
                  </div>

                  {/* Activity Type Badge */}
                  <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                    {activity.type}
                  </div>

                  {/* Segments Info */}
                  {activity.segment_efforts && activity.segment_efforts.length > 0 && (
                    <div className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                      🏁 {activity.segment_efforts.length} segment{activity.segment_efforts.length !== 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Load More Button */}
        {hasMore && (
          <motion.div
            className="flex justify-center pt-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <button
              onClick={loadMore}
              disabled={loading}
              className="flex items-center gap-2 px-6 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Loading...
                </>
              ) : (
                'Load More Activities'
              )}
            </button>
          </motion.div>
        )}

        {/* No Activities Message */}
        {filteredAndSortedActivities.length === 0 && (
          <motion.div
            className="text-center py-12"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="text-gray-500 dark:text-gray-400">
              <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">No activities found</p>
              <p className="text-sm">
                {searchTerm || sportTypeFilter !== 'all' 
                  ? 'Try adjusting your search or filters'
                  : 'No activities have been synced yet'
                }
              </p>
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  )
} 