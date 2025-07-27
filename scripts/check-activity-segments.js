const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function analyzeActivitySegments() {
  console.log('🔍 Analyzing activity types and segment distribution...')
  
  try {
    // Get all activities with their segment counts
    const { data: activities, error } = await supabase
      .from('activities')
      .select(`
        activity_id,
        name,
        type,
        distance,
        start_date,
        segments_fetched
      `)
      .order('start_date', { ascending: false })

    if (error) {
      console.error('❌ Error fetching activities:', error)
      return
    }

    // Group by activity type
    const typeStats = {}
    const segmentCounts = { '0': 0, '1-10': 0, '11-50': 0, '51-100': 0, '100+': 0 }

    activities.forEach(activity => {
      const type = activity.type || 'Unknown'
      if (!typeStats[type]) {
        typeStats[type] = {
          count: 0,
          totalDistance: 0,
          withSegments: 0,
          withoutSegments: 0
        }
      }

      typeStats[type].count++
      typeStats[type].totalDistance += activity.distance || 0

      // Get segment count for this activity
      const segmentCount = getSegmentCountForActivity(activity.activity_id)
      
      if (segmentCount > 0) {
        typeStats[type].withSegments++
      } else {
        typeStats[type].withoutSegments++
      }

      // Categorize by segment count
      if (segmentCount === 0) segmentCounts['0']++
      else if (segmentCount <= 10) segmentCounts['1-10']++
      else if (segmentCount <= 50) segmentCounts['11-50']++
      else if (segmentCount <= 100) segmentCounts['51-100']++
      else segmentCounts['100+']++
    })

    console.log('\n📊 Activity Type Analysis:')
    console.log('='.repeat(60))
    
    Object.entries(typeStats).forEach(([type, stats]) => {
      const avgDistance = stats.count > 0 ? Math.round(stats.totalDistance / stats.count / 1000 * 100) / 100 : 0
      const segmentPercentage = stats.count > 0 ? Math.round((stats.withSegments / stats.count) * 100) : 0
      
      console.log(`${type.padEnd(15)} | ${stats.count.toString().padStart(4)} activities | ${avgDistance}km avg | ${segmentPercentage}% have segments`)
    })

    console.log('\n📈 Segment Distribution:')
    console.log('='.repeat(40))
    
    Object.entries(segmentCounts).forEach(([range, count]) => {
      const percentage = activities.length > 0 ? Math.round((count / activities.length) * 100) : 0
      console.log(`${range.padEnd(8)} segments: ${count.toString().padStart(4)} activities (${percentage}%)`)
    })

    // Show some examples of activities with 0 segments
    console.log('\n🔍 Sample Activities with 0 Segments:')
    console.log('='.repeat(50))
    
    const zeroSegmentActivities = activities.filter(a => !a.segments_fetched).slice(0, 10)
    zeroSegmentActivities.forEach(activity => {
      console.log(`${activity.type.padEnd(12)} | ${activity.name.substring(0, 40).padEnd(40)} | ${Math.round((activity.distance || 0) / 1000 * 100) / 100}km`)
    })

    // Show some examples of activities with many segments
    console.log('\n🏆 Sample Activities with Many Segments:')
    console.log('='.repeat(50))
    
    const highSegmentActivities = activities.filter(a => a.segments_fetched).slice(0, 10)
    highSegmentActivities.forEach(activity => {
      console.log(`${activity.type.padEnd(12)} | ${activity.name.substring(0, 40).padEnd(40)} | ${Math.round((activity.distance || 0) / 1000 * 100) / 100}km`)
    })

  } catch (error) {
    console.error('❌ Analysis failed:', error)
  }
}

async function getSegmentCountForActivity(activityId) {
  try {
    const { count, error } = await supabase
      .from('segment_efforts')
      .select('*', { count: 'exact', head: true })
      .eq('activity_id', activityId)
    
    if (error) {
      console.error(`Error getting segments for activity ${activityId}:`, error)
      return 0
    }
    
    return count || 0
  } catch (error) {
    return 0
  }
}

analyzeActivitySegments() 