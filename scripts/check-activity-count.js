const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function checkActivityCount() {
  console.log('🔍 Checking activity count in database...')
  
  try {
    // Get total count
    const { count, error: countError } = await supabase
      .from('activities')
      .select('*', { count: 'exact', head: true })
    
    if (countError) {
      console.error('❌ Error getting activity count:', countError)
      return
    }
    
    console.log(`📊 Total activities in database: ${count}`)
    
    // Get activities with segments_fetched status
    const { data: activities, error: activitiesError } = await supabase
      .from('activities')
      .select('id, activity_id, name, segments_fetched, start_date')
      .order('start_date', { ascending: false })
      .limit(10)
    
    if (activitiesError) {
      console.error('❌ Error fetching activities:', activitiesError)
      return
    }
    
    console.log('\n📋 Recent activities:')
    activities.forEach((activity, index) => {
      console.log(`${index + 1}. ${activity.name} (ID: ${activity.activity_id})`)
      console.log(`   Segments fetched: ${activity.segments_fetched ? '✅' : '❌'}`)
      console.log(`   Date: ${activity.start_date}`)
      console.log('')
    })
    
    // Count activities that need segments
    const { count: needSegments, error: needSegmentsError } = await supabase
      .from('activities')
      .select('*', { count: 'exact', head: true })
      .eq('segments_fetched', false)
    
    if (needSegmentsError) {
      console.error('❌ Error counting activities needing segments:', needSegmentsError)
      return
    }
    
    console.log(`📊 Activities needing segments: ${needSegments}`)
    console.log(`📊 Activities with segments: ${count - needSegments}`)
    
    // Check segments table
    const { count: segmentCount, error: segmentError } = await supabase
      .from('segment_efforts')
      .select('*', { count: 'exact', head: true })
    
    if (segmentError) {
      console.error('❌ Error counting segments:', segmentError)
      return
    }
    
    console.log(`📊 Total segment efforts: ${segmentCount}`)
    
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

checkActivityCount() 