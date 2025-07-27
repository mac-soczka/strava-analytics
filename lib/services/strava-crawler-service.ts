import { createClient } from '@supabase/supabase-js'
import { StravaService } from './strava-service'
import { StatsService } from './stats-service'
import { config } from '@/lib/config'
import { TokenHealthService } from './token-health-service'
import { RateLimitAnalyzer } from './rate-limit-analyzer'

export interface CrawlerLogEntry {
  run_at: string
  user_id?: number | null
  status: 'success' | 'error' | 'partial'
  message: string
  activities_fetched: number
  segments_fetched: number
  segment_efforts_fetched: number
  execution_time_ms: number
  error?: string
  rate_limit_status?: {
    mode: string
    requests15min: number
    requestsDay: number
    limit15min: number
    limitDay: number
  }
}

export interface CrawlerResult {
  user_id: number
  user_name: string
  success: boolean
  activities_fetched: number
  segments_fetched: number
  segment_efforts_fetched: number
  message: string
  errors?: string[]
  execution_time_ms: number
}

export interface CrawlerOptions {
  batch_size?: number
  include_segments?: boolean
  skip_invalid_tokens?: boolean
  segment_batch_size?: number
}

export class StravaCrawlerService {
  private supabase: ReturnType<typeof createClient>
  private stravaService!: StravaService
  private tokenHealthService: TokenHealthService
  private statsService: StatsService
  private rateLimitAnalyzer: RateLimitAnalyzer

  constructor() {
    this.supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey)
    this.tokenHealthService = new TokenHealthService()
    this.statsService = new StatsService()
    this.rateLimitAnalyzer = new RateLimitAnalyzer()
  }

  /**
   * Main crawler method
   */
  async crawlStravaData(options: CrawlerOptions = {}): Promise<{
    success: boolean
    users_processed: number
    users_successful: number
    total_activities: number
    total_segments: number
    results: CrawlerResult[]
    rate_limit_blocked?: boolean
    next_run_time?: Date
  }> {
    const startTime = Date.now()
    console.log('🚀 Starting Strava data crawler...')

    // Step 0: Analyze rate limits before starting
    console.log('📊 Analyzing rate limits before crawling...')
    let rateLimitAnalysis
    try {
      rateLimitAnalysis = await this.rateLimitAnalyzer.analyzeRateLimits()
      const summary = await this.rateLimitAnalyzer.getRateLimitSummary()
      console.log(summary)
      
      // Check if we should proceed based on rate limit analysis
      if (!rateLimitAnalysis.recommendations.shouldProceed) {
        console.log(`⚠️ Rate limit analysis suggests not proceeding: ${rateLimitAnalysis.recommendations.reason}`)
        console.log(`⏰ Next recommended run time: ${rateLimitAnalysis.recommendations.nextRunTime.toLocaleString()}`)
        
        // Log the decision not to proceed
        await this.logCrawlerResult({
          user_id: null, // System log
          status: 'partial',
          message: `Crawler skipped due to rate limits: ${rateLimitAnalysis.recommendations.reason}`,
          activities_fetched: 0,
          segments_fetched: 0,
          segment_efforts_fetched: 0,
          execution_time_ms: Date.now() - startTime,
          rate_limit_status: {
            mode: rateLimitAnalysis.currentStatus.mode,
            requests15min: rateLimitAnalysis.currentStatus.requests15min,
            requestsDay: rateLimitAnalysis.currentStatus.requestsDay,
            limit15min: rateLimitAnalysis.currentStatus.limit15min,
            limitDay: rateLimitAnalysis.currentStatus.limitDay
          }
        })
        
        return {
          success: false,
          users_processed: 0,
          users_successful: 0,
          total_activities: 0,
          total_segments: 0,
          results: [],
          rate_limit_blocked: true,
          next_run_time: rateLimitAnalysis.recommendations.nextRunTime
        }
      }
      
      // Update options based on rate limit analysis
      if (rateLimitAnalysis.recommendations.suggestedBatchSize !== config.stravaApiLimits.maxCrawlerBatchSize) {
        options.batch_size = rateLimitAnalysis.recommendations.suggestedBatchSize
        console.log(`📦 Adjusted batch size to ${options.batch_size} based on rate limit analysis`)
      }
      
    } catch (rateLimitError: any) {
      console.warn(`⚠️ Rate limit analysis failed: ${rateLimitError.message}`)
      console.log('🔄 Proceeding with default settings...')
    }

    // Track overall rate limit status across all users
    let overallRateLimitStatus = {
      mode: rateLimitAnalysis?.currentStatus.mode || 'unknown',
      requests15min: rateLimitAnalysis?.currentStatus.requests15min || 0,
      requestsDay: rateLimitAnalysis?.currentStatus.requestsDay || 0,
      limit15min: config.stravaApiLimits.requestsPer15Min,
      limitDay: config.stravaApiLimits.requestsPerDay
    }

    // Log the start of the crawler run
    let startLogId: string | null = null
    try {
      await this.logCrawlerResult({
        user_id: null, // System log
        status: 'partial',
        message: 'Crawler started - initializing...',
        activities_fetched: 0,
        segments_fetched: 0,
        segment_efforts_fetched: 0,
        execution_time_ms: 0,
        rate_limit_status: overallRateLimitStatus
      })
    } catch (logError) {
      console.error('❌ Failed to log crawler start:', logError)
    }

    try {
      // Step 1: Check token health if requested
      if (options.skip_invalid_tokens) {
        console.log('🔍 Checking token health before crawling...')
        try {
          const tokenHealth = await this.tokenHealthService.checkAllTokenHealth()
          const usersWithValidTokens = tokenHealth.filter(status => !status.needs_reauthentication)
          console.log(`✅ Found ${usersWithValidTokens.length} users with valid tokens out of ${tokenHealth.length} total users`)
        } catch (tokenError: any) {
          console.error('❌ Token health check failed:', tokenError)
          throw new Error(`Token health check failed: ${tokenError.message}`)
        }
      }

      // Step 2: Get users to process
      let users: any[] = []
      try {
        users = await this.getUsersToProcess(options.skip_invalid_tokens)
        console.log(`👥 Processing ${users.length} users...`)
        
        if (users.length === 0) {
          throw new Error('No users found to process')
        }
      } catch (userError: any) {
        console.error('❌ Failed to get users:', userError)
        throw new Error(`Failed to get users: ${userError.message}`)
      }

      // Step 3: Process each user with individual error handling
      const results: CrawlerResult[] = []
      let totalActivities = 0
      let totalSegments = 0
      let totalSegmentEfforts = 0
      let successfulUsers = 0
      let failedUsers = 0
      const userErrors: string[] = []

      for (const user of users) {
        const userStartTime = Date.now()
        let userRateLimitStatus = null
        
        try {
          console.log(`🔄 Processing user: ${user.firstname} ${user.lastname} (${user.strava_id})`)
          const result = await this.processUser(user, options)
          results.push(result)

          // Capture rate limit status from this user's processing
          if (this.stravaService) {
            try {
              userRateLimitStatus = this.stravaService.getRateLimitStatus()
              // Update overall rate limit status with the highest usage seen
              overallRateLimitStatus.mode = userRateLimitStatus.mode
              overallRateLimitStatus.requests15min = Math.max(overallRateLimitStatus.requests15min, userRateLimitStatus.requests15min)
              overallRateLimitStatus.requestsDay = Math.max(overallRateLimitStatus.requestsDay, userRateLimitStatus.requestsDay)
            } catch (rateLimitError: any) {
              console.warn(`⚠️ Failed to get rate limit status for user ${user.firstname}: ${rateLimitError.message}`)
            }
          }

          if (result.success) {
            successfulUsers++
            totalActivities += result.activities_fetched
            totalSegments += result.segments_fetched
            totalSegmentEfforts += result.segment_efforts_fetched
            console.log(`✅ User ${user.firstname} ${user.lastname} processed successfully`)
          } else {
            failedUsers++
            const errorMsg = `User ${user.firstname} ${user.lastname} failed: ${result.message}`
            userErrors.push(errorMsg)
            console.error(`❌ ${errorMsg}`)
          }
        } catch (userProcessError: any) {
          failedUsers++
          const errorMsg = `User ${user.firstname} ${user.lastname} processing error: ${userProcessError.message}`
          userErrors.push(errorMsg)
          console.error(`❌ ${errorMsg}`)
          
          // Try to get rate limit status even on error
          if (this.stravaService) {
            try {
              userRateLimitStatus = this.stravaService.getRateLimitStatus()
              overallRateLimitStatus.mode = userRateLimitStatus.mode
              overallRateLimitStatus.requests15min = Math.max(overallRateLimitStatus.requests15min, userRateLimitStatus.requests15min)
              overallRateLimitStatus.requestsDay = Math.max(overallRateLimitStatus.requestsDay, userRateLimitStatus.requestsDay)
            } catch (rateLimitError: any) {
              console.warn(`⚠️ Failed to get rate limit status for failed user ${user.firstname}: ${rateLimitError.message}`)
            }
          }
          
          // Log individual user failure with actual execution time
          try {
            const userExecutionTime = Date.now() - userStartTime
            await this.logCrawlerResult({
              user_id: Number(user.strava_id),
              status: 'error',
              message: errorMsg,
              activities_fetched: 0,
              segments_fetched: 0,
              segment_efforts_fetched: 0,
              execution_time_ms: userExecutionTime,
              error: userProcessError.message,
              rate_limit_status: userRateLimitStatus ? {
                mode: userRateLimitStatus.mode,
                requests15min: userRateLimitStatus.requests15min,
                requestsDay: userRateLimitStatus.requestsDay,
                limit15min: config.stravaApiLimits.requestsPer15Min,
                limitDay: config.stravaApiLimits.requestsPerDay
              } : undefined
            })
          } catch (logError) {
            console.error('❌ Failed to log user error:', logError)
          }
        }
      }

      const executionTime = Date.now() - startTime
      
      // Determine overall status
      const overallStatus = failedUsers === 0 ? 'success' : 
                           successfulUsers > 0 ? 'partial' : 'error'
      
      const summary = {
        success: overallStatus !== 'error',
        users_processed: users.length,
        users_successful: successfulUsers,
        total_activities: totalActivities,
        total_segments: totalSegments,
        results
      }

      // Step 4: Log the overall result with comprehensive error reporting
      const logMessage = overallStatus === 'success' 
        ? `Crawler completed successfully: ${successfulUsers}/${users.length} users, ${totalActivities} activities, ${totalSegments} segments, ${totalSegmentEfforts} segment efforts`
        : overallStatus === 'partial'
        ? `Crawler completed partially: ${successfulUsers}/${users.length} users successful, ${failedUsers} failed. ${totalActivities} activities, ${totalSegments} segments, ${totalSegmentEfforts} segment efforts. Errors: ${userErrors.slice(0, 3).join('; ')}${userErrors.length > 3 ? '...' : ''}`
        : `Crawler failed: ${failedUsers}/${users.length} users failed. Errors: ${userErrors.slice(0, 5).join('; ')}${userErrors.length > 5 ? '...' : ''}`

      await this.logCrawlerResult({
        user_id: null, // System log
        status: overallStatus,
        message: logMessage,
        activities_fetched: totalActivities,
        segments_fetched: totalSegments,
        segment_efforts_fetched: totalSegmentEfforts,
        execution_time_ms: executionTime,
        error: userErrors.length > 0 ? userErrors.join('; ') : undefined,
        rate_limit_status: overallRateLimitStatus
      })

      // Step 5: Refresh cache after successful crawl (only if some users succeeded)
      if (successfulUsers > 0) {
        console.log('🔄 Refreshing cache...')
        try {
          await this.statsService.refreshCache()
          console.log('✅ Cache refreshed successfully')
        } catch (cacheError: any) {
          console.warn('⚠️ Failed to refresh cache:', cacheError)
          // Log cache refresh failure but don't fail the entire crawl
          try {
            await this.logCrawlerResult({
              user_id: null,
              status: 'partial',
              message: `Crawler completed but cache refresh failed: ${cacheError.message}`,
              activities_fetched: totalActivities,
              segments_fetched: totalSegments,
              segment_efforts_fetched: totalSegmentEfforts,
              execution_time_ms: executionTime,
              error: `Cache refresh failed: ${cacheError.message}`,
              rate_limit_status: overallRateLimitStatus
            })
          } catch (logError) {
            console.error('❌ Failed to log cache refresh error:', logError)
          }
        }
      }

      console.log(`✅ Crawler completed with status: ${overallStatus}`)
      return summary

    } catch (error: any) {
      const executionTime = Date.now() - startTime
      console.error('❌ Crawler failed with critical error:', error)

      // Log the critical failure
      try {
        await this.logCrawlerResult({
          user_id: null, // System log
          status: 'error',
          message: `Crawler failed with critical error: ${error.message}`,
          activities_fetched: 0,
          segments_fetched: 0,
          segment_efforts_fetched: 0,
          execution_time_ms: executionTime,
          error: error.message,
          rate_limit_status: overallRateLimitStatus
        })
      } catch (logError: any) {
        console.error('❌ Failed to log critical error:', logError)
        // If we can't even log the error, this is a serious system failure
        throw new Error(`Critical crawler failure and logging failed: ${error.message}. Log error: ${logError.message}`)
      }

      return {
        success: false,
        users_processed: 0,
        users_successful: 0,
        total_activities: 0,
        total_segments: 0,
        results: []
      }
    }
  }

  /**
   * Get users to process, optionally filtering by token health
   */
  private async getUsersToProcess(skipInvalidTokens = false): Promise<any[]> {
    if (skipInvalidTokens) {
      // Get only users with valid tokens
      const tokenHealth = await this.tokenHealthService.checkAllTokenHealth()
      const validUserIds = tokenHealth
        .filter(status => !status.needs_reauthentication)
        .map(status => status.strava_id)

      if (validUserIds.length === 0) {
        console.log('⚠️  No users with valid tokens found')
        return []
      }

      const { data: users, error } = await this.supabase
        .from('users')
        .select('*')
        .in('strava_id', validUserIds)

      if (error) {
        console.error('Failed to fetch users with valid tokens:', error)
        return []
      }

      return users || []
    } else {
      // Get all users
      const { data: users, error } = await this.supabase
        .from('users')
        .select('*')

      if (error) {
        console.error('Failed to fetch users:', error)
        return []
      }

      return users || []
    }
  }

  /**
   * Process a single user's Strava data
   */
  private async processUser(user: any, _options: CrawlerOptions = {}): Promise<CrawlerResult> {
    const startTime = Date.now()
    
    // Validate user data and ensure strava_id is a number
    if (!user.strava_id || isNaN(Number(user.strava_id))) {
      throw new Error(`Invalid user data: strava_id must be a number, got ${user.strava_id}`)
    }
    
    const stravaId = Number(user.strava_id)
    
    const result: CrawlerResult = {
      user_id: stravaId,
      user_name: `${user.firstname} ${user.lastname}`,
      success: false,
      activities_fetched: 0,
      segments_fetched: 0,
      segment_efforts_fetched: 0,
      message: '',
      errors: [],
      execution_time_ms: 0
    }

    try {
      console.log(`🔄 Processing user: ${user.firstname} ${user.lastname} (${stravaId})`)
      
      // Step 1: Initialize StravaService for this user
      try {
        this.stravaService = new StravaService(stravaId)
      } catch (initError: any) {
        throw new Error(`Failed to initialize StravaService: ${initError.message}`)
      }
      
      // Step 2: Log initial rate limit status
      let initialRateLimitStatus
      try {
        initialRateLimitStatus = this.stravaService.getRateLimitStatus()
        console.log(`📊 Initial rate limit status for ${user.firstname}: ${initialRateLimitStatus.mode} - 15min: ${initialRateLimitStatus.requests15min}/${config.stravaApiLimits.requestsPer15Min}, Day: ${initialRateLimitStatus.requestsDay}/${config.stravaApiLimits.requestsPerDay}`)
      } catch (rateLimitError: any) {
        console.warn(`⚠️ Failed to get initial rate limit status for ${user.firstname}: ${rateLimitError.message}`)
      }

      // Step 3: Use comprehensive sync to ensure ALL activities and segments are fetched
      let syncResult
      try {
        syncResult = await this.stravaService.syncAllData()
        result.activities_fetched = syncResult.activities.synced
        result.segments_fetched = syncResult.segments.segmentsAdded
        result.segment_efforts_fetched = syncResult.segmentEfforts.total
      } catch (syncError: any) {
        throw new Error(`Sync failed: ${syncError.message}`)
      }

      // Step 4: Log final rate limit status
      let finalRateLimitStatus
      try {
        finalRateLimitStatus = this.stravaService.getRateLimitStatus()
        console.log(`📊 Final rate limit status for ${user.firstname}: 15min: ${finalRateLimitStatus.requests15min}/${config.stravaApiLimits.requestsPer15Min}, Day: ${finalRateLimitStatus.requestsDay}/${config.stravaApiLimits.requestsPerDay}`)
      } catch (rateLimitError: any) {
        console.warn(`⚠️ Failed to get final rate limit status for ${user.firstname}: ${rateLimitError.message}`)
      }

      result.execution_time_ms = Date.now() - startTime
      result.success = true
      result.message = `Successfully processed: ${result.activities_fetched} activities, ${result.segments_fetched} segments, ${result.segment_efforts_fetched} segment efforts`
      console.log(`✅ User ${user.firstname} ${user.lastname} processed: ${result.activities_fetched} activities, ${result.segments_fetched} segments, ${result.segment_efforts_fetched} segment efforts`)

    } catch (error: any) {
      result.success = false // Ensure success is false on error
      if (!result.errors) result.errors = []
      result.errors.push(error.message)
      result.execution_time_ms = Date.now() - startTime

      // Handle specific error types with enhanced logging and categorization
      if (error.message.includes('Invalid refresh token') || error.message.includes('401')) {
        result.message = `User ${user.firstname} ${user.lastname} needs to re-authenticate with Strava`
        console.log(`⚠️ User ${user.firstname} ${user.lastname} (${stravaId}) needs re-authentication`)
      } else if (error.message.includes('Rate limit exceeded') || error.message.includes('429')) {
        result.message = `Rate limit hit while processing user ${user.firstname} ${user.lastname}`
        console.log(`⚠️ Rate limit exceeded for user ${user.firstname} ${user.lastname} (${stravaId})`)
        
        // Log detailed rate limit information
        try {
          if (this.stravaService) {
            const rateLimitStatus = this.stravaService.getRateLimitStatus()
            console.log(`📊 Rate limit details at failure: ${rateLimitStatus.mode} - 15min: ${rateLimitStatus.requests15min}/${config.stravaApiLimits.requestsPer15Min}, Day: ${rateLimitStatus.requestsDay}/${config.stravaApiLimits.requestsPerDay}`)
          }
        } catch (rateLimitError: any) {
          console.warn(`⚠️ Failed to get rate limit status at failure: ${rateLimitError.message}`)
        }
      } else if (error.message.includes('Network') || error.message.includes('fetch') || error.message.includes('timeout')) {
        result.message = `Network error while processing user ${user.firstname} ${user.lastname}: ${error.message}`
        console.error(`🌐 Network error processing user ${user.firstname} ${user.lastname} (${stravaId}):`, error)
      } else if (error.message.includes('Database') || error.message.includes('supabase')) {
        result.message = `Database error while processing user ${user.firstname} ${user.lastname}: ${error.message}`
        console.error(`🗄️ Database error processing user ${user.firstname} ${user.lastname} (${stravaId}):`, error)
      } else {
        result.message = `Unexpected error processing user ${user.firstname} ${user.lastname}: ${error.message}`
        console.error(`❌ Unexpected error processing user ${user.firstname} ${user.lastname} (${stravaId}):`, error)
      }
    }

    // Step 5: Log individual user result with error handling
    try {
      const rateLimitStatus = this.stravaService ? this.stravaService.getRateLimitStatus() : null
      await this.logCrawlerResult({
        user_id: stravaId,
        status: result.success ? 'success' : 'error',
        message: result.message,
        activities_fetched: result.activities_fetched,
        segments_fetched: result.segments_fetched,
        segment_efforts_fetched: result.segment_efforts_fetched,
        execution_time_ms: result.execution_time_ms,
        error: result.errors?.join(', '),
        rate_limit_status: rateLimitStatus ? {
          mode: rateLimitStatus.mode,
          requests15min: rateLimitStatus.requests15min,
          requestsDay: rateLimitStatus.requestsDay,
          limit15min: config.stravaApiLimits.requestsPer15Min,
          limitDay: config.stravaApiLimits.requestsPerDay
        } : undefined
      })
    } catch (logError: any) {
      console.error(`❌ Failed to log result for user ${user.firstname} ${user.lastname}:`, logError)
      // Add logging failure to errors but don't fail the entire process
      if (!result.errors) result.errors = []
      result.errors.push(`Logging failed: ${logError.message}`)
    }

    return result
  }

  /**
   * Log crawler results to database with comprehensive error handling
   */
  private async logCrawlerResult(logEntry: Omit<CrawlerLogEntry, 'run_at'>) {
    try {
      // Validate log entry before inserting
      if (!logEntry.status || !['success', 'error', 'partial'].includes(logEntry.status)) {
        throw new Error(`Invalid status: ${logEntry.status}`)
      }

      if (!logEntry.message) {
        throw new Error('Message is required')
      }

      // Validate user_id if provided
      if (logEntry.user_id !== null && logEntry.user_id !== undefined) {
        if (isNaN(Number(logEntry.user_id))) {
          throw new Error(`Invalid user_id: must be a number, got ${logEntry.user_id}`)
        }
      }

      // Ensure numeric fields are valid
      const validatedEntry = {
        ...logEntry,
        user_id: logEntry.user_id !== null && logEntry.user_id !== undefined ? Number(logEntry.user_id) : null,
        activities_fetched: Math.max(0, logEntry.activities_fetched || 0),
        segments_fetched: Math.max(0, logEntry.segments_fetched || 0),
        segment_efforts_fetched: Math.max(0, logEntry.segment_efforts_fetched || 0),
        execution_time_ms: Math.max(0, logEntry.execution_time_ms || 0),
        run_at: new Date().toISOString()
      }

      const { error } = await this.supabase
        .from('strava_crawler_logs')
        .insert(validatedEntry)

      if (error) {
        console.error('❌ Database error logging crawler result:', error)
        throw new Error(`Database insert failed: ${error.message}`)
      }

      console.log(`📝 Logged crawler result: ${logEntry.status} - ${logEntry.message}`)
    } catch (error: any) {
      console.error('❌ Failed to log crawler result:', error)
      
      // Try to log the logging failure to console with detailed information
      console.error('📋 Log entry that failed:', {
        user_id: logEntry.user_id,
        status: logEntry.status,
        message: logEntry.message,
        activities_fetched: logEntry.activities_fetched,
        segments_fetched: logEntry.segments_fetched,
        execution_time_ms: logEntry.execution_time_ms,
        error: logEntry.error
      })
      
      // Re-throw the error so calling code can handle it
      throw error
    }
  }

  /**
   * Get recent crawler logs
   */
  async getRecentLogs(limit: number = 10): Promise<CrawlerLogEntry[]> {
    const { data, error } = await this.supabase
      .from('strava_crawler_logs')
      .select('*')
      .order('run_at', { ascending: false })
      .limit(limit)

    if (error) {
      throw new Error(`Failed to fetch logs: ${error.message}`)
    }

    return (data as unknown as CrawlerLogEntry[]) || []
  }

  /**
   * Get crawler statistics
   */
  async getCrawlerStats() {
    const { data: logs, error } = await this.supabase
      .from('strava_crawler_logs')
      .select('*')
      .gte('run_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours

    if (error) {
      throw new Error(`Failed to fetch stats: ${error.message}`)
    }

    const typedLogs = (logs as unknown as CrawlerLogEntry[]) || []
    const totalRuns = typedLogs.length
    const successfulRuns = typedLogs.filter(log => log.status === 'success').length
    const totalActivities = typedLogs.reduce((sum, log) => sum + (log.activities_fetched || 0), 0)
    const totalSegments = typedLogs.reduce((sum, log) => sum + (log.segments_fetched || 0), 0)

    return {
      total_runs_24h: totalRuns,
      successful_runs_24h: successfulRuns,
      success_rate: totalRuns > 0 ? (successfulRuns / totalRuns) * 100 : 0,
      total_activities_24h: totalActivities,
      total_segments_24h: totalSegments,
      last_run: typedLogs[0]?.run_at
    }
  }

  /**
   * Get comprehensive entity statistics
   */
  async getEntityStats() {
    try {
      // Get total counts from database
      const [activitiesCount, segmentsCount, segmentEffortsCount, usersCount] = await Promise.all([
        this.supabase.from('activities').select('*', { count: 'exact', head: true }),
        this.supabase.from('segments').select('*', { count: 'exact', head: true }),
        this.supabase.from('segment_efforts').select('*', { count: 'exact', head: true }),
        this.supabase.from('users').select('*', { count: 'exact', head: true })
      ])

      // Get recent crawler activity (last 7 days)
      const { data: recentLogs } = await this.supabase
        .from('strava_crawler_logs')
        .select('*')
        .gte('run_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order('run_at', { ascending: false })

      const typedLogs = (recentLogs as unknown as CrawlerLogEntry[]) || []
      const recentActivities = typedLogs.reduce((sum, log) => sum + (log.activities_fetched || 0), 0)
      const recentSegments = typedLogs.reduce((sum, log) => sum + (log.segments_fetched || 0), 0)

      return {
        totals: {
          activities: activitiesCount.count || 0,
          segments: segmentsCount.count || 0,
          segment_efforts: segmentEffortsCount.count || 0,
          users: usersCount.count || 0
        },
        recent_activity: {
          activities_fetched_7d: recentActivities,
          segments_fetched_7d: recentSegments,
          last_crawler_run: typedLogs[0]?.run_at
        },
        summary: {
          total_entities: (activitiesCount.count || 0) + (segmentsCount.count || 0) + (segmentEffortsCount.count || 0),
          active_users: usersCount.count || 0,
          data_freshness: typedLogs[0]?.run_at ? new Date(typedLogs[0].run_at).toISOString() : null
        }
      }
    } catch (error) {
      console.error('Failed to get entity stats:', error)
      return {
        totals: { activities: 0, segments: 0, segment_efforts: 0, users: 0 },
        recent_activity: { activities_fetched_7d: 0, segments_fetched_7d: 0, last_crawler_run: null },
        summary: { total_entities: 0, active_users: 0, data_freshness: null }
      }
    }
  }
} 