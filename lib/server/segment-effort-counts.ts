import type { SupabaseClient } from '@supabase/supabase-js'

const PAGE = 1000

/**
 * Full effort counts per segment (not limited to PostgREST's default row cap).
 */
export async function buildSegmentEffortCountMap(supabase: SupabaseClient): Promise<Map<number, number>> {
  const map = new Map<number, number>()
  let offset = 0

  for (;;) {
    const { data, error } = await supabase
      .from('segment_efforts')
      .select('segment_id')
      .order('segment_id', { ascending: true })
      .range(offset, offset + PAGE - 1)

    if (error) throw error

    const batch = data || []
    for (const row of batch) {
      const id = Number(row.segment_id)
      map.set(id, (map.get(id) || 0) + 1)
    }

    if (batch.length < PAGE) break
    offset += PAGE
  }

  return map
}
