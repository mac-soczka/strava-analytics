// API route: /api/segments
// Returns all segment efforts, or filters by ?segment_id=xxx

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '100')
    const search = searchParams.get('search') || ''
    const sortBy = searchParams.get('sortBy') || 'name'
    const sortOrder = searchParams.get('sortOrder') || 'asc'
    
    const supabase = createRouteHandlerClient({ cookies })
    
    // Calculate offset
    const offset = (page - 1) * limit
    
    // Build query
    let query = supabase
      .from('segments')
      .select(`
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
      `)
    
    // Add search filter
    if (search) {
      query = query.or(`name.ilike.%${search}%,city.ilike.%${search}%,state.ilike.%${search}%`)
    }
    
    // Add sorting
    query = query.order(sortBy, { ascending: sortOrder === 'asc' })
    
    // Add pagination
    query = query.range(offset, offset + limit - 1)
    
    const { data: segments, error, count } = await query
    
    if (error) {
      console.error('Error fetching segments:', error)
      return NextResponse.json({ error: 'Failed to fetch segments' }, { status: 500 })
    }
    
    // Get total count for pagination
    const { count: totalCount } = await supabase
      .from('segments')
      .select('*', { count: 'exact', head: true })
    
    // Transform segments to match expected format
    const transformedSegments = segments?.map((segment) => ({
      id: segment.segment_id,
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
      segment_efforts: segment.segment_efforts?.map((effort) => ({
        id: effort.id,
        activity_id: effort.activity_id,
        elapsed_time: effort.elapsed_time,
        moving_time: effort.moving_time,
        start_date: effort.start_date,
        average_watts: effort.average_watts,
        max_watts: effort.max_watts,
        segment: {
          id: segment.segment_id,
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
          map: segment.polyline ? { polyline: segment.polyline } : undefined
        }
      })) || []
    })) || []
    
    return NextResponse.json({
      segments: transformedSegments,
      pagination: {
        page,
        limit,
        total: totalCount || 0,
        totalPages: Math.ceil((totalCount || 0) / limit)
      }
    })
    
  } catch (error) {
    console.error('Error in segments API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
