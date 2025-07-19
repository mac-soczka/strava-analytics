import axios from 'axios';
import { config } from '@/lib/config';
import { createClient } from '@supabase/supabase-js';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  if (!code) {
    return new Response('No code provided', { status: 400 });
  }

  try {
    const response = await axios.post('https://www.strava.com/oauth/token', null, {
      params: {
        client_id: config.strava.clientId,
        client_secret: config.strava.clientSecret,
        code,
        grant_type: 'authorization_code',
      },
    });
    // Store tokens and user data in Supabase
    const { access_token, refresh_token, athlete } = response.data;
    
    // Initialize Supabase client
    const supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey);
    
    try {
      // Upsert user data (create or update)
      const { data: userData, error: userError } = await supabase
        .from('users')
        .upsert({
          strava_id: athlete.id,
          firstname: athlete.firstname,
          lastname: athlete.lastname,
          city: athlete.city,
          state: athlete.state,
          country: athlete.country,
          profile_picture: athlete.profile,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'strava_id'
        });
      
      if (userError) {
        console.error('Error saving user data:', userError);
      }
      
      // Store tokens securely
      const { data: tokenData, error: tokenError } = await supabase
        .from('strava_tokens')
        .upsert({
          strava_id: athlete.id,
          access_token: access_token,
          refresh_token: refresh_token,
          expires_at: new Date(response.data.expires_at * 1000).toISOString(),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'strava_id'
        });
      
      if (tokenError) {
        console.error('Error saving tokens:', tokenError);
      }
      
      console.log('✅ User authenticated and data stored:', athlete.firstname, athlete.lastname);
      
    } catch (dbError) {
      console.error('Database error:', dbError);
      // Continue with redirect even if DB fails
    }
    
    // Redirect to dashboard after successful authentication
    const dashboardUrl = process.env.NODE_ENV === 'production' 
      ? 'https://strava-heatmap-alpha.vercel.app/dashboard'
      : 'http://localhost:3000/dashboard';
    
    return Response.redirect(dashboardUrl);
  } catch (error) {
    let errorDetails = { error: error.message };
    if (error.response) {
      errorDetails.status = error.response.status;
      errorDetails.data = error.response.data;
    }
    return new Response(JSON.stringify(errorDetails, null, 2), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
