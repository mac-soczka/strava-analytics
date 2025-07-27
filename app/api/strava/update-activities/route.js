import { StravaService } from '@/lib/services/strava-service'
import { createClient } from '@supabase/supabase-js'

export async function POST(req) {
  try {
    const { searchParams } = new URL(req.url)
    const limit = parseInt(searchParams.get('limit') || '10')
    
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

    // Get user's Strava ID
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

    const stravaService = new StravaService(userData.strava_id)
    const result = await stravaService.updateActivitiesWithMissingData(limit)
    
    return Response.json({
      success: true,
      result,
      message: `Updated ${result.updated} activities, ${result.errors} errors`
    })
  } catch (error) {
    console.error('Error updating activities:', error)
    return Response.json(
      {
        success: false,
        error: error.message
      },
      { status: 500 }
    )
  }
} 