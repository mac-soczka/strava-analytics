const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

async function verifyCronSchedule() {
  console.log('🔍 Verifying Strava crawler cron schedule...')
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase environment variables')
    return
  }
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  
  try {
    // Check current cron jobs
    console.log('1️⃣ Checking current cron jobs...')
    const { data: jobs, error: jobsError } = await supabase
      .from('cron.job')
      .select('*')
    
    if (jobsError) {
      console.error('❌ Failed to fetch cron jobs:', jobsError)
      return
    }
    
    console.log('📋 Current cron jobs:')
    if (jobs && jobs.length > 0) {
      jobs.forEach((job, index) => {
        console.log(`  ${index + 1}. ${job.jobname}`)
        console.log(`     Schedule: ${job.schedule}`)
        console.log(`     Command: ${job.command}`)
        console.log(`     Active: ${job.active}`)
        console.log('')
      })
    } else {
      console.log('  No cron jobs found')
    }
    
    // Check recent job runs
    console.log('2️⃣ Checking recent job runs...')
    const { data: runs, error: runsError } = await supabase
      .from('cron.job_run_details')
      .select('*')
      .order('start_time', { ascending: false })
      .limit(5)
    
    if (runsError) {
      console.error('❌ Failed to fetch job runs:', runsError)
    } else {
      console.log('📊 Recent job runs:')
      if (runs && runs.length > 0) {
        runs.forEach((run, index) => {
          console.log(`  ${index + 1}. ${run.jobid} - ${run.start_time}`)
          console.log(`     Duration: ${run.duration_ms}ms`)
          console.log(`     Status: ${run.return_message}`)
          console.log('')
        })
      } else {
        console.log('  No recent job runs found')
      }
    }
    
    // Test manual trigger
    console.log('3️⃣ Testing manual trigger...')
    const { data: triggerResult, error: triggerError } = await supabase.rpc('manual_trigger_strava_crawler')
    
    if (triggerError) {
      console.error('❌ Manual trigger failed:', triggerError)
    } else {
      console.log('✅ Manual trigger successful:', triggerResult)
    }
    
    // Check recent crawler logs
    console.log('4️⃣ Checking recent crawler logs...')
    const { data: logs, error: logsError } = await supabase
      .from('strava_crawler_logs')
      .select('*')
      .order('run_at', { ascending: false })
      .limit(3)
    
    if (logsError) {
      console.error('❌ Failed to fetch crawler logs:', logsError)
    } else {
      console.log('📋 Recent crawler logs:')
      if (logs && logs.length > 0) {
        logs.forEach((log, index) => {
          console.log(`  ${index + 1}. ${log.run_at} - ${log.status}`)
          console.log(`     Message: ${log.message}`)
          console.log(`     Activities: ${log.activities_fetched}, Segments: ${log.segments_fetched}`)
          console.log('')
        })
      } else {
        console.log('  No recent crawler logs found')
      }
    }
    
    console.log('✅ Cron schedule verification completed!')
    
  } catch (error) {
    console.error('❌ Verification failed:', error)
  }
}

// Run the verification
verifyCronSchedule() 