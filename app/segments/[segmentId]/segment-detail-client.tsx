'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { 
  MapPin, 
  Clock, 
  TrendingUp,
  ExternalLink,
  Trophy,
  Target,
  BarChart3,
  Mountain,
  Award,
  ArrowLeft
} from 'lucide-react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import PolylineMap from '@/app/components/PolylineMap'

const LeafletSegmentMap = dynamic(() => import('../../components/LeafletSegmentMap'), { ssr: false })

interface SegmentDetailClientProps {
  segment: any
  efforts: any[]
  stats: {
    totalEfforts: number
    bestTime: number
    worstTime: number
    averageTime: number
    elevationGain: number
    steepness: number
    distance: number
  }
  pr: any
  mostRecent: any
}

export default function SegmentDetailClient({ segment, efforts, stats, pr, mostRecent }: SegmentDetailClientProps) {
  // Format time helper
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}m ${s.toFixed(2)}s`
  }

  // Format date helper
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    // Use ISO format to ensure consistency between server and client
    return date.toISOString().split('T')[0]
  }

  // Format speed helper
  const formatSpeed = (distance: number, time: number) => {
    return (distance / time * 3.6).toFixed(2) // km/h
  }

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Link
          href="/segments"
          className="inline-flex items-center gap-2 text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Segments
        </Link>
      </motion.div>

      {/* Segment Header */}
      <motion.div
        className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              {segment.name}
            </h1>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
                <MapPin className="h-3 w-3 mr-1" />
                {(stats.distance / 1000).toFixed(2)} km
              </span>
              {stats.elevationGain > 0 && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                  <Mountain className="h-3 w-3 mr-1" />
                  {Math.round(stats.elevationGain)}m
                </span>
              )}
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                <Trophy className="h-3 w-3 mr-1" />
                {stats.totalEfforts} attempt{stats.totalEfforts !== 1 ? 's' : ''}
              </span>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                <TrendingUp className="h-3 w-3 mr-1" />
                {stats.steepness.toFixed(1)}% grade
              </span>
              {segment.city && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                  {segment.city}
                </span>
              )}
            </div>
          </div>
          
          {pr && mostRecent && mostRecent.id !== pr.id && (
            <div className="flex-1 text-right">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Most Recent</div>
              <div className="text-lg font-semibold text-gray-900 dark:text-white">
                {formatTime(mostRecent.elapsed_time)}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {formatSpeed(stats.distance, mostRecent.elapsed_time)} km/h
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
                  {formatSpeed(stats.distance, pr.elapsed_time)} km/h on {formatDate(pr.start_date)}
                </div>
              </div>
              <div className="p-3 bg-green-100 dark:bg-green-800 rounded-full">
                <Award className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </motion.div>
        )}
      </motion.div>

      {/* Statistics Cards */}
      <motion.div 
        className="grid grid-cols-1 md:grid-cols-4 gap-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <motion.div 
          className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow"
          whileHover={{ scale: 1.02 }}
          transition={{ type: "spring", stiffness: 300 }}
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Attempts</h3>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalEfforts}</p>
            </div>
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <Target className="h-5 w-5 text-blue-600 dark:text-blue-400" />
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
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Best Time</h3>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatTime(stats.bestTime)}</p>
            </div>
            <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
              <Trophy className="h-5 w-5 text-green-600 dark:text-green-400" />
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
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Average Time</h3>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatTime(stats.averageTime)}</p>
            </div>
            <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
              <BarChart3 className="h-5 w-5 text-purple-600 dark:text-purple-400" />
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
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Worst Time</h3>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatTime(stats.worstTime)}</p>
            </div>
            <div className="p-2 bg-red-100 dark:bg-red-900 rounded-lg">
              <Clock className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* Segment Map */}
      {segment.polyline && (
        <motion.div
          className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Segment route</h3>
          <div className="flex flex-col lg:flex-row gap-6 items-start">
            <div className="flex flex-col items-center gap-2">
              <p className="text-xs text-gray-500 dark:text-gray-400">Preview</p>
              <PolylineMap polyline={segment.polyline} />
            </div>
            <div className="flex-1 min-w-0 w-full rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600 h-80 lg:h-96">
              <LeafletSegmentMap
                polyline={segment.polyline}
                testId="segment-detail-leaflet"
                className="w-full h-full rounded-lg overflow-hidden border-0 shadow-none mb-0"
              />
            </div>
          </div>
        </motion.div>
      )}

      {/* All Efforts */}
      <motion.div 
        className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            All Efforts ({efforts.length})
          </h3>
        </div>

        <div className="p-6">
          {efforts.length > 0 ? (
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
                  {efforts.map((effort, index) => (
                    <motion.tr
                      key={effort.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className={`border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                        pr && effort.id === pr.id ? 'bg-green-50 dark:bg-green-900/20' : 
                        mostRecent && effort.id === mostRecent.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                      }`}
                    >
                      <td className="py-3 px-4 text-sm text-gray-900 dark:text-white">
                        {formatDate(effort.start_date)}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-900 dark:text-white font-medium">
                        {formatTime(effort.elapsed_time)}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                        {formatSpeed(stats.distance, effort.elapsed_time)} km/h
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                        {effort.percentile}th
                      </td>
                      <td className="py-3 px-4">
                        <a
                          href={`https://www.strava.com/activities/${effort.activity_id}`}
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
    </div>
  )
} 