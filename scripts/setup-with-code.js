const axios = require('axios');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
let envPath = path.join(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  envPath = path.join(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  } else {
    console.error('No .env.local or .env file found.');
    process.exit(1);
  }
}

const clientId = process.env.STRAVA_CLIENT_ID;
const clientSecret = process.env.STRAVA_CLIENT_SECRET;
const TOKENS_FILE = path.join(__dirname, '../data/tokens.json');

if (!clientId || !clientSecret) {
  console.error('Missing STRAVA_CLIENT_ID or STRAVA_CLIENT_SECRET in environment file.');
  process.exit(1);
}

async function setupWithCode() {
  console.log('🔑 Setting up Strava tokens with authorization code...\n');

  // The authorization code from the URL
  const authCode = '24ea30c4970af5c318524c87518ffb96130f6252';

  try {
    console.log('🔄 Exchanging authorization code for tokens...');

    const response = await axios.post('https://www.strava.com/oauth/token', null, {
      params: {
        client_id: clientId,
        client_secret: clientSecret,
        code: authCode,
        grant_type: 'authorization_code',
      },
    });

    console.log('\n✅ Tokens received successfully!');
    console.log(`Access Token: ${response.data.access_token.substring(0, 20)}...`);
    console.log(`Refresh Token: ${response.data.refresh_token.substring(0, 20)}...`);
    console.log(`Expires At: ${new Date(response.data.expires_at * 1000).toISOString()}`);

    // Save tokens
    const dir = path.dirname(TOKENS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const tokens = {
      access_token: response.data.access_token,
      refresh_token: response.data.refresh_token,
      expires_at: response.data.expires_at,
      expires_in: response.data.expires_in,
    };

    fs.writeFileSync(TOKENS_FILE, JSON.stringify(tokens, null, 2));

    console.log('\n✅ Tokens saved successfully!');
    console.log('You can now run the fetch scripts without any manual intervention.');
    console.log('\n🎉 Setup completed! You can now run:');
    console.log('   node scripts/fetch_strava_segments.js');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

setupWithCode(); 