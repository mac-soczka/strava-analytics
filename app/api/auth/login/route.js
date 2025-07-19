import { config } from '@/lib/config'

export async function GET() {
  // Debug logging for OAuth configuration
  console.log('🔍 OAuth Configuration:')
  console.log('Redirect URI:', config.strava.redirectUri)
  console.log('Client ID:', config.strava.clientId)
  
  const stravaAuthUrl = `https://www.strava.com/oauth/authorize?client_id=${config.strava.clientId}&response_type=code&redirect_uri=${encodeURIComponent(config.strava.redirectUri)}&approval_prompt=auto&scope=read,activity:read`;
  
  console.log('🔗 Strava auth URL:', stravaAuthUrl)
  
  return Response.redirect(stravaAuthUrl);
}
