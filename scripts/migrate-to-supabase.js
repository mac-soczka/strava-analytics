const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables:');
  console.error('NEXT_PUBLIC_SUPABASE_URL');
  console.error('SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function migrateActivities() {
  console.log('🔄 Migrating activities...');
  
  try {
    const activitiesData = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/activities.json'), 'utf8'));
    
    console.log(`Found ${activitiesData.length} activities to migrate`);
    
    // Process in batches to avoid overwhelming the database
    const batchSize = 100;
    let migrated = 0;
    
    for (let i = 0; i < activitiesData.length; i += batchSize) {
      const batch = activitiesData.slice(i, i + batchSize);
      
      const activitiesToInsert = batch.map(activity => ({
        id: activity.id,
        name: activity.name,
        distance: activity.distance,
        moving_time: activity.moving_time,
        elapsed_time: activity.elapsed_time,
        total_elevation_gain: activity.total_elevation_gain,
        type: activity.type,
        sport_type: activity.sport_type,
        workout_type: activity.workout_type,
        start_date: activity.start_date,
        start_date_local: activity.start_date_local,
        timezone: activity.timezone,
        utc_offset: activity.utc_offset,
        segments_fetched: false // We'll update this after migrating segments
      }));
      
      const { data, error } = await supabase
        .from('activities')
        .upsert(activitiesToInsert, { onConflict: 'id' });
      
      if (error) {
        console.error('Error inserting activities batch:', error);
        continue;
      }
      
      migrated += batch.length;
      console.log(`Migrated ${migrated}/${activitiesData.length} activities`);
    }
    
    console.log('✅ Activities migration completed');
    return activitiesData.length;
    
  } catch (error) {
    console.error('Error reading activities file:', error);
    throw error;
  }
}

async function migrateSegments() {
  console.log('🔄 Migrating segments...');
  
  const segmentsDir = path.join(__dirname, '../data/segments');
  const segmentFiles = fs.readdirSync(segmentsDir).filter(f => f.endsWith('.json'));
  
  console.log(`Found ${segmentFiles.length} segment files to migrate`);
  
  let totalSegments = 0;
  let processedFiles = 0;
  
  for (const file of segmentFiles) {
    try {
      const activityId = parseInt(file.replace('.json', ''));
      const segmentsData = JSON.parse(fs.readFileSync(path.join(segmentsDir, file), 'utf8'));
      
      if (segmentsData.length === 0) {
        // Mark activity as having no segments
        await supabase
          .from('activities')
          .update({ segments_fetched: true })
          .eq('id', activityId);
        
        processedFiles++;
        continue;
      }
      
      const segmentsToInsert = segmentsData.map(segment => ({
        activity_id: activityId,
        segment_id: segment.segment.id,
        segment_name: segment.segment.name,
        segment_distance: segment.segment.distance,
        segment_elevation_high: segment.segment.elevation_high,
        segment_elevation_low: segment.segment.elevation_low,
        segment_grade: segment.segment.average_grade,
        segment_climb_category: segment.segment.climb_category,
        segment_city: segment.segment.city,
        segment_state: segment.segment.state,
        segment_country: segment.segment.country,
        segment_private: segment.segment.private,
        segment_hazardous: segment.segment.hazardous,
        segment_starred: segment.segment.starred,
        elapsed_time: segment.elapsed_time,
        moving_time: segment.moving_time,
        start_date: segment.start_date,
        start_date_local: segment.start_date_local,
        average_watts: segment.average_watts,
        max_watts: segment.max_watts,
        average_heartrate: segment.average_heartrate,
        max_heartrate: segment.max_heartrate,
        average_cadence: segment.average_cadence,
        max_cadence: segment.max_cadence,
        average_temp: segment.average_temp
      }));
      
      const { error } = await supabase
        .from('segments')
        .upsert(segmentsToInsert, { onConflict: 'activity_id,segment_id' });
      
      if (error) {
        console.error(`Error inserting segments for activity ${activityId}:`, error);
        continue;
      }
      
      // Mark activity as having segments fetched
      await supabase
        .from('activities')
        .update({ segments_fetched: true })
        .eq('id', activityId);
      
      totalSegments += segmentsData.length;
      processedFiles++;
      
      if (processedFiles % 100 === 0) {
        console.log(`Processed ${processedFiles}/${segmentFiles.length} files, ${totalSegments} segments`);
      }
      
    } catch (error) {
      console.error(`Error processing file ${file}:`, error);
    }
  }
  
  console.log('✅ Segments migration completed');
  console.log(`Total segments migrated: ${totalSegments}`);
  return totalSegments;
}

async function migrateTokens() {
  console.log('🔄 Migrating tokens...');
  
  const tokensFile = path.join(__dirname, '../data/tokens.json');
  
  if (!fs.existsSync(tokensFile)) {
    console.log('⚠️  No tokens file found. You can add tokens manually later.');
    return;
  }
  
  try {
    const tokensData = JSON.parse(fs.readFileSync(tokensFile, 'utf8'));
    
    const { error } = await supabase
      .from('tokens')
      .insert({
        access_token: tokensData.access_token,
        refresh_token: tokensData.refresh_token,
        expires_at: new Date(tokensData.expires_at * 1000).toISOString()
      });
    
    if (error) {
      console.error('Error inserting tokens:', error);
    } else {
      console.log('✅ Tokens migration completed');
    }
    
  } catch (error) {
    console.error('Error reading tokens file:', error);
  }
}

async function main() {
  console.log('🚀 Starting Supabase migration...\n');
  
  try {
    // Test connection
    const { data, error } = await supabase.from('activities').select('count').limit(1);
    if (error) {
      console.error('❌ Cannot connect to Supabase:', error);
      process.exit(1);
    }
    
    console.log('✅ Connected to Supabase successfully\n');
    
    // Migrate data
    const activitiesCount = await migrateActivities();
    const segmentsCount = await migrateSegments();
    await migrateTokens();
    
    console.log('\n🎉 Migration completed successfully!');
    console.log(`📊 Summary:`);
    console.log(`   - Activities: ${activitiesCount}`);
    console.log(`   - Segments: ${segmentsCount}`);
    console.log(`   - Tokens: Migrated (if available)`);
    
    console.log('\n📝 Next steps:');
    console.log('   1. Update your .env.local with Supabase credentials');
    console.log('   2. Update your components to use Supabase instead of local files');
    console.log('   3. Test the application');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

main(); 