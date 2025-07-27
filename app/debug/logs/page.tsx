'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface CrawlerLog {
  id: string
  run_at: string
  user_id: number | null
  status: 'success' | 'error' | 'partial'
  message: string
  activities_fetched: number
  segments_fetched: number
  segment_efforts_fetched: number
  error?: string
  execution_time_ms: number
  rate_limit_status?: {
    mode: string
    requests15min: number
    requestsDay: number
    limit15min: number
    limitDay: number
  }
}

interface LogFilters {
  status: string
  userId: string
  dateFrom: string
  dateTo: string
  search: string
}

export default function CrawlerLogsPage() {
  const [logs, setLogs] = useState<CrawlerLog[]>([])
  const [filteredLogs, setFilteredLogs] = useState<CrawlerLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<LogFilters>({
    status: '',
    userId: '',
    dateFrom: '',
    dateTo: '',
    search: ''
  })
  const [sortBy, setSortBy] = useState<'run_at' | 'user_id' | 'execution_time_ms'>('run_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)
  const [pageSize] = useState(50)

  // Fetch logs from API
  const fetchLogs = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/strava/crawler/logs')
      if (!response.ok) {
        throw new Error('Failed to fetch logs')
      }
      const data = await response.json()
      setLogs(data.logs || [])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch logs')
    } finally {
      setLoading(false)
    }
  }

  // Apply filters and sorting
  useEffect(() => {
    let filtered = [...logs]

    // Apply status filter
    if (filters.status) {
      filtered = filtered.filter(log => log.status === filters.status)
    }

    // Apply user ID filter
    if (filters.userId) {
      filtered = filtered.filter(log => log.user_id?.toString() === filters.userId)
    }

    // Apply date range filter
    if (filters.dateFrom) {
      filtered = filtered.filter(log => new Date(log.run_at) >= new Date(filters.dateFrom))
    }
    if (filters.dateTo) {
      filtered = filtered.filter(log => new Date(log.run_at) <= new Date(filters.dateTo))
    }

    // Apply search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase()
      filtered = filtered.filter(log => 
        log.message.toLowerCase().includes(searchLower) ||
        log.error?.toLowerCase().includes(searchLower) ||
        log.user_id?.toString().includes(searchLower)
      )
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: any = a[sortBy]
      let bValue: any = b[sortBy]

      if (sortBy === 'run_at') {
        aValue = new Date(aValue).getTime()
        bValue = new Date(bValue).getTime()
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1
      } else {
        return aValue < bValue ? 1 : -1
      }
    })

    setFilteredLogs(filtered)
    setPage(1) // Reset to first page when filters change
  }, [logs, filters, sortBy, sortOrder])

  // Load logs on mount
  useEffect(() => {
    fetchLogs()
  }, [])

  // Pagination
  const totalPages = Math.ceil(filteredLogs.length / pageSize)
  const startIndex = (page - 1) * pageSize
  const endIndex = startIndex + pageSize
  const paginatedLogs = filteredLogs.slice(startIndex, endIndex)

  // Statistics
  const stats = {
    total: logs.length,
    success: logs.filter(log => log.status === 'success').length,
    error: logs.filter(log => log.status === 'error').length,
    partial: logs.filter(log => log.status === 'partial').length,
    totalActivities: logs.reduce((sum, log) => sum + log.activities_fetched, 0),
    totalSegments: logs.reduce((sum, log) => sum + log.segments_fetched, 0),
    avgExecutionTime: logs.length > 0 ? Math.round(logs.reduce((sum, log) => sum + log.execution_time_ms, 0) / logs.length) : 0
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'text-green-600 bg-green-100'
      case 'error': return 'text-red-600 bg-red-100'
      case 'partial': return 'text-yellow-600 bg-yellow-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
    return `${(ms / 60000).toFixed(1)}m`
  }

  const formatDate = (dateString: string) => {
    // Use ISO format to ensure consistency between server and client
    return new Date(dateString).toISOString().replace('T', ' ').slice(0, 19)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-20 bg-gray-200 rounded"></div>
              ))}
            </div>
            <div className="space-y-4">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="h-16 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Crawler Logs</h1>
            <p className="text-gray-600 mt-1">Monitor and analyze crawler execution history</p>
          </div>
          <Link 
            href="/debug" 
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            ← Back to Debug Page
          </Link>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-sm font-medium text-gray-500">Total Runs</div>
            <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-sm font-medium text-gray-500">Success Rate</div>
            <div className="text-2xl font-bold text-green-600">
              {stats.total > 0 ? Math.round((stats.success / stats.total) * 100) : 0}%
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-sm font-medium text-gray-500">Activities Fetched</div>
            <div className="text-2xl font-bold text-blue-600">{stats.totalActivities.toLocaleString()}</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-sm font-medium text-gray-500">Avg Execution Time</div>
            <div className="text-2xl font-bold text-purple-600">{formatDuration(stats.avgExecutionTime)}</div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <h2 className="text-lg font-semibold mb-4">Filters</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Statuses</option>
                <option value="success">Success</option>
                <option value="error">Error</option>
                <option value="partial">Partial</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">User ID</label>
              <input
                type="text"
                value={filters.userId}
                onChange={(e) => setFilters(prev => ({ ...prev, userId: e.target.value }))}
                placeholder="Filter by user ID"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
              <input
                type="datetime-local"
                value={filters.dateFrom}
                onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
              <input
                type="datetime-local"
                value={filters.dateTo}
                onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                placeholder="Search in messages..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => setFilters({ status: '', userId: '', dateFrom: '', dateTo: '', search: '' })}
              className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
            >
              Clear Filters
            </button>
            <button
              onClick={fetchLogs}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Sort Controls */}
        <div className="bg-white p-4 rounded-lg shadow mb-6">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-gray-700">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="run_at">Date/Time</option>
              <option value="user_id">User ID</option>
              <option value="execution_time_ms">Execution Time</option>
            </select>
            <button
              onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
              className="px-3 py-1 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </button>
            <span className="text-sm text-gray-500">
              Showing {filteredLogs.length} of {logs.length} logs
            </span>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex">
              <div className="text-red-600">⚠️ {error}</div>
            </div>
          </div>
        )}

        {/* Logs Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date/Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Message
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Activities
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Segments
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rate Limit
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(log.run_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {log.user_id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(log.status)}`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 max-w-md">
                      <div className="truncate" title={log.message}>
                        {log.message}
                      </div>
                      {log.error && (
                        <div className="text-red-600 text-xs mt-1 truncate" title={log.error}>
                          Error: {log.error}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {log.activities_fetched}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {log.segments_fetched}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDuration(log.execution_time_ms)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {log.rate_limit_status ? (
                        <div className="text-xs">
                          <div className="font-medium">{log.rate_limit_status.mode}</div>
                          <div>15m: {log.rate_limit_status.requests15min}/{log.rate_limit_status.limit15min}</div>
                          <div>Day: {log.rate_limit_status.requestsDay}/{log.rate_limit_status.limitDay}</div>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="bg-white px-4 py-3 border-t border-gray-200 sm:px-6">
              <div className="flex items-center justify-between">
                <div className="flex-1 flex justify-between sm:hidden">
                  <button
                    onClick={() => setPage(prev => Math.max(1, prev - 1))}
                    disabled={page === 1}
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={page === totalPages}
                    className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-gray-700">
                      Showing <span className="font-medium">{startIndex + 1}</span> to{' '}
                      <span className="font-medium">{Math.min(endIndex, filteredLogs.length)}</span> of{' '}
                      <span className="font-medium">{filteredLogs.length}</span> results
                    </p>
                  </div>
                  <div>
                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                      <button
                        onClick={() => setPage(prev => Math.max(1, prev - 1))}
                        disabled={page === 1}
                        className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Previous
                      </button>
                      {[...Array(totalPages)].map((_, i) => {
                        const pageNum = i + 1
                        return (
                          <button
                            key={pageNum}
                            onClick={() => setPage(pageNum)}
                            className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                              page === pageNum
                                ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                                : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                            }`}
                          >
                            {pageNum}
                          </button>
                        )
                      })}
                      <button
                        onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={page === totalPages}
                        className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Next
                      </button>
                    </nav>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 