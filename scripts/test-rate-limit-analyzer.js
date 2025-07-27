const { RateLimitAnalyzer } = require('../lib/services/rate-limit-analyzer')
require('dotenv').config({ path: '.env.local' })

async function testRateLimitAnalyzer() {
  console.log('🧪 Testing Rate Limit Analyzer...\n')
  
  try {
    const analyzer = new RateLimitAnalyzer()
    
    // Test the analysis
    console.log('📊 Running rate limit analysis...')
    const analysis = await analyzer.analyzeRateLimits()
    
    console.log('✅ Analysis completed successfully!')
    console.log('\n📋 Analysis Results:')
    console.log(JSON.stringify(analysis, null, 2))
    
    // Test the summary
    console.log('\n📝 Human-readable summary:')
    const summary = await analyzer.getRateLimitSummary()
    console.log(summary)
    
  } catch (error) {
    console.error('❌ Error testing rate limit analyzer:', error)
  }
}

testRateLimitAnalyzer() 