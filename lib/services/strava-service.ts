import { createServerComponentClient } from '@/lib/supabase'
import { ActivitiesRepository } from '@/lib/repositories/activities-repository'
import { SegmentsRepository } from '@/lib/repositories/segments-repository'

interface StravaTokens {
  access_token: string
  refresh_token: string
  expires_at: string
}

interface StravaActivity {
  id: number
  name: string
  distance: number
  moving_time: number
  elapsed_time: number
  total_elevation_gain: number
  type: string
  sport_type: string
  start_date: string
  start_date_local: string
  timezone: string
  utc_offset: number
  map?: {
    polyline: string
  }
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

export class StravaService {
  private supabase: ReturnType<typeof createServerComponentClient>
  private activitiesRepo: ActivitiesRepository
  private segmentsRepo: SegmentsRepository

  constructor() {
    this.supabase = createServerComponentClient()
    this.activitiesRepo = new ActivitiesRepository()
    this.segmentsRepo = new SegmentsRepository()
  }

  /**
   * Get valid Strava tokens, refreshing if necessary
   */
  async getValidTokens(): Promise<StravaTokens> {
    const { data: tokens } = await this.supabase
      .from('tokens')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!tokens) {
      throw new Error('No Strava tokens found. Please authenticate first.')
    }

    // Check if token is expired
    if (new Date(tokens.expires_at) <= new Date()) {
      console.log('Token expired, refreshing...')
      return await this.refreshTokens(tokens.refresh_token)
    }

    return tokens
  }

  /**
   * Refresh Strava access tokens
   */
  private async refreshTokens(refreshToken: string): Promise<StravaTokens> {
    const response = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.STRAVA_CLIENT_ID!,
        client_secret: process.env.STRAVA_CLIENT_SECRET!,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      })
    })

    if (!response.ok) {
      throw new Error('Failed to refresh Strava tokens')
    }

    const newTokens = await response.json()

    // Save new tokens to database
    await this.supabase
      .from('tokens')
      .insert({
        access_token: newTokens.access_token,
        refresh_token: newTokens.refresh_token,
        expires_at: new Date(newTokens.expires_at * 1000).toISOString(),
      })

    return {
      access_token: newTokens.access_token,
      refresh_token: newTokens.refresh_token,
      expires_at: new Date(newTokens.expires_at * 1000).toISOString(),
    }
  }

  /**
   * Fetch activities from Strava API
   */
  async fetchActivities(page = 1, perPage = 30): Promise<StravaActivity[]> {
    const tokens = await this.getValidTokens()

    const response = await fetch(
      `https://www.strava.com/api/v3/athlete/activities?page=${page}&per_page=${perPage}`,
      {
        headers: { 'Authorization': `Bearer ${tokens.access_token}` }
      }
    )

    if (!response.ok) {
      if (response.status === 401) {
        // Token might be invalid, try to refresh
        await this.refreshTokens(tokens.refresh_token)
        return this.fetchActivities(page, perPage) // Retry with new tokens
      }
      throw new Error(`Failed to fetch activities: ${response.status}`)
    }

    return response.json()
  }

  /**
   * Fetch segments for a specific activity
   */
  async fetchActivitySegments(activityId: number): Promise<StravaSegmentEffort[]> {
    const tokens = await this.getValidTokens()

    const response = await fetch(
      `https://www.strava.com/api/v3/activities/${activityId}?include_all_efforts=true`,
      {
        headers: { 'Authorization': `Bearer ${tokens.access_token}` }
      }
    )

    if (!response.ok) {
      if (response.status === 401) {
        // Token might be invalid, try to refresh
        await this.refreshTokens(tokens.refresh_token)
        return this.fetchActivitySegments(activityId) // Retry with new tokens
      }
      throw new Error(`Failed to fetch activity segments: ${response.status}`)
    }

    const activity = await response.json()
    return activity.segment_efforts || []
  }

  /**
   * Sync activities from Strava to local database
   */
  async syncActivities(limit = 50): Promise<{ synced: number; errors: number }> {
    let synced = 0
    let errors = 0

    try {
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
          console.log(`Synced activity: ${activity.name}`)

          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 100))
        } catch (error) {
          console.error(`Error syncing activity ${activity.id}:`, error)
          errors++
        }
      }
    } catch (error) {
      console.error('Error in syncActivities:', error)
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
            await this.segmentsRepo.createSegmentEfforts(segmentEfforts)
            segmentsAdded += segments.length
          }

          // Mark activity as having segments fetched
          await this.activitiesRepo.markSegmentsFetched(activity.id)
          processed++

          console.log(`Processed activity ${activity.id}: ${segments.length} segments`)

          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 1100))
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
      segments: segmentStats,
      summary: {
        totalActivities: activityStats.totalActivities,
        totalDistance: activityStats.totalDistance,
        totalTime: activityStats.totalTime,
        totalElevation: activityStats.totalElevation,
        totalSegmentEfforts: segmentStats.totalEfforts,
        uniqueSegments: segmentStats.uniqueSegments,
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