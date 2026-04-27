'use client'

import { RefreshCw } from 'lucide-react'
import { useSyncStore } from '@/app/state/useSyncStore'

interface SyncButtonProps {
  disabled?: boolean
  label?: string
  endpoint?: string
}

export function SyncButton({ disabled, label, endpoint }: SyncButtonProps) {
  const isStarting = useSyncStore((s) => s.isStarting)
  const error = useSyncStore((s) => s.error)
  const startSync = useSyncStore((s) => s.startSync)

  const handleSync = async () => {
    try {
      await startSync(endpoint)
    } catch (err: any) {
      console.error('Sync error:', err)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={handleSync}
        disabled={disabled || isStarting}
        className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <RefreshCw className={`w-4 h-4 ${isStarting ? 'animate-spin' : ''}`} />
        {isStarting ? 'Starting Sync...' : (label ?? 'Sync My Activities')}
      </button>
      
      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}
    </div>
  )
}
