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
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedSegmentId, setSelectedSegmentId] = useState<string>('')
  const [sortBy, setSortBy] = useState<'name' | 'distance' | 'efforts' | 'elevation' | 'steepness' | 'time_max' | 'time_min'>('name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [lastSync, setLastSync] = useState<Date>(new Date())

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
          effortCount: efforts.length,
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

  // Selected segment data
  const selectedSegment = useMemo(() => {
    return segmentsWithMetrics.find(seg => String(seg.id) === selectedSegmentId) || null
  }, [segmentsWithMetrics, selectedSegmentId])

  // Efforts for selected segment
  const efforts = useMemo(() => {
    return selectedSegment?.segment_efforts || []
  }, [selectedSegment])

  // Calculate percentiles for each effort
  const effortsWithPercentile = useMemo(() => {
    if (efforts.length === 0) return []
    
    const sorted = [...efforts].sort((a: StravaSegmentEffort, b: StravaSegmentEffort) => a.elapsed_time - b.elapsed_time)
    return efforts.map((effort: StravaSegmentEffort) => {
      const betterCount = sorted.filter((other: StravaSegmentEffort) => other.elapsed_time < effort.elapsed_time).length
      const percentile = 100 * (betterCount / (sorted.length - 1 || 1))
      return { ...effort, percentile: Math.round(percentile) }
    }).sort((a: StravaSegmentEffort, b: StravaSegmentEffort) => b.elapsed_time - a.elapsed_time) // Sort by time descending
  }, [efforts])

  // Best effort (fastest time)
  const pr = useMemo(() => {
    return efforts.reduce((best: StravaSegmentEffort | null, e: StravaSegmentEffort) => (!best || e.elapsed_time < best.elapsed_time ? e : best), null)
  }, [efforts])

  // Most recent effort
  const mostRecentEffort = useMemo(() => {
    if (efforts.length === 0) return null
    return [...efforts].sort((a: StravaSegmentEffort, b: StravaSegmentEffort) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime())[0]
  }, [efforts])

  // Refresh segments
  const refreshSegments = async () => {
    setLoading(true)
    try {
      // This would typically refetch from the server component
      // For now, we'll just update the timestamp
      setLastSync(new Date())
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
    return `${m}m ${s.toString().padStart(2, '0')}s`
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
        <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
          Last synced: {lastSync.toLocaleTimeString()}
        </div>
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
                  <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Segment</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Distance</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Elevation</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Grade</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Attempts</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Best Time</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Avg Time</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Actions</th>
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
                    onClick={() => setSelectedSegmentId(String(segment.id))}
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
                          setSelectedSegmentId(String(segment.id))
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

      {/* Segment Picker */}
      <motion.div 
        className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        <label className="block mb-4 font-semibold text-lg text-gray-800 dark:text-gray-100">
          Select a Segment for Detailed Analysis
        </label>
        <div className="relative">
          <select
            value={selectedSegmentId}
            onChange={(e) => setSelectedSegmentId(e.target.value)}
            className="w-full p-3 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
          >
            <option value="">Choose a segment...</option>
            {filteredAndSortedSegments.map((segment) => (
              <option key={segment.id} value={String(segment.id)}>
                {segment.name} {segment.city && `(${segment.city})`} - {(segment.distance / 1000).toFixed(2)}km
              </option>
            ))}
          </select>
        </div>
      </motion.div>

      {/* Selected Segment Details */}
      <AnimatePresence>
        {selectedSegment && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden"
          >
            {/* Segment Header */}
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                    {selectedSegment.name}
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
                      <MapPin className="h-3 w-3 mr-1" />
                      {(selectedSegment.distance / 1000).toFixed(2)} km
                    </span>
                    {selectedSegment.metrics.elevationGain > 0 && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                        <Mountain className="h-3 w-3 mr-1" />
                        {Math.round(selectedSegment.metrics.elevationGain)}m
                      </span>
                    )}
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                      <Trophy className="h-3 w-3 mr-1" />
                      {selectedSegment.metrics.effortCount} attempt{selectedSegment.metrics.effortCount !== 1 ? 's' : ''}
                    </span>
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                      <TrendingUp className="h-3 w-3 mr-1" />
                      {selectedSegment.metrics.steepness.toFixed(1)}% grade
                    </span>
                    {selectedSegment.city && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                        {selectedSegment.city}
                      </span>
                    )}
                  </div>
                </div>
                
                {pr && mostRecentEffort && mostRecentEffort.id !== pr.id && (
                  <div className="flex-1 text-right">
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Most Recent</div>
                    <div className="text-lg font-semibold text-gray-900 dark:text-white">
                      {formatTime(mostRecentEffort.elapsed_time)}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {formatSpeed(selectedSegment.distance, mostRecentEffort.elapsed_time)} km/h
                    </div>
                  </div>
                )}
              </div>

              {/* PR Display */}
              {pr && (
                <motion.div 
                  className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-green-800 dark:text-green-200">Personal Record</div>
                      <div className="text-2xl font-bold text-green-900 dark:text-green-100">
                        {formatTime(pr.elapsed_time)}
                      </div>
                      <div className="text-sm text-green-700 dark:text-green-300">
                        {formatSpeed(selectedSegment.distance, pr.elapsed_time)} km/h on {formatDate(pr.start_date)}
                      </div>
                    </div>
                    <div className="p-3 bg-green-100 dark:bg-green-800 rounded-full">
                      <Award className="h-6 w-6 text-green-600 dark:text-green-400" />
                    </div>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Segment Map */}
            {selectedSegment.map?.polyline && (
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Segment Route</h3>
                <div className="h-64 rounded-lg overflow-hidden">
                  <LeafletSegmentMap polyline={selectedSegment.map.polyline} />
                </div>
              </div>
            )}

            {/* Efforts Table */}
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">All Efforts</h3>
              {effortsWithPercentile.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Date</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Time</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Speed</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Percentile</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Activity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {effortsWithPercentile.map((effort, index) => (
                        <motion.tr
                          key={effort.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className={`border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                            pr && effort.id === pr.id ? 'bg-green-50 dark:bg-green-900/20' : 
                            mostRecentEffort && effort.id === mostRecentEffort.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                          }`}
                        >
                          <td className="py-3 px-4 text-sm text-gray-900 dark:text-white">
                            {formatDate(effort.start_date)}
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-900 dark:text-white font-medium">
                            {formatTime(effort.elapsed_time)}
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                            {formatSpeed(selectedSegment.distance, effort.elapsed_time)} km/h
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                            {effort.percentile}th
                          </td>
                          <td className="py-3 px-4">
                            <a
                              href={`https://www.strava.com/activities/${effort.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300 transition-colors"
                            >
                              <ExternalLink className="h-4 w-4" />
                              View
                            </a>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No efforts found for this segment.</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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