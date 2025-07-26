const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function cleanupTestUsers() {
  console.log('🧹 Cleaning up test users...')
  
  try {
    // First, let's see what users we have
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (usersError) {
      console.error('❌ Error fetching users:', usersError)
      return
    }
    
    console.log(`📊 Current users: ${users.length}`)
    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.firstname} ${user.lastname} (${user.strava_id})`)
    })
    
    // Identify test users (users with test names or fake data)
    const testUserIds = users
      .filter(user => {
        const isTestUser = 
          user.firstname === 'Test User' ||
          user.firstname === 'Complete Flow' ||
          user.firstname === 'Updated Name' ||
          user.strava_id === 123456 ||
          user.strava_id === 846358 ||
          user.strava_id === 116246 ||
          user.strava_id === 434058 ||
          user.strava_id === 354519 ||
          user.strava_id === 474407
        return isTestUser
      })
      .map(user => user.id)
    
    console.log(`\n🎯 Identified ${testUserIds.length} test users to remove:`)
    testUserIds.forEach(id => {
      const user = users.find(u => u.id === id)
      console.log(`   - ${user.firstname} ${user.lastname} (${user.strava_id})`)
    })
    
    if (testUserIds.length === 0) {
      console.log('✅ No test users found to remove')
      return
    }
    
    // Remove test users
    console.log('\n🗑️  Removing test users...')
    const { error: deleteUsersError } = await supabase
      .from('users')
      .delete()
      .in('id', testUserIds)
    
    if (deleteUsersError) {
      console.error('❌ Error deleting test users:', deleteUsersError)
      return
    }
    
    console.log('✅ Test users removed successfully')
    
    // Verify cleanup
    const { data: remainingUsers, error: remainingError } = await supabase
      .from('users')
      .select('*')
    
    if (remainingError) {
      console.error('❌ Error fetching remaining users:', remainingError)
      return
    }
    
    console.log(`\n📊 Remaining users: ${remainingUsers.length}`)
    remainingUsers.forEach((user, index) => {
      console.log(`${index + 1}. ${user.firstname} ${user.lastname} (${user.strava_id})`)
    })
    
    console.log('\n🎉 Test user cleanup completed!')
    
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

cleanupTestUsers() 