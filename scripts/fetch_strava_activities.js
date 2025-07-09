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
  let page = 1;
  const perPage = 200;
  let allActivities = [];
  let keepGoing = true;

  while (keepGoing) {
    const res = await axios.get('https://www.strava.com/api/v3/athlete/activities', {
      headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
      params: { page, per_page: perPage }
    });
    if (res.data.length === 0) {
      keepGoing = false;
    } else {
      allActivities = allActivities.concat(res.data);
      page++;
    }
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allActivities, null, 2));
  console.log(`Saved ${allActivities.length} activities to ${OUTPUT_FILE}`);
}

fetchAllActivities().catch(console.error);
