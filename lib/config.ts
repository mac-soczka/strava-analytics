// Configuration for different environments
export const config = {
  // Strava OAuth configuration
  strava: {
    clientId: process.env.STRAVA_CLIENT_ID!,
    clientSecret: process.env.STRAVA_CLIENT_SECRET!,
    redirectUri: process.env.STRAVA_REDIRECT_URI || getDefaultRedirectUri(),
  },
  
  // Supabase configuration
  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  },
}

// Utility function to clean URLs and ensure proper formatting
function cleanUrl(url: string): string {
  if (!url) return url
  // Remove trailing slashes and ensure proper formatting
  return url.replace(/\/+$/, '').replace(/^https?:\/\//, '') // Remove protocol and trailing slashes
}

// Get the default redirect URI based on environment
function getDefaultRedirectUri(): string {
  // Use explicit redirect URI if set (highest priority)
  if (process.env.STRAVA_REDIRECT_URI) {
    return process.env.STRAVA_REDIRECT_URI
  }
  
  // Use VERCEL_URL if available (works for both production and preview deployments)
  if (process.env.VERCEL_URL) {
    const baseUrl = cleanUrl(process.env.VERCEL_URL)
    return `https://${baseUrl}/api/auth/callback`
  }
  
  // Use custom domain if specified
  if (process.env.NEXT_PUBLIC_APP_URL) {
    const baseUrl = cleanUrl(process.env.NEXT_PUBLIC_APP_URL)
    return `${baseUrl}/api/auth/callback`
  }
  
  // Fallback to localhost for development
  return 'http://localhost:3000/api/auth/callback'
}

// Validate required environment variables
export function validateConfig() {
  const required = [
    'STRAVA_CLIENT_ID',
    'STRAVA_CLIENT_SECRET',
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
  ]

  const missing = required.filter(key => !process.env[key])
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
  }
} 