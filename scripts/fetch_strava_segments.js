// Script to fetch all segment efforts for all activities from Strava
// Saves each activity's segment efforts to /data/segments/[activity_id].json
// Respects Strava API rate limits and supports resumability with automatic token refresh

const fs = require('fs');
const path = require('path');
const axios = require('axios');
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

const ACTIVITIES_PATH = path.join(__dirname, '../data/activities.json');
const SEGMENTS_DIR = path.join(__dirname, '../data/segments');
const TOKENS_FILE = path.join(__dirname, '../data/tokens.json');
const BATCH_SIZE = 90; // Requests per batch (keep below 100/15min limit)
const WAIT_TIME_MS = 15 * 60 * 1000; // 15 minutes

// Seamless token management
class SeamlessTokenManager {
  constructor() {
    this.clientId = process.env.STRAVA_CLIENT_ID;
    this.clientSecret = process.env.STRAVA_CLIENT_SECRET;
    this.tokens = this.loadTokens();
  }

  loadTokens() {
    if (fs.existsSync(TOKENS_FILE)) {
      try {
        return JSON.parse(fs.readFileSync(TOKENS_FILE, 'utf8'));
      } catch (error) {
        console.warn('Error loading tokens file:', error.message);
      }
    }
    return null;
  }

  saveTokens(tokens) {
    const dir = path.dirname(TOKENS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(TOKENS_FILE, JSON.stringify(tokens, null, 2));
    this.tokens = tokens;
  }

  isTokenExpired() {
    if (!this.tokens?.expires_at) return true;
    // Add 5 minute buffer before expiration
    return Date.now() >= (this.tokens.expires_at * 1000) - (5 * 60 * 1000);
  }

  async refreshToken() {
    if (!this.tokens?.refresh_token) {
      throw new Error('No refresh token available. Please re-authenticate with Strava.');
    }

    try {
      console.log('🔄 Refreshing Strava access token...');
      const response = await axios.post('https://www.strava.com/oauth/token', null, {
        params: {
          client_id: this.clientId,
          client_secret: this.clientSecret,
          grant_type: 'refresh_token',
          refresh_token: this.tokens.refresh_token,
        },
      });

      const newTokens = {
        access_token: response.data.access_token,
        refresh_token: response.data.refresh_token || this.tokens.refresh_token,
        expires_at: response.data.expires_at,
        expires_in: response.data.expires_in,
      };

      this.saveTokens(newTokens);
      console.log('✅ Token refreshed successfully');
      return newTokens.access_token;
    } catch (error) {
      console.error('❌ Error refreshing token:', error.response?.data || error.message);
      throw new Error('Failed to refresh token. Please re-authenticate with Strava.');
    }
  }

  async getValidToken() {
    if (!this.tokens?.access_token) {
      throw new Error('No access token available. Please re-authenticate with Strava.');
    }

    if (this.isTokenExpired()) {
      return await this.refreshToken();
    }

    return this.tokens.access_token;
  }
}

const tokenManager = new SeamlessTokenManager();
if (!fs.existsSync(ACTIVITIES_PATH)) {
  console.error('Missing activities.json. Run fetch_strava_activities.js first.');
  process.exit(1);
}
if (!fs.existsSync(SEGMENTS_DIR)) {
  fs.mkdirSync(SEGMENTS_DIR, { recursive: true });
}

const activities = JSON.parse(fs.readFileSync(ACTIVITIES_PATH, 'utf8'));

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Utility: Check if a file is valid JSON and not empty
function isValidJsonFile(filePath) {
  try {
    const stats = fs.statSync(filePath);
    if (stats.size === 0) return false;
    const content = fs.readFileSync(filePath, 'utf8');
    JSON.parse(content);
    return true;
  } catch (e) {
    return false;
  }
}

async function fetchSegments() {
  // Build set of already-fetched valid activity IDs
  const fetchedIds = new Set();
  const segmentFiles = fs.readdirSync(SEGMENTS_DIR).filter(f => f.endsWith('.json'));
  for (const file of segmentFiles) {
    const fullPath = path.join(SEGMENTS_DIR, file);
    const id = path.basename(file, '.json');
    if (isValidJsonFile(fullPath)) {
      fetchedIds.add(id);
    } else {
      console.warn(`Corrupt or empty segment file detected: ${file}. Will re-fetch.`);
    }
  }

  let count = 0;
  for (let i = 0; i < activities.length; i++) {
    const id = String(activities[i].id);
    const segmentFile = path.join(SEGMENTS_DIR, `${id}.json`);
    if (fetchedIds.has(id)) {
      console.log(`[${i+1}/${activities.length}] Skipping activity ${id} (already fetched and valid)`);
      continue;
    }
    
    let retries = 0;
    const maxRetries = 3;
    
    while (retries < maxRetries) {
      try {
        console.log(`[${i+1}/${activities.length}] Fetching activity ${id}...`);
        const accessToken = await tokenManager.getValidToken();
        const res = await axios.get(
          `https://www.strava.com/api/v3/activities/${id}?include_all_efforts=true`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        fs.writeFileSync(segmentFile, JSON.stringify(res.data.segment_efforts || [], null, 2));
        console.log(`Saved segment efforts for activity ${id}`);
        break; // Success, exit retry loop
      } catch (err) {
        if (err.response && err.response.status === 429) {
          // Rate limit hit, wait for 15 minutes
          console.warn('Rate limit reached. Waiting 15 minutes...');
          await sleep(WAIT_TIME_MS);
          continue; // Retry same activity
        } else if (err.response && err.response.status === 401) {
          // Authorization error, try to refresh token
          console.warn('Authorization error, attempting token refresh...');
          try {
            await tokenManager.refreshToken();
            retries++;
            continue; // Retry with new token
          } catch (refreshError) {
            console.error('Failed to refresh token:', refreshError.message);
            throw new Error('Token refresh failed. Please re-authenticate with Strava.');
          }
        } else {
          console.error(`Error fetching activity ${id}:`, err.response?.status, err.response?.data || err.message);
          break; // Don't retry other errors
        }
      }
    }
    
    if (retries >= maxRetries) {
      console.error(`Failed to fetch activity ${id} after ${maxRetries} retries`);
      continue;
    }
    
    count++;
    if (count % BATCH_SIZE === 0) {
      console.log(`Batch limit reached (${BATCH_SIZE}). Waiting 15 minutes...`);
      await sleep(WAIT_TIME_MS);
    }
    await sleep(1100); // Small delay between requests (1.1s)
  }
  console.log('Done fetching all segment efforts.');
}

fetchSegments();
