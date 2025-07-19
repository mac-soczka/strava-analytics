'use client'

import React, { useState, useMemo } from 'react'
import { StravaActivity } from '@/types/strava'
import ActivitiesTable from '../components/ActivitiesTable'

interface ActivitiesClientProps {
  initialActivities: StravaActivity[]
  stats: {
    totalActivities: number
    totalDistance: number
    totalTime: number
    totalElevation: number
    bySportType: Record<string, number>
  }
}

export default function ActivitiesClient({ initialActivities, stats }: ActivitiesClientProps) {
  const [activities] = useState(initialActivities)
  const [searchTerm, setSearchTerm] = useState('')
  const [sportTypeFilter, setSportTypeFilter] = useState('all')
  const [sortBy, setSortBy] = useState<'date' | 'distance' | 'time'>('date')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(10)

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
        activity.sport_type === sportTypeFilter
      )
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'distance':
          return b.distance - a.distance
        case 'time':
          return b.moving_time - a.moving_time
        case 'date':
        default:
          return new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
      }
    })

    return filtered
  }, [activities, searchTerm, sportTypeFilter, sortBy])

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedActivities.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedActivities = filteredAndSortedActivities.slice(startIndex, endIndex)

  // Reset to first page when filters change
  React.useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, sportTypeFilter, sortBy])

  // Format statistics for display
  const formattedStats = useMemo(() => ({
    totalDistance: (stats.totalDistance / 1000).toFixed(1), // km
    totalTime: Math.round(stats.totalTime / 3600), // hours
    totalElevation: Math.round(stats.totalElevation), // meters
    sportTypes: Object.entries(stats.bySportType)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
  }), [stats])

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Activities</h3>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalActivities}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Distance</h3>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{formattedStats.totalDistance} km</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Time</h3>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{formattedStats.totalTime}h</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Elevation</h3>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{formattedStats.totalElevation}m</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <label htmlFor="search" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Search Activities
            </label>
            <input
              id="search"
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by activity name..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>

          {/* Sport Type Filter */}
          <div className="md:w-48">
            <label htmlFor="sportType" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Sport Type
            </label>
            <select
              id="sportType"
              value={sportTypeFilter}
              onChange={(e) => setSportTypeFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="all">All Sports</option>
              {Object.keys(stats.bySportType).map(sportType => (
                <option key={sportType} value={sportType}>
                  {sportType} ({stats.bySportType[sportType]})
                </option>
              ))}
            </select>
          </div>

          {/* Sort By */}
          <div className="md:w-48">
            <label htmlFor="sortBy" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Sort By
            </label>
            <select
              id="sortBy"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'date' | 'distance' | 'time')}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="date">Date</option>
              <option value="distance">Distance</option>
              <option value="time">Time</option>
            </select>
          </div>
        </div>
      </div>

      {/* Results Summary */}
      <div className="text-sm text-gray-600 dark:text-gray-400">
        Showing {startIndex + 1}-{Math.min(endIndex, filteredAndSortedActivities.length)} of {filteredAndSortedActivities.length} activities
      </div>

      {/* Activities Table */}
      <ActivitiesTable activities={paginatedActivities} />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center space-x-2">
          <button
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-800 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700"
          >
            Previous
          </button>
          
          <span className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300">
            Page {currentPage} of {totalPages}
          </span>
          
          <button
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-800 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
} 