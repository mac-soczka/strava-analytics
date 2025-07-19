import { createServerComponentClient } from '@/lib/supabase'
import { StravaActivity } from '@/types/strava'

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
  async getActivities(limit = 50, offset = 0) {
    try {
      const { data, error } = await this.supabase
        .from('activities')
        .select('*')
        .order('start_date', { ascending: false })
        .range(offset, offset + limit - 1)

      if (error) throw error
      return data as StravaActivity[]
    } catch (error) {
      console.error('Error fetching activities:', error)
      throw error
    }
  }

  /**
   * Get a single activity by ID
   */
  async getActivityById(id: number) {
    try {
      const { data, error } = await this.supabase
        .from('activities')
        .select('*')
        .eq('id', id)
        .single()

      if (error) throw error
      return data as StravaActivity
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
      return data as StravaActivity[]
    } catch (error) {
      console.error('Error fetching activities by date range:', error)
      throw error
    }
  }

  /**
   * Get activities by sport type
   */
  async getActivitiesByType(sportType: string) {
    try {
      const { data, error } = await this.supabase
        .from('activities')
        .select('*')
        .eq('sport_type', sportType)
        .order('start_date', { ascending: false })

      if (error) throw error
      return data as StravaActivity[]
    } catch (error) {
      console.error('Error fetching activities by type:', error)
      throw error
    }
  }

  /**
   * Get activities that need segments fetched
   */
  async getActivitiesNeedingSegments(limit = 10) {
    try {
      const { data, error } = await this.supabase
        .from('activities')
        .select('id')
        .eq('segments_fetched', false)
        .limit(limit)

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error fetching activities needing segments:', error)
      throw error
    }
  }

  /**
   * Create a new activity
   */
  async createActivity(activity: Omit<StravaActivity, 'id'>) {
    try {
      const { data, error } = await this.supabase
        .from('activities')
        .insert(activity)
        .select()
        .single()

      if (error) throw error
      return data as StravaActivity
    } catch (error) {
      console.error('Error creating activity:', error)
      throw error
    }
  }

  /**
   * Update an activity
   */
  async updateActivity(id: number, updates: Partial<StravaActivity>) {
    try {
      const { data, error } = await this.supabase
        .from('activities')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data as StravaActivity
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
        .update({ segments_fetched: true })
        .eq('id', id)

      if (error) throw error
    } catch (error) {
      console.error('Error marking segments fetched:', error)
      throw error
    }
  }

  /**
   * Get activity statistics
   */
  async getActivityStats() {
    try {
      const { data, error } = await this.supabase
        .from('activities')
        .select('distance, moving_time, total_elevation_gain, sport_type')

      if (error) throw error

      const stats = {
        totalActivities: data.length,
        totalDistance: data.reduce((sum, a) => sum + (a.distance || 0), 0),
        totalTime: data.reduce((sum, a) => sum + (a.moving_time || 0), 0),
        totalElevation: data.reduce((sum, a) => sum + (a.total_elevation_gain || 0), 0),
        bySportType: data.reduce((acc, a) => {
          acc[a.sport_type] = (acc[a.sport_type] || 0) + 1
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
      return data as StravaActivity[]
    } catch (error) {
      console.error('Error fetching recent activities:', error)
      throw error
    }
  }
} 