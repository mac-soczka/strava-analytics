const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

async function quickDiagnostic() {
  console.log('🔍 Quick Diagnostic Test...')
  console.log('='.repeat(50))
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase environment variables')
    return
  }
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  
  try {
    // 1. Check database connectivity
    console.log('\n1️⃣ Database Connectivity...')
    const { data: testData, error: testError } = await supabase
      .from('users')
      .select('count', { count: 'exact', head: true })
    
    if (testError) {
      console.error('❌ Database connection failed:', testError)
      return
    }
    console.log('✅ Database connection successful')
    
    // 2. Check entity counts
    console.log('\n2️⃣ Entity Counts...')
    const [usersCount, activitiesCount, segmentsCount, segmentEffortsCount, tokensCount, sessionsCount] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('activities').select('*', { count: 'exact', head: true }),
      supabase.from('segments').select('*', { count: 'exact', head: true }),
      supabase.from('segment_efforts').select('*', { count: 'exact', head: true }),
      supabase.from('strava_tokens').select('*', { count: 'exact', head: true }),
      supabase.from('app_sessions').select('*', { count: 'exact', head: true })
    ])
    
    console.log(`👥 Users: ${usersCount.count || 0}`)
    console.log(`🏃 Activities: ${activitiesCount.count || 0}`)
    console.log(`🏔️ Segments: ${segmentsCount.count || 0}`)
    console.log(`⚡ Segment Efforts: ${segmentEffortsCount.count || 0}`)
    console.log(`🔑 Tokens: ${tokensCount.count || 0}`)
    console.log(`🔐 Sessions: ${sessionsCount.count || 0}`)
    
    // 3. Check recent crawler activity
    console.log('\n3️⃣ Recent Crawler Activity...')
    const { data: recentLogs, error: logsError } = await supabase
      .from('strava_crawler_logs')
      .select('*')
      .gte('run_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('run_at', { ascending: false })
    
    if (logsError) {
      console.error('❌ Failed to fetch crawler logs:', logsError)
    } else {
      const totalRuns = recentLogs.length
      const successfulRuns = recentLogs.filter(log => log.status === 'success').length
      const successRate = totalRuns > 0 ? ((successfulRuns / totalRuns) * 100).toFixed(1) : 0
      
      const totalActivities = recentLogs.reduce((sum, log) => sum + (log.activities_fetched || 0), 0)
      const totalSegments = recentLogs.reduce((sum, log) => sum + (log.segments_fetched || 0), 0)
      
      console.log(`📊 24h Statistics:`)
      console.log(`   Total Runs: ${totalRuns}`)
      console.log(`   Success Rate: ${successRate}%`)
      console.log(`   Activities: ${totalActivities}`)
      console.log(`   Segments: ${totalSegments}`)
      
      if (recentLogs.length > 0) {
        const lastRun = recentLogs[0]
        console.log(`\n🕐 Last Run: ${new Date(lastRun.run_at).toLocaleString()}`)
        console.log(`   Status: ${lastRun.status}`)
        console.log(`   Message: ${lastRun.message}`)
      }
    }
    
    // 4. Check token health
    console.log('\n4️⃣ Token Health...')
    const { data: tokens, error: tokensError } = await supabase
      .from('strava_tokens')
      .select('*')
    
    if (tokensError) {
      console.error('❌ Failed to fetch tokens:', tokensError)
    } else {
      const now = new Date()
      const validTokens = tokens.filter(token => new Date(token.expires_at) > now)
      const expiredTokens = tokens.filter(token => new Date(token.expires_at) <= now)
      
      console.log(`🔑 Token Status:`)
      console.log(`   Valid: ${validTokens.length}`)
      console.log(`   Expired: ${expiredTokens.length}`)
      console.log(`   Total: ${tokens.length}`)
      
      if (expiredTokens.length > 0) {
        console.log('\n⚠️  Expired tokens:')
        expiredTokens.forEach(token => {
          console.log(`   - User ${token.strava_id}: expired ${token.expires_at}`)
        })
      }
    }
    
    // 5. Check for errors in recent logs
    console.log('\n5️⃣ Recent Errors...')
    const { data: errorLogs, error: errorLogsError } = await supabase
      .from('strava_crawler_logs')
      .select('*')
      .eq('status', 'error')
      .gte('run_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('run_at', { ascending: false })
      .limit(5)
    
    if (errorLogsError) {
      console.error('❌ Failed to fetch error logs:', errorLogsError)
    } else if (errorLogs.length > 0) {
      console.log(`🚨 Recent errors (${errorLogs.length}):`)
      errorLogs.forEach((log, index) => {
        console.log(`   ${index + 1}. ${new Date(log.run_at).toLocaleString()}`)
        console.log(`      User: ${log.user_id || 'System'}`)
        console.log(`      Message: ${log.message}`)
        console.log('')
      })
    } else {
      console.log('✅ No recent errors found')
    }
    
    // 6. System recommendations
    console.log('\n6️⃣ System Recommendations...')
    console.log('='.repeat(50))
    
    if (tokens && tokens.length === 0) {
      console.log('🚨 No tokens found - Users need to authenticate')
      console.log('   Action: Visit https://strava-heatmap-alpha.vercel.app/ and login')
    }
    
    if (tokens && expiredTokens && expiredTokens.length > 0) {
      console.log('⚠️  Expired tokens detected')
      console.log('   Action: Run token health check or force re-authentication')
    }
    
    if (successRate < 50) {
      console.log('⚠️  Low success rate detected')
      console.log('   Action: Check error logs and token health')
    }
    
    if (totalActivities === 0 && totalSegments === 0) {
      console.log('⚠️  No recent data fetched')
      console.log('   Action: Check crawler status and token validity')
    }
    
    console.log('\n🎉 Quick diagnostic completed!')
    
  } catch (error) {
    console.error('❌ Diagnostic failed:', error)
  }
}

// Run the diagnostic
quickDiagnostic() 