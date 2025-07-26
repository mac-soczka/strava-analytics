const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function checkSessions() {
  console.log('🔍 Checking app sessions...')
  
  try {
    const { data: sessions, error } = await supabase
      .from('app_sessions')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('❌ Error fetching sessions:', error)
      return
    }
    
    console.log(`📊 Total app sessions: ${sessions.length}`)
    
    if (sessions.length > 0) {
      console.log('\n📋 Session details:')
      sessions.forEach((session, index) => {
        const expiresAt = new Date(session.expires_at)
        const now = new Date()
        const isExpired = expiresAt < now
        const timeLeft = expiresAt - now
        
        console.log(`${index + 1}. User ${session.strava_id}`)
        console.log(`   Created: ${session.created_at}`)
        console.log(`   Expires: ${session.expires_at}`)
        console.log(`   Status: ${isExpired ? '❌ EXPIRED' : '✅ VALID'}`)
        if (!isExpired) {
          console.log(`   Time left: ${Math.floor(timeLeft / (1000 * 60 * 60))}h ${Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60))}m`)
        }
        console.log('')
      })
    } else {
      console.log('✅ No app sessions found')
    }
    
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

checkSessions() 