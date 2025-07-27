const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function checkSegmentCompletion() {
  console.log('🔍 Analyzing segment and segment effort completion...\n')

  try {
    // 1. Check activities with segments_fetched column
    console.log('📊 1. Activities Segment Fetching Status:')
    console.log('='.repeat(50))
    
    const { data: activitiesWithSegments, error: activitiesError } = await supabase
      .from('activities')
      .select('activity_id, name, segments_fetched, strava_id')
      .not('segments_fetched', 'is', null)

    if (activitiesError) {
      console.error('Error fetching activities:', activitiesError)
      return
    }

    const totalActivities = activitiesWithSegments?.length || 0
    const activitiesWithSegmentsFetched = activitiesWithSegments?.filter(a => a.segments_fetched === true).length || 0
    const activitiesWithoutSegmentsFetched = activitiesWithSegments?.filter(a => a.segments_fetched === false).length || 0

    console.log(`Total activities with segments_fetched column: ${totalActivities}`)
    console.log(`✅ Activities with segments fetched: ${activitiesWithSegmentsFetched}`)
    console.log(`❌ Activities without segments fetched: ${activitiesWithoutSegmentsFetched}`)
    console.log(`📈 Completion rate: ${((activitiesWithSegmentsFetched / totalActivities) * 100).toFixed(1)}%`)

    // 2. Check segments with segment efforts
    console.log('\n📊 2. Segments Segment Effort Fetching Status:')
    console.log('='.repeat(50))
    
    // Get all segments
    const { data: allSegments, error: segmentsError } = await supabase
      .from('segments')
      .select('segment_id, name')

    if (segmentsError) {
      console.error('Error fetching segments:', segmentsError)
      return
    }

    const totalSegments = allSegments?.length || 0
    console.log(`Total segments in database: ${totalSegments}`)

    // Get segments that have segment efforts
    const { data: segmentsWithEfforts, error: effortsError } = await supabase
      .from('segment_efforts')
      .select('segment_id')
      .then(result => {
        if (result.error) throw result.error
        // Get unique segment IDs that have efforts
        const uniqueSegmentIds = [...new Set(result.data?.map(e => e.segment_id) || [])]
        return { data: uniqueSegmentIds, error: null }
      })

    if (effortsError) {
      console.error('Error fetching segment efforts:', effortsError)
      return
    }

    const segmentsWithEffortsCount = segmentsWithEfforts?.length || 0
    const segmentsWithoutEffortsCount = totalSegments - segmentsWithEffortsCount

    console.log(`✅ Segments with efforts: ${segmentsWithEffortsCount}`)
    console.log(`❌ Segments without efforts: ${segmentsWithoutEffortsCount}`)
    console.log(`📈 Completion rate: ${((segmentsWithEffortsCount / totalSegments) * 100).toFixed(1)}%`)

    // 3. Detailed breakdown by user
    console.log('\n📊 3. Breakdown by User:')
    console.log('='.repeat(50))
    
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('strava_id, firstname, lastname')

    if (usersError) {
      console.error('Error fetching users:', usersError)
      return
    }

    for (const user of users || []) {
      // Get user's activities
      const { data: userActivities } = await supabase
        .from('activities')
        .select('activity_id, segments_fetched')
        .eq('strava_id', user.strava_id)

      const userTotalActivities = userActivities?.length || 0
      const userActivitiesWithSegments = userActivities?.filter(a => a.segments_fetched === true).length || 0
      const userActivitiesWithoutSegments = userActivities?.filter(a => a.segments_fetched === false).length || 0

      // Get user's segments (via activities)
      const { data: userSegmentEfforts } = await supabase
        .from('segment_efforts')
        .select('segment_id')
        .in('activity_id', userActivities?.map(a => a.activity_id) || [])

      const userUniqueSegments = [...new Set(userSegmentEfforts?.map(e => e.segment_id) || [])]
      const userSegmentsWithEfforts = userUniqueSegments.length

      console.log(`\n👤 ${user.firstname} ${user.lastname} (${user.strava_id}):`)
      console.log(`   Activities: ${userActivitiesWithSegments}/${userTotalActivities} with segments (${userTotalActivities > 0 ? ((userActivitiesWithSegments / userTotalActivities) * 100).toFixed(1) : 0}%)`)
      console.log(`   Segments with efforts: ${userSegmentsWithEfforts}`)
    }

    // 4. Sample of incomplete activities
    console.log('\n📊 4. Sample Incomplete Activities:')
    console.log('='.repeat(50))
    
    const { data: incompleteActivities } = await supabase
      .from('activities')
      .select('activity_id, name, start_date, segments_fetched')
      .eq('segments_fetched', false)
      .limit(10)

    if (incompleteActivities && incompleteActivities.length > 0) {
      console.log('Sample activities without segments fetched:')
      incompleteActivities.forEach(activity => {
        console.log(`   - ${activity.name} (ID: ${activity.activity_id}, Date: ${activity.start_date})`)
      })
    } else {
      console.log('✅ All activities have segments fetched!')
    }

    // 5. Sample of segments without efforts
    console.log('\n📊 5. Sample Segments Without Efforts:')
    console.log('='.repeat(50))
    
    const { data: segmentsWithoutEfforts } = await supabase
      .rpc('get_segments_without_efforts', { limit_count: 10 })

    if (segmentsWithoutEfforts && segmentsWithoutEfforts.length > 0) {
      console.log('Sample segments without efforts:')
      segmentsWithoutEfforts.forEach(segment => {
        console.log(`   - ${segment.name} (ID: ${segment.segment_id})`)
      })
    } else {
      console.log('✅ All segments have efforts!')
    }

  } catch (error) {
    console.error('❌ Error in analysis:', error)
  }
}

// Run the analysis
checkSegmentCompletion()
  .then(() => {
    console.log('\n✅ Analysis complete!')
    process.exit(0)
  })
  .catch(error => {
    console.error('❌ Analysis failed:', error)
    process.exit(1)
  }) 