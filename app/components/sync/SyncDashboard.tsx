'use client'

import { useState } from 'react'
import { SyncButton } from './SyncButton'
import { SyncProgress } from './SyncProgress'

export function SyncDashboard() {
  const [activeJobId, setActiveJobId] = useState<string | null>(null)

  const handleSyncStart = (jobId: string) => {
    setActiveJobId(jobId)
  }

  const handleSyncComplete = () => {
    console.log('Sync completed!')
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
        <SyncButton
          onSyncStart={handleSyncStart}
          disabled={!!activeJobId}
        />
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
