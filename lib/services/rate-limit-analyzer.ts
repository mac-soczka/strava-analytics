import { createClient } from '@supabase/supabase-js'
import { config } from '@/lib/config'

export interface RateLimitAnalysis {
  // Current status
  currentStatus: {
    mode: 'NO-LIMITS' | 'RATE-LIMITED' | 'UNKNOWN'
    requests15min: number
    requestsDay: number
    limit15min: number
    limitDay: number
    remaining15min: number
    remainingDay: number
    utilization15min: number // percentage
    utilizationDay: number // percentage
  }
  
  // Limit status
  limitsHit: {
    hourly15min: boolean
    daily: boolean
    any: boolean
  }
  
  // Timing information
  timing: {
    next15minReset: Date
    nextDailyReset: Date
    timeUntil15minReset: number // milliseconds
    timeUntilDailyReset: number // milliseconds
    canProceed: boolean
    recommendedDelay: number // milliseconds
    estimatedRequestsPossible: number
  }
  
  // Recommendations
  recommendations: {
    shouldProceed: boolean
    reason: string
    suggestedBatchSize: number
    suggestedDelay: number
    nextRunTime: Date
  }
  
  // Historical context
  historical: {
    lastCrawlTime?: Date
    lastCrawlRequests?: number
    averageRequestsPerCrawl: number
    peakUsageTime?: Date
    peakUsageRequests?: number
  }
}

export class RateLimitAnalyzer {
  private supabase: ReturnType<typeof createClient>

  constructor() {
    this.supabase = createClient(
      config.supabase.url,
      config.supabase.serviceRoleKey
    )
  }

  /**
   * Analyze current rate limit status and provide comprehensive insights
   */
  async analyzeRateLimits(): Promise<RateLimitAnalysis> {
    const now = new Date()
    
    // Get current rate limit status from Strava API
    const currentStatus = await this.getCurrentStravaRateLimitStatus()
    
    // Calculate timing information
    const timing = this.calculateTiming(now, currentStatus)
    
    // Determine if limits are hit
    const limitsHit = {
      hourly15min: currentStatus.requests15min >= currentStatus.limit15min,
      daily: currentStatus.requestsDay >= currentStatus.limitDay,
      any: currentStatus.requests15min >= currentStatus.limit15min || currentStatus.requestsDay >= currentStatus.limitDay
    }
    
    // Get historical context
    const historical = await this.getHistoricalContext()
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(
      currentStatus, 
      timing, 
      limitsHit, 
      historical
    )
    
    return {
      currentStatus,
      limitsHit,
      timing,
      recommendations,
      historical
    }
  }

  /**
   * Get current rate limit status from Strava API
   */
  private async getCurrentStravaRateLimitStatus() {
    // In a real implementation, this would make a lightweight API call to Strava
    // For now, we'll simulate based on the current RateLimitTracker state
    // TODO: Implement actual Strava API call to get real-time rate limit headers
    
    // Simulated response - replace with actual API call
    const mockResponse = {
      'X-RateLimit-Limit': config.stravaApiLimits.requestsPer15Min.toString(),
      'X-RateLimit-Usage': '150', // This would come from actual API response
      'X-RateLimit-Reset': Math.floor(Date.now() / 1000 + 15 * 60).toString() // 15 minutes from now
    }
    
    const mode: 'NO-LIMITS' | 'RATE-LIMITED' | 'UNKNOWN' = config.stravaApiLimits.noLimitsMode ? 'NO-LIMITS' : 'RATE-LIMITED'
    
    return {
      mode,
      requests15min: parseInt(mockResponse['X-RateLimit-Usage'] || '0'),
      requestsDay: 0, // Would need separate tracking for daily limits
      limit15min: config.stravaApiLimits.requestsPer15Min,
      limitDay: config.stravaApiLimits.requestsPerDay,
      remaining15min: config.stravaApiLimits.requestsPer15Min - parseInt(mockResponse['X-RateLimit-Usage'] || '0'),
      remainingDay: config.stravaApiLimits.requestsPerDay,
      utilization15min: (parseInt(mockResponse['X-RateLimit-Usage'] || '0') / config.stravaApiLimits.requestsPer15Min) * 100,
      utilizationDay: 0
    }
  }

  /**
   * Calculate timing information for rate limit resets
   */
  private calculateTiming(now: Date, currentStatus: any) {
    // 15-minute reset (simplified - in reality this would come from Strava headers)
    const next15minReset = new Date(now.getTime() + 15 * 60 * 1000)
    const timeUntil15minReset = next15minReset.getTime() - now.getTime()
    
    // Daily reset (simplified - would need to track actual daily reset time)
    const nextDailyReset = new Date(now.getTime() + 24 * 60 * 60 * 1000)
    const timeUntilDailyReset = nextDailyReset.getTime() - now.getTime()
    
    // Determine if we can proceed
    const canProceed = currentStatus.remaining15min > 0 && currentStatus.remainingDay > 0
    
    // Calculate recommended delay
    const recommendedDelay = this.calculateRecommendedDelay(currentStatus)
    
    // Estimate how many requests we can make
    const estimatedRequestsPossible = Math.min(
      currentStatus.remaining15min,
      currentStatus.remainingDay
    )
    
    return {
      next15minReset,
      nextDailyReset,
      timeUntil15minReset,
      timeUntilDailyReset,
      canProceed,
      recommendedDelay,
      estimatedRequestsPossible
    }
  }

  /**
   * Calculate recommended delay between requests
   */
  private calculateRecommendedDelay(currentStatus: any): number {
    if (currentStatus.mode === 'NO-LIMITS') {
      return 0
    }
    
    const remaining15min = currentStatus.remaining15min
    const remainingDay = currentStatus.remainingDay
    const remaining = Math.min(remaining15min, remainingDay)
    
    if (remaining <= 5) {
      return config.stravaApiLimits.maxDelayMs
    } else if (remaining <= 20) {
      return config.stravaApiLimits.minDelayMs + 500
    } else if (remaining <= 50) {
      return config.stravaApiLimits.minDelayMs + 200
    } else {
      return config.stravaApiLimits.minDelayMs
    }
  }

  /**
   * Get historical context from crawler logs
   */
  private async getHistoricalContext() {
    try {
      // Get recent crawler logs
      const { data: recentLogs, error } = await this.supabase
        .from('strava_crawler_logs')
        .select('*')
        .order('run_at', { ascending: false })
        .limit(10)
      
      if (error || !recentLogs) {
        return {
          averageRequestsPerCrawl: 0
        }
      }
      
      // Calculate average requests per crawl
      const totalRequests = recentLogs.reduce((sum, log) => {
        const rateLimit = log.rate_limit_status as any
        if (rateLimit) {
          return sum + Math.max(rateLimit.requests15min || 0, rateLimit.requestsDay || 0)
        }
        return sum
      }, 0)
      
      const averageRequestsPerCrawl = recentLogs.length > 0 ? totalRequests / recentLogs.length : 0
      
      // Find peak usage
      let peakUsageTime: Date | undefined
      let peakUsageRequests = 0
      
      recentLogs.forEach(log => {
        const rateLimit = log.rate_limit_status as any
        if (rateLimit) {
          const requests = Math.max(rateLimit.requests15min || 0, rateLimit.requestsDay || 0)
          if (requests > peakUsageRequests) {
            peakUsageRequests = requests
            peakUsageTime = new Date(log.run_at as string)
          }
        }
      })
      
      return {
        lastCrawlTime: recentLogs.length > 0 ? new Date(recentLogs[0].run_at as string) : undefined,
        lastCrawlRequests: recentLogs.length > 0 ? 
          Math.max(
            (recentLogs[0].rate_limit_status as any)?.requests15min || 0,
            (recentLogs[0].rate_limit_status as any)?.requestsDay || 0
          ) : undefined,
        averageRequestsPerCrawl,
        peakUsageTime,
        peakUsageRequests
      }
    } catch (error) {
      console.warn('Failed to get historical context:', error)
      return {
        averageRequestsPerCrawl: 0
      }
    }
  }

  /**
   * Generate recommendations based on current status
   */
  private generateRecommendations(
    currentStatus: any,
    timing: any,
    limitsHit: any,
    historical: any
  ) {
    let shouldProceed = true
    let reason = 'Rate limits allow proceeding'
    let suggestedBatchSize = config.stravaApiLimits.maxCrawlerBatchSize
    let suggestedDelay = timing.recommendedDelay
    let nextRunTime = new Date()
    
    // Check if limits are hit
    if (limitsHit.any) {
      shouldProceed = false
      reason = limitsHit.hourly15min && limitsHit.daily 
        ? 'Both 15-minute and daily limits are hit'
        : limitsHit.hourly15min 
        ? '15-minute rate limit is hit'
        : 'Daily rate limit is hit'
      
      // Calculate next run time
      if (limitsHit.hourly15min) {
        nextRunTime = timing.next15minReset
      } else if (limitsHit.daily) {
        nextRunTime = timing.nextDailyReset
      }
    }
    
    // Check if we're approaching limits
    if (currentStatus.utilization15min > 80 || currentStatus.utilizationDay > 80) {
      shouldProceed = true
      reason = 'Approaching limits but can proceed with caution'
      suggestedBatchSize = Math.floor(suggestedBatchSize * 0.5)
      suggestedDelay = Math.max(suggestedDelay, config.stravaApiLimits.minDelayMs * 2)
    }
    
    // Check if we have very few requests remaining
    if (timing.estimatedRequestsPossible < 10) {
      shouldProceed = false
      reason = `Only ${timing.estimatedRequestsPossible} requests remaining`
      nextRunTime = timing.next15minReset
    }
    
    // Consider historical patterns
    if (historical.averageRequestsPerCrawl > timing.estimatedRequestsPossible) {
      shouldProceed = false
      reason = `Average crawl uses ${historical.averageRequestsPerCrawl} requests, but only ${timing.estimatedRequestsPossible} available`
      nextRunTime = timing.next15minReset
    }
    
    return {
      shouldProceed,
      reason,
      suggestedBatchSize,
      suggestedDelay,
      nextRunTime
    }
  }

  /**
   * Get a human-readable summary of the rate limit analysis
   */
  async getRateLimitSummary(): Promise<string> {
    const analysis = await this.analyzeRateLimits()
    
    const formatTime = (date: Date) => date.toLocaleTimeString()
    const formatDuration = (ms: number) => {
      const minutes = Math.floor(ms / (1000 * 60))
      const seconds = Math.floor((ms % (1000 * 60)) / 1000)
      return `${minutes}m ${seconds}s`
    }
    
    let summary = `📊 Rate Limit Analysis\n\n`
    
    // Current status
    summary += `🔍 Current Status:\n`
    summary += `   Mode: ${analysis.currentStatus.mode}\n`
    summary += `   15-min: ${analysis.currentStatus.requests15min}/${analysis.currentStatus.limit15min} (${analysis.currentStatus.utilization15min.toFixed(1)}%)\n`
    summary += `   Daily: ${analysis.currentStatus.requestsDay}/${analysis.currentStatus.limitDay} (${analysis.currentStatus.utilizationDay.toFixed(1)}%)\n`
    summary += `   Remaining: ${analysis.currentStatus.remaining15min} (15-min) / ${analysis.currentStatus.remainingDay} (daily)\n\n`
    
    // Limit status
    summary += `🚦 Limit Status:\n`
    summary += `   15-min limit hit: ${analysis.limitsHit.hourly15min ? '❌ YES' : '✅ NO'}\n`
    summary += `   Daily limit hit: ${analysis.limitsHit.daily ? '❌ YES' : '✅ NO'}\n\n`
    
    // Timing
    summary += `⏰ Timing:\n`
    summary += `   Next 15-min reset: ${formatTime(analysis.timing.next15minReset)} (in ${formatDuration(analysis.timing.timeUntil15minReset)})\n`
    summary += `   Next daily reset: ${formatTime(analysis.timing.nextDailyReset)} (in ${formatDuration(analysis.timing.timeUntilDailyReset)})\n`
    summary += `   Can proceed: ${analysis.timing.canProceed ? '✅ YES' : '❌ NO'}\n`
    summary += `   Estimated requests possible: ${analysis.timing.estimatedRequestsPossible}\n\n`
    
    // Recommendations
    summary += `💡 Recommendations:\n`
    summary += `   Should proceed: ${analysis.recommendations.shouldProceed ? '✅ YES' : '❌ NO'}\n`
    summary += `   Reason: ${analysis.recommendations.reason}\n`
    summary += `   Suggested batch size: ${analysis.recommendations.suggestedBatchSize}\n`
    summary += `   Suggested delay: ${analysis.recommendations.suggestedDelay}ms\n`
    summary += `   Next run time: ${formatTime(analysis.recommendations.nextRunTime)}\n\n`
    
    // Historical context
    if (analysis.historical.lastCrawlTime) {
      summary += `📈 Historical Context:\n`
      summary += `   Last crawl: ${formatTime(analysis.historical.lastCrawlTime)}\n`
      summary += `   Last crawl requests: ${analysis.historical.lastCrawlRequests}\n`
      summary += `   Average requests per crawl: ${analysis.historical.averageRequestsPerCrawl.toFixed(1)}\n`
      if (analysis.historical.peakUsageTime) {
        summary += `   Peak usage: ${analysis.historical.peakUsageRequests} requests at ${formatTime(analysis.historical.peakUsageTime)}\n`
      }
    }
    
    return summary
  }
} 