const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function monitorProgress() {
  console.log('📊 Monitoring Progress...')
  console.log('=' .repeat(50))
  
  try {
    // Get activity counts
    const { count: totalActivities } = await supabase
      .from('activities')
      .select('*', { count: 'exact', head: true })
    
    const { count: needSegments } = await supabase
      .from('activities')
      .select('*', { count: 'exact', head: true })
      .eq('segments_fetched', false)
    
    const { count: haveSegments } = await supabase
      .from('activities')
      .select('*', { count: 'exact', head: true })
      .eq('segments_fetched', true)
    
    // Get segment counts
    const { count: totalSegments } = await supabase
      .from('segment_efforts')
      .select('*', { count: 'exact', head: true })
    
    // Calculate progress
    const segmentProgress = totalActivities > 0 ? ((totalActivities - needSegments) / totalActivities * 100).toFixed(1) : 0
    
    console.log(`📈 ACTIVITIES:`)
    console.log(`   Total: ${totalActivities}`)
    console.log(`   Need segments: ${needSegments}`)
    console.log(`   Have segments: ${haveSegments}`)
    console.log(`   Progress: ${segmentProgress}%`)
    console.log('')
    
    console.log(`🏁 SEGMENTS:`)
    console.log(`   Total segment efforts: ${totalSegments}`)
    console.log('')
    
    // Get recent activities with segment status
    const { data: recentActivities } = await supabase
      .from('activities')
      .select('activity_id, name, segments_fetched, start_date')
      .order('start_date', { ascending: false })
      .limit(5)
    
    console.log(`📋 RECENT ACTIVITIES:`)
    recentActivities?.forEach((activity, index) => {
      const status = activity.segments_fetched ? '✅' : '❌'
      const date = new Date(activity.start_date).toLocaleDateString()
      console.log(`   ${index + 1}. ${activity.name} (${activity.activity_id})`)
      console.log(`      Segments: ${status} | Date: ${date}`)
    })
    console.log('')
    
    // Get segment statistics
    if (totalSegments > 0) {
      const { data: segmentStats } = await supabase
        .from('segment_efforts')
        .select('segment_id')
        .limit(1000)
      
      if (segmentStats) {
        const uniqueSegments = new Set(segmentStats.map(s => s.segment_id)).size
        console.log(`📊 SEGMENT STATISTICS:`)
        console.log(`   Total efforts: ${totalSegments}`)
        console.log(`   Unique segments: ${uniqueSegments}`)
        console.log(`   Average efforts per segment: ${(totalSegments / uniqueSegments).toFixed(1)}`)
      }
    }
    
    console.log('=' .repeat(50))
    
    if (needSegments > 0) {
      console.log(`⏳ Still processing: ${needSegments} activities need segments`)
      console.log(`🔄 Segment fetching script is running in background...`)
    } else {
      console.log(`🎉 All activities processed!`)
    }
    
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

monitorProgress() 