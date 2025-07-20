import axios from 'axios';
import { config } from '@/lib/config';
import { upsertUser, upsertTokens } from '@/lib/database';

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
    
    try {
      // Upsert user data (create or update)
      await upsertUser({
        strava_id: athlete.id,
        firstname: athlete.firstname,
        lastname: athlete.lastname,
        city: athlete.city,
        state: athlete.state,
        country: athlete.country,
        profile_picture: athlete.profile
      });
      
      // Store tokens securely
      await upsertTokens({
        strava_id: athlete.id,
        access_token: access_token,
        refresh_token: refresh_token,
        expires_at: new Date(response.data.expires_at * 1000).toISOString()
      });
      
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
