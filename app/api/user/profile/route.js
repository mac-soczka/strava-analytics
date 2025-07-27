import { createClient } from '@supabase/supabase-js'
import { config } from '@/lib/config'

export async function GET() {
  try {
    // Initialize Supabase client
    const supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey)
    
    // For now, we'll get the most recent user (you can implement session management later)
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
    
    if (userError) {
      console.error('Error fetching user:', userError)
      return Response.json({ error: 'Failed to fetch user profile' }, { status: 500 })
    }
    
    if (!users || users.length === 0) {
      return Response.json({ error: 'No user found' }, { status: 404 })
    }
    
    const user = users[0]
    
    // Return user data (excluding sensitive information)
    return Response.json({
      strava_id: user.strava_id,
      firstname: user.firstname,
      lastname: user.lastname,
      city: user.city,
      state: user.state,
      country: user.country,
      profile_picture: user.profile_picture
    })
    
  } catch (error) {
    console.error('Error in profile API:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
} 