const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function clearSegmentEfforts() {
  console.log('🧹 Clearing all segment efforts...')
  
  try {
    // First, let's see what we have
    const { count: beforeCount } = await supabase
      .from('segment_efforts')
      .select('*', { count: 'exact', head: true })
    
    console.log(`📊 Segment efforts before clearing: ${beforeCount}`)
    
    if (beforeCount > 0) {
      // Clear all segment efforts
      const { error: deleteError } = await supabase
        .from('segment_efforts')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all (using a UUID that doesn't exist)
      
      if (deleteError) {
        console.error('❌ Error clearing segment efforts:', deleteError)
        return
      }
      
      console.log('✅ Cleared all segment efforts')
    } else {
      console.log('✅ No segment efforts to clear')
    }
    
    // Verify the table is empty
    const { count: afterCount } = await supabase
      .from('segment_efforts')
      .select('*', { count: 'exact', head: true })
    
    console.log(`📊 Segment efforts after clearing: ${afterCount}`)
    
    if (afterCount === 0) {
      console.log('🎉 Segment efforts table is now empty and ready for fresh data!')
    } else {
      console.log('⚠️  Some segment efforts still remain')
    }
    
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

clearSegmentEfforts() 