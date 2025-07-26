const { StravaService } = require('../lib/services/strava-service');

async function testCrawlerFix() {
  console.log('🧪 Testing crawler fix...');
  
  try {
    // Test with user ID 42137242 (from the logs)
    const stravaService = new StravaService(42137242);
    
    console.log('📡 Testing token retrieval...');
    const tokens = await stravaService.getValidTokens();
    console.log('✅ Tokens retrieved successfully');
    console.log('Token expires at:', tokens.expires_at);
    
    console.log('📡 Testing activity fetching...');
    const activities = await stravaService.fetchActivities(1, 5);
    console.log(`✅ Fetched ${activities.length} activities from Strava`);
    
    if (activities.length > 0) {
      console.log('📝 Sample activity from Strava:');
      console.log(JSON.stringify(activities[0], null, 2));
      
      console.log('💾 Testing activity sync...');
      const result = await stravaService.syncActivities(1);
      console.log('✅ Activity sync result:', result);
    } else {
      console.log('ℹ️ No activities found on Strava for this user');
    }
    
    console.log('🎉 Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testCrawlerFix().catch(console.error); 