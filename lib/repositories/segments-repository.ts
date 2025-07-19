import { createServerComponentClient } from '@/lib/supabase'
import { StravaSegmentEffort } from '@/types/strava'

export class SegmentsRepository {
  private supabase: ReturnType<typeof createServerComponentClient>

  constructor() {
    this.supabase = createServerComponentClient()
  }

  /**
   * Get all segment efforts
   */
  async getAllSegmentEfforts(limit = 100, offset = 0) {
    const { data, error } = await this.supabase
      .from('segments')
      .select(`
        *,
        activities (
          id,
          name,
          start_date
        )
      `)
      .order('start_date', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error
    return data
  }

  /**
   * Get segment efforts by segment ID
   */
  async getSegmentEffortsBySegmentId(segmentId: number) {
    const { data, error } = await this.supabase
      .from('segments')
      .select(`
        *,
        activities (
          id,
          name,
          start_date
        )
      `)
      .eq('segment_id', segmentId)
      .order('start_date', { ascending: false })

    if (error) throw error
    return data
  }

  /**
   * Get segment efforts by activity ID
   */
  async getSegmentEffortsByActivityId(activityId: number) {
    const { data, error } = await this.supabase
      .from('segments')
      .select('*')
      .eq('activity_id', activityId)
      .order('start_date', { ascending: false })

    if (error) throw error
    return data as StravaSegmentEffort[]
  }

  /**
   * Get unique segments
   */
  async getUniqueSegments() {
    const { data, error } = await this.supabase
      .from('segments')
      .select('segment_id, segment_name, segment_distance, segment_city, segment_state, segment_country')
      .order('segment_name')

    if (error) throw error

    // Remove duplicates by segment_id
    const uniqueSegments = data.reduce((acc, segment) => {
      if (!acc.find(s => s.segment_id === segment.segment_id)) {
        acc.push(segment)
      }
      return acc
    }, [] as typeof data)

    return uniqueSegments
  }

  /**
   * Get segment by ID
   */
  async getSegmentById(segmentId: number) {
    const { data, error } = await this.supabase
      .from('segments')
      .select('*')
      .eq('segment_id', segmentId)
      .limit(1)
      .single()

    if (error) throw error
    return data
  }

  /**
   * Get personal records for segments
   */
  async getPersonalRecords() {
    const { data, error } = await this.supabase
      .from('segments')
      .select('*')
      .order('segment_id, elapsed_time')

    if (error) throw error

    // Group by segment_id and find best time for each
    const personalRecords = data.reduce((acc, effort) => {
      const existing = acc.find((pr: typeof data[0]) => pr.segment_id === effort.segment_id)
      if (!existing || effort.elapsed_time < existing.elapsed_time) {
        // Remove existing if found
        const filtered = acc.filter((pr: typeof data[0]) => pr.segment_id !== effort.segment_id)
        return [...filtered, effort]
      }
      return acc
    }, [] as typeof data)

    return personalRecords
  }

  /**
   * Create segment effort
   */
  async createSegmentEffort(segmentEffort: Omit<StravaSegmentEffort, 'id'>) {
    const { data, error } = await this.supabase
      .from('segments')
      .insert(segmentEffort)
      .select()
      .single()

    if (error) throw error
    return data as StravaSegmentEffort
  }

  /**
   * Create multiple segment efforts
   */
  async createSegmentEfforts(segmentEfforts: Record<string, unknown>[]) {
    const { data, error } = await this.supabase
      .from('segments')
      .insert(segmentEfforts)
      .select()

    if (error) throw error
    return data as StravaSegmentEffort[]
  }

  /**
   * Update segment effort
   */
  async updateSegmentEffort(id: number, updates: Partial<StravaSegmentEffort>) {
    const { data, error } = await this.supabase
      .from('segments')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data as StravaSegmentEffort
  }

  /**
   * Delete segment effort
   */
  async deleteSegmentEffort(id: number) {
    const { error } = await this.supabase
      .from('segments')
      .delete()
      .eq('id', id)

    if (error) throw error
  }

  /**
   * Get segment statistics
   */
  async getSegmentStats() {
    const { data, error } = await this.supabase
      .from('segments')
      .select('segment_id, elapsed_time, segment_distance')

    if (error) throw error

    const stats = {
      totalEfforts: data.length,
      uniqueSegments: new Set(data.map(s => s.segment_id)).size,
      averageTime: data.reduce((sum, s) => sum + (s.elapsed_time || 0), 0) / data.length,
      totalDistance: data.reduce((sum, s) => sum + (s.segment_distance || 0), 0)
    }

    return stats
  }

  /**
   * Get fastest efforts by segment
   */
  async getFastestEffortsBySegment(limit = 10) {
    const { data, error } = await this.supabase
      .from('segments')
      .select('*')
      .order('segment_id, elapsed_time')

    if (error) throw error

    // Group by segment and find fastest for each
    const fastestBySegment = data.reduce((acc, effort) => {
      const existing = acc.find((f: typeof data[0]) => f.segment_id === effort.segment_id)
      if (!existing || effort.elapsed_time < existing.elapsed_time) {
        const filtered = acc.filter((f: typeof data[0]) => f.segment_id !== effort.segment_id)
        return [...filtered, effort]
      }
      return acc
    }, [] as typeof data)

    return fastestBySegment.slice(0, limit)
  }

  /**
   * Search segments by name
   */
  async searchSegmentsByName(searchTerm: string) {
    const { data, error } = await this.supabase
      .from('segments')
      .select('segment_id, segment_name, segment_city, segment_state')
      .ilike('segment_name', `%${searchTerm}%`)
      .order('segment_name')

    if (error) throw error

    // Remove duplicates
    const uniqueSegments = data.reduce((acc, segment) => {
      if (!acc.find(s => s.segment_id === segment.segment_id)) {
        acc.push(segment)
      }
      return acc
    }, [] as typeof data)

    return uniqueSegments
  }
} 