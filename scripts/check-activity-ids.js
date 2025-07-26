const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

async function checkActivityIds() {
  console.log('🔍 Checking Activity IDs in Database...')
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase environment variables')
    return
  }
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  
  try {
    // Get all activities
    const { data: activities, error } = await supabase
      .from('activities')
      .select('id, activity_id, name, strava_id')
      .order('created_at', { ascending: false })
      .limit(20)
    
    if (error) {
      console.error('❌ Failed to fetch activities:', error)
      return
    }
    
    console.log(`📊 Found ${activities.length} activities`)
    console.log('\n🔍 Activity ID Analysis:')
    console.log('='.repeat(60))
    
    let validIds = 0
    let invalidIds = 0
    
    activities.forEach((activity, index) => {
      const activityId = activity.activity_id
      const isNumeric = typeof activityId === 'number' && !isNaN(activityId)
      const isUUID = typeof activityId === 'string' && activityId.includes('-')
      
      console.log(`${index + 1}. Activity: ${activity.name}`)
      console.log(`   Database ID (UUID): ${activity.id}`)
      console.log(`   Activity ID: ${activityId} (${typeof activityId})`)
      console.log(`   Strava ID: ${activity.strava_id}`)
      console.log(`   Status: ${isNumeric ? '✅ Valid (numeric)' : isUUID ? '❌ Invalid (UUID)' : '❓ Unknown'}`)
      console.log('')
      
      if (isNumeric) {
        validIds++
      } else if (isUUID) {
        invalidIds++
      }
    })
    
    console.log('📋 Summary:')
    console.log(`✅ Valid numeric IDs: ${validIds}`)
    console.log(`❌ Invalid UUID IDs: ${invalidIds}`)
    console.log(`📊 Total checked: ${activities.length}`)
    
    if (invalidIds > 0) {
      console.log('\n🚨 PROBLEM DETECTED!')
      console.log('Some activities have UUID activity_ids instead of numeric Strava IDs.')
      console.log('This is causing the "invalid input syntax for type bigint" errors.')
      console.log('\n🔧 Solution:')
      console.log('1. Check the activity creation code')
      console.log('2. Ensure activity_id is set to the numeric Strava ID')
      console.log('3. Clean up invalid records if needed')
    } else {
      console.log('\n✅ All activity IDs look valid!')
    }
    
  } catch (error) {
    console.error('❌ Check failed:', error)
  }
}

// Run the check
checkActivityIds() 