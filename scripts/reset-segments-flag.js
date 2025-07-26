const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function resetSegmentsFlag() {
  console.log('🔄 Resetting segments_fetched flag for all activities...')
  
  try {
    // Reset all activities to need segments
    const { error: updateError } = await supabase
      .from('activities')
      .update({ segments_fetched: false })
      .eq('strava_id', 42137242)
    
    if (updateError) {
      console.error('❌ Error resetting segments flag:', updateError)
      return
    }
    
    console.log('✅ Reset segments_fetched flag for all activities')
    
    // Verify the change
    const { count: needSegments } = await supabase
      .from('activities')
      .select('*', { count: 'exact', head: true })
      .eq('segments_fetched', false)
    
    const { count: totalActivities } = await supabase
      .from('activities')
      .select('*', { count: 'exact', head: true })
    
    console.log(`📊 Activities needing segments: ${needSegments}`)
    console.log(`📊 Total activities: ${totalActivities}`)
    
    // Clear existing segment efforts
    const { error: deleteError } = await supabase
      .from('segment_efforts')
      .delete()
      .neq('id', 0) // Delete all
    
    if (deleteError) {
      console.error('❌ Error clearing segment efforts:', deleteError)
    } else {
      console.log('✅ Cleared all existing segment efforts')
    }
    
    console.log('🎉 Ready to fetch segments for all activities!')
    
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

resetSegmentsFlag() 