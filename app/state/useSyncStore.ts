'use client'

import { create } from 'zustand'
import type { SyncJob } from '@/lib/repositories/sync-jobs-repository'
import type { SyncCoverage } from '@/lib/sync/sync-coverage'

const ACTIVE_JOB_KEY = 'strava_active_sync_job'

export interface RateLimits {
  requests15min: number
  limit15min: number
  remaining15min: number
  requestsDay: number
  limitDay: number
  remainingDay: number
  nextReset15min: string
  nextResetDaily: string
  lastUpdate: string
}

export interface SyncExactState {
  phase?: string | null
  checkpoints?: {
    lastProcessedActivityId?: number | null
    lastProcessedSegmentId?: number | null
    stravaPage?: number | null
    cursorAfterEpoch?: number | null
    cursorBeforeEpoch?: number | null
  } | null
  requestBudget?: {
    requestsUsed15m?: number | null
    requestsUsedDaily?: number | null
    reset15mAt?: string | null
    resetDailyAt?: string | null
  } | null
  activityQueue?: {
    pending: number
    in_progress: number
    completed: number
    failed: number
  } | null
  currentActivity?: {
    activityId: number
    name: string | null
    startedAt: string | null
  } | null
}

type SyncState = {
  isHydrating: boolean
  activeJobId: string | null

  job: SyncJob | null
  rateLimits: RateLimits | null
  exactState: SyncExactState | null
  error: string | null

  coverage: SyncCoverage | null
  isCoverageLoading: boolean

  isStarting: boolean
  isCancelling: boolean

  hydrate: () => Promise<void>
  // eslint-disable-next-line no-unused-vars
  setActiveJobId: (jobId: string | null) => void
  // eslint-disable-next-line no-unused-vars
  setCoverage: (coverage: SyncCoverage | null) => void

  // eslint-disable-next-line no-unused-vars
  startSync: (endpoint?: string, body?: unknown) => Promise<string>
  cancelActiveJob: () => Promise<void>

  refreshCoverage: () => Promise<void>

  // eslint-disable-next-line no-unused-vars
  fetchStatusOnce: (jobId: string) => Promise<void>
  // eslint-disable-next-line no-unused-vars
  startPolling: (jobId: string) => void
  stopPolling: () => void
}

let pollTimeoutId: ReturnType<typeof setTimeout> | null = null
let lastSignature: string | null = null
let resumeAttempted = false
let consecutiveFailures = 0

function jitter(ms: number) {
  const r = 0.85 + Math.random() * 0.3
  return Math.round(ms * r)
}

function parseRateLimitHeaders(
  headers: Headers
): Pick<
  RateLimits,
  | 'requests15min'
  | 'limit15min'
  | 'remaining15min'
  | 'requestsDay'
  | 'limitDay'
  | 'remainingDay'
  | 'lastUpdate'
> | null {
  const usage = headers.get('X-RateLimit-Usage')
  const limit = headers.get('X-RateLimit-Limit')
  const lastUpdate = headers.get('X-RateLimit-LastUpdate') ?? new Date().toISOString()

  if (!usage || !limit) return null

  const [requests15min, requestsDay] = usage.split(',').map((n) => Number(n))
  const [limit15min, limitDay] = limit.split(',').map((n) => Number(n))

  if (![requests15min, requestsDay, limit15min, limitDay].every(Number.isFinite)) return null

  return {
    requests15min,
    limit15min,
    remaining15min: Math.max(0, limit15min - requests15min),
    requestsDay,
    limitDay,
    remainingDay: Math.max(0, limitDay - requestsDay),
    lastUpdate,
  }
}

function isLikelyNetworkError(err: unknown) {
  if (!err || typeof err !== 'object') return false
  const e = err as Error
  const msg = `${e.name || ''} ${e.message || ''}`.toLowerCase()
  return (
    e.name === 'TypeError' ||
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('load failed') ||
    msg.includes('network request failed')
  )
}

export const useSyncStore = create<SyncState>((set, get) => ({
  isHydrating: true,
  activeJobId: null,

  job: null,
  rateLimits: null,
  exactState: null,
  error: null,

  coverage: null,
  isCoverageLoading: false,

  isStarting: false,
  isCancelling: false,

  hydrate: async () => {
    set({ isHydrating: true })

    const setActive = (jobId: string | null) => {
      set({ activeJobId: jobId })
      if (jobId) localStorage.setItem(ACTIVE_JOB_KEY, jobId)
      else localStorage.removeItem(ACTIVE_JOB_KEY)
    }

    // 1) Check localStorage for active job id and validate it.
    const savedJobId = localStorage.getItem(ACTIVE_JOB_KEY)
    if (savedJobId) {
      try {
        await get().fetchStatusOnce(savedJobId)
        const j = get().job
        if (j && ['running', 'pending', 'paused'].includes(j.status)) {
          setActive(savedJobId)
          set({ isHydrating: false })
          return
        }
      } catch {
        // fall through
      }
      localStorage.removeItem(ACTIVE_JOB_KEY)
    }

    // 2) Fallback to server-side active job.
    try {
      const response = await fetch('/api/sync/active', { credentials: 'include', cache: 'no-store' })
      if (response.ok) {
        const data = await response.json()
        const jobId = data?.job?.id as string | undefined
        if (jobId) {
          setActive(jobId)
          await get().fetchStatusOnce(jobId)
        } else {
          setActive(null)
        }
      } else {
        setActive(null)
      }
    } catch {
      setActive(null)
    } finally {
      set({ isHydrating: false })
    }
  },

  setActiveJobId: (jobId) => {
    set({ activeJobId: jobId })
    if (jobId) localStorage.setItem(ACTIVE_JOB_KEY, jobId)
    else localStorage.removeItem(ACTIVE_JOB_KEY)
  },

  setCoverage: (coverage) => set({ coverage }),

  startSync: async (endpoint, body) => {
    set({ isStarting: true, error: null })
    try {
      const response = await fetch(endpoint ?? '/api/sync/start', {
        method: 'POST',
        ...(body !== undefined
          ? {
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            }
          : {}),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        const details = typeof data?.details === 'string' ? data.details : null
        const message = typeof data?.error === 'string' ? data.error : 'Failed to start sync'
        throw new Error(details ? `${message}: ${details}` : message)
      }

      const jobId = data?.job?.id as string | undefined
      if (!jobId) throw new Error('Missing job id')

      get().setActiveJobId(jobId)
      await get().fetchStatusOnce(jobId)
      void get().refreshCoverage()
      return jobId
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      set({ error: message })
      throw err
    } finally {
      set({ isStarting: false })
    }
  },

  cancelActiveJob: async () => {
    const jobId = get().activeJobId
    if (!jobId) return

    set({ isCancelling: true, error: null })
    try {
      const response = await fetch(`/api/sync/cancel/${jobId}`, { method: 'POST' })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(typeof data?.error === 'string' ? data.error : 'Failed to cancel job')
      }
      if (data?.job) set({ job: data.job as SyncJob })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to cancel'
      set({ error: message })
      throw err
    } finally {
      set({ isCancelling: false })
    }
  },

  refreshCoverage: async () => {
    set({ isCoverageLoading: true })
    try {
      const response = await fetch('/api/sync/coverage', { credentials: 'include', cache: 'no-store' })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        // Keep any existing coverage; surface error only if we had none.
        if (!get().coverage) set({ error: data?.error || 'Failed to load sync coverage' })
        return
      }
      set({ coverage: (data?.coverage as SyncCoverage) ?? null })
    } finally {
      set({ isCoverageLoading: false })
    }
  },

  fetchStatusOnce: async (jobId) => {
    const response = await fetch(`/api/sync/status/${jobId}`, {
      credentials: 'include',
      cache: 'no-store',
    })

    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        set({ error: data?.error || 'Unauthorized' })
        return
      }
      if (response.status === 404) {
        set({ error: data?.error || 'Job not found' })
        return
      }
      throw new Error(data?.error || `Failed to fetch status (${response.status})`)
    }

    if (!data?.job) throw new Error('Missing job in response')

    const headerLimits = parseRateLimitHeaders(response.headers)
    const mergedRateLimits = headerLimits
      ? ({
          ...headerLimits,
          nextReset15min: data?.rateLimits?.nextReset15min ?? new Date().toISOString(),
          nextResetDaily: data?.rateLimits?.nextResetDaily ?? new Date().toISOString(),
        } satisfies RateLimits)
      : null

    set({
      job: data.job as SyncJob,
      rateLimits: mergedRateLimits,
      exactState: (data?.exactState as SyncExactState | undefined) ?? null,
      error: null,
    })
  },

  startPolling: (jobId) => {
    get().stopPolling()
    lastSignature = null
    resumeAttempted = false
    consecutiveFailures = 0

    let pollIntervalMs = 2000
    const maxPollIntervalMs = 30000
    const maxTransientPollFailures = 10

    const schedule = (ms: number) => {
      pollTimeoutId = setTimeout(() => void poll(), jitter(ms))
    }

    const poll = async () => {
      try {
        await get().fetchStatusOnce(jobId)

        const j = get().job
        if (!j) {
          schedule(2000)
          return
        }

        // Proactively resume if paused and resume_at has passed.
        if (j.status === 'paused' && j.resume_at && !resumeAttempted) {
          const resumeTime = new Date(j.resume_at).getTime()
          if (Number.isFinite(resumeTime) && Date.now() >= resumeTime) {
            resumeAttempted = true
            fetch(`/api/sync/resume/${jobId}`, { method: 'POST', credentials: 'include' }).catch(() => {})
          }
        }

        if (['completed', 'failed', 'cancelled'].includes(j.status)) {
          // Stop polling and clear active job id (UX should stop showing it).
          get().stopPolling()
          void get().refreshCoverage()
          get().setActiveJobId(null)
          return
        }

        consecutiveFailures = 0

        const signature = [j.status, j.processed_items, j.failed_items, j.updated_at].join('|')
        const changed = lastSignature !== signature
        lastSignature = signature

        let baseIntervalMs = 5000
        if (j.status === 'running') baseIntervalMs = 2000
        if (j.status === 'pending') baseIntervalMs = 5000

        if (j.status === 'paused' && j.resume_at) {
          const resumeTime = new Date(j.resume_at).getTime()
          const msUntilResume = resumeTime - Date.now()

          if (msUntilResume > 60000) baseIntervalMs = 60000
          else if (msUntilResume > 10000) baseIntervalMs = 5000
          else baseIntervalMs = 2000

          pollIntervalMs = baseIntervalMs
        } else if (changed) {
          pollIntervalMs = baseIntervalMs
        } else {
          pollIntervalMs = Math.min(maxPollIntervalMs, Math.max(baseIntervalMs, pollIntervalMs * 2))
        }

        schedule(pollIntervalMs)
      } catch (err) {
        consecutiveFailures += 1
        const transient = isLikelyNetworkError(err)
        if (transient && consecutiveFailures < maxTransientPollFailures) {
          const backoffMs = Math.min(maxPollIntervalMs, 2000 * 2 ** Math.min(consecutiveFailures - 1, 4))
          schedule(backoffMs)
          return
        }
        const message = err instanceof Error ? err.message : 'Unknown error'
        set({ error: message })
      }
    }

    void poll()
  },

  stopPolling: () => {
    if (pollTimeoutId) clearTimeout(pollTimeoutId)
    pollTimeoutId = null
  },
}))

