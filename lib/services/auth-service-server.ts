import { supabase as serverSupabase } from '@/lib/database'
import { getUserByStravaId, getTokensByStravaId, upsertTokens } from '@/lib/database'
import crypto from 'crypto'

// Types
export interface AppSession {
  id: string
  strava_id: number
  session_token: string
  expires_at: string
  created_at: string
}

export interface AuthUser {
  id: string
  strava_id: number
  firstname: string
  lastname: string
  city?: string
  state?: string
  country?: string
  profile_picture?: string
}

// Utility functions
function generateSecureToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

function generateCSRFToken(): string {
  return crypto.randomBytes(16).toString('hex')
}

// Session management for server-side
export class SessionManagerServer {
  static async createSession(stravaId: number): Promise<{ sessionToken: string; expiresAt: string }> {
    const sessionToken = generateSecureToken()
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours

    console.log('🔧 Creating session for strava_id:', stravaId)
    console.log('🔧 Session token:', sessionToken)
    console.log('🔧 Expires at:', expiresAt)
    console.log('🔧 ServerSupabase client:', !!serverSupabase)

    try {
      const { error } = await serverSupabase
        .from('app_sessions')
        .insert({
          strava_id: stravaId,
          session_token: sessionToken,
          expires_at: expiresAt
        })

      if (error) {
        console.error('❌ Session creation error:', error)
        throw new Error(`Failed to create session: ${error.message}`)
      }
    } catch (_error) {
      console.error('Failed to create session:', _error)
      throw new Error('Failed to create session')
    }

    console.log('✅ Session created successfully')
    return { sessionToken, expiresAt }
  }

  static async validateSession(sessionToken: string): Promise<number | null> {
    if (!sessionToken) return null

    try {
      const { data, error } = await serverSupabase
        .from('app_sessions')
        .select('strava_id, expires_at')
        .eq('session_token', sessionToken)
        .single()

      if (error || !data) return null

      if (new Date(data.expires_at) < new Date()) {
        // Session expired, clean it up
        await this.deleteSession(sessionToken)
        return null
      }

      return data.strava_id
    } catch (error) {
      return null
    }
  }

  static async deleteSession(sessionToken: string): Promise<void> {
    await serverSupabase
      .from('app_sessions')
      .delete()
      .eq('session_token', sessionToken)
  }

  static async rotateSession(oldToken: string): Promise<string | null> {
    try {
      const newToken = generateSecureToken()
      const { error } = await serverSupabase
        .from('app_sessions')
        .update({ 
          session_token: newToken,
          updated_at: new Date().toISOString()
        })
        .eq('session_token', oldToken)

      if (error) return null
      return newToken
    } catch (error) {
      return null
    }
  }

  static async cleanupExpiredSessions(): Promise<void> {
    await serverSupabase
      .from('app_sessions')
      .delete()
      .lt('expires_at', new Date().toISOString())
  }
}

// Token management
export class TokenManagerServer {
  static async getValidTokens(stravaId: number): Promise<any> {
    try {
      const tokens = await getTokensByStravaId(stravaId)
      const expiresAt = new Date(tokens.expires_at)
      
      // If token expires in next 5 minutes, refresh it
      if (expiresAt <= new Date(Date.now() + 5 * 60 * 1000)) {
        return await this.refreshTokens(tokens.refresh_token, stravaId)
      }
      
      return tokens
    } catch (error) {
      throw new Error(`Failed to get valid tokens: ${error}`)
    }
  }

  static async refreshTokens(refreshToken: string, stravaId: number): Promise<any> {
    try {
      const response = await fetch('https://www.strava.com/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: process.env.STRAVA_CLIENT_ID,
          client_secret: process.env.STRAVA_CLIENT_SECRET,
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to refresh Strava token')
      }

      const data = await response.json()
      
      // Update tokens in database
      await upsertTokens({
        strava_id: stravaId,
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: new Date(data.expires_at * 1000).toISOString()
      })

      return {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: new Date(data.expires_at * 1000).toISOString()
      }
    } catch (error) {
      throw new Error(`Token refresh failed: ${error}`)
    }
  }
}

// Main authentication service for server-side
export class AuthServiceServer {
  static async authenticateUser(stravaId: number): Promise<{ sessionToken: string; expiresAt: string; user: AuthUser }> {
    try {
      // Get user data
      const user = await getUserByStravaId(stravaId)
      if (!user) {
        throw new Error('User not found')
      }

      // Create app session
      const { sessionToken, expiresAt } = await SessionManagerServer.createSession(stravaId)

      return {
        sessionToken,
        expiresAt,
        user: {
          id: user.id,
          strava_id: user.strava_id,
          firstname: user.firstname,
          lastname: user.lastname,
          city: user.city,
          state: user.state,
          country: user.country,
          profile_picture: user.profile_picture
        }
      }
    } catch (error) {
      throw new Error(`Authentication failed: ${error}`)
    }
  }

  static async getCurrentUser(sessionToken: string): Promise<AuthUser | null> {
    try {
      const stravaId = await SessionManagerServer.validateSession(sessionToken)
      if (!stravaId) return null

      const user = await getUserByStravaId(stravaId)
      if (!user) return null

      return {
        id: user.id,
        strava_id: user.strava_id,
        firstname: user.firstname,
        lastname: user.lastname,
        city: user.city,
        state: user.state,
        country: user.country,
        profile_picture: user.profile_picture
      }
    } catch (error) {
      return null
    }
  }

  static async logout(sessionToken: string): Promise<void> {
    await SessionManagerServer.deleteSession(sessionToken)
  }

  static generateCSRFToken(): string {
    return generateCSRFToken()
  }

  static validateCSRFToken(token: string, storedToken: string): boolean {
    return token === storedToken
  }
}

// Cookie utilities for server-side
export class CookieManagerServer {
  static setSessionCookie(sessionToken: string, expiresAt: string): string {
    const expires = new Date(expiresAt)
    
    return `app_session=${sessionToken}; HttpOnly; Secure=${process.env.NODE_ENV === 'production'}; SameSite=Lax; Expires=${expires.toUTCString()}; Path=/`
  }

  static setCSRFCookie(csrfToken: string): string {
    return `csrf_token=${csrfToken}; HttpOnly; Secure=${process.env.NODE_ENV === 'production'}; SameSite=Lax; Max-Age=86400; Path=/`
  }

  static clearSessionCookie(): string {
    return `app_session=; HttpOnly; Secure=${process.env.NODE_ENV === 'production'}; SameSite=Lax; Max-Age=0; Path=/`
  }
} 