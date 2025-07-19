import { config } from '@/lib/config'

export async function GET() {
  // Debug logging to help identify the issue
  console.log('Environment variables:')
  console.log('VERCEL_URL:', process.env.VERCEL_URL)
  console.log('NEXT_PUBLIC_APP_URL:', process.env.NEXT_PUBLIC_APP_URL)
  console.log('STRAVA_REDIRECT_URI:', process.env.STRAVA_REDIRECT_URI)
  console.log('Final redirect URI:', config.strava.redirectUri)
  
  // Check for double slashes in the redirect URI
  if (config.strava.redirectUri.includes('//')) {
    console.log('🚨 WARNING: Double slashes detected in redirect URI!')
    console.log('Original VERCEL_URL:', process.env.VERCEL_URL)
    console.log('Cleaned redirect URI:', config.strava.redirectUri)
  }
  
  const stravaAuthUrl = `https://www.strava.com/oauth/authorize?client_id=${config.strava.clientId}&response_type=code&redirect_uri=${encodeURIComponent(config.strava.redirectUri)}&approval_prompt=auto&scope=read,activity:read`;
  
  console.log('Strava auth URL:', stravaAuthUrl)
  
  return Response.redirect(stravaAuthUrl);
}
