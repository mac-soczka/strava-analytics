import { createClient } from '@supabase/supabase-js'
import { config } from '@/lib/config'

export interface Segment {
  id?: string
  segment_id: number
  name?: string
  distance?: number
  elevation_gain?: number
  average_grade?: number
  maximum_grade?: number
  climb_category?: number
  city?: string
  state?: string
  country?: string
  polyline?: string
  created_at?: string
  updated_at?: string
}

export interface SegmentEffort {
  id?: string
  activity_id: number
  segment_id: number
  effort_id: number
  elapsed_time?: number
  moving_time?: number
  start_date?: string
  average_watts?: number
  max_watts?: number
  created_at?: string
  updated_at?: string
}

export class SegmentsRepository {
  private supabase: ReturnType<typeof createClient>

  constructor() {
    this.supabase = createClient(
      config.supabase.url,
      config.supabase.serviceRoleKey
    )
  }

  /**
   * Upsert a segment (insert or update)
   */
  async upsertSegment(segment: Segment): Promise<{ data: Segment | null; error: any }> {
    const { data, error } = await this.supabase
      .from('segments')
      .upsert(segment as any, { onConflict: 'segment_id' })
      .select()
      .single()

    return { data: data as Segment | null, error }
  }

  /**
   * Get segment by ID
   */
  async getSegmentById(segmentId: number): Promise<{ data: Segment | null; error: any }> {
    const { data, error } = await this.supabase
      .from('segments')
      .select('*')
      .eq('segment_id', segmentId)
      .single()

    return { data: data as Segment | null, error }
  }

  /**
   * Given a list of Strava segment ids, returns the subset that already exist in DB.
   */
  async getExistingSegmentIds(segmentIds: number[]): Promise<{ data: number[]; error: any }> {
    if (segmentIds.length === 0) return { data: [], error: null }

    const { data, error } = await this.supabase
      .from('segments')
      .select('segment_id')
      .in('segment_id', segmentIds)

    if (error) return { data: [], error }
    return { data: (data || []).map((r: any) => r.segment_id as number), error: null }
  }

  /**
   * Get segments by location (city, state, country)
   */
  async getSegmentsByLocation(city?: string, state?: string, country?: string) {
    try {
      let query = this.supabase.from('segments').select('*')

      if (city) query = query.eq('city', city)
      if (state) query = query.eq('state', state)
      if (country) query = query.eq('country', country)

      const { data, error } = await query

      if (error) throw error
      return data as unknown as Segment[] | null
    } catch (error) {
      console.error('Error fetching segments by location:', error)
      throw error
    }
  }

  /**
   * Get segments by climb category
   */
  async getSegmentsByClimbCategory(category: number): Promise<{ data: Segment[] | null; error: any }> {
    const { data, error } = await this.supabase
      .from('segments')
      .select('*')
      .eq('climb_category', category)

    return { data: data as Segment[] | null, error }
  }

  /**
   * Upsert a segment effort
   */
  async upsertSegmentEffort(effort: SegmentEffort): Promise<{ data: SegmentEffort | null; error: any }> {
    const { data, error } = await this.supabase
      .from('segment_efforts')
      .upsert(effort as any, { onConflict: 'activity_id,segment_id' })
      .select()
      .single()

    return { data: data as SegmentEffort | null, error }
  }

  /**
   * Get segment efforts for an activity
   */
  async getSegmentEffortsByActivity(activityId: number): Promise<{ data: SegmentEffort[] | null; error: any }> {
    const { data, error } = await this.supabase
      .from('segment_efforts')
      .select('*')
      .eq('activity_id', activityId)

    return { data: data as SegmentEffort[] | null, error }
  }

  /**
   * Get segment efforts for a segment
   */
  async getSegmentEffortsBySegment(segmentId: number): Promise<{ data: SegmentEffort[] | null; error: any }> {
    const { data, error } = await this.supabase
      .from('segment_efforts')
      .select('*')
      .eq('segment_id', segmentId)
      .order('elapsed_time', { ascending: true })

    return { data: data as SegmentEffort[] | null, error }
  }

  /**
   * Get user's best efforts for a segment
   */
  async getUserBestEffortsForSegment(segmentId: number, _userId: number): Promise<{ data: SegmentEffort[] | null; error: any }> {
    const { data, error } = await this.supabase
      .from('segment_efforts')
      .select('*')
      .eq('segment_id', segmentId)

    return { data: data as SegmentEffort[] | null, error }
  }

  /**
   * Bulk upsert segments
   */
  async bulkUpsertSegments(segments: Segment[]): Promise<{ data: Segment[] | null; error: any }> {
    const { data, error } = await this.supabase
      .from('segments')
      .upsert(segments as any[], { onConflict: 'segment_id' })
      .select()

    return { data: data as Segment[] | null, error }
  }

  /**
   * Bulk upsert segment efforts
   */
  async bulkUpsertSegmentEfforts(efforts: SegmentEffort[]): Promise<{ data: SegmentEffort[] | null; error: any }> {
    const { data, error } = await this.supabase
      .from('segment_efforts')
      .upsert(efforts as any[], { onConflict: 'activity_id,segment_id' })
      .select()

    return { data: data as SegmentEffort[] | null, error }
  }

  /**
   * Get segment statistics
   */
  async getSegmentStats(): Promise<{ data: any; error: any }> {
    const { data, error } = await this.supabase
      .from('segments')
      .select('climb_category, city, state, country')

    if (error) return { data: null, error }

    const stats = {
      total_segments: data.length,
      by_climb_category: {} as Record<number, number>,
      by_city: {} as Record<string, number>,
      by_state: {} as Record<string, number>,
      by_country: {} as Record<string, number>
    }

    data.forEach((segment: any) => {
      if (segment.climb_category) {
        stats.by_climb_category[segment.climb_category] = (stats.by_climb_category[segment.climb_category] || 0) + 1
      }
      if (segment.city) {
        stats.by_city[segment.city] = (stats.by_city[segment.city] || 0) + 1
      }
      if (segment.state) {
        stats.by_state[segment.state] = (stats.by_state[segment.state] || 0) + 1
      }
      if (segment.country) {
        stats.by_country[segment.country] = (stats.by_country[segment.country] || 0) + 1
      }
    })

    return { data: stats, error: null }
  }
} 