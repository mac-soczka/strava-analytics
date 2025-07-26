const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testTokenRefresh() {
  console.log('🔄 Testing token refresh...');

  try {
    // Get tokens for user 42137242 (the one that's definitely expired)
    const { data: tokens, error } = await supabase
      .from('strava_tokens')
      .select('*')
      .eq('strava_id', 42137242)
      .single();

    if (error) {
      console.error('❌ Error fetching tokens:', error);
      return;
    }

    console.log('📋 Current token info:');
    console.log(`   Expires: ${tokens.expires_at}`);
    console.log(`   Has refresh_token: ${!!tokens.refresh_token}`);
    console.log(`   Current time: ${new Date().toISOString()}`);
    console.log(`   Is expired: ${new Date(tokens.expires_at) <= new Date()}`);

    if (!tokens.refresh_token) {
      console.error('❌ No refresh token available');
      return;
    }

    // Try to refresh the token
    console.log('🔄 Attempting token refresh...');
    
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
    console.error('❌ Test failed:', error);
  }
}

testTokenRefresh().catch(console.error); 