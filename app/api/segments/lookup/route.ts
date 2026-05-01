import { NextRequest, NextResponse } from 'next/server'
import { createServerComponentClient } from '@/lib/supabase'
import { AuthServiceServer } from '@/lib/services/auth-service-server'
import { StravaService } from '@/lib/services/strava-service'

export async function GET(request: NextRequest) {
  try {
    const cookies = request.headers.get('cookie')
    const sessionToken = cookies
      ?.split(';')
      .find((c) => c.trim().startsWith('app_session='))
      ?.split('=')[1]

    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await AuthServiceServer.getCurrentUser(sessionToken)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const rawSegmentId = searchParams.get('segmentId')
    const segmentId = Number(rawSegmentId)

    if (!Number.isFinite(segmentId) || segmentId <= 0) {
      return NextResponse.json({ error: 'Invalid segmentId' }, { status: 400 })
    }

    const supabase = createServerComponentClient()
    const { data: segment, error } = await supabase
      .from('segments')
      .select(
        'segment_id, name, distance, elevation_gain, average_grade, maximum_grade, city, state, country'
      )
      .eq('segment_id', Math.floor(segmentId))
      .maybeSingle()

    if (error) {
      console.error('Error loading segment lookup:', error)
      return NextResponse.json({ error: 'Failed to load segment details' }, { status: 500 })
    }

    let resolvedSegment = segment

    if (!resolvedSegment) {
      // If segment isn't in local catalog yet, fetch from Strava first.
      const stravaService = new StravaService(user.strava_id)
      try {
        const remoteSegment = await stravaService.fetchSegmentById(Math.floor(segmentId))
        if (!remoteSegment) {
          return NextResponse.json({ segment: null }, { status: 200 })
        }

        const upsertPayload = {
          segment_id: remoteSegment.id,
          name: remoteSegment.name,
          distance: remoteSegment.distance,
          elevation_gain: (remoteSegment.elevation_high || 0) - (remoteSegment.elevation_low || 0),
          average_grade: remoteSegment.average_grade,
          maximum_grade: remoteSegment.maximum_grade,
          climb_category: remoteSegment.climb_category,
          city: remoteSegment.city,
          state: remoteSegment.state,
          country: remoteSegment.country,
          polyline: remoteSegment.map?.polyline,
        }

        const { data: inserted, error: upsertError } = await supabase
          .from('segments')
          .upsert(upsertPayload, { onConflict: 'segment_id' })
          .select(
            'segment_id, name, distance, elevation_gain, average_grade, maximum_grade, city, state, country'
          )
          .single()

        if (upsertError) {
          console.error('Error upserting segment from Strava lookup:', upsertError)
          return NextResponse.json({ error: 'Failed to save segment details' }, { status: 500 })
        }

        resolvedSegment = inserted
      } catch (fetchError: any) {
        if (fetchError?.statusCode === 402) {
          return NextResponse.json(
            {
              error:
                'Segment lookup from Strava is unavailable for this account (402 Payment Required).',
            },
            { status: 402 }
          )
        }
        if (fetchError?.statusCode === 404) {
          return NextResponse.json({ segment: null }, { status: 200 })
        }
        throw fetchError
      }
    }

    const { count: totalEfforts, error: countError } = await supabase
      .from('segment_efforts')
      .select('*', { count: 'exact', head: true })
      .eq('segment_id', resolvedSegment.segment_id)

    if (countError) {
      console.error('Error loading segment effort count:', countError)
      return NextResponse.json({ error: 'Failed to load segment effort count' }, { status: 500 })
    }

    return NextResponse.json({
      segment: {
        segmentId: resolvedSegment.segment_id,
        name: resolvedSegment.name,
        distance: Number(resolvedSegment.distance || 0),
        elevationGain: Number(resolvedSegment.elevation_gain || 0),
        averageGrade: Number(resolvedSegment.average_grade || 0),
        maximumGrade: Number(resolvedSegment.maximum_grade || 0),
        city: resolvedSegment.city,
        state: resolvedSegment.state,
        country: resolvedSegment.country,
        totalEfforts: totalEfforts || 0,
      },
    })
  } catch (error) {
    console.error('Error in segment lookup API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

