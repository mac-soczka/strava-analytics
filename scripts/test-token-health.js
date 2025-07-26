const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

async function testTokenHealth() {
  console.log('🔍 Testing Token Health Service...')
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase environment variables')
    return
  }
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  
  try {
    // Test 1: Check token health via API
    console.log('\n1️⃣ Checking token health via API...')
    const response = await fetch('http://localhost:3000/api/strava/token-health')
    const data = await response.json()
    
    if (data.success) {
      console.log('✅ Token health check successful')
      console.log('📊 Summary:', data.summary)
      
      if (data.summary.needs_reauthentication > 0) {
        console.log('\n🚨 Users needing re-authentication:')
        data.users
          .filter(user => user.needs_reauthentication)
          .forEach(user => {
            console.log(`  - ${user.user_name} (${user.strava_id})`)
            console.log(`    Status: ${user.token_status}`)
            console.log(`    Error: ${user.error_message || 'No tokens'}`)
            console.log('')
          })
      } else {
        console.log('✅ All users have valid tokens!')
      }
    } else {
      console.error('❌ Token health check failed:', data.error)
    }
    
    // Test 2: Check current tokens in database
    console.log('\n2️⃣ Checking current tokens in database...')
    const { data: tokens, error: tokensError } = await supabase
      .from('strava_tokens')
      .select('*')
    
    if (tokensError) {
      console.error('❌ Failed to fetch tokens:', tokensError)
    } else {
      console.log(`📊 Total tokens in database: ${tokens.length}`)
      
      // Check for expired tokens
      const now = new Date()
      const expiredTokens = tokens.filter(token => {
        const expiresAt = new Date(token.expires_at)
        return expiresAt <= now
      })
      
      console.log(`⏰ Expired tokens: ${expiredTokens.length}`)
      
      if (expiredTokens.length > 0) {
        console.log('\n⚠️  Expired tokens:')
        expiredTokens.forEach(token => {
          console.log(`  - User ${token.strava_id}: expires ${token.expires_at}`)
        })
      }
    }
    
    // Test 3: Check users without tokens
    console.log('\n3️⃣ Checking users without tokens...')
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('strava_id, firstname, lastname')
    
    if (usersError) {
      console.error('❌ Failed to fetch users:', usersError)
    } else {
      const userIds = users.map(u => u.strava_id)
      const tokenUserIds = tokens.map(t => t.strava_id)
      const usersWithoutTokens = userIds.filter(id => !tokenUserIds.includes(id))
      
      console.log(`📊 Users without tokens: ${usersWithoutTokens.length}`)
      
      if (usersWithoutTokens.length > 0) {
        console.log('\n🚫 Users without tokens:')
        usersWithoutTokens.forEach(userId => {
          const user = users.find(u => u.strava_id === userId)
          console.log(`  - ${user?.firstname} ${user?.lastname} (${userId})`)
        })
      }
    }
    
    // Test 4: Provide re-authentication guidance
    console.log('\n4️⃣ Re-authentication Guidance:')
    console.log('='.repeat(50))
    
    if (data.summary.needs_reauthentication > 0) {
      console.log('🚨 Users need to re-authenticate with Strava:')
      console.log('')
      console.log('📋 Steps for users to re-authenticate:')
      console.log('1. Visit the app: https://strava-heatmap-alpha.vercel.app/')
      console.log('2. Click "Login with Strava"')
      console.log('3. Authorize the app again')
      console.log('4. New tokens will be saved automatically')
      console.log('')
      console.log('🔧 Alternative: Manual cleanup')
      console.log('- Run: node scripts/cleanup-invalid-tokens.js')
      console.log('- This will remove invalid tokens from the database')
      console.log('- Users will need to re-authenticate on next login')
    } else {
      console.log('✅ All tokens are healthy! No re-authentication needed.')
    }
    
    console.log('\n🎉 Token health test completed!')
    
  } catch (error) {
    console.error('❌ Test failed:', error)
  }
}

// Run the test
testTokenHealth() 