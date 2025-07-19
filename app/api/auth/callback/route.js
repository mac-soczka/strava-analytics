import axios from 'axios';
import { config } from '@/lib/config';

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
    // Store tokens (you might want to save these to a database)
    const { access_token, refresh_token, athlete } = response.data;
    
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
