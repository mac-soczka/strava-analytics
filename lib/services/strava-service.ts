import { createClient } from '@supabase/supabase-js'
import { ActivitiesRepository } from '@/lib/repositories/activities-repository'
import { SegmentsRepository } from '@/lib/repositories/segments-repository'
import { StravaActivity } from '@/types/strava'
import { config } from '@/lib/config'

interface StravaTokens {
  access_token: string
  refresh_token: string
  expires_at: string
}



interface StravaSegmentEffort {
  id: number
  segment: {
    id: number
    name: string
    distance: number
    average_grade: number
    maximum_grade: number
    elevation_high: number
    elevation_low: number
    climb_category: number
    city: string
    state: string
    country: string
    private: boolean
    hazardous: boolean
    starred: boolean
  }
  elapsed_time: number
  moving_time: number
  start_date: string
  start_date_local: string
  average_watts?: number
  max_watts?: number
  average_heartrate?: number
  max_heartrate?: number
  average_cadence?: number
  max_cadence?: number
  average_temp?: number
}

// Rate limiting configuration
const RATE_LIMIT_CONFIG = {
  REQUESTS_PER_15MIN: 100,
  REQUESTS_PER_DAY: 1000,
  MIN_DELAY_MS: 900, // 1 request per 0.9 seconds (conservative)
  MAX_DELAY_MS: 1200, // 1 request per 1.2 seconds (safe)
  BATCH_SIZE: 80, // Leave 20 requests buffer per 15min
  RETRY_DELAY_MS: 15 * 60 * 1000, // 15 minutes for rate limit reset
}

// Rate limit tracking
class RateLimitTracker {
  private requests15min: number = 0
  private requestsDay: number = 0
  private lastReset15min: number = Date.now()
  private lastResetDay: number = Date.now()

  canMakeRequest(): boolean {
    this.updateCounters()
    return this.requests15min < RATE_LIMIT_CONFIG.REQUESTS_PER_15MIN &&
           this.requestsDay < RATE_LIMIT_CONFIG.REQUESTS_PER_DAY
  }

  recordRequest() {
    this.requests15min++
    this.requestsDay++
  }

  private updateCounters() {
    const now = Date.now()
    
    // Reset 15-minute counter
    if (now - this.lastReset15min >= 15 * 60 * 1000) {
      this.requests15min = 0
      this.lastReset15min = now
    }
    
    // Reset daily counter
    if (now - this.lastResetDay >= 24 * 60 * 60 * 1000) {
      this.requestsDay = 0
      this.lastResetDay = now
    }
  }

  getDelay(): number {
    const remaining15min = RATE_LIMIT_CONFIG.REQUESTS_PER_15MIN - this.requests15min
    const remainingDay = RATE_LIMIT_CONFIG.REQUESTS_PER_DAY - this.requestsDay
    
    // Use the more restrictive limit
    const remaining = Math.min(remaining15min, remainingDay)
    
    if (remaining <= 10) {
      return RATE_LIMIT_CONFIG.MAX_DELAY_MS // Slow down when approaching limit
    } else if (remaining <= 20) {
      return RATE_LIMIT_CONFIG.MIN_DELAY_MS + 100 // Moderate delay
    } else {
      return RATE_LIMIT_CONFIG.MIN_DELAY_MS // Normal speed
    }
  }

  getStatus() {
    return {
      requests15min: this.requests15min,
      requestsDay: this.requestsDay,
      remaining15min: RATE_LIMIT_CONFIG.REQUESTS_PER_15MIN - this.requests15min,
      remainingDay: RATE_LIMIT_CONFIG.REQUESTS_PER_DAY - this.requestsDay,
      nextReset15min: new Date(this.lastReset15min + 15 * 60 * 1000),
      nextResetDay: new Date(this.lastResetDay + 24 * 60 * 60 * 1000),
    }
  }
}

const rateLimitTracker = new RateLimitTracker()

export class StravaService {
  private supabase: ReturnType<typeof createClient>
  private activitiesRepo: ActivitiesRepository
  private segmentsRepo: SegmentsRepository
  private userId?: number

  constructor(userId?: number) {
    this.supabase = createClient(
      config.supabase.url,
      config.supabase.serviceRoleKey
    )
    this.activitiesRepo = new ActivitiesRepository()
    this.segmentsRepo = new SegmentsRepository()
    this.userId = userId
  }

  /**
   * Get valid Strava tokens, refreshing if necessary
   */
  async getValidTokens(): Promise<StravaTokens> {
    console.log(`🔍 Looking for tokens for user: ${this.userId}`)
    
    let query = this.supabase
      .from('strava_tokens')
      .select('*')

    // If userId is provided, filter by that user
    if (this.userId) {
      query = query.eq('strava_id', this.userId)
    }

    const { data: tokens, error } = await query.single()

    if (error) {
      console.log(`❌ Error fetching tokens:`, error)
    }

    if (!tokens) {
      console.log(`❌ No tokens found for user ${this.userId}`)
      throw new Error('No Strava tokens found. Please authenticate first.')
    }

    const typedTokens = tokens as unknown as StravaTokens & { strava_id: number }

    console.log(`✅ Found tokens for user ${this.userId}, expires at: ${typedTokens.expires_at}`)
    console.log(`🕐 Current time: ${new Date().toISOString()}`)
    console.log(`⏰ Token expires: ${new Date(typedTokens.expires_at).toISOString()}`)
    console.log(`📊 Is expired: ${new Date(typedTokens.expires_at) <= new Date()}`)

    // Check if token is expired
    if (new Date(typedTokens.expires_at) <= new Date()) {
      console.log('Token expired, refreshing...')
      return await this.refreshTokens(typedTokens.refresh_token, typedTokens.strava_id)
    }

    return typedTokens
  }

  /**
   * Refresh Strava access tokens
   */
  private async refreshTokens(refreshToken: string, stravaId?: number): Promise<StravaTokens> {
    const { config } = await import('@/lib/config')
    
    const response = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: config.strava.clientId,
        client_secret: config.strava.clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      })
    })

    if (!response.ok) {
      throw new Error('Failed to refresh Strava tokens')
    }

    const newTokens = await response.json()

    // Save new tokens to database
    const tokenData = {
      access_token: newTokens.access_token,
      refresh_token: newTokens.refresh_token,
      expires_at: new Date(newTokens.expires_at * 1000).toISOString(),
    }

    if (stravaId) {
      // Update existing tokens for specific user
      await this.supabase
        .from('strava_tokens')
        .update(tokenData)
        .eq('strava_id', stravaId)
    } else {
      // Insert new tokens (fallback)
      await this.supabase
        .from('strava_tokens')
        .insert(tokenData)
    }

    return {
      access_token: newTokens.access_token,
      refresh_token: newTokens.refresh_token,
      expires_at: new Date(newTokens.expires_at * 1000).toISOString(),
    }
  }

  /**
   * Fetch activities from Strava API with rate limiting
   */
  async fetchActivities(page = 1, perPage = 30): Promise<StravaActivity[]> {
    // Check rate limits before making request
    if (!rateLimitTracker.canMakeRequest()) {
      const status = rateLimitTracker.getStatus()
      throw new Error(`Rate limit exceeded. 15min: ${status.requests15min}/${RATE_LIMIT_CONFIG.REQUESTS_PER_15MIN}, Day: ${status.requestsDay}/${RATE_LIMIT_CONFIG.REQUESTS_PER_DAY}`)
    }

    const tokens = await this.getValidTokens()

    const response = await fetch(
      `https://www.strava.com/api/v3/athlete/activities?page=${page}&per_page=${perPage}`,
      {
        headers: { 'Authorization': `Bearer ${tokens.access_token}` }
      }
    )

    // Record the request
    rateLimitTracker.recordRequest()

    if (!response.ok) {
      if (response.status === 429) {
        // Rate limit hit, wait for reset
        console.warn('Rate limit hit, waiting for reset...')
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_CONFIG.RETRY_DELAY_MS))
        return this.fetchActivities(page, perPage) // Retry after waiting
      } else if (response.status === 401) {
        // Token might be invalid, try to refresh
        await this.refreshTokens(tokens.refresh_token)
        return this.fetchActivities(page, perPage) // Retry with new tokens
      }
      throw new Error(`Failed to fetch activities: ${response.status}`)
    }

    // Apply rate limiting delay
    const delay = rateLimitTracker.getDelay()
    await new Promise(resolve => setTimeout(resolve, delay))

    return response.json()
  }

  /**
   * Fetch segments for a specific activity with rate limiting
   */
  async fetchActivitySegments(activityId: number): Promise<StravaSegmentEffort[]> {
    // Check rate limits before making request
    if (!rateLimitTracker.canMakeRequest()) {
      const status = rateLimitTracker.getStatus()
      throw new Error(`Rate limit exceeded. 15min: ${status.requests15min}/${RATE_LIMIT_CONFIG.REQUESTS_PER_15MIN}, Day: ${status.requestsDay}/${RATE_LIMIT_CONFIG.REQUESTS_PER_DAY}`)
    }

    const tokens = await this.getValidTokens()

    const response = await fetch(
      `https://www.strava.com/api/v3/activities/${activityId}?include_all_efforts=true`,
      {
        headers: { 'Authorization': `Bearer ${tokens.access_token}` }
      }
    )

    // Record the request
    rateLimitTracker.recordRequest()

    if (!response.ok) {
      if (response.status === 429) {
        // Rate limit hit, wait for reset
        console.warn('Rate limit hit, waiting for reset...')
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_CONFIG.RETRY_DELAY_MS))
        return this.fetchActivitySegments(activityId) // Retry after waiting
      } else if (response.status === 401) {
        // Token might be invalid, try to refresh
        await this.refreshTokens(tokens.refresh_token)
        return this.fetchActivitySegments(activityId) // Retry with new tokens
      }
      throw new Error(`Failed to fetch activity segments: ${response.status}`)
    }

    // Apply rate limiting delay
    const delay = rateLimitTracker.getDelay()
    await new Promise(resolve => setTimeout(resolve, delay))

    const activity = await response.json()
    return activity.segment_efforts || []
  }

  /**
   * Sync activities from Strava to local database with rate limiting
   */
  async syncActivities(limit = RATE_LIMIT_CONFIG.BATCH_SIZE): Promise<{ synced: number; errors: number }> {
    let synced = 0
    let errors = 0

    try {
      console.log(`🔄 Starting activity sync (limit: ${limit})`)
      const status = rateLimitTracker.getStatus()
      console.log(`📊 Rate limit status: 15min ${status.remaining15min} remaining, Day ${status.remainingDay} remaining`)

      const activities = await this.fetchActivities(1, limit)

      for (const activity of activities) {
        try {
          // Check if activity already exists
          const existing = await this.activitiesRepo.getActivityById(activity.id)
          if (existing) {
            console.log(`Activity ${activity.id} already exists, skipping...`)
            continue
          }

          // Create activity in database
          await this.activitiesRepo.createActivity({
            name: activity.name,
            distance: activity.distance,
            moving_time: activity.moving_time,
            elapsed_time: activity.elapsed_time,
            total_elevation_gain: activity.total_elevation_gain,
            type: activity.type,
            sport_type: activity.sport_type,
            start_date: activity.start_date,
            start_date_local: activity.start_date_local,
            timezone: activity.timezone,
            utc_offset: activity.utc_offset,
          })

          synced++
          console.log(`✅ Synced activity: ${activity.name}`)

          // Rate limiting is handled in fetchActivities
        } catch (error) {
          console.error(`❌ Error syncing activity ${activity.id}:`, error)
          errors++
        }
      }

      console.log(`🎉 Activity sync complete: ${synced} synced, ${errors} errors`)
    } catch (error) {
      console.error('❌ Error in syncActivities:', error)
      throw error
    }

    return { synced, errors }
  }

  /**
   * Sync segments for activities that need them
   */
  async syncSegments(batchSize = 10): Promise<{ processed: number; segmentsAdded: number; errors: number }> {
    let processed = 0
    let segmentsAdded = 0
    let errors = 0

    try {
      // Get activities that need segments
      const activitiesNeedingSegments = await this.activitiesRepo.getActivitiesNeedingSegments(batchSize)

      for (const activity of activitiesNeedingSegments) {
        try {
          // Fetch segments from Strava
          const segments = await this.fetchActivitySegments(activity.id)

          if (segments.length > 0) {
            // Transform segments for database
            const segmentEfforts = segments.map(segment => ({
              activity_id: activity.id,
              segment_id: segment.segment.id,
              segment_name: segment.segment.name,
              segment_distance: segment.segment.distance,
              segment_elevation_high: segment.segment.elevation_high,
              segment_elevation_low: segment.segment.elevation_low,
              segment_grade: segment.segment.average_grade,
              segment_climb_category: segment.segment.climb_category,
              segment_city: segment.segment.city,
              segment_state: segment.segment.state,
              segment_country: segment.segment.country,
              segment_private: segment.segment.private,
              segment_hazardous: segment.segment.hazardous,
              segment_starred: segment.segment.starred,
              elapsed_time: segment.elapsed_time,
              moving_time: segment.moving_time,
              start_date: segment.start_date,
              start_date_local: segment.start_date_local,
              average_watts: segment.average_watts,
              max_watts: segment.max_watts,
              average_heartrate: segment.average_heartrate,
              max_heartrate: segment.max_heartrate,
              average_cadence: segment.average_cadence,
              max_cadence: segment.max_cadence,
              average_temp: segment.average_temp,
            }))

            // Save segments to database
            for (const effort of segmentEfforts) {
              await this.segmentsRepo.upsertSegmentEffort({
                activity_id: effort.activity_id,
                segment_id: effort.segment_id,
                effort_id: effort.segment_id, // Using segment_id as effort_id for now
                elapsed_time: effort.elapsed_time,
                moving_time: effort.moving_time,
                start_date: effort.start_date,
                average_watts: effort.average_watts,
                max_watts: effort.max_watts,
              })
            }
            segmentsAdded += segments.length
          }

          // Mark activity as having segments fetched
          await this.activitiesRepo.markSegmentsFetched(activity.id)
          processed++

          console.log(`Processed activity ${activity.id}: ${segments.length} segments`)

          // Rate limiting is handled in fetchActivitySegments
        } catch (error) {
          console.error(`Error processing activity ${activity.id}:`, error)
          errors++
        }
      }
    } catch (error) {
      console.error('Error in syncSegments:', error)
      throw error
    }

    return { processed, segmentsAdded, errors }
  }

  /**
   * Get comprehensive activity statistics
   */
  async getActivityStatistics() {
    const [activityStats, segmentStats] = await Promise.all([
      this.activitiesRepo.getActivityStats(),
      this.segmentsRepo.getSegmentStats()
    ])

    return {
      activities: activityStats,
      segments: segmentStats.data,
      summary: {
        totalActivities: activityStats.totalActivities,
        totalDistance: activityStats.totalDistance,
        totalTime: activityStats.totalTime,
        totalElevation: activityStats.totalElevation,
        totalSegments: segmentStats.data?.total_segments || 0,
        uniqueSegments: segmentStats.data?.total_segments || 0,
      }
    }
  }

  /**
   * Search activities by name
   */
  async searchActivities(searchTerm: string, limit = 20) {
    const { data, error } = await this.supabase
      .from('activities')
      .select('*')
      .ilike('name', `%${searchTerm}%`)
      .order('start_date', { ascending: false })
      .limit(limit)

    if (error) throw error
    return data
  }

  /**
   * Get activity with full details including segments
   */
  async getActivityDetails(activityId: number) {
    const activity = await this.activitiesRepo.getActivityWithSegments(activityId)
    
    if (!activity) {
      throw new Error(`Activity ${activityId} not found`)
    }

    return activity
  }

  /**
   * Get current rate limit status
   */
  getRateLimitStatus() {
    return rateLimitTracker.getStatus()
  }
} 