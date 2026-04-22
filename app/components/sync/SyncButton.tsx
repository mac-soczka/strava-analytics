'use client'

import { useState } from 'react'
import { RefreshCw } from 'lucide-react'

interface SyncButtonProps {
  onSyncStart?: (jobId: string) => void
  disabled?: boolean
  label?: string
  endpoint?: string
}

export function SyncButton({ onSyncStart, disabled, label, endpoint }: SyncButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSync = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(endpoint ?? '/api/sync/start', {
        method: 'POST',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to start sync')
      }

      if (onSyncStart && data.job?.id) {
        onSyncStart(data.job.id)
      }
    } catch (err: any) {
      console.error('Sync error:', err)
      setError(err?.message || 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={handleSync}
        disabled={disabled || isLoading}
        className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        {isLoading ? 'Starting Sync...' : (label ?? 'Sync My Activities')}
      </button>
      
      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}
    </div>
  )
}
