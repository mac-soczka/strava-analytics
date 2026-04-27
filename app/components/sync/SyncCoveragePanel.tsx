'use client'

import { useEffect } from 'react'
import type { SyncCoverage } from '@/lib/sync/sync-coverage'
import { useSyncStore } from '@/app/state/useSyncStore'
import { SyncCoverageSummary } from './SyncCoverageSummary'

export function SyncCoveragePanel({ initialCoverage }: { initialCoverage?: SyncCoverage | null }) {
  const coverage = useSyncStore((s) => s.coverage)
  const setCoverage = useSyncStore((s) => s.setCoverage)
  const refreshCoverage = useSyncStore((s) => s.refreshCoverage)

  useEffect(() => {
    if (initialCoverage && !coverage) {
      setCoverage(initialCoverage)
    }
    void refreshCoverage()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const effectiveCoverage = coverage ?? initialCoverage ?? null
  if (!effectiveCoverage) return null

  return <SyncCoverageSummary coverage={effectiveCoverage} />
}

