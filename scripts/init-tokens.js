const axios = require('axios');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
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

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function initTokens() {
  console.log('🔑 Strava Token Initialization');
  console.log('==============================\n');

  // Check if tokens already exist
  if (fs.existsSync(TOKENS_FILE)) {
    console.log('⚠️  Tokens already exist. Do you want to overwrite them? (y/N)');
    const answer = await question('');
    if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
      console.log('Keeping existing tokens.');
      rl.close();
      return;
    }
  }

  console.log(`Client ID: ${clientId}`);
  console.log(`Client Secret: ${clientSecret.substring(0, 4)}...\n`);

  const authUrl = `https://www.strava.com/oauth/authorize?client_id=${clientId}&response_type=code&redirect_uri=http://localhost&approval_prompt=auto&scope=read,activity:read`;
  
  console.log('📋 Follow these steps:');
  console.log('1. Open this URL in your browser:');
  console.log(`   ${authUrl}`);
  console.log('2. Complete the authorization');
  console.log('3. Copy the authorization code from the URL (after "code=")');
  console.log('4. Paste it below\n');

  const authCode = await question('Enter the authorization code: ');

  if (!authCode.trim()) {
    console.log('\n❌ No authorization code provided. Exiting.');
    rl.close();
    return;
  }

  try {
    console.log('\n🔄 Exchanging authorization code for tokens...');

    const response = await axios.post('https://www.strava.com/oauth/token', null, {
      params: {
        client_id: clientId,
        client_secret: clientSecret,
        code: authCode.trim(),
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
  } finally {
    rl.close();
  }
}

initTokens(); 