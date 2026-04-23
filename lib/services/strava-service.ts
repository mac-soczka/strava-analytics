import { createClient } from '@supabase/supabase-js'
import { config } from '@/lib/config'
import { ActivitiesRepository } from '@/lib/repositories/activities-repository'
import { SegmentsRepository } from '@/lib/repositories/segments-repository'
import { StravaActivity, StravaSegmentEffort, StravaTokens, DatabaseActivity } from '@/types/strava'
import { getLogger } from '@/lib/utils/logger'
import { getRateLimitService } from '@/lib/services/rate-limit-service'

const rateLimitService = getRateLimitService()

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

  private buildRateLimitError(message: string, retryAfterMs: number): any {
    const err: any = new Error(message)
    err.statusCode = 429
    err.retryAfter = retryAfterMs
    return err
  }

  private computeRetryAfterMs(response?: Response): number {
    // Prefer server-provided guidance, then fall back to our computed estimate.
    const retryAfterHeader = response?.headers.get('Retry-After')
    const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : NaN
    const headerRetryMs = Number.isFinite(retryAfterSeconds) ? Math.max(0, retryAfterSeconds) * 1000 : 0
    const computedRetryMs = rateLimitService.getRecommendedWaitTime()
    return Math.max(60_000, headerRetryMs, computedRetryMs)
  }

  private async stravaFetch(url: string, init: RequestInit, allowRefreshOnce: boolean = true): Promise<Response> {
    // Check rate limits before making request
    if (!rateLimitService.canMakeRequest()) {
      throw this.buildRateLimitError('Strava API rate limit exceeded', this.computeRetryAfterMs())
    }

    const tokens = await this.getValidTokens()
    const response = await fetch(url, {
      ...init,
      headers: {
        ...(init.headers || {}),
        Authorization: `Bearer ${tokens.access_token}`,
      },
    })

    // Update rate limits from response headers (even for errors)
    rateLimitService.updateFromHeaders(response)

    if (response.status === 401 && allowRefreshOnce) {
      console.warn('Token expired (401), refreshing tokens...')
      await this.refreshTokens(tokens.refresh_token, this.userId)
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
      throw new Error(`Strava API request failed: ${response.status}${bodyText ? ` - ${bodyText}` : ''}`)
    }

    const delay = rateLimitService.getAdaptiveDelay()
    if (delay > 0) {
      const status = rateLimitService.getStatus()
      console.log(
        `Applying rate limit delay: ${delay}ms (15min ${status.requests15min}/${status.limit15min}, day ${status.requestsDay}/${status.limitDay})`
      )
      await new Promise((resolve) => setTimeout(resolve, delay))
    }

    return response.json()
  }

  /**
   * Get current rate limit status
   */
  getRateLimitStatus() {
    return rateLimitService.getStatus()
  }

  /**
   * Get valid Strava tokens, refreshing if necessary
   */
  async getValidTokens(): Promise<StravaTokens> {
    if (!this.userId) {
      throw new Error('User ID is required to get tokens')
    }

    console.log(`Looking for tokens for user: ${this.userId}`)

    const { data: tokens, error } = await this.supabase
      .from('strava_tokens')
      .select('*')
      .eq('strava_id', this.userId)
      .single()

    if (error || !tokens) {
      throw new Error(`No Strava tokens found for user ${this.userId}. Please authenticate first.`)
    }

    console.log(`Found tokens for user ${this.userId}, expires at: ${tokens.expires_at}`)
    console.log(`Current time: ${new Date().toISOString()}`)
    console.log(`Token expires: ${tokens.expires_at}`)

    const expiresAt = new Date(tokens.expires_at as string)
    const now = new Date()
    const isExpired = expiresAt <= now

    console.log(`Is expired: ${isExpired}`)

    if (isExpired) {
      console.log(`Token expired, refreshing...`)
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
    console.log(`Attempting to refresh tokens for user ${stravaId}...`)
    
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
      } catch {
        errorDetails = { message: errorText }
      }
      if (response.status === 400 && errorDetails.errors?.some((e: any) => e.code === 'invalid')) {
        console.error(`Invalid refresh token for user ${stravaId}. User needs to re-authenticate.`)
        throw new Error(`Invalid refresh token - user ${stravaId} needs to re-authenticate with Strava`)
      }
      console.error(`Token refresh failed for user ${stravaId}:`, errorDetails)
      throw new Error(`Failed to refresh Strava tokens: ${response.status} - ${errorDetails.message || errorText}`)
    }

    const newTokens = await response.json()
    console.log(`Token refresh successful for user ${stravaId}`)

    // Save new tokens to database
    const { error: updateError } = await this.supabase
      .from('strava_tokens')
      .upsert({
        strava_id: stravaId,
        access_token: newTokens.access_token,
        refresh_token: newTokens.refresh_token,
        expires_at: new Date(newTokens.expires_at * 1000).toISOString(),
      }, {
        onConflict: 'strava_id'
      })

    if (updateError) {
      console.error('Failed to save refreshed tokens:', updateError)
      // Don't throw error here, as the tokens are still valid for this request
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
    if (config.stravaApiLimits.noLimitsMode) {
      console.log(`NO-LIMITS MODE: Fetching activities page ${page} without rate limiting`)
    } else {
      const status = rateLimitService.getStatus()
      console.log(`Rate limit status before activities fetch: 15min ${status.requests15min}/${status.limit15min}, Day ${status.requestsDay}/${status.limitDay}`)
    }
    const activities = await this.stravaFetchJson<StravaActivity[]>(
      `https://www.strava.com/api/v3/athlete/activities?page=${page}&per_page=${perPage}`
    )
    console.log(`Fetched ${activities.length} activities from Strava API`)
    return activities
  }

  /**
   * Fetch detailed activity information including polyline from Strava API
   */
  async fetchActivityDetails(activityId: number): Promise<StravaActivity | null> {
    // Activity details are enrichment; if rate-limited, we skip (do not pause the whole job).
    try {
      const activity = await this.stravaFetchJson<StravaActivity>(
        `https://www.strava.com/api/v3/activities/${activityId}`
      )
    
      // Add Strava URL
      activity.strava_url = `https://www.strava.com/activities/${activityId}`

      console.log(`Fetched detailed activity: ${activity.name} (ID: ${activityId})`)
      return activity
    } catch (err: any) {
      if (err?.statusCode === 429) {
        const status = rateLimitService.getStatus()
        console.log(
          `Rate limit reached. 15min: ${status.requests15min}/${status.limit15min}, Day: ${status.requestsDay}/${status.limitDay}. Skipping detailed fetch for activity ${activityId}`
        )
        return null
      }
      throw err
    }
  }

  /**
   * Fetch segments for a specific activity from Strava API
   */
  async fetchActivitySegments(activityId: number): Promise<StravaSegmentEffort[]> {
    // Check if we already have segments for this activity in the database
    const existingSegmentsResult = await this.segmentsRepo.getSegmentEffortsByActivity(activityId)
    
    if (existingSegmentsResult.data && existingSegmentsResult.data.length > 0) {
      console.log(`Found ${existingSegmentsResult.data.length} existing segments for activity ${activityId} in database, skipping Strava API call`)
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

    console.log(`Fetching segments for activity ${activityId} from Strava API`)

    if (config.stravaApiLimits.noLimitsMode) {
      console.log(`NO-LIMITS MODE: Fetching segments for activity ${activityId} without rate limiting`)
    } else {
      const status = rateLimitService.getStatus()
      console.log(`Rate limit status before segments fetch: 15min ${status.requests15min}/${status.limit15min}, Day ${status.requestsDay}/${status.limitDay}`)
    }
    const activity = await this.stravaFetchJson<any>(
      `https://www.strava.com/api/v3/activities/${activityId}?include_all_efforts=true`
    )
    const segments = activity.segment_efforts || []
    console.log(`Fetched ${segments.length} segments for activity ${activityId} from Strava API`)
    
    return segments
  }

  /**
   * Check current sync status and data coverage
   */
  async getSyncStatus() {
    try {
      const [totalActivities, activitiesNeedingSegments, totalSegments] = await Promise.all([
        this.activitiesRepo.getActivityStats(),
        this.activitiesRepo.getActivitiesNeedingSegmentsCount(),
        this.segmentsRepo.getSegmentStats()
      ])

      // Get total segment efforts count
      const { count: totalSegmentEfforts } = await this.supabase
        .from('segment_efforts')
        .select('*', { count: 'exact', head: true })

      const activitiesWithSegments = totalActivities.totalActivities - activitiesNeedingSegments
      const segmentCoverage = totalActivities.totalActivities > 0 
        ? Math.round((activitiesWithSegments / totalActivities.totalActivities) * 100) 
        : 0

      return {
        activities: {
          total: totalActivities.totalActivities,
          needingSegments: activitiesNeedingSegments,
          withSegments: activitiesWithSegments,
          coverage: `${segmentCoverage}%`
        },
        segments: {
          total: totalSegments.data?.total_segments || 0,
          efforts: totalSegmentEfforts || 0
        },
        summary: {
          needsSync: activitiesNeedingSegments > 0,
          syncRequired: activitiesNeedingSegments > 0 ? `Need to fetch segments for ${activitiesNeedingSegments} activities` : 'All activities have segments fetched',
          dataComplete: activitiesNeedingSegments === 0
        }
      }
    } catch (error) {
      console.error('Error getting sync status:', error)
      throw error
    }
  }

  /**
   * Comprehensive sync: Fetch ALL activities, then ALL segments for ALL activities
   * This ensures complete data coverage
   */
  async syncAllData(): Promise<{
    activities: { synced: number; errors: number }
    segments: { processed: number; segmentsAdded: number; errors: number }
    segmentEfforts: { total: number }
    totalExecutionTime: number
  }> {
    const startTime = Date.now()
    
    console.log('Starting comprehensive Strava data sync...')
    console.log('Sequence: 1. Fetch ALL activities -> 2. Fetch ALL segments for ALL activities')
    
    try {
      // Step 1: Sync ALL activities
      console.log('\nSTEP 1: Syncing ALL activities from Strava...')
      const activityResult = await this.syncActivities()
      
      // Step 2: Sync ALL segments for ALL activities
      console.log('\nSTEP 2: Syncing ALL segments for ALL activities...')
      const segmentResult = await this.syncSegments()
      
      // Step 3: Get total segment efforts count
      const { count: totalSegmentEfforts } = await this.supabase
        .from('segment_efforts')
        .select('*', { count: 'exact', head: true })
      
      const totalExecutionTime = Date.now() - startTime
      
      const summary = {
        activities: activityResult,
        segments: segmentResult,
        segmentEfforts: { total: totalSegmentEfforts || 0 },
        totalExecutionTime
      }
      
      console.log('\nComprehensive sync completed!')
      console.log(`Summary:`)
      console.log(`   Activities: ${activityResult.synced} synced, ${activityResult.errors} errors`)
      console.log(`   Segments: ${segmentResult.processed} activities processed, ${segmentResult.segmentsAdded} segments added, ${segmentResult.errors} errors`)
      console.log(`   Segment Efforts: ${totalSegmentEfforts || 0} total efforts`)
      console.log(`   Total time: ${Math.round(totalExecutionTime / 1000)}s`)
      
      return summary
      
    } catch (error) {
      console.error('Error in comprehensive sync:', error)
      throw error
    }
  }

  /**
   * Sync activities from Strava to database
   * Fetches activities in pages and processes in batches
   */
  async syncActivities(
    pageSize = config.stravaApiLimits.maxCrawlerBatchSize,
    processBatchSize = 20, // Process 20 activities at a time
    onProgress?: (synced: number, errors: number, total: number) => Promise<void>
  ): Promise<{ synced: number; errors: number }> {
    let synced = 0
    let errors = 0
    let page = 1
    let hasMoreActivities = true
    let totalActivitiesSeen = 0 // Track total across all pages

    try {
      const logger = getLogger()
      logger.log(`Starting activity sync (page size: ${pageSize}, batch size: ${processBatchSize})`)
      const status = rateLimitService.getStatus()
      logger.log(`Initial rate limit status: 15min ${status.remaining15min} remaining, Day ${status.remainingDay} remaining`)

      // Continue fetching until no more activities are found
      while (hasMoreActivities) {
        console.log(`Fetching activities page ${page}...`)
        
        const activities = await this.fetchActivities(page, pageSize)
        
        if (activities.length === 0) {
          console.log(`No more activities found on page ${page}, sync complete`)
          hasMoreActivities = false
          break
        }

        console.log(`Found ${activities.length} activities on page ${page}`)
        
        // Update total count
        totalActivitiesSeen += activities.length

        // Report progress with current total
        if (onProgress) {
          await onProgress(synced, errors, totalActivitiesSeen)
        }

        // Process activities in batches
        for (let i = 0; i < activities.length; i += processBatchSize) {
          const batch = activities.slice(i, i + processBatchSize)
          const batchNum = Math.floor(i / processBatchSize) + 1
          const totalBatches = Math.ceil(activities.length / processBatchSize)
          
          console.log(`Processing batch ${batchNum}/${totalBatches} (${batch.length} activities)`)

          for (const activity of batch) {
            try {
              // Check if activity already exists
              const existing = await this.activitiesRepo.getActivityById(activity.id)
              if (existing) {
                console.log(`Activity ${activity.id} already exists, skipping...`)
                synced++ // Count as synced since it's in DB
                continue
              }

              // For new activities, try to get detailed data but fall back to basic data if needed
              let detailedActivity: StravaActivity
              let hasDetailedData = false

              console.log(`Fetching detailed data for activity ${activity.id}...`)
              const fetchedDetails = await this.fetchActivityDetails(activity.id)
              
              if (fetchedDetails) {
                detailedActivity = fetchedDetails
                hasDetailedData = true
              } else {
                // Rate limit reached or other issue - use basic activity data
                console.log(`Using basic data for activity ${activity.id} (rate limit reached)`)
                detailedActivity = {
                  ...activity,
                  strava_url: `https://www.strava.com/activities/${activity.id}`
                }
                hasDetailedData = false
              }

              // Create activity in database with available data
              const activityData: Omit<DatabaseActivity, 'id'> = {
                strava_id: this.userId!,
                activity_id: detailedActivity.id,
                name: detailedActivity.name,
                distance: detailedActivity.distance,
                moving_time: detailedActivity.moving_time,
                elapsed_time: detailedActivity.elapsed_time,
                total_elevation_gain: detailedActivity.total_elevation_gain,
                type: detailedActivity.type,
                start_date: detailedActivity.start_date,
                start_date_local: detailedActivity.start_date_local,
                average_speed: detailedActivity.average_speed,
                max_speed: detailedActivity.max_speed,
                average_watts: detailedActivity.average_watts,
                max_watts: detailedActivity.max_watts,
                average_heartrate: detailedActivity.average_heartrate,
                max_heartrate: detailedActivity.max_heartrate,
                polyline: detailedActivity.map?.polyline || detailedActivity.map?.summary_polyline,
                strava_url: detailedActivity.strava_url,
              }
              await this.activitiesRepo.createActivity(activityData)

              synced++
              console.log(`Synced activity${hasDetailedData ? ' with polyline' : ' (basic data)'}: ${detailedActivity.name}`)

              // Rate limiting is handled in fetchActivityDetails
            } catch (error) {
              console.error(`Error syncing activity ${activity.id}:`, error)
              errors++
            }
          }

          console.log(`Batch ${batchNum}/${totalBatches} complete: ${synced} total synced, ${errors} errors`)
          
          // Report progress after each batch
          if (onProgress) {
            await onProgress(synced, errors, totalActivitiesSeen)
          }
        }

        // Move to next page
        page++
        
        // Safety check to prevent infinite loops
        if (page > 100) {
          console.log(`Reached page limit (100), stopping sync to prevent infinite loop`)
          break
        }
      }

      console.log(`Complete activity sync finished: ${synced} synced, ${errors} errors, ${page - 1} pages processed`)
    } catch (error) {
      // Rate limiting is expected and handled by orchestration (pause + resume).
      if ((error as any)?.statusCode !== 429) {
        console.error('Error in syncActivities:', error)
      }
      throw error
    }

    return { synced, errors }
  }

  /**
   * Sync segments for ALL activities that need them
   * Processes ALL activities, not just a limited batch
   */
  async syncSegments(batchSize = config.stravaApiLimits.maxSegmentBatchSize): Promise<{ processed: number; segmentsAdded: number; errors: number }> {
    let processed = 0
    let segmentsAdded = 0
    let errors = 0
    let offset = 0
    let hasMoreActivities = true

    try {
      console.log(`Starting complete segment sync (batch size: ${batchSize})`)

      // Get total count of activities needing segments for progress tracking
      const totalActivitiesNeedingSegments = await this.activitiesRepo.getActivitiesNeedingSegmentsCount()
      console.log(`Total activities needing segments: ${totalActivitiesNeedingSegments}`)

      if (totalActivitiesNeedingSegments === 0) {
        console.log('No activities need segments fetched')
        return { processed: 0, segmentsAdded: 0, errors: 0 }
      }

      // Continue processing until no more activities need segments
      while (hasMoreActivities) {
        console.log(`Processing activities batch starting at offset ${offset} (${processed}/${totalActivitiesNeedingSegments} processed)...`)

        // Get activities that need segments fetched
        const activitiesNeedingSegments = await this.activitiesRepo.getActivitiesNeedingSegments(batchSize, offset)

        if (!activitiesNeedingSegments || activitiesNeedingSegments.length === 0) {
          console.log(`No more activities need segments fetched at offset ${offset}`)
          hasMoreActivities = false
          break
        }

        console.log(`Found ${activitiesNeedingSegments.length} activities needing segments at offset ${offset}`)

        for (const activity of activitiesNeedingSegments) {
          try {
            // Check if segments already exist for this activity
            const existingSegments = await this.segmentsRepo.getSegmentEffortsByActivity(activity.activity_id)
            
            if (existingSegments.data && existingSegments.data.length > 0) {
              console.log(`Activity ${activity.activity_id} already has ${existingSegments.data.length} segments, marking as fetched...`)
              // Mark as fetched even if we skip
              await this.activitiesRepo.markSegmentsFetched(activity.id)
              // Don't increment processed count for already-fetched activities
              continue
            }

            console.log(`🔄 Processing segments for activity ${activity.activity_id}`)

            // Fetch segments from Strava
            const segmentEfforts = await this.fetchActivitySegments(activity.activity_id)

            if (segmentEfforts.length > 0) {
              // First pass: create *missing* segment records only (no updates).
              const segmentsFromEfforts = segmentEfforts.map(effort => ({
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

              // Only insert segments we don't already have yet.
              const uniqueSegmentIds = Array.from(new Set(segmentsFromEfforts.map(s => s.segment_id)))
              const existingIdsResult = await this.segmentsRepo.getExistingSegmentIds(uniqueSegmentIds)
              if (existingIdsResult.error) throw existingIdsResult.error
              const existingIds = new Set(existingIdsResult.data)

              const segmentsToInsert = segmentsFromEfforts
                .filter(s => !existingIds.has(s.segment_id))
                // avoid duplicates in the insert batch
                .filter((s, idx, arr) => arr.findIndex(x => x.segment_id === s.segment_id) === idx)

              if (segmentsToInsert.length > 0) {
                await this.segmentsRepo.bulkUpsertSegments(segmentsToInsert)
              }

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

              // Check how many segment efforts were actually inserted (not updated)
              const existingEfforts = await this.segmentsRepo.getSegmentEffortsByActivity(activity.activity_id)
              const existingEffortIds = new Set(existingEfforts.data?.map(e => e.effort_id) || [])
              
              // Only count efforts that don't already exist
              const newEfforts = segmentsToSave.filter(effort => !existingEffortIds.has(effort.effort_id))
              
              await this.segmentsRepo.bulkUpsertSegmentEfforts(segmentsToSave)
              segmentsAdded += newEfforts.length
              console.log(`Added ${newEfforts.length} NEW segment efforts for activity ${activity.activity_id} (${segmentEfforts.length} total found, ${existingEfforts.data?.length || 0} already existed)`)
              
              // Mark activity as having segments fetched only if segments were found
              await this.activitiesRepo.markSegmentsFetched(activity.id)
            } else {
              console.log(`No segments found for activity ${activity.activity_id}`)
              // Don't mark as fetched if no segments were found
            }
            
            processed++

          } catch (error: any) {
            // If we're rate-limited, abort the loop so the orchestration layer can pause the job.
            if (error?.statusCode === 429 || `${error?.message || ''}`.includes('rate limit')) {
              throw error
            }

            console.error(`Error processing activity ${activity.activity_id}:`, error)
            errors++
          }
        }

        // Move to next batch
        offset += batchSize
        
        // Safety check to prevent infinite loops
        if (offset > 10000) {
          console.log(`Reached offset limit (10000), stopping sync to prevent infinite loop`)
          break
        }
      }

      console.log(`Complete segment sync finished: ${processed} processed, ${segmentsAdded} segments added, ${errors} errors`)
    } catch (error: any) {
      // Rate limiting is expected and handled by orchestration (pause + resume).
      if (error?.statusCode !== 429) {
        console.error('Error in syncSegments:', error)
      }
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
   * Update existing activities with missing polyline and strava_url data
   * This is a separate process that can be run independently
   */
  async updateActivitiesWithMissingData(limit = 10): Promise<{ updated: number; errors: number }> {
    let updated = 0
    let errors = 0

    try {
      console.log(`🔄 Starting update of activities with missing data (limit: ${limit})`)
      
      // Get activities that are missing polyline or strava_url
      const { data: activitiesNeedingUpdate, error } = await this.supabase
        .from('activities')
        .select('activity_id, name')
        .or('polyline.is.null,strava_url.is.null')
        .eq('strava_id', this.userId!)
        .limit(limit)

      if (error) throw error

      if (!activitiesNeedingUpdate || activitiesNeedingUpdate.length === 0) {
        console.log('No activities need updating')
        return { updated: 0, errors: 0 }
      }

      console.log(`Found ${activitiesNeedingUpdate.length} activities needing updates`)

      for (const activity of activitiesNeedingUpdate) {
        try {
          console.log(`Updating activity ${activity.activity_id}...`)
          
          // Fetch detailed activity data
          const detailedActivity = await this.fetchActivityDetails(activity.activity_id as number)
          
          if (!detailedActivity) {
            console.log(`Rate limit reached, skipping update for activity ${activity.activity_id}`)
            continue
          }
          
          // Update the activity with missing data
          const updateData: Partial<DatabaseActivity> = {
            average_speed: detailedActivity.average_speed,
            max_speed: detailedActivity.max_speed,
            average_watts: detailedActivity.average_watts,
            max_watts: detailedActivity.max_watts,
            average_heartrate: detailedActivity.average_heartrate,
            max_heartrate: detailedActivity.max_heartrate,
            polyline: detailedActivity.map?.polyline || detailedActivity.map?.summary_polyline,
            strava_url: detailedActivity.strava_url,
          }

          const { error: updateError } = await this.supabase
            .from('activities')
            .update(updateData)
            .eq('activity_id', activity.activity_id as number)

          if (updateError) throw updateError

          updated++
          console.log(`Updated activity: ${activity.name}`)

        } catch (error) {
          console.error(`Error updating activity ${activity.activity_id}:`, error)
          errors++
        }
      }

      console.log(`Activity update completed: ${updated} updated, ${errors} errors`)
    } catch (error) {
      console.error('Error in updateActivitiesWithMissingData:', error)
      throw error
    }

    return { updated, errors }
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