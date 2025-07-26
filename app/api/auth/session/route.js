import { AuthService } from '@/lib/services/auth-service'

export async function GET(req) {
  try {
    // Get session token from cookies
    const cookies = req.headers.get('cookie')
    const sessionToken = cookies?.split(';')
      .find(c => c.trim().startsWith('app_session='))
      ?.split('=')[1]
    
    if (!sessionToken) {
      return Response.json({ authenticated: false }, { status: 401 })
    }
    
    // Get current user from session
    const user = await AuthService.getCurrentUser(sessionToken)
    
    if (!user) {
      return Response.json({ authenticated: false }, { status: 401 })
    }
    
    return Response.json({
      authenticated: true,
      user: {
        id: user.id,
        strava_id: user.strava_id,
        firstname: user.firstname,
        lastname: user.lastname,
        city: user.city,
        state: user.state,
        country: user.country,
        profile_picture: user.profile_picture
      }
    })
    
  } catch (error) {
    console.error('Error in session validation:', error)
    return Response.json({ authenticated: false }, { status: 500 })
  }
} 