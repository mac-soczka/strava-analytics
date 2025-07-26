import { createClientComponentClient } from '@/lib/supabase'

// Utility function to get current timestamp in ISO format
export function getCurrentTimestamp(): string {
  return new Date().toISOString()
}

// Utility function to prepare data for insertion with timestamps
export function prepareInsertData<T extends Record<string, any>>(data: T): T & { created_at: string; updated_at: string } {
  const timestamp = getCurrentTimestamp()
  return {
    ...data,
    created_at: timestamp,
    updated_at: timestamp,
  }
}

// Utility function to prepare data for update with timestamp
export function prepareUpdateData<T extends Record<string, any>>(data: T): T & { updated_at: string } {
  return {
    ...data,
    updated_at: getCurrentTimestamp(),
  }
}

// Client-side database operation wrappers
export async function upsertUserClient(userData: {
  strava_id: number
  firstname: string
  lastname: string
  city?: string
  state?: string
  country?: string
  profile_picture?: string
}) {
  const client = createClientComponentClient()
  const data = prepareUpdateData(userData)
  
  const { data: result, error } = await client
    .from('users')
    .upsert(data, {
      onConflict: 'strava_id'
    })

  if (error) {
    console.error('Error upserting user:', error)
    throw error
  }

  return result
}

export async function upsertTokensClient(tokenData: {
  strava_id: number
  access_token: string
  refresh_token: string
  expires_at: string
}) {
  const client = createClientComponentClient()
  const data = prepareUpdateData(tokenData)
  
  const { data: result, error } = await client
    .from('strava_tokens')
    .upsert(data, {
      onConflict: 'strava_id'
    })

  if (error) {
    console.error('Error upserting tokens:', error)
    throw error
  }

  return result
}

export async function getUserByStravaIdClient(stravaId: number) {
  const client = createClientComponentClient()
  const { data, error } = await client
    .from('users')
    .select('*')
    .eq('strava_id', stravaId)
    .single()

  if (error) {
    console.error('Error fetching user:', error)
    throw error
  }

  return data
}

export async function getTokensByStravaIdClient(stravaId: number) {
  const client = createClientComponentClient()
  const { data, error } = await client
    .from('strava_tokens')
    .select('*')
    .eq('strava_id', stravaId)
    .single()

  if (error) {
    console.error('Error fetching tokens:', error)
    throw error
  }

  return data
}

// Export types for better type safety
export interface User {
  id: string
  strava_id: number
  firstname: string
  lastname: string
  city?: string
  state?: string
  country?: string
  profile_picture?: string
  created_at: string
  updated_at: string
}

export interface StravaTokens {
  id: string
  strava_id: number
  access_token: string
  refresh_token: string
  expires_at: string
  created_at: string
  updated_at: string
} 