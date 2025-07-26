import { createClient } from '@supabase/supabase-js'
import { config } from '@/lib/config'
import { ActivitiesRepository } from '@/lib/repositories/activities-repository'
import { SegmentsRepository } from '@/lib/repositories/segments-repository'
import { StravaActivity, StravaSegmentEffort, StravaTokens, DatabaseActivity } from '@/types/strava'

// Rate limit tracking
class RateLimitTracker {
  private requests15min: number = 0
  private requestsDay: number = 0
  private lastReset15min: number = Date.now()
  private lastResetDay: number = Date.now()

  canMakeRequest(): boolean {
    // In no-limits mode, always allow requests
    if (config.stravaApiLimits.noLimitsMode) {
      return true
    }
    
    this.updateCounters()
    return this.requests15min < config.stravaApiLimits.requestsPer15Min &&
           this.requestsDay < config.stravaApiLimits.requestsPerDay
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
    
    // Reset daily counter (simplified - resets every 24 hours from first request)
    if (now - this.lastResetDay >= 24 * 60 * 60 * 1000) {
      this.requestsDay = 0
      this.lastResetDay = now
    }
  }

  getStatus() {
    this.updateCounters()
    return {
      requests15min: this.requests15min,
      requestsDay: this.requestsDay,
      remaining15min: config.stravaApiLimits.requestsPer15Min - this.requests15min,
      remainingDay: config.stravaApiLimits.requestsPerDay - this.requestsDay,
      noLimitsMode: config.stravaApiLimits.noLimitsMode,
      mode: config.stravaApiLimits.noLimitsMode ? 'NO-LIMITS' : 'RATE-LIMITED'
    }
  }

  getDelay(): number {
    // In no-limits mode, no delay
    if (config.stravaApiLimits.noLimitsMode) {
      return 0
    }
    
    const remaining15min = config.stravaApiLimits.requestsPer15Min - this.requests15min
    const remainingDay = config.stravaApiLimits.requestsPerDay - this.requestsDay
    
    // Use the more restrictive limit
    const remaining = Math.min(remaining15min, remainingDay)
    
    if (remaining <= 10) {
      return config.stravaApiLimits.maxDelayMs // Slow down when approaching limit
    } else if (remaining <= 20) {
      return config.stravaApiLimits.minDelayMs + 100 // Moderate delay
    } else {
      return config.stravaApiLimits.minDelayMs // Normal speed
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
   * Get current rate limit status
   */
  getRateLimitStatus() {
    return rateLimitTracker.getStatus()
  }

  /**
   * Get valid Strava tokens, refreshing if necessary
   */
  async getValidTokens(): Promise<StravaTokens> {
    if (!this.userId) {
      throw new Error('User ID is required to get tokens')
    }

    console.log(`🔍 Looking for tokens for user: ${this.userId}`)

    const { data: tokens, error } = await this.supabase
      .from('strava_tokens')
      .select('*')
      .eq('strava_id', this.userId)
      .single()

    if (error || !tokens) {
      throw new Error(`No Strava tokens found for user ${this.userId}. Please authenticate first.`)
    }

    console.log(`✅ Found tokens for user ${this.userId}, expires at: ${tokens.expires_at}`)
    console.log(`🕐 Current time: ${new Date().toISOString()}`)
    console.log(`⏰ Token expires: ${tokens.expires_at}`)

    const expiresAt = new Date(tokens.expires_at as string)
    const now = new Date()
    const isExpired = expiresAt <= now

    console.log(`📊 Is expired: ${isExpired}`)

    if (isExpired) {
      console.log(`🔄 Token expired, refreshing...`)
      return this.refreshTokens(tokens.refresh_token as string, this.userId)
    }

    return {
      access_token: tokens.access_token as string,
      refresh_token: tokens.refresh_token as string,
      expires_at: tokens.expires_at as string
    }
  }

  /**
   * Refresh Strava tokens
   */
  private async refreshTokens(refreshToken: string, stravaId?: number): Promise<StravaTokens> {
    console.log(`🔄 Attempting to refresh tokens for user ${stravaId}...`)
    
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
      const errorText = await response.text()
      let errorDetails
      try {
        errorDetails = JSON.parse(errorText)
      } catch (e) {
        errorDetails = { message: errorText }
      }
      if (response.status === 400 && errorDetails.errors?.some((e: any) => e.code === 'invalid')) {
        console.error(`❌ Invalid refresh token for user ${stravaId}. User needs to re-authenticate.`)
        throw new Error(`Invalid refresh token - user ${stravaId} needs to re-authenticate with Strava`)
      }
      console.error(`❌ Token refresh failed for user ${stravaId}:`, errorDetails)
      throw new Error(`Failed to refresh Strava tokens: ${response.status} - ${errorDetails.message || errorText}`)
    }

    const newTokens = await response.json()
    console.log(`✅ Token refresh successful for user ${stravaId}`)

    // Save new tokens to database
    const { error: updateError } = await this.supabase
      .from('strava_tokens')
      .upsert({
        strava_id: stravaId,
        access_token: newTokens.access_token,
        refresh_token: newTokens.refresh_token,
        expires_at: new Date(newTokens.expires_at * 1000).toISOString(),
      })

    if (updateError) {
      console.error('Failed to save refreshed tokens:', updateError)
    }

    return {
      access_token: newTokens.access_token,
      refresh_token: newTokens.refresh_token,
      expires_at: new Date(newTokens.expires_at * 1000).toISOString()
    }
  }

  /**
   * Fetch activities from Strava API with rate limiting
   */
  async fetchActivities(page = 1, perPage = config.stravaApiLimits.maxActivitiesPerRequest): Promise<StravaActivity[]> {
    // Check rate limits before making request
    if (!rateLimitTracker.canMakeRequest()) {
      const status = rateLimitTracker.getStatus()
      throw new Error(`Rate limit exceeded. 15min: ${status.requests15min}/${config.stravaApiLimits.requestsPer15Min}, Day: ${status.requestsDay}/${config.stravaApiLimits.requestsPerDay}`)
    }

    if (config.stravaApiLimits.noLimitsMode) {
      console.log('🚀 NO-LIMITS MODE: Fetching activities without rate limiting')
    }

    const tokens = await this.getValidTokens()

    // Check if we already have recent activities in the database
    const existingActivities = await this.activitiesRepo.getActivities(perPage, (page - 1) * perPage)
    
    if (existingActivities && existingActivities.length > 0) {
      console.log(`📊 Found ${existingActivities.length} existing activities in database, checking if we need to fetch from Strava...`)
      
      // Check if the most recent activity is recent enough (within last 24 hours)
      const mostRecentActivity = existingActivities[0] as any
      const lastActivityDate = new Date(mostRecentActivity.start_date)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
      
      if (lastActivityDate > oneDayAgo) {
        console.log(`✅ Recent activities found in database (last: ${lastActivityDate.toISOString()}), skipping Strava API call`)
        return existingActivities
      }
    }

    console.log(`🔄 Fetching activities from Strava API (page: ${page}, per_page: ${perPage})`)

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
        await new Promise(resolve => setTimeout(resolve, config.stravaApiLimits.retryDelayMs))
        return this.fetchActivities(page, perPage) // Retry after waiting
      } else if (response.status === 401) {
        // Token might be invalid, try to refresh
        await this.refreshTokens(tokens.refresh_token, this.userId)
        return this.fetchActivities(page, perPage) // Retry with new tokens
      }
      throw new Error(`Failed to fetch activities: ${response.status}`)
    }

    // Apply rate limiting delay
    const delay = rateLimitTracker.getDelay()
    await new Promise(resolve => setTimeout(resolve, delay))

    const activities = await response.json()
    console.log(`✅ Fetched ${activities.length} activities from Strava API`)
    
    return activities
  }

  /**
   * Fetch segments for a specific activity from Strava API
   */
  async fetchActivitySegments(activityId: number): Promise<StravaSegmentEffort[]> {
    // Check if we already have segments for this activity in the database
    const existingSegmentsResult = await this.segmentsRepo.getSegmentEffortsByActivity(activityId)
    
    if (existingSegmentsResult.data && existingSegmentsResult.data.length > 0) {
      console.log(`📊 Found ${existingSegmentsResult.data.length} existing segments for activity ${activityId} in database, skipping Strava API call`)
      return existingSegmentsResult.data.map((segment: any) => ({
        id: segment.effort_id,
        segment: {
          id: segment.segment_id,
          name: segment.segment_name || '',
          distance: segment.segment_distance || 0,
          average_grade: segment.segment_average_grade || 0,
          maximum_grade: segment.segment_maximum_grade || 0,
          elevation_high: segment.segment_elevation_high || 0,
          elevation_low: segment.segment_elevation_low || 0,
          climb_category: segment.segment_climb_category || 0,
          city: segment.segment_city || '',
          state: segment.segment_state || '',
          country: segment.segment_country || '',
          private: false,
          hazardous: false,
          starred: false
        },
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
        average_temp: segment.average_temp
      }))
    }

    console.log(`🔄 Fetching segments for activity ${activityId} from Strava API`)

    // Check rate limits before making request
    if (!rateLimitTracker.canMakeRequest()) {
      const status = rateLimitTracker.getStatus()
      throw new Error(`Rate limit exceeded. 15min: ${status.requests15min}/${config.stravaApiLimits.requestsPer15Min}, Day: ${status.requestsDay}/${config.stravaApiLimits.requestsPerDay}`)
    }

    if (config.stravaApiLimits.noLimitsMode) {
      console.log(`🚀 NO-LIMITS MODE: Fetching segments for activity ${activityId} without rate limiting`)
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
        await new Promise(resolve => setTimeout(resolve, config.stravaApiLimits.retryDelayMs))
        return this.fetchActivitySegments(activityId) // Retry after waiting
      } else if (response.status === 401) {
        // Token might be invalid, try to refresh
        await this.refreshTokens(tokens.refresh_token, this.userId)
        return this.fetchActivitySegments(activityId) // Retry with new tokens
      }
      throw new Error(`Failed to fetch activity segments: ${response.status}`)
    }

    // Apply rate limiting delay
    const delay = rateLimitTracker.getDelay()
    await new Promise(resolve => setTimeout(resolve, delay))

    const activity = await response.json()
    const segments = activity.segment_efforts || []
    console.log(`✅ Fetched ${segments.length} segments for activity ${activityId} from Strava API`)
    
    return segments
  }

  /**
   * Sync activities from Strava to local database with rate limiting
   */
  async syncActivities(limit = config.stravaApiLimits.maxCrawlerBatchSize): Promise<{ synced: number; errors: number }> {
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
          const activityData: Omit<DatabaseActivity, 'id'> = {
            strava_id: this.userId!,
            activity_id: activity.id,
            name: activity.name,
            distance: activity.distance,
            moving_time: activity.moving_time,
            elapsed_time: activity.elapsed_time,
            total_elevation_gain: activity.total_elevation_gain,
            type: activity.type,
            start_date: activity.start_date,
            start_date_local: activity.start_date_local,
          }
          await this.activitiesRepo.createActivity(activityData)

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
  async syncSegments(batchSize = config.stravaApiLimits.maxSegmentBatchSize): Promise<{ processed: number; segmentsAdded: number; errors: number }> {
    let processed = 0
    let segmentsAdded = 0
    let errors = 0

    try {
      console.log(`🔄 Starting segment sync (batch size: ${batchSize})`)

      // Get activities that need segments fetched
      const activitiesNeedingSegments = await this.activitiesRepo.getActivitiesNeedingSegments(batchSize)

      if (!activitiesNeedingSegments || activitiesNeedingSegments.length === 0) {
        console.log('✅ No activities need segments fetched')
        return { processed: 0, segmentsAdded: 0, errors: 0 }
      }

      console.log(`📊 Found ${activitiesNeedingSegments.length} activities needing segments`)

      for (const activity of activitiesNeedingSegments) {
        try {
          // Check if segments already exist for this activity
          const existingSegments = await this.segmentsRepo.getSegmentEffortsByActivity(activity.activity_id)
          
          if (existingSegments.data && existingSegments.data.length > 0) {
            console.log(`Activity ${activity.activity_id} already has ${existingSegments.data.length} segments, skipping...`)
            // Mark as fetched even if we skip
            await this.activitiesRepo.markSegmentsFetched(activity.id)
            processed++
            continue
          }

          console.log(`🔄 Processing segments for activity ${activity.activity_id}`)

          // Fetch segments from Strava
          const segmentEfforts = await this.fetchActivitySegments(activity.activity_id)

          if (segmentEfforts.length > 0) {
            // First, create segment records in the segments table
            const segmentsToCreate = segmentEfforts.map(effort => ({
              segment_id: effort.segment.id,
              name: effort.segment.name,
              distance: effort.segment.distance,
              elevation_gain: effort.segment.elevation_high - effort.segment.elevation_low, // Calculate elevation gain
              average_grade: effort.segment.average_grade,
              maximum_grade: effort.segment.maximum_grade,
              climb_category: effort.segment.climb_category,
              city: effort.segment.city,
              state: effort.segment.state,
              country: effort.segment.country,
              polyline: effort.segment.map?.polyline,
            }))

            // Upsert segments (create if they don't exist)
            await this.segmentsRepo.bulkUpsertSegments(segmentsToCreate)

            // Then save segment efforts to database
            const segmentsToSave = segmentEfforts.map(effort => ({
              activity_id: activity.activity_id,
              segment_id: effort.segment.id,
              effort_id: effort.id,
              elapsed_time: effort.elapsed_time,
              moving_time: effort.moving_time,
              start_date: effort.start_date,
              average_watts: effort.average_watts,
              max_watts: effort.max_watts,
            }))

            await this.segmentsRepo.bulkUpsertSegmentEfforts(segmentsToSave)
            segmentsAdded += segmentEfforts.length
            console.log(`✅ Added ${segmentEfforts.length} segments for activity ${activity.activity_id}`)
            
            // Mark activity as having segments fetched only if segments were found
            await this.activitiesRepo.markSegmentsFetched(activity.id)
          } else {
            console.log(`ℹ️  No segments found for activity ${activity.activity_id}`)
            // Don't mark as fetched if no segments were found
          }
          
          processed++

        } catch (error) {
          console.error(`❌ Error processing activity ${activity.activity_id}:`, error)
          errors++
        }
      }

      console.log(`🎉 Segment sync complete: ${processed} processed, ${segmentsAdded} segments added, ${errors} errors`)
    } catch (error) {
      console.error('❌ Error in syncSegments:', error)
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
} 