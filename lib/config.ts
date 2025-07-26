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
}

function getStravaConfig(): StravaConfig {
  const clientId = process.env.STRAVA_CLIENT_ID
  const clientSecret = process.env.STRAVA_CLIENT_SECRET
  const redirectUri = process.env.STRAVA_REDIRECT_URI

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Missing required Strava configuration. Please check your environment variables.')
  }

  return {
    clientId,
    clientSecret,
    redirectUri
  }
}

function getSupabaseConfig(): SupabaseConfig {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !anonKey || !serviceRoleKey) {
    throw new Error('Missing required Supabase configuration. Please check your environment variables.')
  }

  return {
    url,
    anonKey,
    serviceRoleKey
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

export const config: AppConfig = {
  strava: getStravaConfig(),
  supabase: getSupabaseConfig(),
  stravaApiLimits: getStravaApiLimits()
}

export default config
