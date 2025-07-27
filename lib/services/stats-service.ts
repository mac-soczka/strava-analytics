import { createClient } from '@supabase/supabase-js'

interface UserStats {
  totalActivities: number
  totalDistance: number
  totalTime: number
  totalElevation: number
  totalEfforts: number
  uniqueSegmentsAttempted: number
  activityTypes: Record<string, number>
  lastUpdated: string
}

interface GlobalStats {
  totalActivities: number
  totalSegments: number
  totalEfforts: number
  totalDistance: number
  totalElevation: number
  lastUpdated: string
}

export class StatsService {
  private supabase: any
  private cache = new Map<string, { data: any; timestamp: number }>()
  private readonly CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }

  /**
   * Get user statistics with caching
   */
  async getUserStats(stravaId: number): Promise<UserStats> {
    const cacheKey = `user_stats_${stravaId}`
    const cached = this.cache.get(cacheKey)
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data
    }

    try {
      // Use the database function for fast access
      const { data: userStats, error } = await this.supabase
        .rpc('get_user_stats', { user_strava_id: stravaId })

      if (error || !userStats || userStats.length === 0) {
        // Fallback to calculating from scratch
        return await this.calculateUserStats(stravaId)
      }

      const stats = userStats[0]
      const userStatsData: UserStats = {
        totalActivities: Number(stats.total_activities) || 0,
        totalDistance: Number(stats.total_distance) || 0,
        totalTime: Number(stats.total_time) || 0,
        totalElevation: Number(stats.total_elevation) || 0,
        totalEfforts: Number(stats.total_efforts) || 0,
        uniqueSegmentsAttempted: Number(stats.unique_segments_attempted) || 0,
        activityTypes: stats.activity_types || {},
        lastUpdated: new Date().toISOString()
      }

      this.cache.set(cacheKey, { data: userStatsData, timestamp: Date.now() })
      return userStatsData

    } catch (error) {
      console.error('Error fetching user stats:', error)
      return await this.calculateUserStats(stravaId)
    }
  }

  /**
   * Calculate user statistics from scratch (fallback)
   */
  private async calculateUserStats(stravaId: number): Promise<UserStats> {
    const [activities, efforts] = await Promise.all([
      this.supabase.from('activities').select('*').eq('strava_id', stravaId),
      this.supabase
        .from('segment_efforts')
        .select('segment_id')
        .in('activity_id', 
          this.supabase
            .from('activities')
            .select('activity_id')
            .eq('strava_id', stravaId)
        )
    ])

    const activityTypes = activities.data?.reduce((acc: Record<string, number>, activity: any) => {
      acc[activity.type] = (acc[activity.type] || 0) + 1
      return acc
    }, {} as Record<string, number>) || {}

    const stats: UserStats = {
      totalActivities: activities.data?.length || 0,
      totalDistance: activities.data?.reduce((sum: number, a: any) => sum + (a.distance || 0), 0) || 0,
      totalTime: activities.data?.reduce((sum: number, a: any) => sum + (a.moving_time || 0), 0) || 0,
      totalElevation: activities.data?.reduce((sum: number, a: any) => sum + (a.total_elevation_gain || 0), 0) || 0,
      totalEfforts: efforts.data?.length || 0,
      uniqueSegmentsAttempted: new Set(efforts.data?.map((e: any) => e.segment_id) || []).size,
      activityTypes,
      lastUpdated: new Date().toISOString()
    }

    return stats
  }

  /**
   * Get global statistics
   */
  async getGlobalStats(): Promise<GlobalStats> {
    const cacheKey = 'global_stats'
    const cached = this.cache.get(cacheKey)
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data
    }

    try {
      // Use views for fast access
      const [activityStats, segmentStats, effortStats] = await Promise.all([
        this.supabase.from('activity_stats').select('*').single(),
        this.supabase.from('segment_stats').select('*').single(),
        this.supabase.from('segment_effort_stats').select('*').single()
      ])

      const stats: GlobalStats = {
        totalActivities: activityStats.data?.total_activities || 0,
        totalSegments: segmentStats.data?.total_segments || 0,
        totalEfforts: effortStats.data?.total_efforts || 0,
        totalDistance: activityStats.data?.total_distance || 0,
        totalElevation: activityStats.data?.total_elevation || 0,
        lastUpdated: new Date().toISOString()
      }

      this.cache.set(cacheKey, { data: stats, timestamp: Date.now() })
      return stats

    } catch (error) {
      console.error('Error fetching global stats:', error)
      throw error
    }
  }

  /**
   * Invalidate cache for a specific user
   */
  invalidateUserCache(stravaId: number): void {
    this.cache.delete(`user_stats_${stravaId}`)
  }

  /**
   * Invalidate all cache
   */
  invalidateAllCache(): void {
    this.cache.clear()
  }

  /**
   * Refresh cache (call after data updates)
   */
  async refreshCache(): Promise<void> {
    try {
      // Since we're using views, they're automatically up-to-date
      // Just invalidate the cache to force fresh data
      this.invalidateAllCache()
      console.log('✅ Cache refreshed successfully')
    } catch (error) {
      console.error('Error refreshing cache:', error)
    }
  }
} 