'use client'

import { useState, useEffect } from 'react'
import { SyncButton } from './SyncButton'
import { SyncProgress } from './SyncProgress'

const ACTIVE_JOB_KEY = 'strava_active_sync_job'

export function SyncDashboard() {
  const [activeJobId, setActiveJobId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Check for active job on mount
  useEffect(() => {
    const checkForActiveJob = async () => {
      // Check localStorage first
      const savedJobId = localStorage.getItem(ACTIVE_JOB_KEY)
      if (savedJobId) {
        // Verify the job is still active
        try {
          const response = await fetch(`/api/sync/status/${savedJobId}`)
          if (response.ok) {
            const data = await response.json()
            if (['running', 'pending', 'paused'].includes(data.job?.status)) {
              setActiveJobId(savedJobId)
              setIsLoading(false)
              return
            } else {
              // Job is complete/failed, clear it
              localStorage.removeItem(ACTIVE_JOB_KEY)
            }
          } else {
            localStorage.removeItem(ACTIVE_JOB_KEY)
          }
        } catch (error) {
          console.error('Error checking job status:', error)
          localStorage.removeItem(ACTIVE_JOB_KEY)
        }
      }
      
      // Fallback: Check if there's any active job for this user
      try {
        const response = await fetch('/api/sync/active')
        if (response.ok) {
          const data = await response.json()
          if (data.job) {
            setActiveJobId(data.job.id)
            localStorage.setItem(ACTIVE_JOB_KEY, data.job.id)
          }
        }
      } catch (error) {
        console.error('Error checking for active jobs:', error)
      }
      
      setIsLoading(false)
    }

    checkForActiveJob()
  }, [])

  const handleSyncStart = (jobId: string) => {
    setActiveJobId(jobId)
    localStorage.setItem(ACTIVE_JOB_KEY, jobId)
  }

  const handleSyncComplete = () => {
    console.log('Sync completed!')
    localStorage.removeItem(ACTIVE_JOB_KEY)
    setActiveJobId(null)
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Sync Your Data</h2>
            <p className="text-gray-600 mt-1">
              Checking for active sync jobs...
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Sync Your Data</h2>
          <p className="text-gray-600 mt-1">
            Fetch all your activities, routes, and stats from Strava
          </p>
        </div>
        <div className="flex items-center gap-3">
          <SyncButton
            onSyncStart={handleSyncStart}
            disabled={!!activeJobId}
            label="Sync My Activities"
            endpoint="/api/sync/start"
          />
          <SyncButton
            onSyncStart={handleSyncStart}
            disabled={!!activeJobId}
            label="Sync Segments"
            endpoint="/api/sync/start-segments"
          />
        </div>
      </div>

      {activeJobId && (
        <SyncProgress
          jobId={activeJobId}
          onComplete={handleSyncComplete}
        />
      )}
    </div>
  )
}
