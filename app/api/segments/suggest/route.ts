import { NextRequest, NextResponse } from 'next/server'
import { createServerComponentClient } from '@/lib/supabase'
import { AuthServiceServer } from '@/lib/services/auth-service-server'

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
    const q = (searchParams.get('q') || '').trim()
    const limitParam = Number(searchParams.get('limit') || 8)
    const limit = Math.min(20, Math.max(1, Number.isFinite(limitParam) ? limitParam : 8))

    const supabase = createServerComponentClient()

    let query = supabase
      .from('segments')
      .select('segment_id, name, city, state, country')
      .order('name', { ascending: true })
      .limit(limit)

    if (q.length > 0) {
      const escaped = q.replace(/,/g, ' ')
      const numeric = Number(q)
      if (Number.isFinite(numeric) && numeric > 0) {
        query = query.or(
          `segment_id.eq.${Math.floor(numeric)},name.ilike.%${escaped}%,city.ilike.%${escaped}%,state.ilike.%${escaped}%`
        )
      } else {
        query = query.or(`name.ilike.%${escaped}%,city.ilike.%${escaped}%,state.ilike.%${escaped}%`)
      }
    }

    const { data, error } = await query
    if (error) {
      console.error('Error fetching segment suggestions:', error)
      return NextResponse.json({ error: 'Failed to fetch segment suggestions' }, { status: 500 })
    }

    return NextResponse.json({
      suggestions: (data || []).map((row) => ({
        segmentId: row.segment_id,
        name: row.name,
        city: row.city,
        state: row.state,
        country: row.country,
      })),
    })
  } catch (error) {
    console.error('Error in segment suggestions API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

