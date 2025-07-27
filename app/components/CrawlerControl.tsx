'use client'

import { useState, useEffect } from 'react'

interface CrawlerStats {
  total_runs_24h: number
  successful_runs_24h: number
  success_rate: number
  total_activities_24h: number
  total_segments_24h: number
  last_run: string
}

interface CrawlerLog {
  id: string
  run_at: string
  user_id?: number
  status: 'success' | 'error' | 'partial'
  message: string
  activities_fetched: number
  segments_fetched: number
  segment_efforts_fetched: number
  error?: string
  execution_time_ms: number
}

export default function CrawlerControl() {
  const [isRunning, setIsRunning] = useState(false)
  const [stats, setStats] = useState<CrawlerStats | null>(null)
  const [logs, setLogs] = useState<CrawlerLog[]>([])
  const [lastResult, setLastResult] = useState<any>(null)

  // Load stats and logs on component mount
  useEffect(() => {
    loadStats()
    loadLogs()
  }, [])

  const loadStats = async () => {
    try {
      const response = await fetch('/api/strava/crawler/stats')
      const data = await response.json()
      if (data.success) {
        setStats(data.stats)
      }
    } catch (error) {
      console.error('Failed to load stats:', error)
    }
  }

  const loadLogs = async () => {
    try {
      const response = await fetch('/api/strava/crawler/logs?limit=5')
      const data = await response.json()
      if (data.success) {
        setLogs(data.logs)
      }
    } catch (error) {
      console.error('Failed to load logs:', error)
    }
  }

  const triggerCrawler = async () => {
    setIsRunning(true)
    try {
      const response = await fetch('/api/strava/crawl', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      
      const result = await response.json()
      setLastResult(result)
      
      // Reload stats and logs after completion
      await loadStats()
      await loadLogs()
      
    } catch (error: any) {
      console.error('Crawler failed:', error)
      setLastResult({ success: false, error: error?.message || 'Unknown error' })
    } finally {
      setIsRunning(false)
    }
  }

  const updateActivities = async () => {
    setIsRunning(true)
    try {
      const response = await fetch('/api/strava/update-activities?limit=10', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      
      const result = await response.json()
      setLastResult(result)
      
      // Reload stats and logs after completion
      await loadStats()
      await loadLogs()
      
    } catch (error: any) {
      console.error('Activity update failed:', error)
      setLastResult({ success: false, error: error?.message || 'Unknown error' })
    } finally {
      setIsRunning(false)
    }
  }

  const formatDuration = (ms: number) => {
    const seconds = Math.round(ms / 1000)
    return `${seconds}s`
  }

  const formatDate = (dateString: string) => {
    // Use ISO format to ensure consistency between server and client
    return new Date(dateString).toISOString().replace('T', ' ').slice(0, 19)
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-bold mb-6">Strava Data Crawler</h2>
      
      {/* Control Panel */}
      <div className="mb-6 space-y-3">
        <div className="flex gap-3">
          <button
            onClick={triggerCrawler}
            disabled={isRunning}
            className={`px-4 py-2 rounded-md font-medium ${
              isRunning
                ? 'bg-gray-300 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {isRunning ? '🔄 Running...' : '🚀 Start Crawler'}
          </button>
          <button
            onClick={updateActivities}
            disabled={isRunning}
            className={`px-4 py-2 rounded-md font-medium ${
              isRunning
                ? 'bg-gray-300 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
          >
            {isRunning ? '🔄 Running...' : '📊 Update Activities'}
          </button>
        </div>
        <p className="text-sm text-gray-600">
          <strong>Start Crawler:</strong> Sync new activities and segments | 
          <strong> Update Activities:</strong> Add polylines and Strava URLs to existing activities
        </p>
      </div>

      {/* Last Result */}
      {lastResult && (
        <div className={`mb-6 p-4 rounded-md ${
          lastResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
        }`}>
          <h3 className="font-semibold mb-2">
            {lastResult.success ? '✅ Last Run Success' : '❌ Last Run Failed'}
          </h3>
          <pre className="text-sm overflow-auto">
            {JSON.stringify(lastResult, null, 2)}
          </pre>
        </div>
      )}

      {/* Statistics */}
      {stats && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3">24h Statistics</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 p-3 rounded-md">
              <div className="text-2xl font-bold text-blue-600">{stats.total_runs_24h}</div>
              <div className="text-sm text-gray-600">Total Runs</div>
            </div>
            <div className="bg-green-50 p-3 rounded-md">
              <div className="text-2xl font-bold text-green-600">{stats.success_rate.toFixed(1)}%</div>
              <div className="text-sm text-gray-600">Success Rate</div>
            </div>
            <div className="bg-purple-50 p-3 rounded-md">
              <div className="text-2xl font-bold text-purple-600">{stats.total_activities_24h}</div>
              <div className="text-sm text-gray-600">Activities</div>
            </div>
            <div className="bg-orange-50 p-3 rounded-md">
              <div className="text-2xl font-bold text-orange-600">{stats.total_segments_24h}</div>
              <div className="text-sm text-gray-600">Segments</div>
            </div>
          </div>
          {stats.last_run && (
            <div className="mt-2 text-sm text-gray-600">
              Last run: {formatDate(stats.last_run)}
            </div>
          )}
        </div>
      )}

      {/* Recent Logs */}
      {logs.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3">Recent Logs</h3>
          <div className="space-y-2">
            {logs.map((log) => (
              <div key={log.id} className={`p-3 rounded-md border ${
                log.status === 'success' ? 'bg-green-50 border-green-200' :
                log.status === 'error' ? 'bg-red-50 border-red-200' :
                'bg-yellow-50 border-yellow-200'
              }`}>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="font-medium">{log.message}</div>
                    <div className="text-sm text-gray-600">
                      {log.activities_fetched} activities, {log.segments_fetched} segments
                      {log.user_id && ` (User: ${log.user_id})`}
                    </div>
                    {log.error && (
                      <div className="text-sm text-red-600 mt-1">{log.error}</div>
                    )}
                  </div>
                  <div className="text-right text-sm text-gray-500">
                    <div>{formatDate(log.run_at)}</div>
                    <div>{formatDuration(log.execution_time_ms)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
} 