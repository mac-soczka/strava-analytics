'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { 
  Target, 
  MapPin, 
  TrendingUp, 
  Trophy,
  Search,
  Activity
} from 'lucide-react'

interface SegmentEffort {
  id: string
  segment_id: number
  activity_id: number
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
  activities: {
    activity_id: number
    name: string
    type: string
    start_date: string
    distance: number
    moving_time: number
  }
}

interface SegmentEffortsStats {
  totalEfforts: number
  uniqueSegments: number
  totalDistance: number
  totalElevation: number
  totalPRs: number
}

interface PersonalRecord {
  id: string
  segment_id: number
  elapsed_time: number
  start_date: string
  segments: {
    name: string
    distance: number
    elevation_gain: number
  }
}

interface SegmentEffortsClientProps {
  efforts: SegmentEffort[]
  stats: SegmentEffortsStats
  personalRecords: PersonalRecord[]
}

export default function SegmentEffortsClient({ 
  efforts, 
  stats, 
  personalRecords 
}: SegmentEffortsClientProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedSegment, setSelectedSegment] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'date' | 'time' | 'segment' | 'activity'>('date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [showOnlyPRs, setShowOnlyPRs] = useState(false)

  // Get unique segments for filter
  const uniqueSegments = useMemo(() => {
    const segments = new Map()
    efforts.forEach(effort => {
      if (!segments.has(effort.segment_id)) {
        segments.set(effort.segment_id, {
          id: effort.segment_id,
          name: effort.segments.name
        })
      }
    })
    return Array.from(segments.values())
  }, [efforts])

  // Filter and sort efforts
  const filteredAndSortedEfforts = useMemo(() => {
    let filtered = efforts

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(effort => 
        effort.segments.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        effort.activities.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Filter by segment
    if (selectedSegment !== 'all') {
      filtered = filtered.filter(effort => 
        effort.segment_id.toString() === selectedSegment
      )
    }

    // Filter by PRs only
    if (showOnlyPRs) {
      const prSegmentIds = new Set(personalRecords.map(pr => pr.segment_id))
      filtered = filtered.filter(effort => prSegmentIds.has(effort.segment_id))
    }

    // Sort
    filtered.sort((a, b) => {
      let aValue: any, bValue: any

      switch (sortBy) {
        case 'date':
          aValue = new Date(a.start_date).getTime()
          bValue = new Date(b.start_date).getTime()
          break
        case 'time':
          aValue = a.elapsed_time
          bValue = b.elapsed_time
          break
        case 'segment':
          aValue = a.segments.name
          bValue = b.segments.name
          break
        case 'activity':
          aValue = a.activities.name
          bValue = b.activities.name
          break
        default:
          aValue = new Date(a.start_date).getTime()
          bValue = new Date(b.start_date).getTime()
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1
      } else {
        return aValue < bValue ? 1 : -1
      }
    })

    return filtered
  }, [efforts, searchTerm, selectedSegment, sortBy, sortOrder, showOnlyPRs, personalRecords])

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }

  const formatDistance = (meters: number) => {
    return `${(meters / 1000).toFixed(2)} km`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  const isPR = (effort: SegmentEffort) => {
    return personalRecords.some(pr => 
      pr.segment_id === effort.segment_id && 
      pr.elapsed_time === effort.elapsed_time
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
          <div className="flex items-center">
            <Target className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Efforts</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalEfforts.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
          <div className="flex items-center">
            <MapPin className="h-8 w-8 text-green-600 dark:text-green-400" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Unique Segments</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.uniqueSegments}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
          <div className="flex items-center">
            <Activity className="h-8 w-8 text-purple-600 dark:text-purple-400" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Distance</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalDistance} km</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
          <div className="flex items-center">
            <TrendingUp className="h-8 w-8 text-orange-600 dark:text-orange-400" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Elevation</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalElevation}m</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
          <div className="flex items-center">
            <Trophy className="h-8 w-8 text-yellow-600 dark:text-yellow-400" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Personal Records</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalPRs}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
        <div className="flex flex-col lg:flex-row gap-4 items-center">
          <div className="flex-1 min-w-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search segments or activities..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <select
            value={selectedSegment}
            onChange={(e) => setSelectedSegment(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Segments</option>
            {uniqueSegments.map(segment => (
              <option key={segment.id} value={segment.id}>
                {segment.name}
              </option>
            ))}
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="date">Sort by Date</option>
            <option value="time">Sort by Time</option>
            <option value="segment">Sort by Segment</option>
            <option value="activity">Sort by Activity</option>
          </select>

          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            {sortOrder === 'asc' ? '↑' : '↓'}
          </button>

          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={showOnlyPRs}
              onChange={(e) => setShowOnlyPRs(e.target.checked)}
              className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">PRs Only</span>
          </label>
        </div>
      </div>

      {/* Efforts Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Recent Segment Efforts ({filteredAndSortedEfforts.length})
          </h2>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Segment
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Activity
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Distance
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Elevation
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Date
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredAndSortedEfforts.slice(0, 100).map((effort) => (
                <tr key={effort.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Link 
                        href={`/segments/${effort.segment_id}`}
                        className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                      >
                        {effort.segments.name}
                      </Link>
                      {isPR(effort) && (
                        <Trophy className="ml-2 h-4 w-4 text-yellow-500" />
                      )}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {effort.segments.city}, {effort.segments.state}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-white">
                      {effort.activities.name}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {effort.activities.type}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {formatTime(effort.elapsed_time)}
                    </div>
                    {effort.average_watts && (
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {effort.average_watts}W avg
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {formatDistance(effort.segments.distance)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {effort.segments.elevation_gain}m
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {formatDate(effort.start_date)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {filteredAndSortedEfforts.length === 0 && (
        <div className="text-center py-12">
          <Target className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No segment efforts found</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Try adjusting your filters or search terms.
          </p>
        </div>
      )}
    </div>
  )
} 