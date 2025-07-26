const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

async function updateCronSchedule() {
  console.log('🕐 Updating Strava crawler cron schedule to run every 15 minutes...')
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase environment variables')
    return
  }
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  
  try {
    // Step 1: Unschedule the current daily job
    console.log('1️⃣ Unscheduling current daily job...')
    const { error: unscheduleError } = await supabase.rpc('cron_unschedule', {
      job_name: 'strava-crawler-daily'
    })
    
    if (unscheduleError) {
      console.log('ℹ️ Job was not scheduled or already unscheduled')
    } else {
      console.log('✅ Daily job unscheduled')
    }
    
    // Step 2: Schedule the job to run every 15 minutes
    console.log('2️⃣ Scheduling job to run every 15 minutes...')
    const { error: scheduleError } = await supabase.rpc('cron_schedule', {
      job_name: 'strava-crawler-15min',
      schedule: '*/15 * * * *',
      command: 'SELECT trigger_strava_crawler_direct();'
    })
    
    if (scheduleError) {
      console.error('❌ Failed to schedule job:', scheduleError)
      return
    }
    
    console.log('✅ Job scheduled to run every 15 minutes')
    
    // Step 3: Verify the schedule
    console.log('3️⃣ Verifying cron job schedule...')
    const { data: jobs, error: jobsError } = await supabase
      .from('cron.job')
      .select('*')
      .eq('jobname', 'strava-crawler-15min')
    
    if (jobsError) {
      console.error('❌ Failed to verify job:', jobsError)
    } else if (jobs && jobs.length > 0) {
      const job = jobs[0]
      console.log('✅ Cron job verified:')
      console.log(`   Name: ${job.jobname}`)
      console.log(`   Schedule: ${job.schedule}`)
      console.log(`   Command: ${job.command}`)
      console.log(`   Active: ${job.active}`)
    } else {
      console.log('⚠️ Job not found in cron.job table')
    }
    
    // Step 4: Test the manual trigger
    console.log('4️⃣ Testing manual trigger...')
    const { data: triggerResult, error: triggerError } = await supabase.rpc('manual_trigger_strava_crawler')
    
    if (triggerError) {
      console.error('❌ Manual trigger failed:', triggerError)
    } else {
      console.log('✅ Manual trigger successful:', triggerResult)
    }
    
    console.log('\n🎉 Cron schedule updated successfully!')
    console.log('📅 The Strava crawler will now run every 15 minutes')
    console.log('🕐 Next run: Within 15 minutes from now')
    
  } catch (error) {
    console.error('❌ Failed to update cron schedule:', error)
  }
}

// Run the update
updateCronSchedule() 