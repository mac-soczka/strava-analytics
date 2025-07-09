const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const ACCESS_TOKEN = process.env.STRAVA_ACCESS_TOKEN;
console.log(ACCESS_TOKEN);
const OUTPUT_FILE = path.join(__dirname, '../data/activities.json');

if (!ACCESS_TOKEN) {
  throw new Error('STRAVA_ACCESS_TOKEN not found in .env.local');
}

async function fetchAllActivities() {
  const activitiesPath = path.join(__dirname, '../data/activities.json');
  if (!fs.existsSync(activitiesPath)) {
    throw new Error('data/activities.json not found. Please run the fetcher to generate it first.');
  }

  console.log('Reading activities from data/activities.json...');
  const allActivities = JSON.parse(fs.readFileSync(activitiesPath, 'utf-8'));
  console.log(`Loaded ${allActivities.length} activities from data/activities.json.`);

  // Ensure /data/activities directory exists
  const dir = path.join(__dirname, '../data/activities');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Save each activity as its own file, skip if already exists
  let saved = 0, skipped = 0;
  allActivities.forEach((a, i) => {
    const file = path.join(dir, `${a.id}.json`);
    if (fs.existsSync(file)) {
      console.log(`[${i + 1}/${allActivities.length}] Skipping already saved activity ${a.id}`);
      skipped++;
      return; // Already fetched
    }
    fs.writeFileSync(file, JSON.stringify(a, null, 2));
    console.log(`[${i + 1}/${allActivities.length}] Saved activity ${a.id} (${a.name})`);
    saved++;
  });
  console.log(`Done. Saved ${saved} new activities to ${dir} (${skipped} skipped)`);
}


fetchAllActivities().catch(console.error);
