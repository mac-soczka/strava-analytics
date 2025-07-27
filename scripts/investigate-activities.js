const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function investigateActivities() {
  console.log('🔍 Investigating User Activities and Segment Status...\n')

  try {
    // 1. Get all users
    console.log('1. Getting all users...')
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('*')

    if (usersError) {
      console.error('❌ Error fetching users:', usersError)
      return
    }

    console.log(`✅ Found ${users.length} users`)
    users.forEach(user => {
      console.log(`   - ${user.firstname} ${user.lastname} (${user.strava_id})`)
    })

    // 2. Get total activities count
    console.log('\n2. Getting total activities count...')
    const { count: totalActivities, error: countError } = await supabase
      .from('activities')
      .select('*', { count: 'exact', head: true })

    if (countError) {
      console.error('❌ Error counting activities:', countError)
      return
    }

    console.log(`✅ Total activities: ${totalActivities}`)

    // 3. Get activities that need segments fetched
    console.log('\n3. Getting activities that need segments fetched...')
    const { data: activitiesNeedingSegments, error: segmentsError } = await supabase
      .from('activities')
      .select('*')
      .eq('segments_fetched', false)

    if (segmentsError) {
      console.error('❌ Error fetching activities needing segments:', segmentsError)
      return
    }

    console.log(`✅ Activities needing segments: ${activitiesNeedingSegments.length}`)

    // 4. Get activities with segments already fetched
    console.log('\n4. Getting activities with segments already fetched...')
    const { data: activitiesWithSegments, error: withSegmentsError } = await supabase
      .from('activities')
      .select('*')
      .eq('segments_fetched', true)

    if (withSegmentsError) {
      console.error('❌ Error fetching activities with segments:', withSegmentsError)
      return
    }

    console.log(`✅ Activities with segments fetched: ${activitiesWithSegments.length}`)

    // 5. Get activities with segments_fetched = null (unknown status)
    console.log('\n5. Getting activities with unknown segment status...')
    const { data: activitiesUnknownStatus, error: unknownError } = await supabase
      .from('activities')
      .select('*')
      .is('segments_fetched', null)

    if (unknownError) {
      console.error('❌ Error fetching activities with unknown status:', unknownError)
      return
    }

    console.log(`✅ Activities with unknown segment status: ${activitiesUnknownStatus.length}`)

    // 6. Sample of activities needing segments
    console.log('\n6. Sample of activities needing segments:')
    const sampleSize = Math.min(10, activitiesNeedingSegments.length)
    activitiesNeedingSegments.slice(0, sampleSize).forEach((activity, i) => {
      console.log(`   ${i + 1}. Activity ${activity.activity_id} - ${activity.name}`)
      console.log(`      Type: ${activity.type}, Date: ${activity.start_date}`)
      console.log(`      Distance: ${activity.distance}m, Duration: ${activity.moving_time}s`)
    })

    // 7. Summary statistics
    console.log('\n7. Summary Statistics:')
    console.log(`   Total Activities: ${totalActivities}`)
    console.log(`   Need Segments: ${activitiesNeedingSegments.length} (${((activitiesNeedingSegments.length / totalActivities) * 100).toFixed(1)}%)`)
    console.log(`   Have Segments: ${activitiesWithSegments.length} (${((activitiesWithSegments.length / totalActivities) * 100).toFixed(1)}%)`)
    console.log(`   Unknown Status: ${activitiesUnknownStatus.length} (${((activitiesUnknownStatus.length / totalActivities) * 100).toFixed(1)}%)`)

    // 8. Check segments table
    console.log('\n8. Checking segments table...')
    const { count: totalSegments, error: segmentsCountError } = await supabase
      .from('segments')
      .select('*', { count: 'exact', head: true })

    if (segmentsCountError) {
      console.error('❌ Error counting segments:', segmentsCountError)
      return
    }

    console.log(`✅ Total segments: ${totalSegments}`)

    // 9. Check segment efforts
    console.log('\n9. Checking segment efforts...')
    const { count: totalSegmentEfforts, error: effortsCountError } = await supabase
      .from('segment_efforts')
      .select('*', { count: 'exact', head: true })

    if (effortsCountError) {
      console.error('❌ Error counting segment efforts:', effortsCountError)
      return
    }

    console.log(`✅ Total segment efforts: ${totalSegmentEfforts}`)

    // 10. Recent activities analysis
    console.log('\n10. Recent activities analysis (last 10):')
    const { data: recentActivities, error: recentError } = await supabase
      .from('activities')
      .select('*')
      .order('start_date', { ascending: false })
      .limit(10)

    if (recentError) {
      console.error('❌ Error fetching recent activities:', recentError)
      return
    }

    recentActivities.forEach((activity, i) => {
      const segmentStatus = activity.segments_fetched === true ? '✅' : 
                           activity.segments_fetched === false ? '❌' : '❓'
      console.log(`   ${i + 1}. ${segmentStatus} Activity ${activity.activity_id} - ${activity.name}`)
      console.log(`      Date: ${activity.start_date}, Type: ${activity.type}`)
    })

  } catch (error) {
    console.error('❌ Error:', error)
  }
}

investigateActivities() 