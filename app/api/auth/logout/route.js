import { createClient } from '@supabase/supabase-js'
import { config } from '@/lib/config'

export async function POST(req) {
  try {
    // Initialize Supabase client
    const supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey)
    
    // For now, we'll clear the most recent user's tokens (you can implement session management later)
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('strava_id')
      .order('updated_at', { ascending: false })
      .limit(1)
    
    if (userError) {
      console.error('Error fetching user for logout:', userError)
      return Response.json({ error: 'Failed to logout' }, { status: 500 })
    }
    
    if (users && users.length > 0) {
      // Clear tokens for the user
      const { error: tokenError } = await supabase
        .from('strava_tokens')
        .delete()
        .eq('strava_id', users[0].strava_id)
      
      if (tokenError) {
        console.error('Error clearing tokens:', tokenError)
      }
    }
    
    return Response.json({ message: 'Logged out successfully' })
    
  } catch (error) {
    console.error('Error in logout API:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
} 