import axios from 'axios';
import { config } from '@/lib/config';
import { upsertUser, upsertTokens } from '@/lib/database';
import { AuthServiceServer, CookieManagerServer } from '@/lib/services/auth-service-server';

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
    
    const { access_token, refresh_token, athlete } = response.data;
    
    // Initialize session variables
    let sessionToken = null;
    let expiresAt = null;
    
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
      
      // Create app session
      const sessionResult = await AuthServiceServer.authenticateUser(athlete.id);
      sessionToken = sessionResult.sessionToken;
      expiresAt = sessionResult.expiresAt;
      
      console.log('✅ User authenticated and session created:', athlete.firstname, athlete.lastname);
      
    } catch (dbError) {
      console.error('Database error:', dbError);
      // If database operations fail, we can't create a session
      // Redirect to home page with error
      const homeUrl = process.env.NODE_ENV === 'production' 
        ? 'https://strava-heatmap-alpha.vercel.app'
        : config.app.baseUrl;
      
      return Response.redirect(homeUrl);
    }
    
    // Redirect to dashboard after successful authentication
    const dashboardUrl = process.env.NODE_ENV === 'production' 
      ? 'https://strava-heatmap-alpha.vercel.app/dashboard'
      : `${config.app.baseUrl}/dashboard`;
    
    // Create response with session cookie
    console.log('🔧 Redirecting to dashboard:', dashboardUrl);
    
    // Set session cookie only if session was created successfully
    if (sessionToken && expiresAt) {
      console.log('🔧 Setting cookies for session');
      const sessionCookie = CookieManagerServer.setSessionCookie(sessionToken, expiresAt);
      const csrfToken = AuthServiceServer.generateCSRFToken();
      const csrfCookie = CookieManagerServer.setCSRFCookie(csrfToken);
      
      console.log('🔧 Session cookie:', sessionCookie);
      console.log('🔧 CSRF cookie:', csrfCookie);
      
      console.log('✅ Cookies set successfully');
      console.log('✅ Redirecting to dashboard with cookies');
      
      return new Response(null, {
        status: 302,
        headers: {
          Location: dashboardUrl,
          'Set-Cookie': [sessionCookie, csrfCookie],
        },
      });
    } else {
      console.log('❌ No session token or expiresAt available');
      console.log('✅ Redirecting to dashboard without cookies');
      
      return new Response(null, {
        status: 302,
        headers: { Location: dashboardUrl },
      });
    }
  } catch (error) {
    console.error('❌ Callback error:', error);
    console.error('❌ Error stack:', error.stack);
    
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
