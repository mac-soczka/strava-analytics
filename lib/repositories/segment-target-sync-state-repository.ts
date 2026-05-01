import { createClient } from '@supabase/supabase-js'
import config from '@/lib/config'

export type SegmentTargetSyncMode = 'backfill' | 'incremental'

export interface SegmentTargetSyncState {
  id: string
  strava_id: number
  segment_id: number
  mode: SegmentTargetSyncMode
  backfill_before_epoch: number | null
  backfill_after_epoch: number | null
  incremental_after_epoch: number | null
  last_activity_id: number | null
  created_at: string
  updated_at: string
}

export class SegmentTargetSyncStateRepository {
  private supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey)

  async getByUserAndSegment(
    stravaId: number,
    segmentId: number
  ): Promise<SegmentTargetSyncState | null> {
    const { data, error } = await this.supabase
      .from('segment_target_sync_state')
      .select('*')
      .eq('strava_id', stravaId)
      .eq('segment_id', segmentId)
      .maybeSingle()

    if (error) throw error
    return data
  }

  async getOrCreate(
    stravaId: number,
    segmentId: number,
    initialBackfillBeforeEpoch: number,
    initialBackfillAfterEpoch: number
  ): Promise<SegmentTargetSyncState> {
    const existing = await this.getByUserAndSegment(stravaId, segmentId)
    if (existing) return existing

    const { data, error } = await this.supabase
      .from('segment_target_sync_state')
      .insert({
        strava_id: stravaId,
        segment_id: segmentId,
        mode: 'backfill',
        backfill_before_epoch: initialBackfillBeforeEpoch,
        backfill_after_epoch: initialBackfillAfterEpoch,
      })
      .select('*')
      .single()

    if (error) throw error
    return data
  }

  async update(
    stravaId: number,
    segmentId: number,
    updates: Partial<
      Pick<
        SegmentTargetSyncState,
        'mode' | 'backfill_before_epoch' | 'backfill_after_epoch' | 'incremental_after_epoch' | 'last_activity_id'
      >
    >
  ): Promise<SegmentTargetSyncState> {
    const { data, error } = await this.supabase
      .from('segment_target_sync_state')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('strava_id', stravaId)
      .eq('segment_id', segmentId)
      .select('*')
      .single()

    if (error) throw error
    return data
  }
}

