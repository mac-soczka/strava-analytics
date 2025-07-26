const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function checkSegmentEfforts() {
  console.log('🔍 Checking segment_efforts table directly...')
  
  try {
    // Get all segment efforts
    const { data: efforts, error } = await supabase
      .from('segment_efforts')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('❌ Error fetching segment efforts:', error)
      return
    }
    
    console.log(`📊 Total segment efforts in database: ${efforts.length}`)
    
    if (efforts.length > 0) {
      console.log('\n📋 Recent segment efforts:')
      efforts.slice(0, 10).forEach((effort, index) => {
        console.log(`${index + 1}. Activity ${effort.activity_id} - Segment ${effort.segment_id}`)
        console.log(`   Effort ID: ${effort.effort_id}`)
        console.log(`   Created: ${effort.created_at}`)
        console.log('')
      })
      
      // Check for the specific segment that's causing the error
      const problematicSegment = efforts.filter(e => e.segment_id === 21030395)
      if (problematicSegment.length > 0) {
        console.log(`⚠️  Found ${problematicSegment.length} efforts for segment 21030395:`)
        problematicSegment.forEach(effort => {
          console.log(`   Activity ${effort.activity_id} - Effort ${effort.effort_id}`)
        })
      }
    } else {
      console.log('✅ No segment efforts found')
      
      // Try to check for the specific problematic combination
      console.log('\n🔍 Checking for specific problematic combination...')
      const { data: specificEfforts, error: specificError } = await supabase
        .from('segment_efforts')
        .select('*')
        .eq('activity_id', 15214271415)
        .eq('segment_id', 21030395)
      
      if (specificError) {
        console.log('❌ Error checking specific combination:', specificError.message)
      } else if (specificEfforts && specificEfforts.length > 0) {
        console.log(`⚠️  Found ${specificEfforts.length} problematic records:`)
        specificEfforts.forEach(effort => {
          console.log('   ', effort)
        })
      } else {
        console.log('✅ No record found for activity_id=15214271415, segment_id=21030395')
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

checkSegmentEfforts() 