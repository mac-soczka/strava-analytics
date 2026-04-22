'use client'

import { useEffect, useState } from 'react'
import { SyncButton } from './SyncButton'
import { SyncProgress } from './SyncProgress'

const ACTIVE_JOB_KEY = 'strava_active_sync_job'

interface SyncJobControlsProps {
  label: string
  endpoint: string
}

export function SyncJobControls({ label, endpoint }: SyncJobControlsProps) {
  const [activeJobId, setActiveJobId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const checkForActiveJob = async () => {
      const savedJobId = localStorage.getItem(ACTIVE_JOB_KEY)
      if (savedJobId) {
        try {
          const response = await fetch(`/api/sync/status/${savedJobId}`)
          if (response.ok) {
            const data = await response.json()
            if (['running', 'pending', 'paused'].includes(data.job?.status)) {
              setActiveJobId(savedJobId)
              setIsLoading(false)
              return
            }
          }
        } catch {
          // ignore and fall back
        }

        localStorage.removeItem(ACTIVE_JOB_KEY)
      }

      try {
        const response = await fetch('/api/sync/active')
        if (response.ok) {
          const data = await response.json()
          if (data.job && ['running', 'pending', 'paused'].includes(data.job.status)) {
            setActiveJobId(data.job.id)
            localStorage.setItem(ACTIVE_JOB_KEY, data.job.id)
          }
        }
      } finally {
        setIsLoading(false)
      }
    }

    checkForActiveJob()
  }, [])

  const handleSyncStart = (jobId: string) => {
    setActiveJobId(jobId)
    localStorage.setItem(ACTIVE_JOB_KEY, jobId)
  }

  const handleSyncComplete = () => {
    localStorage.removeItem(ACTIVE_JOB_KEY)
    setActiveJobId(null)
  }

  if (isLoading) return null

  return (
    <div className="space-y-4">
      <SyncButton
        onSyncStart={handleSyncStart}
        disabled={!!activeJobId}
        label={label}
        endpoint={endpoint}
      />

      {activeJobId && (
        <SyncProgress
          jobId={activeJobId}
          onComplete={handleSyncComplete}
        />
      )}
    </div>
  )
}

