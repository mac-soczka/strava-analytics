import { createClient } from '@supabase/supabase-js'
import config from '@/lib/config'

export interface StravaSyncState {
  id: string
  strava_id: number
  activities_after: number | null
  backfill_cursor_before: number | null
  last_full_backfill_at: string | null
  daily_budget_override: number | null
  created_at: string
  updated_at: string
}

export class StravaSyncStateRepository {
  private supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey)

  async getByStravaId(stravaId: number): Promise<StravaSyncState | null> {
    const { data, error } = await this.supabase
      .from('strava_sync_state')
      .select('*')
      .eq('strava_id', stravaId)
      .maybeSingle()

    if (error) throw error
    return data
  }

  async getOrCreate(stravaId: number): Promise<StravaSyncState> {
    const existing = await this.getByStravaId(stravaId)
    if (existing) return existing

    const { data, error } = await this.supabase
      .from('strava_sync_state')
      .insert({ strava_id: stravaId })
      .select('*')
      .single()

    if (error) throw error
    return data
  }

  async update(
    stravaId: number,
    updates: Partial<Pick<StravaSyncState, 'activities_after' | 'backfill_cursor_before' | 'last_full_backfill_at' | 'daily_budget_override'>>
  ): Promise<StravaSyncState> {
    const { data, error } = await this.supabase
      .from('strava_sync_state')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('strava_id', stravaId)
      .select('*')
      .single()

    if (error) throw error
    return data
  }
}

