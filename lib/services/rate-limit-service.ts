import { getLogger } from '@/lib/utils/logger'

/**
 * Strava Rate Limit Service
 * 
 * Manages Strava API rate limits based on official documentation:
 * https://developers.strava.com/docs/rate-limits/
 * 
 * Rate Limits:
 * - 100 requests per 15 minutes (short-term)
 * - 1,000 requests per day (long-term)
 * 
 * Reset Times:
 * - 15-minute window: Rolling window (resets 15 minutes after first request)
 * - Daily window: Resets at midnight UTC
 * 
 * Response Headers:
 * - X-RateLimit-Usage: "short_term_usage,daily_usage" (e.g., "5,12")
 * - X-RateLimit-Limit: "short_term_limit,daily_limit" (e.g., "100,1000")
 */

export interface RateLimitStatus {
  requests15min: number
  requestsDay: number
  limit15min: number
  limitDay: number
  remaining15min: number
  remainingDay: number
  canProceed: boolean
  nextReset15min: Date
  nextResetDaily: Date
  timeUntilReset15min: number // milliseconds
  timeUntilResetDaily: number // milliseconds
  lastUpdate: Date
  mode: string // 'RATE-LIMITED' or 'NO-LIMITS'
  noLimitsMode: boolean
}

export class RateLimitService {
  private requests15min: number = 0
  private requestsDay: number = 0
  private limit15min: number = 100
  private limitDay: number = 1000
  private lastUpdate: Date = new Date()

  /**
   * Update rate limits from Strava API response headers
   */
  updateFromHeaders(response: Response): void {
    // Strava may send both overall and read-specific rate limit headers.
    // If read headers are present, treat them as the effective limits for GET-heavy workloads.
    const readUsage = response.headers.get('X-ReadRateLimit-Usage')
    const readLimit = response.headers.get('X-ReadRateLimit-Limit')

    const rateLimitUsage = response.headers.get('X-RateLimit-Usage')
    const rateLimitLimit = response.headers.get('X-RateLimit-Limit')
    
    const logger = getLogger()

    const effectiveUsage = readUsage ?? rateLimitUsage
    const effectiveLimit = readLimit ?? rateLimitLimit

    if (effectiveUsage && effectiveLimit) {
      // Log raw header values for debugging
      logger.log(
        `Strava headers - X-RateLimit-Usage: "${rateLimitUsage}", X-RateLimit-Limit: "${rateLimitLimit}", ` +
        `X-ReadRateLimit-Usage: "${readUsage}", X-ReadRateLimit-Limit: "${readLimit}"`
      )
      
      const usage = effectiveUsage.split(',').map(Number)
      const limits = effectiveLimit.split(',').map(Number)
      
      if (usage.length >= 2 && limits.length >= 2) {
        this.requests15min = usage[0] || 0
        this.requestsDay = usage[1] || 0
        this.limit15min = limits[0] || 100
        this.limitDay = limits[1] || 1000
        this.lastUpdate = new Date()
        
        // Log rate limits with special formatting
        logger.rateLimit({
          requests15min: this.requests15min,
          limit15min: this.limit15min,
          requestsDay: this.requestsDay,
          limitDay: this.limitDay
        })
      }
    } else {
      logger.warn('No rate limit headers found in Strava response')
    }
  }

  /**
   * Get current rate limit status
   */
  getStatus(): RateLimitStatus {
    const now = new Date()
    
    // Strava resets the 15-minute limit at natural quarter-hour boundaries
    // (0, 15, 30, 45 minutes after the hour) per:
    // https://developers.strava.com/docs/rate-limits/
    const next15minReset = new Date(now)
    const utcMinutes = next15minReset.getUTCMinutes()
    const nextQuarter = Math.floor(utcMinutes / 15) * 15 + 15
    if (nextQuarter >= 60) {
      next15minReset.setUTCHours(next15minReset.getUTCHours() + 1, 0, 0, 0)
    } else {
      next15minReset.setUTCMinutes(nextQuarter, 0, 0)
    }
    const timeUntilReset15min = Math.max(0, next15minReset.getTime() - now.getTime())
    
    // Calculate next daily reset (midnight UTC)
    const nextDailyReset = new Date(now)
    nextDailyReset.setUTCHours(24, 0, 0, 0) // Next midnight UTC
    const timeUntilResetDaily = nextDailyReset.getTime() - now.getTime()
    
    // Strava sometimes reports usage slightly over limit; treat remaining as 0 in that case.
    const remaining15min = Math.max(0, this.limit15min - this.requests15min)
    const remainingDay = Math.max(0, this.limitDay - this.requestsDay)
    
    return {
      requests15min: this.requests15min,
      requestsDay: this.requestsDay,
      limit15min: this.limit15min,
      limitDay: this.limitDay,
      remaining15min,
      remainingDay,
      canProceed: remaining15min > 0 && remainingDay > 0,
      nextReset15min: next15minReset,
      nextResetDaily: nextDailyReset,
      timeUntilReset15min,
      timeUntilResetDaily,
      lastUpdate: this.lastUpdate,
      mode: 'RATE-LIMITED',
      noLimitsMode: false
    }
  }

  /**
   * Check if we can make a request
   */
  canMakeRequest(): boolean {
    const status = this.getStatus()
    return status.canProceed
  }

  /**
   * Get recommended wait time before next request
   * Returns 0 if can proceed immediately
   * Returns milliseconds to wait if rate limited
   */
  getRecommendedWaitTime(): number {
    const status = this.getStatus()
    
    if (status.canProceed) {
      return 0
    }
    
    // If both limits are hit, wait for whichever resets first
    if (status.remaining15min <= 0 && status.remainingDay <= 0) {
      return Math.min(status.timeUntilReset15min, status.timeUntilResetDaily)
    }
    
    // If only 15-min limit is hit
    if (status.remaining15min <= 0) {
      return status.timeUntilReset15min
    }
    
    // If only daily limit is hit
    if (status.remainingDay <= 0) {
      return status.timeUntilResetDaily
    }
    
    return 0
  }

  /**
   * Get adaptive delay between requests based on remaining quota
   */
  getAdaptiveDelay(): number {
    const status = this.getStatus()
    
    // If we're close to limits, slow down
    const utilizationPercent = Math.max(
      (status.requests15min / status.limit15min) * 100,
      (status.requestsDay / status.limitDay) * 100
    )
    
    if (utilizationPercent >= 90) {
      return 2000 // 2 seconds when at 90%+ utilization
    } else if (utilizationPercent >= 75) {
      return 1500 // 1.5 seconds when at 75%+ utilization
    } else if (utilizationPercent >= 50) {
      return 1000 // 1 second when at 50%+ utilization
    } else {
      return 500 // 500ms when below 50% utilization
    }
  }

  /**
   * Format time until reset as human-readable string
   */
  formatTimeUntilReset(milliseconds: number): string {
    const seconds = Math.floor(milliseconds / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`
    } else {
      return `${seconds}s`
    }
  }

  /**
   * Log current rate limit status
   */
  logStatus(): void {
    const status = this.getStatus()
    const logger = getLogger()
    
    logger.log('Rate Limit Status:', {
      '15-minute': `${status.requests15min}/${status.limit15min} (${status.remaining15min} remaining)`,
      'Daily': `${status.requestsDay}/${status.limitDay} (${status.remainingDay} remaining)`,
      'Can proceed': status.canProceed,
      'Next 15-min reset': `${status.nextReset15min.toISOString()} (in ${this.formatTimeUntilReset(status.timeUntilReset15min)})`,
      'Next daily reset': `${status.nextResetDaily.toISOString()} (in ${this.formatTimeUntilReset(status.timeUntilResetDaily)})`
    })
  }
}

// Singleton instance
let rateLimitServiceInstance: RateLimitService | null = null

export function getRateLimitService(): RateLimitService {
  if (!rateLimitServiceInstance) {
    rateLimitServiceInstance = new RateLimitService()
  }
  return rateLimitServiceInstance
}
