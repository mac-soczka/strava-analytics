const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function checkUsers() {
  console.log('🔍 Checking all users in database...')
  
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('❌ Error fetching users:', error)
      return
    }
    
    console.log(`📊 Total users: ${users.length}`)
    
    if (users.length > 0) {
      console.log('\n📋 User details:')
      users.forEach((user, index) => {
        console.log(`${index + 1}. ${user.firstname} ${user.lastname}`)
        console.log(`   Strava ID: ${user.strava_id}`)
        console.log(`   Created: ${user.created_at}`)
        console.log(`   City: ${user.city || 'N/A'}`)
        console.log(`   Country: ${user.country || 'N/A'}`)
        console.log('')
      })
    } else {
      console.log('✅ No users found')
    }
    
    // Check for duplicate Strava IDs
    const stravaIds = users.map(u => u.strava_id)
    const uniqueIds = [...new Set(stravaIds)]
    
    if (stravaIds.length !== uniqueIds.length) {
      console.log('\n⚠️  Duplicate Strava IDs found:')
      const duplicates = stravaIds.filter((id, index) => stravaIds.indexOf(id) !== index)
      duplicates.forEach(id => {
        const duplicateUsers = users.filter(u => u.strava_id === id)
        console.log(`   Strava ID ${id}: ${duplicateUsers.length} users`)
        duplicateUsers.forEach(u => {
          console.log(`     - ${u.firstname} ${u.lastname} (ID: ${u.id})`)
        })
      })
    } else {
      console.log('\n✅ No duplicate Strava IDs found')
    }
    
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

checkUsers() 