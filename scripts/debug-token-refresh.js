const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugTokenRefresh() {
  console.log('🔍 Debugging token refresh...');

  try {
    // Check environment variables
    console.log('📋 Environment variables:');
    console.log(`   STRAVA_CLIENT_ID: ${process.env.STRAVA_CLIENT_ID ? 'SET' : 'NOT SET'}`);
    console.log(`   STRAVA_CLIENT_SECRET: ${process.env.STRAVA_CLIENT_SECRET ? 'SET' : 'NOT SET'}`);

    // Get tokens for user 123456 (from the logs)
    const { data: tokens, error } = await supabase
      .from('strava_tokens')
      .select('*')
      .eq('strava_id', 123456)
      .single();

    if (error) {
      console.error('❌ Error fetching tokens:', error);
      return;
    }

    console.log('📋 Token info:');
    console.log(`   Expires: ${tokens.expires_at}`);
    console.log(`   Current time: ${new Date().toISOString()}`);
    console.log(`   Is expired: ${new Date(tokens.expires_at) <= new Date()}`);

    // Test the exact same logic as the service
    console.log('🔄 Testing token refresh logic...');
    
    const response = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.STRAVA_CLIENT_ID,
        client_secret: process.env.STRAVA_CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: tokens.refresh_token,
      })
    });

    console.log(`📊 Response status: ${response.status}`);
    console.log(`📊 Response ok: ${response.ok}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Token refresh failed:');
      console.error(`   Status: ${response.status}`);
      console.error(`   Error: ${errorText}`);
      
      // Try to parse as JSON for more details
      try {
        const errorJson = JSON.parse(errorText);
        console.error('   Details:', errorJson);
      } catch (e) {
        console.error('   Raw response:', errorText);
      }
    } else {
      const newTokens = await response.json();
      console.log('✅ Token refresh successful!');
      console.log('📋 New token info:');
      console.log(`   New expires_at: ${new Date(newTokens.expires_at * 1000).toISOString()}`);
      console.log(`   Has new access_token: ${!!newTokens.access_token}`);
      console.log(`   Has new refresh_token: ${!!newTokens.refresh_token}`);
    }

  } catch (error) {
    console.error('❌ Debug failed:', error);
    console.error('   Stack:', error.stack);
  }
}

debugTokenRefresh().catch(console.error); 