// Script to fetch all segment efforts for all activities from Strava
// Saves each activity's segment efforts to /data/segments/[activity_id].json
// Respects Strava API rate limits and supports resumability

// Try to load from .env.local, fallback to .env
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
let envPath = path.join(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
  console.log('Loaded environment variables from .env.local');
} else {
  envPath = path.join(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    console.log('Loaded environment variables from .env');
  } else {
    console.error('No .env.local or .env file found.');
    process.exit(1);
  }
}
const axios = require('axios');

const ACCESS_TOKEN = process.env.STRAVA_ACCESS_TOKEN;
const ACTIVITIES_PATH = path.join(__dirname, '../data/activities.json');
const SEGMENTS_DIR = path.join(__dirname, '../data/segments');
const BATCH_SIZE = 90; // Requests per batch (keep below 100/15min limit)
const WAIT_TIME_MS = 15 * 60 * 1000; // 15 minutes

if (!ACCESS_TOKEN) {
  console.error('Missing STRAVA_ACCESS_TOKEN in .env.local');
  process.exit(1);
}
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
    try {
      console.log(`[${i+1}/${activities.length}] Fetching activity ${id}...`);
      const res = await axios.get(
        `https://www.strava.com/api/v3/activities/${id}?include_all_efforts=true`,
        { headers: { Authorization: `Bearer ${ACCESS_TOKEN}` } }
      );
      fs.writeFileSync(segmentFile, JSON.stringify(res.data.segment_efforts || [], null, 2));
      console.log(`Saved segment efforts for activity ${id}`);
    } catch (err) {
      if (err.response && err.response.status === 429) {
        // Rate limit hit, wait for 15 minutes
        console.warn('Rate limit reached. Waiting 15 minutes...');
        await sleep(WAIT_TIME_MS);
        i--; // retry this activity
        continue;
      }
      console.error(`Error fetching activity ${id}:`, err.response?.status, err.response?.data || err.message);
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
