import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get valid token
    let { data: tokens } = await supabase
      .from('tokens')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!tokens) {
      throw new Error('No tokens found in database')
    }

    // Check if token is expired
    if (new Date(tokens.expires_at) <= new Date()) {
      console.log('Token expired, refreshing...')
      
      const refreshResponse = await fetch('https://www.strava.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: Deno.env.get('STRAVA_CLIENT_ID')!,
          client_secret: Deno.env.get('STRAVA_CLIENT_SECRET')!,
          grant_type: 'refresh_token',
          refresh_token: tokens.refresh_token,
        })
      })

      if (!refreshResponse.ok) {
        throw new Error('Failed to refresh token')
      }

      const newTokens = await refreshResponse.json()

      // Save new tokens
      await supabase
        .from('tokens')
        .insert({
          access_token: newTokens.access_token,
          refresh_token: newTokens.refresh_token,
          expires_at: new Date(newTokens.expires_at * 1000).toISOString(),
        })

      tokens = {
        access_token: newTokens.access_token,
        refresh_token: newTokens.refresh_token,
        expires_at: new Date(newTokens.expires_at * 1000).toISOString(),
      }
    }

    // Get activities that need segments
    const { data: activities } = await supabase
      .from('activities')
      .select('id')
      .eq('segments_fetched', false)
      .limit(10) // Process in small batches

    if (!activities || activities.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No activities need segments fetched' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create job record
    const { data: job } = await supabase
      .from('jobs')
      .insert({
        type: 'fetch_segments',
        status: 'running',
        total_items: activities.length,
        started_at: new Date().toISOString(),
      })
      .select()
      .single()

    let processed = 0
    let totalSegments = 0

    for (const activity of activities) {
      try {
        // Fetch segments from Strava
        const response = await fetch(
          `https://www.strava.com/api/v3/activities/${activity.id}?include_all_efforts=true`,
          {
            headers: { 'Authorization': `Bearer ${tokens.access_token}` }
          }
        )

        if (response.ok) {
          const data = await response.json()
          const segments = data.segment_efforts || []

          // Store segments
          if (segments.length > 0) {
            const segmentsToInsert = segments.map((segment: any) => ({
              activity_id: activity.id,
              segment_id: segment.segment.id,
              segment_name: segment.segment.name,
              segment_distance: segment.segment.distance,
              segment_elevation_high: segment.segment.elevation_high,
              segment_elevation_low: segment.segment.elevation_low,
              segment_grade: segment.segment.average_grade,
              segment_climb_category: segment.segment.climb_category,
              segment_city: segment.segment.city,
              segment_state: segment.segment.state,
              segment_country: segment.segment.country,
              segment_private: segment.segment.private,
              segment_hazardous: segment.segment.hazardous,
              segment_starred: segment.segment.starred,
              elapsed_time: segment.elapsed_time,
              moving_time: segment.moving_time,
              start_date: segment.start_date,
              start_date_local: segment.start_date_local,
              average_watts: segment.average_watts,
              max_watts: segment.max_watts,
              average_heartrate: segment.average_heartrate,
              max_heartrate: segment.max_heartrate,
              average_cadence: segment.average_cadence,
              max_cadence: segment.max_cadence,
              average_temp: segment.average_temp
            }))

            await supabase
              .from('segments')
              .upsert(segmentsToInsert, { onConflict: 'activity_id,segment_id' })

            totalSegments += segments.length
          }

          // Mark activity as processed
          await supabase
            .from('activities')
            .update({ segments_fetched: true })
            .eq('id', activity.id)
        } else if (response.status === 401) {
          // Token might be invalid, try to refresh
          console.log('Got 401, token might be invalid')
          break
        } else {
          console.log(`Error fetching activity ${activity.id}: ${response.status}`)
        }

        processed++
        
        // Update job progress
        await supabase
          .from('jobs')
          .update({ progress: processed })
          .eq('id', job.id)

        // Rate limiting - wait 1.1 seconds between requests
        await new Promise(resolve => setTimeout(resolve, 1100))

      } catch (error) {
        console.error(`Error processing activity ${activity.id}:`, error)
      }
    }

    // Mark job as completed
    await supabase
      .from('jobs')
      .update({ 
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', job.id)

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed, 
        total: activities.length,
        segmentsAdded: totalSegments
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in fetch-segments function:', error)
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}) 