// Utility to load and aggregate all segment efforts from data/segments/*.json
// Outputs a single array of all efforts for further processing or API serving

const fs = require('fs');
const path = require('path');

const SEGMENTS_DIR = path.join(__dirname, '../data/segments');

function loadAllSegments() {
  const files = fs.readdirSync(SEGMENTS_DIR).filter(f => f.endsWith('.json'));
  let allEfforts = [];
  for (const file of files) {
    const fullPath = path.join(SEGMENTS_DIR, file);
    try {
      const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
      if (Array.isArray(data)) {
        allEfforts = allEfforts.concat(data);
      } else {
        console.warn(`File ${file} does not contain an array, skipping.`);
      }
    } catch (err) {
      console.warn(`Could not parse ${file}: ${err.message}`);
    }
  }
  return allEfforts;
}

if (require.main === module) {
  // Run as script: print summary
  const allEfforts = loadAllSegments();
  console.log(`Loaded ${allEfforts.length} segment efforts from ${SEGMENTS_DIR}`);
  // Print a sample of unique segment names
  const uniqueSegments = Array.from(new Set(allEfforts.map(e => e.segment?.name))).slice(0, 20);
  console.log('Sample segment names:', uniqueSegments);
}

module.exports = { loadAllSegments };
