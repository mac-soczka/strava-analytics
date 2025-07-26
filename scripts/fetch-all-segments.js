const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function fetchAllSegments() {
  console.log('🔄 Fetching segments for all activities...')
  
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
    
    console.log('✅ Found tokens, starting segment fetch...')
    
    // Get all activities that need segments
    const { data: activities, error: activitiesError } = await supabase
      .from('activities')
      .select('id, activity_id, name')
      .eq('strava_id', 42137242)
      .eq('segments_fetched', false)
      .order('start_date', { ascending: false })
    
    if (activitiesError) {
      console.error('❌ Error fetching activities:', activitiesError)
      return
    }
    
    console.log(`📊 Found ${activities.length} activities needing segments`)
    
    let processed = 0
    let segmentsAdded = 0
    let errors = 0
    
    for (const activity of activities) {
      try {
        console.log(`🔄 Processing segments for activity ${activity.activity_id} (${activity.name})`)
        
        // Fetch segments from Strava
        const response = await fetch(
          `https://www.strava.com/api/v3/activities/${activity.activity_id}?include_all_efforts=true`,
          {
            headers: { 'Authorization': `Bearer ${tokens.access_token}` }
          }
        )
        
        if (!response.ok) {
          if (response.status === 404) {
            console.log(`⚠️  Activity ${activity.activity_id} not found (404), marking as fetched`)
            await supabase
              .from('activities')
              .update({ segments_fetched: true })
              .eq('id', activity.id)
            processed++
            continue
          } else {
            console.error(`❌ Error fetching activity ${activity.activity_id}: ${response.status}`)
            errors++
            continue
          }
        }
        
        const activityData = await response.json()
        const segmentEfforts = activityData.segment_efforts || []
        
        if (segmentEfforts.length > 0) {
          // Deduplicate segment efforts by segment_id to avoid conflicts
          const uniqueSegments = new Map()
          segmentEfforts.forEach(effort => {
            const segmentId = effort.segment.id
            if (!uniqueSegments.has(segmentId)) {
              uniqueSegments.set(segmentId, effort)
            }
          })
          
          const deduplicatedEfforts = Array.from(uniqueSegments.values())
          console.log(`🔄 Found ${segmentEfforts.length} segment efforts, deduplicated to ${deduplicatedEfforts.length}`)
          
          // Save segments to database
          const segmentsToSave = deduplicatedEfforts.map(effort => ({
            activity_id: activity.activity_id,
            segment_id: effort.segment.id,
            effort_id: effort.id,
            elapsed_time: effort.elapsed_time,
            moving_time: effort.moving_time,
            start_date: effort.start_date,
            average_watts: effort.average_watts || null,
            max_watts: effort.max_watts || null,
          }))
          
          const { error: insertError } = await supabase
            .from('segment_efforts')
            .upsert(segmentsToSave, { onConflict: 'activity_id,segment_id' })
          
          if (insertError) {
            console.error(`❌ Error inserting segments for activity ${activity.activity_id}:`, insertError)
            errors++
          } else {
            segmentsAdded += segmentEfforts.length
            console.log(`✅ Added ${segmentEfforts.length} segments for activity ${activity.activity_id}`)
            
            // Mark activity as having segments fetched
            await supabase
              .from('activities')
              .update({ segments_fetched: true })
              .eq('id', activity.id)
          }
        } else {
          console.log(`ℹ️  No segments found for activity ${activity.activity_id}`)
          // Mark as fetched even if no segments (to avoid re-checking)
          await supabase
            .from('activities')
            .update({ segments_fetched: true })
            .eq('id', activity.id)
        }
        
        processed++
        
        // Progress update every 10 activities
        if (processed % 10 === 0) {
          console.log(`📊 Progress: ${processed}/${activities.length} activities processed, ${segmentsAdded} segments added, ${errors} errors`)
        }
        
        // Rate limiting - wait 1 second between requests
        await new Promise(resolve => setTimeout(resolve, 1000))
        
      } catch (error) {
        console.error(`❌ Error processing activity ${activity.activity_id}:`, error)
        errors++
      }
    }
    
    console.log(`🎉 Segment fetch complete!`)
    console.log(`📊 Total processed: ${processed}`)
    console.log(`📊 Total segments added: ${segmentsAdded}`)
    console.log(`📊 Total errors: ${errors}`)
    
    // Final count check
    const { count: finalSegmentCount } = await supabase
      .from('segment_efforts')
      .select('*', { count: 'exact', head: true })
    
    console.log(`📊 Total segment efforts in database: ${finalSegmentCount}`)
    
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

fetchAllSegments() 