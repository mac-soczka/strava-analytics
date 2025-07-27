import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { StravaCrawlerService } from '../../../lib/services/strava-crawler-service.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('🕐 Supabase Edge Function triggered at:', new Date().toISOString())
    
    // Create Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // Initialize crawler service
    const crawlerService = new StravaCrawlerService()
    
    // Process all users with valid tokens
    const results = await crawlerService.crawlStravaData({
      batch_size: 200,
      include_segments: true
    })
    
    console.log(`✅ Edge Function completed. Processed ${results.users_processed} users`)
    
    // Calculate summary statistics
    const successful = results.users_successful
    const totalActivities = results.total_activities
    const totalSegments = results.total_segments
    const totalExecutionTime = results.results.reduce((sum, r) => sum + r.execution_time_ms, 0)
    
    const response = {
      success: true,
      users_processed: results.users_processed,
      users_successful: successful,
      total_activities: totalActivities,
      total_segments: totalSegments,
      execution_time_ms: totalExecutionTime,
      results: results.results,
      timestamp: new Date().toISOString(),
      message: `Processed ${results.users_processed} users: ${successful} successful, ${totalActivities} activities, ${totalSegments} segments`
    }
    
    return new Response(
      JSON.stringify(response),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )
    
  } catch (error: any) {
    console.error('❌ Edge Function failed:', error)
    
    const errorResponse = {
      success: false,
      error: error?.message || 'Unknown error',
      timestamp: new Date().toISOString()
    }
    
    return new Response(
      JSON.stringify(errorResponse),
      { 
        status: 500,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )
  }
}) 