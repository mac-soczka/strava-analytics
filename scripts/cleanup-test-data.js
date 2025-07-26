const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function cleanupTestData() {
  console.log('🧹 Cleaning up all test data...')
  
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
    const testUsers = users.filter(user => {
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
    
    console.log(`\n🎯 Identified ${testUsers.length} test users to remove:`)
    testUsers.forEach(user => {
      console.log(`   - ${user.firstname} ${user.lastname} (${user.strava_id})`)
    })
    
    if (testUsers.length === 0) {
      console.log('✅ No test users found to remove')
      return
    }
    
    const testStravaIds = testUsers.map(user => user.strava_id)
    
    // Clean up related data in the correct order (respecting foreign key constraints)
    console.log('\n🗑️  Cleaning up related data...')
    
    // 1. Delete crawler logs for test users
    console.log('   📝 Deleting crawler logs...')
    const { error: logsError } = await supabase
      .from('strava_crawler_logs')
      .delete()
      .in('user_id', testStravaIds)
    
    if (logsError) {
      console.error('❌ Error deleting crawler logs:', logsError)
    } else {
      console.log('   ✅ Crawler logs deleted')
    }
    
    // 2. Delete activities for test users
    console.log('   🏃 Deleting activities...')
    const { error: activitiesError } = await supabase
      .from('activities')
      .delete()
      .in('strava_id', testStravaIds)
    
    if (activitiesError) {
      console.error('❌ Error deleting activities:', activitiesError)
    } else {
      console.log('   ✅ Activities deleted')
    }
    
    // 3. Delete segments for test users
    console.log('   🏁 Deleting segments...')
    const { error: segmentsError } = await supabase
      .from('segments')
      .delete()
      .in('strava_id', testStravaIds)
    
    if (segmentsError) {
      console.error('❌ Error deleting segments:', segmentsError)
    } else {
      console.log('   ✅ Segments deleted')
    }
    
    // 4. Delete tokens for test users
    console.log('   🔑 Deleting tokens...')
    const { error: tokensError } = await supabase
      .from('strava_tokens')
      .delete()
      .in('strava_id', testStravaIds)
    
    if (tokensError) {
      console.error('❌ Error deleting tokens:', tokensError)
    } else {
      console.log('   ✅ Tokens deleted')
    }
    
    // 5. Delete app sessions for test users
    console.log('   🍪 Deleting app sessions...')
    const { error: sessionsError } = await supabase
      .from('app_sessions')
      .delete()
      .in('strava_id', testStravaIds)
    
    if (sessionsError) {
      console.error('❌ Error deleting app sessions:', sessionsError)
    } else {
      console.log('   ✅ App sessions deleted')
    }
    
    // 6. Finally, delete the test users
    console.log('   👤 Deleting test users...')
    const { error: deleteUsersError } = await supabase
      .from('users')
      .delete()
      .in('strava_id', testStravaIds)
    
    if (deleteUsersError) {
      console.error('❌ Error deleting test users:', deleteUsersError)
      return
    }
    
    console.log('   ✅ Test users deleted')
    
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
    
    // Check other tables
    const { data: remainingTokens } = await supabase.from('strava_tokens').select('*')
    const { data: remainingSessions } = await supabase.from('app_sessions').select('*')
    const { data: remainingActivities } = await supabase.from('activities').select('*')
    
    console.log(`\n📊 Database status after cleanup:`)
    console.log(`   Users: ${remainingUsers.length}`)
    console.log(`   Tokens: ${remainingTokens?.length || 0}`)
    console.log(`   Sessions: ${remainingSessions?.length || 0}`)
    console.log(`   Activities: ${remainingActivities?.length || 0}`)
    
    console.log('\n🎉 Test data cleanup completed!')
    
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

cleanupTestData() 