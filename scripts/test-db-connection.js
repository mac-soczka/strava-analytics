const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

console.log('🔧 Testing database connection...')
console.log('🔧 Supabase URL:', supabaseUrl)
console.log('🔧 Service Key exists:', !!supabaseServiceKey)

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function testConnection() {
  try {
    // Test basic connection
    console.log('🔧 Testing basic connection...')
    const { data, error } = await supabase.from('users').select('count').limit(1)
    
    if (error) {
      console.error('❌ Basic connection failed:', error)
      return
    }
    
    console.log('✅ Basic connection successful')
    
    // Test app_sessions table
    console.log('🔧 Testing app_sessions table...')
    const { data: sessionsData, error: sessionsError } = await supabase
      .from('app_sessions')
      .select('count')
      .limit(1)
    
    if (sessionsError) {
      console.error('❌ app_sessions table error:', sessionsError)
      console.log('💡 You may need to run: yarn auth:migrate')
      return
    }
    
    console.log('✅ app_sessions table exists and is accessible')
    
    // Test inserting a session
    console.log('🔧 Testing session insertion...')
    const testSession = {
      strava_id: 999999,
      session_token: 'test-token-' + Date.now(),
      expires_at: new Date(Date.now() + 3600000).toISOString()
    }
    
    const { error: insertError } = await supabase
      .from('app_sessions')
      .insert(testSession)
    
    if (insertError) {
      console.error('❌ Session insertion failed:', insertError)
      return
    }
    
    console.log('✅ Session insertion successful')
    
    // Clean up test session
    await supabase
      .from('app_sessions')
      .delete()
      .eq('strava_id', 999999)
    
    console.log('✅ Test session cleaned up')
    console.log('🎉 All database tests passed!')
    
  } catch (error) {
    console.error('❌ Test failed:', error)
  }
}

testConnection() 