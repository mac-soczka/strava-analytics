import { AuthServiceServer, CookieManagerServer } from '@/lib/services/auth-service-server'

export async function POST(req) {
  try {
    // Get session token from cookies
    const cookies = req.headers.get('cookie')
    const sessionToken = cookies?.split(';')
      .find(c => c.trim().startsWith('app_session='))
      ?.split('=')[1]
    
    if (sessionToken) {
      // Delete the session
      await AuthServiceServer.logout(sessionToken)
    }
    
    // Create response with cleared cookies
    const response = Response.json({ message: 'Logged out successfully' })
    
    // Clear session cookie
    const clearSessionCookie = CookieManagerServer.clearSessionCookie()
    response.headers.set('Set-Cookie', clearSessionCookie)
    
    return response
    
  } catch (error) {
    console.error('Error in logout API:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
} 