import { StatsService } from '@/lib/services/stats-service'
import { createClient } from '@supabase/supabase-js'

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url)
    const stravaId = searchParams.get('strava_id')
    const type = searchParams.get('type') || 'user' // 'user' or 'global'

    // Get the user from the session
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return Response.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    const statsService = new StatsService()

    if (type === 'global') {
      const stats = await statsService.getGlobalStats()
      return Response.json({
        success: true,
        stats,
        type: 'global'
      })
    } else {
      // Get user's Strava ID if not provided
      let targetStravaId = stravaId
      if (!targetStravaId) {
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('strava_id')
          .eq('id', user.id)
          .single()

        if (userError || !userData) {
          return Response.json(
            { success: false, error: 'User not found' },
            { status: 404 }
          )
        }
        targetStravaId = userData.strava_id
      }

      const stats = await statsService.getUserStats(targetStravaId)
      return Response.json({
        success: true,
        stats,
        type: 'user',
        strava_id: targetStravaId
      })
    }

  } catch (error) {
    console.error('Error fetching stats:', error)
    return Response.json(
      {
        success: false,
        error: error.message
      },
      { status: 500 }
    )
  }
}

export async function POST(req) {
  try {
    const { action, strava_id } = await req.json()

    // Get the user from the session
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return Response.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    const statsService = new StatsService()

    switch (action) {
      case 'refresh_cache':
        if (strava_id) {
          statsService.invalidateUserCache(strava_id)
        } else {
          statsService.invalidateAllCache()
        }
        return Response.json({ success: true, message: 'Cache invalidated' })

      case 'refresh_cache':
        await statsService.refreshCache()
        return Response.json({ success: true, message: 'Cache refreshed' })

      default:
        return Response.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        )
    }

  } catch (error) {
    console.error('Error with stats action:', error)
    return Response.json(
      {
        success: false,
        error: error.message
      },
      { status: 500 }
    )
  }
} 