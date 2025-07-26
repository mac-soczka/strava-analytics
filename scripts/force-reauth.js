const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

async function forceReauth() {
  console.log('🔐 Testing Re-authentication Process...')
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase environment variables')
    return
  }
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  
  try {
    // Step 1: Check current token status
    console.log('\n1️⃣ Checking current token status...')
    const { data: tokens, error: tokensError } = await supabase
      .from('strava_tokens')
      .select('*')
    
    if (tokensError) {
      console.error('❌ Failed to fetch tokens:', tokensError)
      return
    }
    
    console.log(`📊 Current tokens in database: ${tokens.length}`)
    tokens.forEach(token => {
      console.log(`  - User ${token.strava_id}: expires ${token.expires_at}`)
    })
    
    // Step 2: Remove all tokens to force re-authentication
    console.log('\n2️⃣ Removing all tokens to force re-authentication...')
    const { error: deleteError } = await supabase
      .from('strava_tokens')
      .delete()
      .neq('strava_id', 0) // Delete all tokens
    
    if (deleteError) {
      console.error('❌ Failed to delete tokens:', deleteError)
      return
    }
    
    console.log('✅ All tokens removed from database')
    
    // Step 3: Check app sessions
    console.log('\n3️⃣ Checking app sessions...')
    const { data: sessions, error: sessionsError } = await supabase
      .from('app_sessions')
      .select('*')
    
    if (sessionsError) {
      console.error('❌ Failed to fetch sessions:', sessionsError)
    } else {
      console.log(`📊 Current app sessions: ${sessions.length}`)
      if (sessions.length > 0) {
        console.log('🗑️  Removing app sessions...')
        const { error: sessionDeleteError } = await supabase
          .from('app_sessions')
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000')
        
        if (sessionDeleteError) {
          console.error('❌ Failed to delete sessions:', sessionDeleteError)
        } else {
          console.log('✅ All app sessions removed')
        }
      }
    }
    
    // Step 4: Instructions for re-authentication
    console.log('\n4️⃣ Re-authentication Instructions:')
    console.log('='.repeat(50))
    console.log('🚨 All tokens and sessions have been removed!')
    console.log('')
    console.log('📋 Next steps:')
    console.log('1. Visit: https://strava-heatmap-alpha.vercel.app/')
    console.log('2. You should now see the "Login with Strava" button')
    console.log('3. Click it to start the OAuth flow')
    console.log('4. Authorize the app in Strava')
    console.log('5. New tokens will be saved automatically')
    console.log('')
    console.log('🔍 To verify re-authentication worked:')
    console.log('- Run: node scripts/test-token-health.js')
    console.log('- Check that new tokens are present')
    console.log('')
    console.log('🎯 Expected behavior:')
    console.log('- App should redirect to Strava for authorization')
    console.log('- After authorization, you should be logged in')
    console.log('- New tokens should be saved in the database')
    
    console.log('\n🎉 Re-authentication test setup completed!')
    
  } catch (error) {
    console.error('❌ Test failed:', error)
  }
}

// Run the test
forceReauth() 