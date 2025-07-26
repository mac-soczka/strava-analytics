const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function monitorSessions() {
  console.log('🔍 Monitoring app sessions...')
  
  try {
    // Check sessions
    const { data: sessions, error: sessionsError } = await supabase
      .from('app_sessions')
      .select('*')
    
    if (sessionsError) {
      console.error('❌ Error fetching sessions:', sessionsError)
      return
    }
    
    // Check tokens
    const { data: tokens, error: tokensError } = await supabase
      .from('strava_tokens')
      .select('*')
    
    if (tokensError) {
      console.error('❌ Error fetching tokens:', tokensError)
      return
    }
    
    console.log(`📊 Current Status:`)
    console.log(`   App Sessions: ${sessions.length}`)
    console.log(`   Strava Tokens: ${tokens.length}`)
    
    if (sessions.length > 0) {
      console.log('\n📋 Active Sessions:')
      sessions.forEach((session, index) => {
        const expiresAt = new Date(session.expires_at)
        const now = new Date()
        const isExpired = expiresAt < now
        
        console.log(`   ${index + 1}. User ${session.strava_id} - ${isExpired ? '❌ EXPIRED' : '✅ VALID'}`)
      })
    }
    
    if (tokens.length > 0) {
      console.log('\n📋 Active Tokens:')
      tokens.forEach((token, index) => {
        const expiresAt = new Date(token.expires_at)
        const now = new Date()
        const isExpired = expiresAt < now
        
        console.log(`   ${index + 1}. User ${token.strava_id} - ${isExpired ? '❌ EXPIRED' : '✅ VALID'}`)
      })
    }
    
    // Check for multiple sessions per user
    const userSessionCounts = {}
    sessions.forEach(session => {
      userSessionCounts[session.strava_id] = (userSessionCounts[session.strava_id] || 0) + 1
    })
    
    const multipleSessions = Object.entries(userSessionCounts).filter(([_, count]) => count > 1)
    if (multipleSessions.length > 0) {
      console.log('\n⚠️  Users with multiple sessions:')
      multipleSessions.forEach(([userId, count]) => {
        console.log(`   User ${userId}: ${count} sessions`)
      })
    } else {
      console.log('\n✅ No users with multiple sessions')
    }
    
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

monitorSessions() 