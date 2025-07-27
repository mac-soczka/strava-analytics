const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function testCrawler() {
  console.log('🧪 Testing Crawler Manually...\n')

  try {
    // Call the Supabase Edge Function directly
    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/strava-crawler`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      console.error('❌ Edge Function call failed:', response.status, response.statusText)
      const errorText = await response.text()
      console.error('Error details:', errorText)
      return
    }

    const result = await response.json()
    console.log('✅ Edge Function Response:')
    console.log(JSON.stringify(result, null, 2))

  } catch (error) {
    console.error('❌ Error calling Edge Function:', error)
  }
}

testCrawler() 