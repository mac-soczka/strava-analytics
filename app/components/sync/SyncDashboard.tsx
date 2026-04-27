'use client'

import { useEffect } from 'react'
import { SyncProgress } from './SyncProgress'
import { useSyncStore } from '@/app/state/useSyncStore'

export function SyncDashboard() {
  const isHydrating = useSyncStore((s) => s.isHydrating)
  const activeJobId = useSyncStore((s) => s.activeJobId)
  const hydrate = useSyncStore((s) => s.hydrate)

  useEffect(() => {
    void hydrate()
  }, [hydrate])

  if (isHydrating) {
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
      </div>

      {activeJobId && (
        <SyncProgress
          jobId={activeJobId}
        />
      )}
    </div>
  )
}
