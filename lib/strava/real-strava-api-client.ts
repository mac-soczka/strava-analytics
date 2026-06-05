import { createClient } from '@supabase/supabase-js'
import { config } from '@/lib/config'
import { getRateLimitService, RateLimitService } from '@/lib/services/rate-limit-service'
import type { StravaActivity, StravaSegment, StravaSegmentEffort, StravaTokens } from '@/types/strava'
import type { StravaApiClient, StravaListActivitiesOptions } from './strava-api-client'
import { getLogger } from '@/lib/utils/logger'
import {
  logStravaHttpFromFetchParts,
  logStravaHttpNetworkFailure,
} from '@/lib/strava/strava-http-json-logger'
import JSONbig from 'json-bigint'

export type RealStravaApiClientDeps = {
  fetchFn?: typeof fetch
  rateLimitService?: RateLimitService
  sleep?: (_ms: number) => Promise<void>
}

export class RealStravaApiClient implements StravaApiClient {
  private supabase: ReturnType<typeof createClient>
  private stravaId: number
  private fetchFn: typeof fetch
  private rateLimitService: RateLimitService
  private sleep: (_ms: number) => Promise<void>

  constructor(stravaId: number, deps: RealStravaApiClientDeps = {}) {
    this.supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey)
    this.stravaId = stravaId
    this.fetchFn = deps.fetchFn ?? fetch
    this.rateLimitService = deps.rateLimitService ?? getRateLimitService()
    this.sleep = deps.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)))
  }

  private buildRateLimitError(message: string, retryAfterMs: number): any {
    const err: any = new Error(message)
    err.statusCode = 429
    err.retryAfter = retryAfterMs
    return err
  }

  private computeRetryAfterMs(response?: Response): number {
    const retryAfterHeader = response?.headers.get('Retry-After')
    const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : NaN
    const headerRetryMs = Number.isFinite(retryAfterSeconds) ? Math.max(0, retryAfterSeconds) * 1000 : 0
    const computedRetryMs = this.rateLimitService.getRecommendedWaitTime()
    return Math.max(60_000, headerRetryMs, computedRetryMs)
  }

  private async stravaFetch(url: string, init: RequestInit, allowRefreshOnce: boolean = true): Promise<Response> {
    const logger = getLogger()
    const method = (init.method || 'GET').toUpperCase()

    if (!this.rateLimitService.canMakeRequest()) {
      logger.warn('[Strava HTTP] blocked by local rate-limit guard', {
        strava_id: this.stravaId,
        method,
        url,
      })
      throw this.buildRateLimitError('Strava API rate limit exceeded', this.computeRetryAfterMs())
    }

    const tokens = await this.getValidTokens()
    const startedAt = Date.now()
    const baseHeaders =
      typeof init.headers === 'object' && init.headers && !(init.headers instanceof Headers)
        ? (init.headers as Record<string, string>)
        : {}
    const mergedInit: RequestInit = {
      ...init,
      headers: {
        ...baseHeaders,
        Authorization: `Bearer ${tokens.access_token}`,
      },
    }

    let response: Response
    try {
      response = await this.fetchFn(url, mergedInit)
    } catch (error: any) {
      logger.error('[Strava HTTP] network/request error', {
        strava_id: this.stravaId,
        method,
        url,
        elapsed_ms: Date.now() - startedAt,
        error: error?.message || String(error),
      })
      logStravaHttpNetworkFailure({
        strava_id: this.stravaId,
        started_at_ms: startedAt,
        method,
        url,
        init: mergedInit,
        message: error?.message || String(error),
      })
      throw error
    }

    void logStravaHttpFromFetchParts({
      strava_id: this.stravaId,
      started_at_ms: startedAt,
      method,
      url,
      init: mergedInit,
      response,
    }).catch(() => {})

    this.rateLimitService.updateFromHeaders(response)

    if (response.status === 401 && allowRefreshOnce) {
      logger.warn('[Strava HTTP] 401 received, attempting token refresh', {
        strava_id: this.stravaId,
        method,
        url,
      })
      await this.refreshTokens(tokens.refresh_token, this.stravaId)
      return this.stravaFetch(url, init, false)
    }

    if (response.status === 429) {
      throw this.buildRateLimitError('Strava API rate limit exceeded', this.computeRetryAfterMs(response))
    }

    return response
  }

  private async stravaFetchJson<T>(url: string, init: RequestInit = {}): Promise<T> {
    const response = await this.stravaFetch(url, init)
    if (!response.ok) {
      const bodyText = await response.text().catch(() => '')
      const err: any = new Error(
        `Strava API request failed: ${response.status}${bodyText ? ` - ${bodyText}` : ''}`
      )
      err.statusCode = response.status
      err.responseBody = bodyText
      throw err
    }

    const delay = this.rateLimitService.getAdaptiveDelay()
    if (delay > 0) {
      await this.sleep(delay)
    }

    return response.json()
  }

  private async stravaFetchJsonBigInt<T>(url: string, init: RequestInit = {}): Promise<T> {
    const response = await this.stravaFetch(url, init)
    if (!response.ok) {
      const bodyText = await response.text().catch(() => '')
      const err: any = new Error(
        `Strava API request failed: ${response.status}${bodyText ? ` - ${bodyText}` : ''}`
      )
      err.statusCode = response.status
      err.responseBody = bodyText
      throw err
    }

    const delay = this.rateLimitService.getAdaptiveDelay()
    if (delay > 0) {
      await this.sleep(delay)
    }

    const text = await response.text()
    return JSONbig({ storeAsString: true }).parse(text) as T
  }

  private async getValidTokens(): Promise<StravaTokens> {
    const { data: tokens, error } = await this.supabase
      .from('strava_tokens')
      .select('*')
      .eq('strava_id', this.stravaId)
      .single()

    if (error || !tokens) {
      throw new Error(`No Strava tokens found for user ${this.stravaId}. Please authenticate first.`)
    }

    const expiresAt = new Date(tokens.expires_at as string)
    const now = new Date()
    const isExpired = expiresAt <= now

    if (isExpired) {
      return this.refreshTokens(tokens.refresh_token as string, this.stravaId)
    }

    return {
      access_token: tokens.access_token as string,
      refresh_token: tokens.refresh_token as string,
      expires_at: tokens.expires_at as string,
    }
  }

  private async refreshTokens(refreshToken: string, stravaId: number): Promise<StravaTokens> {
    const logger = getLogger()
    const url = 'https://www.strava.com/oauth/token'
    const startedAt = Date.now()

    const refreshInit: RequestInit = {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: config.strava.clientId,
        client_secret: config.strava.clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    }

    let response: Response
    try {
      response = await this.fetchFn(url, refreshInit)
    } catch (error: any) {
      logger.error('[Strava HTTP] network/request error', {
        strava_id: stravaId,
        method: 'POST',
        url,
        elapsed_ms: Date.now() - startedAt,
        token_refresh: true,
        error: error?.message || String(error),
      })
      logStravaHttpNetworkFailure({
        strava_id: stravaId,
        token_refresh: true,
        started_at_ms: startedAt,
        method: 'POST',
        url,
        init: refreshInit,
        message: error?.message || String(error),
      })
      throw error
    }

    void logStravaHttpFromFetchParts({
      strava_id: stravaId,
      token_refresh: true,
      started_at_ms: startedAt,
      method: 'POST',
      url,
      init: refreshInit,
      response,
    }).catch(() => {})

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Failed to refresh Strava tokens: ${response.status} - ${errorText}`)
    }

    const newTokens = await response.json()

    const { error: updateError } = await this.supabase
      .from('strava_tokens')
      .upsert(
        {
          strava_id: stravaId,
          access_token: newTokens.access_token,
          refresh_token: newTokens.refresh_token,
          expires_at: new Date(newTokens.expires_at * 1000).toISOString(),
        },
        { onConflict: 'strava_id' }
      )

    if (updateError) {
      // Tokens are still usable for the current request; best-effort persistence.
    }

    return {
      access_token: newTokens.access_token,
      refresh_token: newTokens.refresh_token,
      expires_at: new Date(newTokens.expires_at * 1000).toISOString(),
    }
  }

  async fetchActivities(page: number, perPage: number, options?: StravaListActivitiesOptions): Promise<StravaActivity[]> {
    const params = new URLSearchParams({
      page: String(page),
      per_page: String(perPage),
    })
    if (typeof options?.before === 'number') params.set('before', String(options.before))
    if (typeof options?.after === 'number') params.set('after', String(options.after))

    return this.stravaFetchJson<StravaActivity[]>(
      `https://www.strava.com/api/v3/athlete/activities?${params.toString()}`
    )
  }

  async fetchActivityDetails(activityId: number): Promise<StravaActivity | null> {
    const activity = await this.stravaFetchJson<StravaActivity>(
      `https://www.strava.com/api/v3/activities/${activityId}?include_all_efforts=true`
    )
    activity.strava_url = `https://www.strava.com/activities/${activityId}`
    return activity
  }

  async fetchActivitySegmentEfforts(activityId: number): Promise<StravaSegmentEffort[]> {
    const activity = await this.stravaFetchJsonBigInt<any>(
      `https://www.strava.com/api/v3/activities/${activityId}?include_all_efforts=true`
    )
    return (activity.segment_efforts || []) as StravaSegmentEffort[]
  }

  async fetchSegmentEffortsForSegment(
    segmentId: number,
    page: number,
    perPage: number
  ): Promise<StravaSegmentEffort[]> {
    return this.stravaFetchJson<StravaSegmentEffort[]>(
      `https://www.strava.com/api/v3/segments/${segmentId}/all_efforts?page=${page}&per_page=${perPage}`
    )
  }

  async fetchSegmentById(segmentId: number): Promise<StravaSegment | null> {
    try {
      return await this.stravaFetchJson<StravaSegment>(
        `https://www.strava.com/api/v3/segments/${segmentId}`
      )
    } catch (error: any) {
      if (error?.statusCode === 404) return null
      throw error
    }
  }
}

