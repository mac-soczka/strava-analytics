const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function fetchAllActivities() {
  console.log('🔄 Fetching all activities from Strava...')
  
  try {
    // Get tokens for user 42137242
    const { data: tokens, error: tokensError } = await supabase
      .from('strava_tokens')
      .select('*')
      .eq('strava_id', 42137242)
      .single()
    
    if (tokensError || !tokens) {
      console.error('❌ Error fetching tokens:', tokensError)
      return
    }
    
    console.log('✅ Found tokens, starting activity fetch...')
    
    let page = 1
    let totalFetched = 0
    let hasMore = true
    const perPage = 200 // Strava API maximum
    
    while (hasMore) {
      console.log(`📄 Fetching page ${page} (${perPage} activities per page)...`)
      
      try {
        const response = await fetch(
          `https://www.strava.com/api/v3/athlete/activities?page=${page}&per_page=${perPage}`,
          {
            headers: { 'Authorization': `Bearer ${tokens.access_token}` }
          }
        )
        
        if (!response.ok) {
          console.error(`❌ Error fetching page ${page}: ${response.status}`)
          break
        }
        
        const activities = await response.json()
        console.log(`✅ Fetched ${activities.length} activities from page ${page}`)
        
        if (activities.length === 0) {
          console.log('📄 No more activities found')
          hasMore = false
          break
        }
        
        // Process activities
        for (const activity of activities) {
          try {
            // Check if activity already exists
            const { data: existing } = await supabase
              .from('activities')
              .select('id')
              .eq('activity_id', activity.id)
              .single()
            
            if (existing) {
              console.log(`⏭️  Activity ${activity.id} already exists, skipping...`)
              continue
            }
            
            // Insert new activity
            const { error: insertError } = await supabase
              .from('activities')
              .insert({
                strava_id: 42137242,
                activity_id: activity.id,
                name: activity.name,
                distance: activity.distance,
                moving_time: activity.moving_time,
                elapsed_time: activity.elapsed_time,
                total_elevation_gain: activity.total_elevation_gain,
                type: activity.type,
                start_date: activity.start_date,
                start_date_local: activity.start_date_local,
                segments_fetched: false // Mark as needing segments
              })
            
            if (insertError) {
              console.error(`❌ Error inserting activity ${activity.id}:`, insertError)
            } else {
              totalFetched++
              console.log(`✅ Inserted activity: ${activity.name} (${activity.id})`)
            }
            
          } catch (error) {
            console.error(`❌ Error processing activity ${activity.id}:`, error)
          }
        }
        
        page++
        
        // Rate limiting - wait 1 second between requests
        await new Promise(resolve => setTimeout(resolve, 1000))
        
      } catch (error) {
        console.error(`❌ Error fetching page ${page}:`, error)
        break
      }
    }
    
    console.log(`🎉 Activity fetch complete! Total new activities: ${totalFetched}`)
    
    // Check final count
    const { count: finalCount } = await supabase
      .from('activities')
      .select('*', { count: 'exact', head: true })
    
    console.log(`📊 Total activities in database: ${finalCount}`)
    
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

fetchAllActivities() 