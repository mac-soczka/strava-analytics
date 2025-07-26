import { createClient } from '@supabase/supabase-js';
import { config } from './config';

// Create Supabase client with service role key for server-side operations
export const supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey);

// Debug Supabase configuration
console.log('🔧 Supabase URL:', config.supabase.url)
console.log('🔧 Service Role Key exists:', !!config.supabase.serviceRoleKey)

// Create Supabase client with anon key for client-side operations
export const supabaseClient = createClient(config.supabase.url, config.supabase.anonKey);

// Utility function to get current timestamp in ISO format
export function getCurrentTimestamp(): string {
  return new Date().toISOString();
}

// Utility function to prepare data for insertion with timestamps
export function prepareInsertData<T extends Record<string, any>>(data: T): T & { created_at: string; updated_at: string } {
  const timestamp = getCurrentTimestamp();
  return {
    ...data,
    created_at: timestamp,
    updated_at: timestamp,
  };
}

// Utility function to prepare data for update with timestamp
export function prepareUpdateData<T extends Record<string, any>>(data: T): T & { updated_at: string } {
  return {
    ...data,
    updated_at: getCurrentTimestamp(),
  };
}

// Database operation wrappers with proper error handling
export async function upsertUser(userData: {
  strava_id: number;
  firstname: string;
  lastname: string;
  city?: string;
  state?: string;
  country?: string;
  profile_picture?: string;
}) {
  const data = prepareUpdateData(userData);
  
  const { data: result, error } = await supabase
    .from('users')
    .upsert(data, {
      onConflict: 'strava_id'
    });

  if (error) {
    console.error('Error upserting user:', error);
    throw error;
  }

  return result;
}

export async function upsertTokens(tokenData: {
  strava_id: number;
  access_token: string;
  refresh_token: string;
  expires_at: string;
}) {
  const data = prepareUpdateData(tokenData);
  
  const { data: result, error } = await supabase
    .from('strava_tokens')
    .upsert(data, {
      onConflict: 'strava_id'
    });

  if (error) {
    console.error('Error upserting tokens:', error);
    throw error;
  }

  return result;
}

export async function getUserByStravaId(stravaId: number) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('strava_id', stravaId)
    .single();

  if (error) {
    console.error('Error fetching user:', error);
    throw error;
  }

  return data;
}

export async function getTokensByStravaId(stravaId: number) {
  const { data, error } = await supabase
    .from('strava_tokens')
    .select('*')
    .eq('strava_id', stravaId)
    .single();

  if (error) {
    console.error('Error fetching tokens:', error);
    throw error;
  }

  return data;
}

// Test helper function
export function mockTimestamp(): string {
  return '2024-01-01T00:00:00.000Z';
}

// Export types for better type safety
export interface User {
  id: string;
  strava_id: number;
  firstname: string;
  lastname: string;
  city?: string;
  state?: string;
  country?: string;
  profile_picture?: string;
  created_at: string;
  updated_at: string;
}

export interface StravaTokens {
  id: string;
  strava_id: number;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

export interface Activity {
  id: string;
  strava_id: number;
  activity_id: number;
  name?: string;
  distance?: number;
  moving_time?: number;
  elapsed_time?: number;
  total_elevation_gain?: number;
  type?: string;
  start_date?: string;
  start_date_local?: string;
  average_speed?: number;
  max_speed?: number;
  average_watts?: number;
  max_watts?: number;
  average_heartrate?: number;
  max_heartrate?: number;
  polyline?: string;
  created_at: string;
  updated_at: string;
} 