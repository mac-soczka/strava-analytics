import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('user_id')
    const type = searchParams.get('type') || 'overview' // 'overview', 'user', 'incomplete'

    switch (type) {
      case 'overview':
        // Get overall completion statistics
        const { data: overallStats, error: overallError } = await supabase
          .rpc('get_segment_completion_stats')

        if (overallError) {
          console.error('Error fetching overall stats:', overallError)
          return Response.json(
            { success: false, error: 'Failed to fetch overall statistics' },
            { status: 500 }
          )
        }

        return Response.json({
          success: true,
          data: overallStats?.[0] || null,
          type: 'overview'
        })

      case 'user':
        // Get user-specific statistics
        if (!userId) {
          return Response.json(
            { success: false, error: 'user_id parameter required for user stats' },
            { status: 400 }
          )
        }

        const { data: userStats, error: userError } = await supabase
          .rpc('get_user_segment_completion_stats', { user_strava_id: parseInt(userId) })

        if (userError) {
          console.error('Error fetching user stats:', userError)
          return Response.json(
            { success: false, error: 'Failed to fetch user statistics' },
            { status: 500 }
          )
        }

        return Response.json({
          success: true,
          data: userStats?.[0] || null,
          type: 'user'
        })

      case 'incomplete':
        // Get incomplete activities for a user
        if (!userId) {
          return Response.json(
            { success: false, error: 'user_id parameter required for incomplete activities' },
            { status: 400 }
          )
        }

        const limit = parseInt(searchParams.get('limit') || '10')
        const { data: incompleteActivities, error: incompleteError } = await supabase
          .rpc('get_incomplete_activities', { 
            user_strava_id: parseInt(userId), 
            limit_count: limit 
          })

        if (incompleteError) {
          console.error('Error fetching incomplete activities:', incompleteError)
          return Response.json(
            { success: false, error: 'Failed to fetch incomplete activities' },
            { status: 500 }
          )
        }

        return Response.json({
          success: true,
          data: incompleteActivities || [],
          type: 'incomplete'
        })

      case 'segments-without-efforts':
        // Get segments without efforts
        const segmentLimit = parseInt(searchParams.get('limit') || '10')
        const { data: segmentsWithoutEfforts, error: segmentsError } = await supabase
          .rpc('get_segments_without_efforts', { limit_count: segmentLimit })

        if (segmentsError) {
          console.error('Error fetching segments without efforts:', segmentsError)
          return Response.json(
            { success: false, error: 'Failed to fetch segments without efforts' },
            { status: 500 }
          )
        }

        return Response.json({
          success: true,
          data: segmentsWithoutEfforts || [],
          type: 'segments-without-efforts'
        })

      default:
        return Response.json(
          { success: false, error: 'Invalid type parameter' },
          { status: 400 }
        )
    }

  } catch (error) {
    console.error('Error in segment completion endpoint:', error)
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
} 