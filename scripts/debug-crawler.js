const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function debugCrawler() {
  console.log('🔍 Debugging Crawler Issues...\n')

  try {
    // 1. Check if there are any users
    console.log('1. Checking users...')
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('*')
    
    if (usersError) {
      console.error('❌ Error fetching users:', usersError)
      return
    }
    
    console.log(`✅ Found ${users?.length || 0} users`)
    if (users && users.length > 0) {
      console.log('Users:', users.map(u => `${u.firstname} ${u.lastname} (${u.strava_id})`))
    }

    // 2. Check recent crawler logs
    console.log('\n2. Checking recent crawler logs...')
    const { data: logs, error: logsError } = await supabase
      .from('strava_crawler_logs')
      .select('*')
      .order('run_at', { ascending: false })
      .limit(10)
    
    if (logsError) {
      console.error('❌ Error fetching logs:', logsError)
      return
    }
    
    console.log(`✅ Found ${logs?.length || 0} recent logs`)
    if (logs && logs.length > 0) {
      console.log('Recent logs:')
      logs.forEach((log, i) => {
        console.log(`  ${i + 1}. ${log.run_at} - User: ${log.user_id || 'N/A'} - Status: ${log.status}`)
        console.log(`     Activities: ${log.activities_fetched}, Segments: ${log.segments_fetched}, Efforts: ${log.segment_efforts_fetched}`)
        console.log(`     Message: ${log.message}`)
        if (log.error) console.log(`     Error: ${log.error}`)
        console.log('')
      })
    }

    // 3. Check activities count
    console.log('3. Checking activities...')
    const { count: activitiesCount, error: activitiesError } = await supabase
      .from('activities')
      .select('*', { count: 'exact', head: true })
    
    if (activitiesError) {
      console.error('❌ Error fetching activities count:', activitiesError)
      return
    }
    
    console.log(`✅ Total activities: ${activitiesCount || 0}`)

    // 4. Check segments count
    console.log('\n4. Checking segments...')
    const { count: segmentsCount, error: segmentsError } = await supabase
      .from('segments')
      .select('*', { count: 'exact', head: true })
    
    if (segmentsError) {
      console.error('❌ Error fetching segments count:', segmentsError)
      return
    }
    
    console.log(`✅ Total segments: ${segmentsCount || 0}`)

    // 5. Check activities that need segments
    console.log('\n5. Checking activities needing segments...')
    const { data: activitiesNeedingSegments, error: needsError } = await supabase
      .from('activities')
      .select('*')
      .eq('segments_fetched', false)
      .limit(5)
    
    if (needsError) {
      console.error('❌ Error fetching activities needing segments:', needsError)
      return
    }
    
    console.log(`✅ Activities needing segments: ${activitiesNeedingSegments?.length || 0}`)
    if (activitiesNeedingSegments && activitiesNeedingSegments.length > 0) {
      console.log('Sample activities needing segments:')
      activitiesNeedingSegments.forEach((activity, i) => {
        console.log(`  ${i + 1}. Activity ${activity.activity_id} - ${activity.name}`)
      })
    }

    // 6. Check token health
    console.log('\n6. Checking token health...')
    const { data: tokens, error: tokensError } = await supabase
      .from('strava_tokens')
      .select('*')
    
    if (tokensError) {
      console.error('❌ Error fetching tokens:', tokensError)
      return
    }
    
    console.log(`✅ Found ${tokens?.length || 0} tokens`)
    if (tokens && tokens.length > 0) {
      tokens.forEach((token, i) => {
        const expiresAt = new Date(token.expires_at)
        const now = new Date()
        const isExpired = expiresAt < now
        console.log(`  ${i + 1}. User ${token.strava_id} - Expires: ${expiresAt.toISOString()} - Expired: ${isExpired}`)
      })
    }

    // 7. Check if crawler is running (check for recent activity)
    console.log('\n7. Checking crawler activity...')
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { data: recentActivity, error: activityError } = await supabase
      .from('strava_crawler_logs')
      .select('*')
      .gte('run_at', oneHourAgo)
    
    if (activityError) {
      console.error('❌ Error checking recent activity:', activityError)
      return
    }
    
    console.log(`✅ Crawler runs in last hour: ${recentActivity?.length || 0}`)
    if (recentActivity && recentActivity.length > 0) {
      console.log('Recent activity:')
      recentActivity.forEach((log, i) => {
        console.log(`  ${i + 1}. ${log.run_at} - ${log.status} - ${log.message}`)
      })
    } else {
      console.log('⚠️  No crawler activity in the last hour!')
    }

  } catch (error) {
    console.error('❌ Error in debug script:', error)
  }
}

debugCrawler() 