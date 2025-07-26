const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function checkTokens() {
  console.log('🔍 Checking tokens in database...')
  
  // Check all tokens
  const { data: allTokens, error: allError } = await supabase
    .from('strava_tokens')
    .select('*')
  
  if (allError) {
    console.error('❌ Error fetching all tokens:', allError)
    return
  }
  
  console.log(`📊 Total tokens found: ${allTokens?.length || 0}`)
  
  if (allTokens && allTokens.length > 0) {
    console.log('📋 Token details:')
    allTokens.forEach((token, index) => {
      console.log(`${index + 1}. User ID: ${token.strava_id}`)
      console.log(`   Expires: ${token.expires_at}`)
      console.log(`   Has access_token: ${!!token.access_token}`)
      console.log(`   Has refresh_token: ${!!token.refresh_token}`)
      console.log('---')
    })
  }
  
  // Check specific user (42137242)
  console.log('\n🔍 Checking tokens for user 42137242...')
  const { data: userTokens, error: userError } = await supabase
    .from('strava_tokens')
    .select('*')
    .eq('strava_id', 42137242)
  
  if (userError) {
    console.error('❌ Error fetching user tokens:', userError)
    return
  }
  
  console.log(`📊 Tokens for user 42137242: ${userTokens?.length || 0}`)
  
  if (userTokens && userTokens.length > 0) {
    userTokens.forEach((token, index) => {
      console.log(`${index + 1}. Expires: ${token.expires_at}`)
      console.log(`   Has access_token: ${!!token.access_token}`)
      console.log(`   Has refresh_token: ${!!token.refresh_token}`)
    })
  }
}

checkTokens().catch(console.error) 