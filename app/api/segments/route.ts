import { createServerComponentClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'
import { buildSegmentEffortCountMap } from '@/lib/server/segment-effort-counts'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '100')
    const search = searchParams.get('search') || ''
    const sortBy = searchParams.get('sortBy') || 'name'
    const sortOrder = searchParams.get('sortOrder') || 'asc'
    const sortColumnByParam: Record<string, string> = {
      name: 'name',
      distance: 'distance',
      elevation: 'elevation_gain',
      grade: 'average_grade',
    }
    const sortColumn = sortColumnByParam[sortBy] || 'name'
    const computedSort = sortBy === 'attempts' || sortBy === 'bestTime' || sortBy === 'avgTime'

    const supabase = createServerComponentClient()
    const offset = (page - 1) * limit

    const effortCountMap = await buildSegmentEffortCountMap(supabase)

    let query = supabase.from('segments').select(
      `
        *,
        segment_efforts (
          id,
          activity_id,
          elapsed_time,
          moving_time,
          start_date,
          average_watts,
          max_watts
        )
      `
    )

    if (search) {
      query = query.or(`name.ilike.%${search}%,city.ilike.%${search}%,state.ilike.%${search}%`)
    }

    if (!computedSort) {
      query = query.order(sortColumn, { ascending: sortOrder === 'asc' })
      query = query.range(offset, offset + limit - 1)
    } else {
      // For computed metrics (attempts/best/avg), fetch full filtered set then sort/paginate in memory.
      query = query.order('name', { ascending: true })
    }

    const { data: segments, error } = await query

    if (error) {
      console.error('Error fetching segments:', error)
      return NextResponse.json({ error: 'Failed to fetch segments' }, { status: 500 })
    }

    const transformedSegments =
      segments?.map((segment: any) => {
        const sid = segment.segment_id as number
        const efforts = Array.isArray(segment.segment_efforts) ? segment.segment_efforts : []
        const elapsedTimes = efforts
          .map((effort: any) => Number(effort.elapsed_time ?? 0))
          .filter((value: number) => Number.isFinite(value) && value > 0)
        const bestTimeSeconds = elapsedTimes.length > 0 ? Math.min(...elapsedTimes) : 0
        const avgTimeSeconds =
          elapsedTimes.length > 0
            ? elapsedTimes.reduce((sum: number, value: number) => sum + value, 0) / elapsedTimes.length
            : 0
        return {
          id: sid,
          name: segment.name,
          distance: segment.distance,
          elevation_high: segment.elevation_gain + (segment.elevation_low || 0),
          elevation_low: segment.elevation_low || 0,
          average_grade: segment.average_grade,
          maximum_grade: segment.maximum_grade,
          climb_category: segment.climb_category,
          city: segment.city,
          state: segment.state,
          country: segment.country,
          private: false,
          hazardous: false,
          starred: false,
          map: segment.polyline ? { polyline: segment.polyline } : undefined,
          segment_efforts:
            efforts.map((effort: any) => ({
              id: effort.id,
              activity_id: effort.activity_id,
              elapsed_time: effort.elapsed_time,
              moving_time: effort.moving_time,
              start_date: effort.start_date,
              average_watts: effort.average_watts,
              max_watts: effort.max_watts,
              segment: {
                id: sid,
                name: segment.name,
                distance: segment.distance,
                elevation_high: segment.elevation_gain + (segment.elevation_low || 0),
                elevation_low: segment.elevation_low || 0,
                average_grade: segment.average_grade,
                maximum_grade: segment.maximum_grade,
                climb_category: segment.climb_category,
                city: segment.city,
                state: segment.state,
                country: segment.country,
                private: false,
                hazardous: false,
                starred: false,
                map: segment.polyline ? { polyline: segment.polyline } : undefined,
              },
            })) || [],
          total_effort_count: effortCountMap.get(sid) ?? 0,
          best_time_seconds: bestTimeSeconds,
          avg_time_seconds: avgTimeSeconds,
        }
      }) || []

    const sortedSegments = computedSort
      ? [...transformedSegments].sort((a: any, b: any) => {
          let compare = 0
          if (sortBy === 'attempts') {
            compare = Number(a.total_effort_count ?? 0) - Number(b.total_effort_count ?? 0)
          } else if (sortBy === 'bestTime') {
            compare = Number(a.best_time_seconds ?? 0) - Number(b.best_time_seconds ?? 0)
          } else if (sortBy === 'avgTime') {
            compare = Number(a.avg_time_seconds ?? 0) - Number(b.avg_time_seconds ?? 0)
          }
          if (compare === 0) {
            compare = String(a.name ?? '').localeCompare(String(b.name ?? ''))
          }
          return sortOrder === 'asc' ? compare : -compare
        })
      : transformedSegments

    const pagedSegments = computedSort
      ? sortedSegments.slice(offset, offset + limit)
      : sortedSegments

    let totalCount = 0
    if (computedSort) {
      totalCount = sortedSegments.length
    } else {
      let countQuery = supabase.from('segments').select('*', { count: 'exact', head: true })
      if (search) {
        countQuery = countQuery.or(`name.ilike.%${search}%,city.ilike.%${search}%,state.ilike.%${search}%`)
      }
      const { count } = await countQuery
      totalCount = count || 0
    }

    return NextResponse.json({
      segments: pagedSegments,
      pagination: {
        page,
        limit,
        total: totalCount || 0,
        totalPages: Math.ceil((totalCount || 0) / limit),
      },
    })
  } catch (error) {
    console.error('Error in segments API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
