import { createServerComponentClient } from '@/lib/supabase'
import { StravaActivity } from '@/types/strava'

export class ActivitiesRepository {
  private supabase: ReturnType<typeof createServerComponentClient>

  constructor() {
    this.supabase = createServerComponentClient()
  }

  /**
   * Get all activities with optional pagination
   */
  async getActivities(limit = 50, offset = 0) {
    const { data, error } = await this.supabase
      .from('activities')
      .select('*')
      .order('start_date', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error
    return data as StravaActivity[]
  }

  /**
   * Get a single activity by ID
   */
  async getActivityById(id: number) {
    const { data, error } = await this.supabase
      .from('activities')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    return data as StravaActivity
  }

  /**
   * Get activity with its segments
   */
  async getActivityWithSegments(id: number) {
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
  }

  /**
   * Get activities by date range
   */
  async getActivitiesByDateRange(startDate: string, endDate: string) {
    const { data, error } = await this.supabase
      .from('activities')
      .select('*')
      .gte('start_date', startDate)
      .lte('start_date', endDate)
      .order('start_date', { ascending: false })

    if (error) throw error
    return data as StravaActivity[]
  }

  /**
   * Get activities by sport type
   */
  async getActivitiesByType(sportType: string) {
    const { data, error } = await this.supabase
      .from('activities')
      .select('*')
      .eq('sport_type', sportType)
      .order('start_date', { ascending: false })

    if (error) throw error
    return data as StravaActivity[]
  }

  /**
   * Get activities that need segments fetched
   */
  async getActivitiesNeedingSegments(limit = 10) {
    const { data, error } = await this.supabase
      .from('activities')
      .select('id')
      .eq('segments_fetched', false)
      .limit(limit)

    if (error) throw error
    return data
  }

  /**
   * Create a new activity
   */
  async createActivity(activity: Omit<StravaActivity, 'id'>) {
    const { data, error } = await this.supabase
      .from('activities')
      .insert(activity)
      .select()
      .single()

    if (error) throw error
    return data as StravaActivity
  }

  /**
   * Update an activity
   */
  async updateActivity(id: number, updates: Partial<StravaActivity>) {
    const { data, error } = await this.supabase
      .from('activities')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data as StravaActivity
  }

  /**
   * Mark activity as having segments fetched
   */
  async markSegmentsFetched(id: number) {
    const { error } = await this.supabase
      .from('activities')
      .update({ segments_fetched: true })
      .eq('id', id)

    if (error) throw error
  }

  /**
   * Get activity statistics
   */
  async getActivityStats() {
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
  }

  /**
   * Get recent activities for dashboard
   */
  async getRecentActivities(limit = 5) {
    const { data, error } = await this.supabase
      .from('activities')
      .select('*')
      .order('start_date', { ascending: false })
      .limit(limit)

    if (error) throw error
    return data as StravaActivity[]
  }
} 