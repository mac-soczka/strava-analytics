import { createClient } from '@supabase/supabase-js'
import { config } from '@/lib/config'

export interface TokenHealthStatus {
  strava_id: number
  user_name: string
  token_status: 'valid' | 'expired' | 'invalid' | 'missing'
  last_check: string
  expires_at?: string
  needs_reauthentication: boolean
  error_message?: string
}

export class TokenHealthService {
  private supabase: ReturnType<typeof createClient>

  constructor() {
    this.supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey)
  }

  /**
   * Check health of all user tokens
   */
  async checkAllTokenHealth(): Promise<TokenHealthStatus[]> {
    console.log('🔍 Checking token health for all users...')

    // Get all users
    const { data: users, error: usersError } = await this.supabase
      .from('users')
      .select('strava_id, firstname, lastname')

    // Get all tokens separately
    const { data: tokens, error: tokensError } = await this.supabase
      .from('strava_tokens')
      .select('*')

    if (tokensError) {
      console.error('Failed to fetch tokens:', tokensError)
      return []
    }

    const healthStatuses: TokenHealthStatus[] = []

    for (const user of users || []) {
      const userTokens = tokens?.filter(t => t.strava_id === user.strava_id) || []
      const status = await this.checkUserTokenHealth(user, userTokens[0])
      healthStatuses.push(status)
    }

    return healthStatuses
  }

  /**
   * Check health of a specific user's token
   */
  async checkUserTokenHealth(user: any, tokens?: any): Promise<TokenHealthStatus> {
    const stravaId = user.strava_id
    const userName = `${user.firstname} ${user.lastname}`

    if (!tokens) {
      return {
        strava_id: stravaId,
        user_name: userName,
        token_status: 'missing',
        last_check: new Date().toISOString(),
        needs_reauthentication: true,
        error_message: 'No tokens found'
      }
    }

    // Check if token is expired
    const expiresAt = new Date(tokens.expires_at)
    const now = new Date()
    const isExpired = expiresAt <= now

    if (isExpired) {
      // Try to refresh the token
      try {
        await this.attemptTokenRefresh(stravaId, tokens.refresh_token)
        return {
          strava_id: stravaId,
          user_name: userName,
          token_status: 'valid',
          last_check: new Date().toISOString(),
          expires_at: tokens.expires_at,
          needs_reauthentication: false
        }
      } catch (error: any) {
        return {
          strava_id: stravaId,
          user_name: userName,
          token_status: 'invalid',
          last_check: new Date().toISOString(),
          expires_at: tokens.expires_at,
          needs_reauthentication: true,
          error_message: error.message
        }
      }
    }

    return {
      strava_id: stravaId,
      user_name: userName,
      token_status: 'valid',
      last_check: new Date().toISOString(),
      expires_at: tokens.expires_at,
      needs_reauthentication: false
    }
  }

  /**
   * Attempt to refresh a user's token
   */
  private async attemptTokenRefresh(stravaId: number, refreshToken: string): Promise<void> {
    const response = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: config.strava.clientId,
        client_secret: config.strava.clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      let errorDetails
      try {
        errorDetails = JSON.parse(errorText)
      } catch (e) {
        errorDetails = { message: errorText }
      }

      if (response.status === 400 && errorDetails.errors?.some((e: any) => e.code === 'invalid')) {
        throw new Error(`Invalid refresh token - user ${stravaId} needs to re-authenticate with Strava`)
      }
      throw new Error(`Failed to refresh tokens: ${response.status} - ${errorDetails.message || errorText}`)
    }

    const newTokens = await response.json()

    // Save new tokens to database
    const { error: updateError } = await this.supabase
      .from('strava_tokens')
      .upsert({
        strava_id: stravaId,
        access_token: newTokens.access_token,
        refresh_token: newTokens.refresh_token,
        expires_at: new Date(newTokens.expires_at * 1000).toISOString(),
      })

    if (updateError) {
      throw new Error(`Failed to save refreshed tokens: ${updateError.message}`)
    }

    console.log(`✅ Token refresh successful for user ${stravaId}`)
  }

  /**
   * Get users that need re-authentication
   */
  async getUsersNeedingReauthentication(): Promise<TokenHealthStatus[]> {
    const allStatuses = await this.checkAllTokenHealth()
    return allStatuses.filter(status => status.needs_reauthentication)
  }

  /**
   * Clean up invalid tokens (optional - removes tokens that can't be refreshed)
   */
  async cleanupInvalidTokens(): Promise<{ removed: number; errors: number }> {
    console.log('🧹 Cleaning up invalid tokens...')

    const invalidUsers = await this.getUsersNeedingReauthentication()
    let removed = 0
    let errors = 0

    for (const user of invalidUsers) {
      try {
        // Only remove tokens that are definitely invalid (not just expired)
        if (user.token_status === 'invalid') {
          const { error } = await this.supabase
            .from('strava_tokens')
            .delete()
            .eq('strava_id', user.strava_id)

          if (error) {
            console.error(`Failed to remove tokens for user ${user.strava_id}:`, error)
            errors++
          } else {
            console.log(`✅ Removed invalid tokens for user ${user.strava_id}`)
            removed++
          }
        }
      } catch (error) {
        console.error(`Error cleaning up tokens for user ${user.strava_id}:`, error)
        errors++
      }
    }

    return { removed, errors }
  }

  /**
   * Log token health status
   */
  async logTokenHealthStatus(): Promise<void> {
    const statuses = await this.checkAllTokenHealth()
    
    console.log('\n📊 Token Health Report:')
    console.log('='.repeat(50))
    
    const valid = statuses.filter(s => s.token_status === 'valid').length
    const expired = statuses.filter(s => s.token_status === 'expired').length
    const invalid = statuses.filter(s => s.token_status === 'invalid').length
    const missing = statuses.filter(s => s.token_status === 'missing').length
    
    console.log(`✅ Valid tokens: ${valid}`)
    console.log(`⏰ Expired tokens: ${expired}`)
    console.log(`❌ Invalid tokens: ${invalid}`)
    console.log(`🚫 Missing tokens: ${missing}`)
    console.log(`📊 Total users: ${statuses.length}`)
    
    if (invalid > 0 || missing > 0) {
      console.log('\n🚨 Users needing re-authentication:')
      statuses
        .filter(s => s.needs_reauthentication)
        .forEach(user => {
          console.log(`  - ${user.user_name} (${user.strava_id}): ${user.error_message || 'No tokens'}`)
        })
    }
  }
} 