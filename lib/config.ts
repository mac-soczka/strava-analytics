import { config as dotenvConfig } from 'dotenv'

// Load environment variables
dotenvConfig({ path: '.env.local' })

export interface StravaConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
}

export interface SupabaseConfig {
  url: string
  anonKey: string
  serviceRoleKey: string
}

export interface StravaApiLimits {
  // API Rate Limits
  requestsPer15Min: number
  requestsPerDay: number
  
  // Fetch Limits
  maxActivitiesPerRequest: number
  maxSegmentBatchSize: number
  maxCrawlerBatchSize: number
  
  // Timing Configuration
  minDelayMs: number
  maxDelayMs: number
  retryDelayMs: number
  
  // Development Overrides
  noLimitsMode: boolean
}

export interface AppConfig {
  strava: StravaConfig
  supabase: SupabaseConfig
  stravaApiLimits: StravaApiLimits
  app: {
    baseUrl: string
    port: number
  }
}

function formatMissingEnvError(section: string, missingKeys: string[]): Error {
  return new Error(
    `Missing required ${section} environment variables: ${missingKeys.join(', ')}. ` +
    'Add them to .env.local and restart the server.'
  )
}

function formatInvalidEnvError(section: string, invalidKeys: string[]): Error {
  return new Error(
    `Invalid ${section} environment variable values for: ${invalidKeys.join(', ')}. ` +
    'Replace placeholder values in .env.local with real credentials and restart the server.'
  )
}

function isPlaceholderValue(value: string): boolean {
  // Don't reject valid local Supabase keys (sb_publishable_, sb_secret_)
  if (value.startsWith('sb_publishable_') || value.startsWith('sb_secret_')) {
    return false
  }
  return /your[-_]|example|placeholder/i.test(value)
}

function getDefaultStravaRedirectUri(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (appUrl) {
    return `${appUrl.replace(/\/$/, '')}/api/auth/callback`
  }

  const vercelUrl = process.env.VERCEL_URL
  if (vercelUrl) {
    return `https://${vercelUrl.replace(/\/$/, '')}/api/auth/callback`
  }

  return 'http://localhost:3001/api/auth/callback'
}

function getStravaConfig(): StravaConfig {
  const clientId = process.env.STRAVA_CLIENT_ID
  const clientSecret = process.env.STRAVA_CLIENT_SECRET
  const redirectUri = process.env.STRAVA_REDIRECT_URI || getDefaultStravaRedirectUri()

  const missing: string[] = []
  if (!clientId) missing.push('STRAVA_CLIENT_ID')
  if (!clientSecret) missing.push('STRAVA_CLIENT_SECRET')

  if (missing.length > 0) {
    throw formatMissingEnvError('Strava', missing)
  }

  const requiredClientId = clientId as string
  const requiredClientSecret = clientSecret as string

  const invalid: string[] = []
  if (isPlaceholderValue(requiredClientId)) invalid.push('STRAVA_CLIENT_ID')
  if (isPlaceholderValue(requiredClientSecret)) invalid.push('STRAVA_CLIENT_SECRET')

  if (invalid.length > 0) {
    throw formatInvalidEnvError('Strava', invalid)
  }

  return {
    clientId: requiredClientId,
    clientSecret: requiredClientSecret,
    redirectUri
  }
}

function getSupabaseConfig(): SupabaseConfig {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  const missing: string[] = []
  if (!url) missing.push('NEXT_PUBLIC_SUPABASE_URL')
  if (!anonKey) missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  if (!serviceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY')

  if (missing.length > 0) {
    throw formatMissingEnvError('Supabase', missing)
  }

  const requiredUrl = url as string
  const requiredAnonKey = anonKey as string
  const requiredServiceRoleKey = serviceRoleKey as string

  const invalid: string[] = []
  if (isPlaceholderValue(requiredUrl)) invalid.push('NEXT_PUBLIC_SUPABASE_URL')
  if (isPlaceholderValue(requiredAnonKey)) invalid.push('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  if (isPlaceholderValue(requiredServiceRoleKey)) invalid.push('SUPABASE_SERVICE_ROLE_KEY')

  if (invalid.length > 0) {
    throw formatInvalidEnvError('Supabase', invalid)
  }

  return {
    url: requiredUrl,
    anonKey: requiredAnonKey,
    serviceRoleKey: requiredServiceRoleKey
  }
}

function getStravaApiLimits(): StravaApiLimits {
  return {
    // API Rate Limits (Strava API limits)
    requestsPer15Min: 100,
    requestsPerDay: 1000,
    
    // Fetch Limits (Strava API maximums)
    maxActivitiesPerRequest: 200, // Strava API maximum
                maxSegmentBatchSize: 100,     // Process 100 activities at a time for segments
            maxCrawlerBatchSize: 200,     // Maximum activities per crawler run (Strava API limit)
    
    // Timing Configuration
    minDelayMs: 900,  // 1 request per 0.9 seconds (conservative)
    maxDelayMs: 1200, // 1 request per 1.2 seconds (safe)
    retryDelayMs: 15 * 60 * 1000, // 15 minutes for rate limit reset
    
    // Development Overrides
    noLimitsMode: process.env.STRAVA_NO_LIMITS === 'true'
  }
}

function getAppConfig() {
  const port = 3001 // Development port (different from default 3000)
  
  // Priority: NEXT_PUBLIC_APP_URL > VERCEL_URL > localhost with port
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (appUrl) {
    return {
      baseUrl: appUrl.replace(/\/$/, ''),
      port
    }
  }

  const vercelUrl = process.env.VERCEL_URL
  if (vercelUrl) {
    return {
      baseUrl: `https://${vercelUrl.replace(/\/$/, '')}`,
      port: 443 // HTTPS default
    }
  }

  return {
    baseUrl: `http://localhost:${port}`,
    port
  }
}

export const config: AppConfig = {
  strava: getStravaConfig(),
  supabase: getSupabaseConfig(),
  stravaApiLimits: getStravaApiLimits(),
  app: getAppConfig()
}

export default config
