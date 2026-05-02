import { createServerComponentClient } from '@/lib/supabase'
import { StravaActivity, DatabaseActivity } from '@/types/strava'

export type ActivitySyncState = 'pending' | 'in_progress' | 'completed' | 'failed'

export type ClaimedActivityForSegmentSync = {
  id: string
  activity_id: number
  name: string
}

export class ActivitiesRepository {
  private supabase: ReturnType<typeof createServerComponentClient>

  constructor() {
    try {
      this.supabase = createServerComponentClient()
    } catch (error) {
      console.error('Failed to initialize Supabase client:', error)
      throw new Error('Supabase configuration required. Please check your environment variables.')
    }
  }

  /**
   * Get all activities with optional pagination
   */
  async getActivities(limit = 200, offset = 0) {
    try {
      const { data, error } = await this.supabase
        .from('activities')
        .select('*')
        .order('start_date', { ascending: false })
        .range(offset, offset + limit - 1)

      if (error) throw error
      
      // Convert DatabaseActivity to StravaActivity format
      return (data || []).map((dbActivity: any) => ({
        id: dbActivity.activity_id, // Use activity_id as the Strava ID
        name: dbActivity.name,
        distance: dbActivity.distance,
        moving_time: dbActivity.moving_time,
        elapsed_time: dbActivity.elapsed_time,
        total_elevation_gain: dbActivity.total_elevation_gain,
        type: dbActivity.type,
        start_date: dbActivity.start_date,
        start_date_local: dbActivity.start_date_local
      })) as StravaActivity[]
    } catch (error) {
      console.error('Error fetching activities:', error)
      throw error
    }
  }

  /**
   * Get a single activity by Strava activity ID
   */
  async getActivityById(activityId: number) {
    try {
      const { data, error } = await this.supabase
        .from('activities')
        .select('*')
        .eq('activity_id', activityId)
        .maybeSingle() // Use maybeSingle() instead of single() to return null if not found

      if (error) throw error
      return data as StravaActivity | null // Return null if activity not found
    } catch (error) {
      console.error('Error fetching activity by ID:', error)
      throw error
    }
  }

  /**
   * Get activity with its segments
   */
  async getActivityWithSegments(id: number) {
    try {
      const { data, error } = await this.supabase
        .from('activities')
        .select(`
          *,
          segments (*)
        `)
        .eq('id', id)
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error fetching activity with segments:', error)
      throw error
    }
  }

  /**
   * Get activities by date range
   */
  async getActivitiesByDateRange(startDate: string, endDate: string) {
    try {
      const { data, error } = await this.supabase
        .from('activities')
        .select('*')
        .gte('start_date', startDate)
        .lte('start_date', endDate)
        .order('start_date', { ascending: false })

      if (error) throw error
      
      // Convert DatabaseActivity to StravaActivity format
      return (data || []).map((dbActivity: any) => ({
        id: dbActivity.activity_id, // Use activity_id as the Strava ID
        name: dbActivity.name,
        distance: dbActivity.distance,
        moving_time: dbActivity.moving_time,
        elapsed_time: dbActivity.elapsed_time,
        total_elevation_gain: dbActivity.total_elevation_gain,
        type: dbActivity.type,
        start_date: dbActivity.start_date,
        start_date_local: dbActivity.start_date_local
      })) as StravaActivity[]
    } catch (error) {
      console.error('Error fetching activities by date range:', error)
      throw error
    }
  }

  /**
   * Get activities by type
   */
  async getActivitiesByType(activityType: string) {
    try {
      const { data, error } = await this.supabase
        .from('activities')
        .select('*')
        .eq('type', activityType)
        .order('start_date', { ascending: false })

      if (error) throw error
      
      // Convert DatabaseActivity to StravaActivity format
      return (data || []).map((dbActivity: any) => ({
        id: dbActivity.activity_id, // Use activity_id as the Strava ID
        name: dbActivity.name,
        distance: dbActivity.distance,
        moving_time: dbActivity.moving_time,
        elapsed_time: dbActivity.elapsed_time,
        total_elevation_gain: dbActivity.total_elevation_gain,
        type: dbActivity.type,
        start_date: dbActivity.start_date,
        start_date_local: dbActivity.start_date_local
      })) as StravaActivity[]
    } catch (error) {
      console.error('Error fetching activities by type:', error)
      throw error
    }
  }

  /**
   * Reset segments_fetched flag for activities (useful for re-processing)
   */
  async resetSegmentsFetchedFlag(limit = 1000) {
    try {
      const { data, error } = await this.supabase
        .from('activities')
        .update({ segments_fetched: false })
        .eq('segments_fetched', true)
        .limit(limit)
        .select('id, activity_id')

      if (error) throw error
      
      console.log(`🔄 Reset segments_fetched flag for ${data?.length || 0} activities`)
      return data?.length || 0
    } catch (error) {
      console.error('Error resetting segments_fetched flag:', error)
      throw error
    }
  }

  /**
   * Get total count of activities that need segments fetched
   */
  async getActivitiesNeedingSegmentsCount(stravaId?: number) {
    try {
      let query = this.supabase
        .from('activities')
        .select('*', { count: 'exact', head: true })
        .neq('activity_sync_state', 'completed')

      if (stravaId !== undefined) {
        query = query.eq('strava_id', stravaId)
      }

      const { count, error } = await query

      if (error) throw error
      
      return count || 0
    } catch (error) {
      console.error('Error fetching activities needing segments count:', error)
      throw error
    }
  }

  /**
   * Get activities that need segments fetched with pagination support
   */
  async getActivitiesNeedingSegments(limit = 10, offset = 0, stravaId?: number) {
    try {
      let query = this.supabase
        .from('activities')
        .select('id, activity_id, name')
        .neq('activity_sync_state', 'completed')
        .range(offset, offset + limit - 1)
        .order('start_date', { ascending: true })

      if (stravaId !== undefined) {
        query = query.eq('strava_id', stravaId)
      }

      const { data, error } = await query

      if (error) throw error
      
      // Return data with both database ID and activity_id for flexibility
      return data || []
    } catch (error) {
      console.error('Error fetching activities needing segments:', error)
      throw error
    }
  }

  async claimNextActivityForSegmentSync(stravaId: number): Promise<ClaimedActivityForSegmentSync | null> {
    try {
      const { data, error } = await this.supabase.rpc('claim_next_activity_for_segment_sync', {
        p_strava_id: stravaId,
      })
      if (error) throw error
      const row = Array.isArray(data) ? data[0] : data
      if (!row) return null
      return row as ClaimedActivityForSegmentSync
    } catch (error) {
      console.error('Error claiming next activity for segment sync:', error)
      throw error
    }
  }

  /**
   * Create a new activity
   */
  async createActivity(activity: Omit<DatabaseActivity, 'id'>) {
    try {
      const { data, error } = await this.supabase
        .from('activities')
        .insert(activity)
        .select()
        .single()

      if (error) throw error
      return data as DatabaseActivity
    } catch (error) {
      console.error('Error creating activity:', error)
      throw error
    }
  }

  /**
   * Update an activity
   */
  async updateActivity(id: number, updates: Partial<DatabaseActivity>) {
    try {
      const { data, error} = await this.supabase
        .from('activities')
        .update(updates)
        .eq('activity_id', id)
        .select()
        .single()

      if (error) throw error
      return data as DatabaseActivity
    } catch (error) {
      console.error('Error updating activity:', error)
      throw error
    }
  }

  /**
   * Mark activity as having segments fetched
   */
  async markSegmentsFetched(id: number) {
    try {
      const { error } = await this.supabase
        .from('activities')
        .update({
          segments_fetched: true,
          segments_fetch_status: 'success_rows',
          segments_fetched_at: new Date().toISOString(),
          segments_fetch_error: null,
        })
        .eq('id', id)

      if (error) throw error
    } catch (error) {
      console.error('Error marking segments fetched:', error)
      throw error
    }
  }

  async markSegmentsFetchSuccessEmpty(id: string) {
    const now = new Date().toISOString()
    const { error } = await this.supabase
      .from('activities')
      .update({
        activity_sync_state: 'completed',
        activity_sync_completed_at: now,
        activity_sync_error: null,
        segments_fetched: true,
        segments_fetch_status: 'success_empty',
        segments_fetched_at: now,
        segment_efforts_synced_at: now,
        segments_fetch_error: null,
        segments_effort_rows_count: 0,
      })
      .eq('id', id)
    if (error) throw error
  }

  async markSegmentsFetchSuccessRows(id: string, effortRowsCount: number) {
    const now = new Date().toISOString()
    const { error } = await this.supabase
      .from('activities')
      .update({
        activity_sync_state: 'completed',
        activity_sync_completed_at: now,
        activity_sync_error: null,
        segments_fetched: true,
        segments_fetch_status: 'success_rows',
        segments_fetched_at: now,
        segment_efforts_synced_at: now,
        segments_fetch_error: null,
        segments_effort_rows_count: effortRowsCount,
      })
      .eq('id', id)
    if (error) throw error
  }

  async markSegmentsFetchFailed(id: string, errorMessage: string) {
    const { error } = await this.supabase
      .from('activities')
      .update({
        activity_sync_state: 'failed',
        activity_sync_completed_at: null,
        activity_sync_error: errorMessage,
        segments_fetched: false,
        segments_fetch_status: 'failed',
        segments_fetch_error: errorMessage,
      })
      .eq('id', id)
    if (error) throw error
  }

  async requeueSegmentsFetchByActivityId(activityId: number, reason: string = 'manual requeue') {
    const { error } = await this.supabase
      .from('activities')
      .update({
        activity_sync_state: 'pending',
        activity_sync_started_at: null,
        activity_sync_completed_at: null,
        activity_sync_error: null,
        segments_fetched: false,
        segments_fetch_status: 'pending',
        segments_fetch_error: reason,
      })
      .eq('activity_id', activityId)
    if (error) throw error
  }

  /**
   * Get activity statistics
   */
  async getActivityStats() {
    try {
      const { data, error } = await this.supabase
        .from('activities')
        .select('distance, moving_time, total_elevation_gain, type')

      if (error) throw error

      const stats = {
        totalActivities: data.length,
        totalDistance: data.reduce((sum, a) => sum + (a.distance || 0), 0),
        totalTime: data.reduce((sum, a) => sum + (a.moving_time || 0), 0),
        totalElevation: data.reduce((sum, a) => sum + (a.total_elevation_gain || 0), 0),
        bySportType: data.reduce((acc, a) => {
          acc[a.type] = (acc[a.type] || 0) + 1
          return acc
        }, {} as Record<string, number>)
      }

      return stats
    } catch (error) {
      console.error('Error fetching activity stats:', error)
      throw error
    }
  }

  /**
   * Get recent activities for dashboard
   */
  async getRecentActivities(limit = 5) {
    try {
      const { data, error } = await this.supabase
        .from('activities')
        .select('*')
        .order('start_date', { ascending: false })
        .limit(limit)

      if (error) throw error
      
      // Convert DatabaseActivity to StravaActivity format
      return (data || []).map((dbActivity: any) => ({
        id: dbActivity.activity_id, // Use activity_id as the Strava ID
        name: dbActivity.name,
        distance: dbActivity.distance,
        moving_time: dbActivity.moving_time,
        elapsed_time: dbActivity.elapsed_time,
        total_elevation_gain: dbActivity.total_elevation_gain,
        type: dbActivity.type,
        start_date: dbActivity.start_date,
        start_date_local: dbActivity.start_date_local
      })) as StravaActivity[]
    } catch (error) {
      console.error('Error fetching recent activities:', error)
      throw error
    }
  }
} 