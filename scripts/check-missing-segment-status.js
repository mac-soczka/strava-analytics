const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function checkMissingSegmentStatus() {
  console.log('🔍 Checking for Activities with Missing Segment Status...\n')

  try {
    // Check for activities with segments_fetched = null
    console.log('1. Checking activities with segments_fetched = null...')
    const { data: nullStatusActivities, error: nullError } = await supabase
      .from('activities')
      .select('*')
      .is('segments_fetched', null)

    if (nullError) {
      console.error('❌ Error fetching null status activities:', nullError)
      return
    }

    console.log(`✅ Found ${nullStatusActivities.length} activities with null segments_fetched status`)

    if (nullStatusActivities.length > 0) {
      console.log('\nSample of activities with null status:')
      nullStatusActivities.slice(0, 5).forEach((activity, i) => {
        console.log(`   ${i + 1}. Activity ${activity.activity_id} - ${activity.name}`)
        console.log(`      Type: ${activity.type}, Date: ${activity.start_date}`)
        console.log(`      Distance: ${activity.distance}m, Duration: ${activity.moving_time}s`)
      })
    }

    // Check for activities with segments_fetched = false but have segments
    console.log('\n2. Checking activities with segments_fetched = false...')
    const { data: falseStatusActivities, error: falseError } = await supabase
      .from('activities')
      .select('*')
      .eq('segments_fetched', false)

    if (falseError) {
      console.error('❌ Error fetching false status activities:', falseError)
      return
    }

    console.log(`✅ Found ${falseStatusActivities.length} activities with segments_fetched = false`)

    // Check for activities with segments_fetched = true
    console.log('\n3. Checking activities with segments_fetched = true...')
    const { data: trueStatusActivities, error: trueError } = await supabase
      .from('activities')
      .select('*')
      .eq('segments_fetched', true)

    if (trueError) {
      console.error('❌ Error fetching true status activities:', trueError)
      return
    }

    console.log(`✅ Found ${trueStatusActivities.length} activities with segments_fetched = true`)

    // Check for activities with missing polyline data
    console.log('\n4. Checking activities with missing polyline data...')
    const { data: missingPolylineActivities, error: polylineError } = await supabase
      .from('activities')
      .select('*')
      .is('polyline', null)

    if (polylineError) {
      console.error('❌ Error fetching activities with missing polyline:', polylineError)
      return
    }

    console.log(`✅ Found ${missingPolylineActivities.length} activities with missing polyline data`)

    // Check for activities with missing strava_url
    console.log('\n5. Checking activities with missing strava_url...')
    const { data: missingUrlActivities, error: urlError } = await supabase
      .from('activities')
      .select('*')
      .is('strava_url', null)

    if (urlError) {
      console.error('❌ Error fetching activities with missing strava_url:', urlError)
      return
    }

    console.log(`✅ Found ${missingUrlActivities.length} activities with missing strava_url`)

    // Check for activities with 0 distance or duration
    console.log('\n6. Checking activities with 0 distance or duration...')
    const { data: zeroDataActivities, error: zeroError } = await supabase
      .from('activities')
      .select('*')
      .or('distance.eq.0,moving_time.eq.0')

    if (zeroError) {
      console.error('❌ Error fetching activities with zero data:', zeroError)
      return
    }

    console.log(`✅ Found ${zeroDataActivities.length} activities with 0 distance or duration`)

    if (zeroDataActivities.length > 0) {
      console.log('\nSample of activities with zero data:')
      zeroDataActivities.slice(0, 5).forEach((activity, i) => {
        console.log(`   ${i + 1}. Activity ${activity.activity_id} - ${activity.name}`)
        console.log(`      Type: ${activity.type}, Date: ${activity.start_date}`)
        console.log(`      Distance: ${activity.distance}m, Duration: ${activity.moving_time}s`)
        console.log(`      Segments fetched: ${activity.segments_fetched}`)
      })
    }

    // Summary
    console.log('\n7. Data Quality Summary:')
    console.log(`   Total activities: ${nullStatusActivities.length + falseStatusActivities.length + trueStatusActivities.length}`)
    console.log(`   Activities with null segments_fetched: ${nullStatusActivities.length}`)
    console.log(`   Activities with segments_fetched = false: ${falseStatusActivities.length}`)
    console.log(`   Activities with segments_fetched = true: ${trueStatusActivities.length}`)
    console.log(`   Activities missing polyline: ${missingPolylineActivities.length}`)
    console.log(`   Activities missing strava_url: ${missingUrlActivities.length}`)
    console.log(`   Activities with zero distance/duration: ${zeroDataActivities.length}`)

    // Check if there are any activities that should be updated
    console.log('\n8. Recommendations:')
    if (nullStatusActivities.length > 0) {
      console.log(`   ⚠️  ${nullStatusActivities.length} activities have null segments_fetched status - these should be updated`)
    }
    if (missingPolylineActivities.length > 0) {
      console.log(`   ⚠️  ${missingPolylineActivities.length} activities are missing polyline data - consider re-fetching`)
    }
    if (missingUrlActivities.length > 0) {
      console.log(`   ⚠️  ${missingUrlActivities.length} activities are missing strava_url - consider re-fetching`)
    }
    if (zeroDataActivities.length > 0) {
      console.log(`   ⚠️  ${zeroDataActivities.length} activities have zero distance/duration - these may be invalid`)
    }

  } catch (error) {
    console.error('❌ Error:', error)
  }
}

checkMissingSegmentStatus() 