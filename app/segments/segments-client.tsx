'use client'

import React, { useState, useMemo, useCallback } from 'react'
import { StravaSegment, StravaSegmentEffort } from '@/types/strava'
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
  Trophy,
  Target,
  BarChart3,
  Mountain,
  Activity,
  Timer,
  Award
} from 'lucide-react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'

const LeafletSegmentMap = dynamic(() => import('../components/LeafletSegmentMap'), { ssr: false })

interface SegmentsClientProps {
  segments: (StravaSegment & { segment_efforts?: StravaSegmentEffort[] })[]
  stats: {
    totalSegments: number
    totalEfforts: number
    totalDistance: number
    totalElevation: number
  }
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function SegmentsClient({ segments, stats }: SegmentsClientProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'distance' | 'efforts' | 'elevation' | 'steepness' | 'time_max' | 'time_min'>('name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [lastSync, setLastSync] = useState<string>('')

  // Calculate segment metrics for sorting
  const segmentsWithMetrics = useMemo(() => {
    return segments.map(segment => {
      const efforts = segment.segment_efforts || []
      const times = efforts.map(e => e.elapsed_time)
      const elevationGain = segment.elevation_high - segment.elevation_low
      const steepness = segment.distance > 0 ? (elevationGain / segment.distance) * 100 : 0 // percentage grade
      
      return {
        ...segment,
        metrics: {
          effortCount: (segment as any).total_effort_count || efforts.length, // Use database count if available
          timeMax: times.length > 0 ? Math.max(...times) : 0,
          timeMin: times.length > 0 ? Math.min(...times) : 0,
          elevationGain,
          steepness,
          averageTime: times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0
        }
      }
    })
  }, [segments])

  // Filter and sort segments
  const filteredAndSortedSegments = useMemo(() => {
    let filtered = segmentsWithMetrics

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(segment =>
        segment.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (segment.city && segment.city.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (segment.state && segment.state.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0
      switch (sortBy) {
        case 'distance':
          comparison = (a.distance || 0) - (b.distance || 0)
          break
        case 'efforts':
          comparison = a.metrics.effortCount - b.metrics.effortCount
          break
        case 'elevation':
          comparison = a.metrics.elevationGain - b.metrics.elevationGain
          break
        case 'steepness':
          comparison = a.metrics.steepness - b.metrics.steepness
          break
        case 'time_max':
          comparison = a.metrics.timeMax - b.metrics.timeMax
          break
        case 'time_min':
          comparison = a.metrics.timeMin - b.metrics.timeMin
          break
        case 'name':
        default:
          comparison = a.name.localeCompare(b.name)
          break
      }
      return sortOrder === 'asc' ? comparison : -comparison
    })

    return filtered
  }, [segmentsWithMetrics, searchTerm, sortBy, sortOrder])

  // Navigate to segment detail page
  const handleSegmentClick = useCallback((segmentId: string) => {
    router.push(`/segments/${segmentId}`)
  }, [router])

  // Refresh segments
  const refreshSegments = async () => {
    setLoading(true)
    try {
      // This would typically refetch from the server component
      // For now, we'll just update the timestamp
      setLastSync(new Date().toLocaleTimeString())
    } catch (error) {
      console.error('Error refreshing segments:', error)
    } finally {
      setLoading(false)
    }
  }

  // Format time helper
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}m ${s.toFixed(2)}s`
  }

  // Format date helper
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString()
  }

  // Format speed helper
  const formatSpeed = (distance: number, time: number) => {
    return (distance / time * 3.6).toFixed(2) // km/h
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
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Segments</h3>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalSegments}</p>
            </div>
            <div className="p-2 bg-orange-100 dark:bg-orange-900 rounded-lg">
              <Target className="h-5 w-5 text-orange-600 dark:text-orange-400" />
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
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Efforts</h3>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalEfforts}</p>
            </div>
            <div className="p-2 bg-red-100 dark:bg-red-900 rounded-lg">
              <Trophy className="h-5 w-5 text-red-600 dark:text-red-400" />
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
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{(stats.totalDistance / 1000).toFixed(1)} km</p>
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
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Elevation</h3>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{Math.round(stats.totalElevation)}m</p>
            </div>
            <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
              <Mountain className="h-5 w-5 text-purple-600 dark:text-purple-400" />
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
                placeholder="Search segments..."
                className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              />
            </div>

            {/* Sort Controls */}
            <div className="flex items-center gap-2">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent dark:bg-gray-700 dark:text-white text-sm"
              >
                <option value="name">Name</option>
                <option value="distance">Distance</option>
                <option value="efforts">Number of Attempts</option>
                <option value="elevation">Elevation Gain</option>
                <option value="steepness">Steepness (Grade %)</option>
                <option value="time_max">Slowest Time</option>
                <option value="time_min">Fastest Time</option>
              </select>
              <button
                onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                className="p-2 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                title={`Sort ${sortOrder === 'asc' ? 'Descending' : 'Ascending'}`}
              >
                {sortOrder === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Refresh Button */}
          <button
            onClick={refreshSegments}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Last Sync Info */}
        {lastSync && (
          <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
            Last synced: {lastSync}
          </div>
        )}
      </motion.div>

      {/* Segments List */}
      <motion.div 
        className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            All Segments ({filteredAndSortedSegments.length})
          </h3>
          
          {/* Segments Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th 
                    className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    onClick={() => {
                      if (sortBy === 'name') {
                        setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')
                      } else {
                        setSortBy('name')
                        setSortOrder('asc')
                      }
                    }}
                  >
                    <div className="flex items-center gap-2">
                      Segment
                      {sortBy === 'name' && (
                        <span className="text-orange-600 dark:text-orange-400">
                          {sortOrder === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </span>
                      )}
                    </div>
                  </th>
                  <th 
                    className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    onClick={() => {
                      if (sortBy === 'distance') {
                        setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')
                      } else {
                        setSortBy('distance')
                        setSortOrder('asc')
                      }
                    }}
                  >
                    <div className="flex items-center gap-2">
                      Distance
                      {sortBy === 'distance' && (
                        <span className="text-orange-600 dark:text-orange-400">
                          {sortOrder === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </span>
                      )}
                    </div>
                  </th>
                  <th 
                    className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    onClick={() => {
                      if (sortBy === 'elevation') {
                        setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')
                      } else {
                        setSortBy('elevation')
                        setSortOrder('asc')
                      }
                    }}
                  >
                    <div className="flex items-center gap-2">
                      Elevation
                      {sortBy === 'elevation' && (
                        <span className="text-orange-600 dark:text-orange-400">
                          {sortOrder === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </span>
                      )}
                    </div>
                  </th>
                  <th 
                    className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    onClick={() => {
                      if (sortBy === 'steepness') {
                        setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')
                      } else {
                        setSortBy('steepness')
                        setSortOrder('asc')
                      }
                    }}
                  >
                    <div className="flex items-center gap-2">
                      Grade
                      {sortBy === 'steepness' && (
                        <span className="text-orange-600 dark:text-orange-400">
                          {sortOrder === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </span>
                      )}
                    </div>
                  </th>
                  <th 
                    className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    onClick={() => {
                      if (sortBy === 'efforts') {
                        setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')
                      } else {
                        setSortBy('efforts')
                        setSortOrder('asc')
                      }
                    }}
                  >
                    <div className="flex items-center gap-2">
                      Attempts
                      {sortBy === 'efforts' && (
                        <span className="text-orange-600 dark:text-orange-400">
                          {sortOrder === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </span>
                      )}
                    </div>
                  </th>
                  <th 
                    className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    onClick={() => {
                      if (sortBy === 'time_min') {
                        setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')
                      } else {
                        setSortBy('time_min')
                        setSortOrder('asc')
                      }
                    }}
                  >
                    <div className="flex items-center gap-2">
                      Best Time
                      {sortBy === 'time_min' && (
                        <span className="text-orange-600 dark:text-orange-400">
                          {sortOrder === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </span>
                      )}
                    </div>
                  </th>
                  <th 
                    className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    onClick={() => {
                      if (sortBy === 'time_max') {
                        setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')
                      } else {
                        setSortBy('time_max')
                        setSortOrder('asc')
                      }
                    }}
                  >
                    <div className="flex items-center gap-2">
                      Avg Time
                      {sortBy === 'time_max' && (
                        <span className="text-orange-600 dark:text-orange-400">
                          {sortOrder === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </span>
                      )}
                    </div>
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSortedSegments.map((segment, index) => (
                  <motion.tr
                    key={segment.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                    onClick={() => handleSegmentClick(String(segment.id))}
                  >
                    <td className="py-3 px-4">
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">{segment.name}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {segment.city && `${segment.city}, `}{segment.state || segment.country}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-900 dark:text-white">
                      {(segment.distance / 1000).toFixed(2)} km
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-900 dark:text-white">
                      {Math.round(segment.metrics.elevationGain)}m
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-900 dark:text-white">
                      {segment.metrics.steepness.toFixed(1)}%
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-900 dark:text-white">
                      {segment.metrics.effortCount}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-900 dark:text-white">
                      {segment.metrics.timeMin > 0 ? formatTime(segment.metrics.timeMin) : '-'}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-900 dark:text-white">
                      {segment.metrics.averageTime > 0 ? formatTime(segment.metrics.averageTime) : '-'}
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleSegmentClick(String(segment.id))
                        }}
                        className="text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300 transition-colors"
                      >
                        View Details
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </motion.div>

      {/* No Segments Message */}
      {filteredAndSortedSegments.length === 0 && (
        <motion.div
          className="text-center py-12"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div className="text-gray-500 dark:text-gray-400">
            <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium mb-2">No segments found</p>
            <p className="text-sm">
              {searchTerm 
                ? 'Try adjusting your search terms'
                : 'No segments have been synced yet'
              }
            </p>
          </div>
        </motion.div>
      )}
    </div>
  )
} 