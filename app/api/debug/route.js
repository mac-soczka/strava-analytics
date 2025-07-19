import { config } from '@/lib/config'

export async function GET() {
  const debugInfo = {
    environment: process.env.NODE_ENV,
    vercelUrl: process.env.VERCEL_URL,
    nextPublicAppUrl: process.env.NEXT_PUBLIC_APP_URL,
    stravaRedirectUri: process.env.STRAVA_REDIRECT_URI,
    stravaClientId: process.env.STRAVA_CLIENT_ID ? 'SET' : 'NOT SET',
    finalRedirectUri: config.strava.redirectUri,
    hasDoubleSlash: config.strava.redirectUri.replace(/^https?:\/\//, '').includes('//'),
    urlSource: getUrlSource(),
    timestamp: new Date().toISOString()
  }
  
  return Response.json(debugInfo, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache'
    }
  })
}

function getUrlSource() {
  if (process.env.STRAVA_REDIRECT_URI) return 'STRAVA_REDIRECT_URI'
  if (process.env.VERCEL_URL) return 'VERCEL_URL'
  if (process.env.NEXT_PUBLIC_APP_URL) return 'NEXT_PUBLIC_APP_URL'
  return 'localhost'
} 