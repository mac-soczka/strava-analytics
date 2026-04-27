'use client'

import { useEffect, useState } from 'react'
import { SyncButton } from './SyncButton'
import { SyncProgress } from './SyncProgress'
import { useSyncStore } from '@/app/state/useSyncStore'

interface SyncJobControlsProps {
  label: string
  endpoint: string
}

export function SyncJobControls({ label, endpoint }: SyncJobControlsProps) {
  const activeJobId = useSyncStore((s) => s.activeJobId)
  const isHydrating = useSyncStore((s) => s.isHydrating)
  const hydrate = useSyncStore((s) => s.hydrate)
  const [hydrationTriggered, setHydrationTriggered] = useState(false)

  useEffect(() => {
    if (hydrationTriggered) return
    setHydrationTriggered(true)
    void hydrate()
  }, [hydrate, hydrationTriggered])

  if (isHydrating) return null

  return (
    <div className="space-y-4">
      <SyncButton
        disabled={!!activeJobId}
        label={label}
        endpoint={endpoint}
      />

      {activeJobId && (
        <SyncProgress
          jobId={activeJobId}
        />
      )}
    </div>
  )
}

