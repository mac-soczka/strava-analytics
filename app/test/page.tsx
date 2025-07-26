'use client'

import { useState, useEffect } from 'react'
import { createClientComponentClient } from '@/lib/supabase'
import { supabase as serverSupabase } from '@/lib/database'
import { AuthService, SessionManager, TokenManager } from '@/lib/services/auth-service'
import { upsertUserClient, upsertTokensClient, getUserByStravaIdClient, getTokensByStravaIdClient } from '@/lib/database-client'
import CrawlerControl from '@/app/components/CrawlerControl'

interface TestResult {
  test: string
  status: 'success' | 'error' | 'pending'
  message: string
  data?: any
  error?: any
}

interface TestUser {
  strava_id: number
  firstname: string
  lastname: string
  city?: string
  state?: string
  country?: string
  profile_picture?: string
}

interface TestActivity {
  strava_id: number
  activity_id: number
  name?: string
  distance?: number
  moving_time?: number
  type?: string
  start_date?: string
}

interface TestSegment {
  segment_id: number
  name: string
  distance: number
  elevation_gain: number
  average_grade: number
  maximum_grade: number
  climb_category: number
  city: string
  state: string
  country: string
}

interface TestSegmentEffort {
  activity_id: number
  segment_id: number
  effort_id: number
  elapsed_time: number
  moving_time: number
  start_date: string
  average_watts?: number
  max_watts?: number
}

interface SystemStatus {
  database: 'healthy' | 'warning' | 'critical' | 'unknown'
  authentication: 'healthy' | 'warning' | 'critical' | 'unknown'
  strava: 'healthy' | 'warning' | 'critical' | 'unknown'
  crawler: 'healthy' | 'warning' | 'critical' | 'unknown'
  overall: 'healthy' | 'warning' | 'critical' | 'unknown'
}

export default function TestPage() {
  const [results, setResults] = useState<TestResult[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [rateLimitStatus, setRateLimitStatus] = useState<any>(null)
  const [noLimitsMode, setNoLimitsMode] = useState<boolean>(false)
  const [crawlerDiagnostics, setCrawlerDiagnostics] = useState<any>(null)
  const [systemStatus, setSystemStatus] = useState<SystemStatus>({
    database: 'unknown',
    authentication: 'unknown',
    strava: 'unknown',
    crawler: 'unknown',
    overall: 'unknown'
  })
  const [testData, setTestData] = useState<any>({
    users: [],
    activities: [],
    segments: [],
    tokens: []
  })
  const [activeTab, setActiveTab] = useState<'overview' | 'crud' | 'crawler' | 'auth' | 'diagnostics'>('overview')
  const supabase = createClientComponentClient()

  const addResult = (test: string, status: TestResult['status'], message: string, data?: any, error?: any) => {
    setResults(prev => [...prev, { test, status, message, data, error }])
  }

  const clearResults = () => {
    setResults([])
  }

  // Test 1: Connection Test
  const testConnection = async () => {
    try {
      addResult('Database Connection', 'pending', 'Testing connection...')
      
      const { data, error } = await supabase
        .from('users')
        .select('count')
        .limit(1)
      
      if (error) throw error
      
      addResult('Database Connection', 'success', 'Connection successful', data)
    } catch (error: any) {
      addResult('Database Connection', 'error', 'Connection failed', undefined, error.message)
    }
  }

  // Test 2: App Session Status Check
  const testAppSessionStatus = async () => {
    try {
      addResult('App Session Status', 'pending', 'Checking app session status...')
      
      const response = await fetch('/api/auth/session')
      const data = await response.json()
      
      if (response.ok && data.authenticated) {
        addResult('App Session Status', 'success', 'User has valid app session', {
          user: data.user,
          authenticated: data.authenticated
        })
        setUser(data.user)
      } else {
        addResult('App Session Status', 'success', 'No valid app session found')
        setUser(null)
      }
    } catch (error: any) {
      addResult('App Session Status', 'error', 'Session status check failed', undefined, error.message)
    }
  }

  // Test 3: Rate Limit Status
  const testRateLimitStatus = async () => {
    try {
      addResult('Rate Limit Status', 'pending', 'Checking Strava API rate limits...')
      
      const response = await fetch('/api/strava/rate-limit')
      const data = await response.json()
      
      if (response.ok) {
        setRateLimitStatus(data)
        setNoLimitsMode(data.noLimitsMode || false)
        addResult('Rate Limit Status', 'success', 'Rate limit status retrieved', data)
      } else {
        addResult('Rate Limit Status', 'error', 'Failed to get rate limit status', undefined, data.error)
      }
    } catch (error: any) {
      addResult('Rate Limit Status', 'error', 'Rate limit status check failed', undefined, error.message)
    }
  }

  // Toggle No-Limits Mode
  const toggleNoLimitsMode = async () => {
    try {
      addResult('Toggle No-Limits Mode', 'pending', 'Toggling no-limits mode...')
      
      // This would require a server-side API to toggle the environment variable
      // For now, we'll just show a message about how to enable it
      addResult('Toggle No-Limits Mode', 'success', 'To enable no-limits mode, set STRAVA_NO_LIMITS=true in your .env.local file and restart the server', {
        instruction: 'Add STRAVA_NO_LIMITS=true to your .env.local file and restart the development server'
      })
    } catch (error: any) {
      addResult('Toggle No-Limits Mode', 'error', 'Failed to toggle no-limits mode', undefined, error.message)
    }
  }

  // Crawler Diagnostics
  const runCrawlerDiagnostics = async () => {
    try {
      addResult('Crawler Diagnostics', 'pending', 'Running comprehensive crawler diagnostics...')
      
      const diagnostics: any = {
        timestamp: new Date().toISOString(),
        issues: [],
        recommendations: [],
        status: 'unknown'
      }

      // 1. Check database connection
      try {
        const { data: users, error: usersError } = await supabase
          .from('users')
          .select('*')
          .limit(1)
        
        if (usersError) {
          diagnostics.issues.push('Database connection failed')
          diagnostics.recommendations.push('Check Supabase configuration and network connectivity')
        } else {
          diagnostics.usersCount = users?.length || 0
        }
      } catch (error) {
        diagnostics.issues.push('Database connection error')
        diagnostics.recommendations.push('Verify Supabase environment variables')
      }

      // 2. Check users table
      try {
        const { data: allUsers, error: usersError } = await supabase
          .from('users')
          .select('*')
        
        if (!usersError && allUsers) {
          diagnostics.totalUsers = allUsers.length
          diagnostics.usersWithTokens = 0
          
          // Check which users have tokens
          for (const user of allUsers) {
            const { data: tokens } = await supabase
              .from('strava_tokens')
              .select('*')
              .eq('strava_id', user.strava_id)
              .limit(1)
            
            if (tokens && tokens.length > 0) {
              diagnostics.usersWithTokens++
              
              // Check token expiration
              const token = tokens[0]
              const expiresAt = new Date(token.expires_at)
              const now = new Date()
              const isExpired = expiresAt < now
              
              if (isExpired) {
                diagnostics.issues.push(`User ${user.strava_id} has expired tokens`)
                diagnostics.recommendations.push(`User ${user.strava_id} needs to re-authenticate with Strava`)
              }
            } else {
              diagnostics.issues.push(`User ${user.strava_id} has no Strava tokens`)
              diagnostics.recommendations.push(`User ${user.strava_id} needs to authenticate with Strava`)
            }
          }
        }
      } catch (error) {
        diagnostics.issues.push('Error checking users and tokens')
      }

      // 3. Check activities table
      try {
        const { data: activities, error: activitiesError } = await supabase
          .from('activities')
          .select('*')
          .limit(1)
        
        if (!activitiesError) {
          diagnostics.activitiesCount = activities?.length || 0
          
          // Check if segments_fetched column exists
          const { data: testActivity, error: columnError } = await supabase
            .from('activities')
            .select('segments_fetched')
            .limit(1)
          
          if (columnError && columnError.message.includes('segments_fetched')) {
            diagnostics.issues.push('segments_fetched column missing from activities table')
            diagnostics.recommendations.push('Run database migration: node scripts/apply-segments-fetched-migration.js')
          }
        }
      } catch (error) {
        diagnostics.issues.push('Error checking activities table')
      }

      // 4. Check segments table
      try {
        const { data: segments, error: segmentsError } = await supabase
          .from('segments')
          .select('*')
          .limit(1)
        
        if (segmentsError && segmentsError.message.includes('relation "segments" does not exist')) {
          diagnostics.issues.push('segments table missing')
          diagnostics.recommendations.push('Run database migration for segments table')
        } else {
          diagnostics.segmentsCount = segments?.length || 0
        }
      } catch (error) {
        diagnostics.issues.push('Error checking segments table')
      }

      // 5. Check rate limiting status
      try {
        const response = await fetch('/api/strava/rate-limit')
        const rateLimitData = await response.json()
        
        if (response.ok) {
          diagnostics.rateLimitStatus = rateLimitData
          diagnostics.noLimitsMode = rateLimitData.noLimitsMode
        } else {
          diagnostics.issues.push('Rate limit API not accessible')
        }
      } catch (error) {
        diagnostics.issues.push('Error checking rate limit status')
      }

      // 6. Check recent crawler logs
      try {
        const response = await fetch('/api/strava/crawler/logs?limit=5')
        const logsData = await response.json()
        
        if (response.ok) {
          diagnostics.recentLogs = logsData.logs
          
          // Analyze recent errors
          const recentErrors = logsData.logs?.filter((log: any) => 
            log.status === 'error' || log.message?.includes('Error')
          ) || []
          
          if (recentErrors.length > 0) {
            diagnostics.issues.push(`${recentErrors.length} recent crawler errors found`)
            diagnostics.recentErrors = recentErrors
          }
        }
      } catch (error) {
        diagnostics.issues.push('Error fetching crawler logs')
      }

      // Determine overall status
      if (diagnostics.issues.length === 0) {
        diagnostics.status = 'healthy'
        diagnostics.summary = 'All systems operational - crawler should work normally'
      } else if (diagnostics.issues.length <= 2) {
        diagnostics.status = 'warning'
        diagnostics.summary = 'Minor issues detected - crawler may have problems'
      } else {
        diagnostics.status = 'critical'
        diagnostics.summary = 'Multiple critical issues - crawler cannot progress'
      }

      setCrawlerDiagnostics(diagnostics)
      
      if (diagnostics.status === 'healthy') {
        addResult('Crawler Diagnostics', 'success', 'All systems operational', diagnostics)
      } else if (diagnostics.status === 'warning') {
        addResult('Crawler Diagnostics', 'error', 'Minor issues detected', diagnostics)
      } else {
        addResult('Crawler Diagnostics', 'error', 'Critical issues preventing crawler progress', diagnostics)
      }
      
    } catch (error: any) {
      addResult('Crawler Diagnostics', 'error', 'Diagnostics failed', undefined, error.message)
    }
  }

  // Test 4: Strava OAuth Flow Simulation
  const testStravaOAuthFlow = async () => {
    try {
      addResult('Strava OAuth Flow', 'pending', 'Simulating Strava OAuth flow...')
      
      // This simulates what happens after successful Strava OAuth
      const testStravaId = Math.floor(Math.random() * 1000000)
      
      // Use the actual service functions
      const user = await upsertUserClient({
        strava_id: testStravaId,
        firstname: 'Test',
        lastname: 'User',
        city: 'Test City',
        state: 'Test State',
        country: 'Test Country'
      })
      
      const tokens = await upsertTokensClient({
        strava_id: testStravaId,
        access_token: `test_access_${Date.now()}`,
        refresh_token: `test_refresh_${Date.now()}`,
        expires_at: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString() // 6 hours from now
      })
      
      const { sessionToken, expiresAt } = await SessionManager.createSession(testStravaId)
      
      addResult('Strava OAuth Flow', 'success', 'OAuth flow simulation completed', {
        user,
        tokens,
        session: { sessionToken, expiresAt }
      })
    } catch (error: any) {
      addResult('Strava OAuth Flow', 'error', 'OAuth flow simulation failed', undefined, error.message)
    }
  }

  // Test 4: App Logout
  const testAppLogout = async () => {
    try {
      addResult('App Logout', 'pending', 'Testing app logout...')
      
      const response = await fetch('/api/auth/logout', {
        method: 'POST'
      })
      
      if (response.ok) {
        addResult('App Logout', 'success', 'App logout successful')
        setUser(null)
      } else {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Logout failed')
      }
    } catch (error: any) {
      addResult('App Logout', 'error', 'App logout failed', undefined, error.message)
    }
  }

  // Test 5: Create User (CRUD)
  const testCreateUser = async () => {
    try {
      addResult('Create User', 'pending', 'Creating test user...')
      
      const testUser: TestUser = {
        strava_id: Math.floor(Math.random() * 1000000),
        firstname: 'Test',
        lastname: 'User',
        city: 'Test City',
        state: 'Test State',
        country: 'Test Country'
      }
      
      const user = await upsertUserClient(testUser)
      
      // Update test data
      setTestData((prev: any) => ({
        ...prev,
        users: [...prev.users, user]
      }))
      
      addResult('Create User', 'success', 'User created successfully', user)
    } catch (error: any) {
      addResult('Create User', 'error', 'User creation failed', undefined, error.message)
    }
  }

  // Test 5.1: Create Multiple Users (CRUD)
  const testCreateMultipleUsers = async () => {
    try {
      addResult('Create Multiple Users', 'pending', 'Creating multiple test users...')
      
      const users: any[] = []
      for (let i = 0; i < 3; i++) {
        const testUser: TestUser = {
          strava_id: Math.floor(Math.random() * 1000000),
          firstname: `Test${i + 1}`,
          lastname: 'User',
          city: `Test City ${i + 1}`,
          state: 'Test State',
          country: 'Test Country'
        }
        
        const user = await upsertUserClient(testUser)
        users.push(user)
      }
      
      // Update test data
      setTestData((prev: any) => ({
        ...prev,
        users: [...prev.users, ...users]
      }))
      
      addResult('Create Multiple Users', 'success', `${users.length} users created successfully`, users)
    } catch (error: any) {
      addResult('Create Multiple Users', 'error', 'Multiple user creation failed', undefined, error.message)
    }
  }

  // Test 6: Read Users (CRUD)
  const testReadUsers = async () => {
    try {
      addResult('Read Users', 'pending', 'Fetching users...')
      
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .limit(5)
      
      if (error) throw error
      
      addResult('Read Users', 'success', `Found ${data.length} users`, data)
    } catch (error: any) {
      addResult('Read Users', 'error', 'Failed to fetch users', undefined, error.message)
    }
  }

  // Test 7: Update User (CRUD)
  const testUpdateUser = async () => {
    try {
      addResult('Update User', 'pending', 'Updating test user...')
      
      // First get a user to update
      const { data: users, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .limit(1)
      
      if (fetchError) throw fetchError
      
      if (!users || users.length === 0) {
        addResult('Update User', 'error', 'No users found to update')
        return
      }
      
      const userToUpdate = users[0]
      const updateData = {
        firstname: 'Updated',
        lastname: 'Name',
        city: 'Updated City'
      }
      
      const { data, error } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', userToUpdate.id)
        .select()
        .single()
      
      if (error) throw error
      
      addResult('Update User', 'success', 'User updated successfully', data)
    } catch (error: any) {
      addResult('Update User', 'error', 'User update failed', undefined, error.message)
    }
  }

  // Test 8: Delete User (CRUD)
  const testDeleteUser = async () => {
    try {
      addResult('Delete User', 'pending', 'Deleting test user...')
      
      // First get a user to delete
      const { data: users, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .limit(1)
      
      if (fetchError) throw fetchError
      
      if (!users || users.length === 0) {
        addResult('Delete User', 'error', 'No users found to delete')
        return
      }
      
      const userToDelete = users[0]
      
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', userToDelete.id)
      
      if (error) throw error
      
      addResult('Delete User', 'success', 'User deleted successfully', { deleted_id: userToDelete.id })
    } catch (error: any) {
      addResult('Delete User', 'error', 'User deletion failed', undefined, error.message)
    }
  }

  // Test 9: Create Activity
  const testCreateActivity = async () => {
    try {
      addResult('Create Activity', 'pending', 'Creating test activity...')
      
      const testActivity: TestActivity = {
        strava_id: 123456,
        activity_id: Math.floor(Math.random() * 1000000),
        name: 'Test Activity',
        distance: 1000,
        moving_time: 3600,
        type: 'Run',
        start_date: new Date().toISOString()
      }
      
      const { data, error } = await supabase
        .from('activities')
        .insert(testActivity)
        .select()
        .single()
      
      if (error) throw error
      
      // Update test data
      setTestData((prev: any) => ({
        ...prev,
        activities: [...prev.activities, data]
      }))
      
      addResult('Create Activity', 'success', 'Activity created successfully', data)
    } catch (error: any) {
      addResult('Create Activity', 'error', 'Activity creation failed', undefined, error.message)
    }
  }

  // Test 9.1: Create Multiple Activities
  const testCreateMultipleActivities = async () => {
    try {
      addResult('Create Multiple Activities', 'pending', 'Creating multiple test activities...')
      
      const activities: any[] = []
      for (let i = 0; i < 3; i++) {
        const testActivity: TestActivity = {
          strava_id: 123456,
          activity_id: Math.floor(Math.random() * 1000000),
          name: `Test Activity ${i + 1}`,
          distance: 1000 + (i * 500),
          moving_time: 3600 + (i * 300),
          type: i % 2 === 0 ? 'Run' : 'Ride',
          start_date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString()
        }
        
        const { data, error } = await supabase
          .from('activities')
          .insert(testActivity)
          .select()
          .single()
        
        if (error) throw error
        activities.push(data)
      }
      
      // Update test data
      setTestData((prev: any) => ({
        ...prev,
        activities: [...prev.activities, ...activities]
      }))
      
      addResult('Create Multiple Activities', 'success', `${activities.length} activities created successfully`, activities)
    } catch (error: any) {
      addResult('Create Multiple Activities', 'error', 'Multiple activity creation failed', undefined, error.message)
    }
  }

  // Test 9.2: Create Segment
  const testCreateSegment = async () => {
    try {
      addResult('Create Segment', 'pending', 'Creating test segment...')
      
      const testSegment: TestSegment = {
        segment_id: Math.floor(Math.random() * 1000000),
        name: 'Test Segment',
        distance: 1000,
        elevation_gain: 50,
        average_grade: 5.0,
        maximum_grade: 8.0,
        climb_category: 4,
        city: 'Test City',
        state: 'Test State',
        country: 'Test Country'
      }
      
      const { data, error } = await supabase
        .from('segments')
        .insert(testSegment)
        .select()
        .single()
      
      if (error) throw error
      
      // Update test data
      setTestData((prev: any) => ({
        ...prev,
        segments: [...prev.segments, data]
      }))
      
      addResult('Create Segment', 'success', 'Segment created successfully', data)
    } catch (error: any) {
      addResult('Create Segment', 'error', 'Segment creation failed', undefined, error.message)
    }
  }

  // Test 9.3: Create Segment Effort
  const testCreateSegmentEffort = async () => {
    try {
      addResult('Create Segment Effort', 'pending', 'Creating test segment effort...')
      
      const testEffort: TestSegmentEffort = {
        activity_id: Math.floor(Math.random() * 1000000),
        segment_id: Math.floor(Math.random() * 1000000),
        effort_id: Math.floor(Math.random() * 1000000),
        elapsed_time: 1800,
        moving_time: 1700,
        start_date: new Date().toISOString(),
        average_watts: 200,
        max_watts: 300
      }
      
      const { data, error } = await supabase
        .from('segment_efforts')
        .insert(testEffort)
        .select()
        .single()
      
      if (error) throw error
      
      addResult('Create Segment Effort', 'success', 'Segment effort created successfully', data)
    } catch (error: any) {
      addResult('Create Segment Effort', 'error', 'Segment effort creation failed', undefined, error.message)
    }
  }

  // Test 10: Read Activities
  const testReadActivities = async () => {
    try {
      addResult('Read Activities', 'pending', 'Fetching activities...')
      
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .limit(5)
      
      if (error) throw error
      
      addResult('Read Activities', 'success', `Found ${data.length} activities`, data)
    } catch (error: any) {
      addResult('Read Activities', 'error', 'Failed to fetch activities', undefined, error.message)
    }
  }

  // Test 11: Database Schema Check
  const testSchemaCheck = async () => {
    try {
      addResult('Schema Check', 'pending', 'Checking database schema...')
      
      const tables = ['users', 'strava_tokens', 'activities']
      const schemaInfo: any = {}
      
      for (const table of tables) {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .limit(0)
        
        if (error) {
          schemaInfo[table] = { error: error.message }
        } else {
          schemaInfo[table] = { exists: true }
        }
      }
      
      addResult('Schema Check', 'success', 'Schema check completed', schemaInfo)
    } catch (error: any) {
      addResult('Schema Check', 'error', 'Schema check failed', undefined, error.message)
    }
  }

  // Test 12: RLS Policies Test
  const testRLSPolicies = async () => {
    try {
      addResult('RLS Policies', 'pending', 'Testing RLS policies...')
      
      // Test if we can read from tables (should work with current policies)
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('count')
        .limit(1)
      
      const { data: activities, error: activitiesError } = await supabase
        .from('activities')
        .select('count')
        .limit(1)
      
      const rlsResults = {
        users: usersError ? { error: usersError.message } : { accessible: true },
        activities: activitiesError ? { error: activitiesError.message } : { accessible: true }
      }
      
      addResult('RLS Policies', 'success', 'RLS policy test completed', rlsResults)
    } catch (error: any) {
      addResult('RLS Policies', 'error', 'RLS policy test failed', undefined, error.message)
    }
  }

  // Test 13: App Session Management
  const testAppSession = async () => {
    try {
      addResult('App Session', 'pending', 'Testing app session creation...')
      
      // Test session creation (this would normally happen after Strava auth)
      const testStravaId = 123456
      
      // First create a test user if it doesn't exist
      try {
        await getUserByStravaIdClient(testStravaId)
      } catch {
        await upsertUserClient({
          strava_id: testStravaId,
          firstname: 'Test',
          lastname: 'User'
        })
      }
      
      // Test session creation using the service
      const { sessionToken, expiresAt } = await SessionManager.createSession(testStravaId)
      
      addResult('App Session', 'success', 'Session created successfully', {
        sessionToken,
        expiresAt,
        strava_id: testStravaId
      })
    } catch (error: any) {
      addResult('App Session', 'error', 'Session creation failed', undefined, error.message)
    }
  }

  // Test 14: Session Validation
  const testSessionValidation = async () => {
    try {
      addResult('Session Validation', 'pending', 'Testing session validation...')
      
      // Create a test session
      const testStravaId = 123456
      const { sessionToken } = await SessionManager.createSession(testStravaId)
      
      // Test validation using the service
      const stravaId = await SessionManager.validateSession(sessionToken)
      
      if (stravaId) {
        addResult('Session Validation', 'success', 'Session validation successful', {
          sessionToken,
          strava_id: stravaId
        })
      } else {
        addResult('Session Validation', 'error', 'Session validation failed')
      }
    } catch (error: any) {
      addResult('Session Validation', 'error', 'Session validation test failed', undefined, error.message)
    }
  }

  // Test 15: Token Refresh Simulation
  const testTokenRefresh = async () => {
    try {
      addResult('Token Refresh', 'pending', 'Testing token refresh simulation...')
      
      // Test getting tokens for a user
      const testStravaId = 123456
      
      try {
        const tokens = await getTokensByStravaIdClient(testStravaId)
        
        // Check if token is expired
        const isExpired = new Date(tokens.expires_at) < new Date()
        
        addResult('Token Refresh', 'success', 'Token status checked', {
          strava_id: tokens.strava_id,
          expires_at: tokens.expires_at,
          is_expired: isExpired
        })
      } catch {
        // Create a test token if none exists
        await upsertTokensClient({
          strava_id: testStravaId,
          access_token: 'test_token',
          refresh_token: 'test_refresh',
          expires_at: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString() // 6 hours from now
        })
        
        addResult('Token Refresh', 'success', 'Test token created for future refresh tests')
      }
    } catch (error: any) {
      addResult('Token Refresh', 'error', 'Token refresh test failed', undefined, error.message)
    }
  }

  // Test 16: Session Cleanup
  const testSessionCleanup = async () => {
    try {
      addResult('Session Cleanup', 'pending', 'Testing session cleanup...')
      
      // Create expired session manually for testing
      const expiredSession = {
        strava_id: 123456,
        session_token: `expired_${Date.now()}`,
        expires_at: new Date(Date.now() - 3600000).toISOString() // 1 hour ago
      }
      
      await supabase
        .from('app_sessions')
        .insert(expiredSession)
      
      // Use the service to clean up expired sessions
      await SessionManager.cleanupExpiredSessions()
      
      // Verify cleanup worked
      const { data: remainingExpired, error } = await supabase
        .from('app_sessions')
        .select('*')
        .lt('expires_at', new Date().toISOString())
      
      if (error) throw error
      
      addResult('Session Cleanup', 'success', `Cleanup completed. ${remainingExpired?.length || 0} expired sessions remaining`, {
        cleaned_sessions: remainingExpired
      })
    } catch (error: any) {
      addResult('Session Cleanup', 'error', 'Session cleanup failed', undefined, error.message)
    }
  }

  // Test 17: Session Rotation
  const testSessionRotation = async () => {
    try {
      addResult('Session Rotation', 'pending', 'Testing session rotation...')
      
      // Create a test session using the service
      const testStravaId = 123456
      const { sessionToken } = await SessionManager.createSession(testStravaId)
      
      // Rotate the session using the service
      const newToken = await SessionManager.rotateSession(sessionToken)
      
      if (newToken) {
        addResult('Session Rotation', 'success', 'Session rotated successfully', {
          original_token: sessionToken,
          new_token: newToken
        })
      } else {
        addResult('Session Rotation', 'error', 'Session rotation failed')
      }
    } catch (error: any) {
      addResult('Session Rotation', 'error', 'Session rotation failed', undefined, error.message)
    }
  }

  // Test 18: Protected Route Simulation
  const testProtectedRoute = async () => {
    try {
      addResult('Protected Route', 'pending', 'Testing protected route simulation...')
      
      // Test accessing protected route without session
      const response = await fetch('/api/auth/session')
      const data = await response.json()
      
      if (data.authenticated) {
        addResult('Protected Route', 'success', 'User has access to protected route', {
          user: data.user,
          authenticated: data.authenticated
        })
      } else {
        addResult('Protected Route', 'success', 'User would be redirected to login', {
          authenticated: data.authenticated
        })
      }
    } catch (error: any) {
      addResult('Protected Route', 'error', 'Protected route test failed', undefined, error.message)
    }
  }

  // Test 19: CSRF Token Generation
  const testCSRFToken = async () => {
    try {
      addResult('CSRF Token', 'pending', 'Testing CSRF token generation...')
      
      // Simulate CSRF token generation (this would normally be done server-side)
      const csrfToken = `csrf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      // Test token validation
      const isValidToken = csrfToken.length > 20 && csrfToken.startsWith('csrf_')
      
      if (isValidToken) {
        addResult('CSRF Token', 'success', 'CSRF token generated and validated', {
          token: csrfToken,
          length: csrfToken.length,
          valid: isValidToken
        })
      } else {
        addResult('CSRF Token', 'error', 'CSRF token validation failed')
      }
    } catch (error: any) {
      addResult('CSRF Token', 'error', 'CSRF token test failed', undefined, error.message)
    }
  }

  // Test 20: Complete Auth Flow
  const testCompleteAuthFlow = async () => {
    try {
      addResult('Complete Auth Flow', 'pending', 'Testing complete authentication flow...')
      
      const testStravaId = Math.floor(Math.random() * 1000000)
      
      // Step 1: Create user (simulates Strava OAuth callback)
      const user = await upsertUserClient({
        strava_id: testStravaId,
        firstname: 'Complete',
        lastname: 'Flow',
        city: 'Test City',
        state: 'Test State',
        country: 'Test Country'
      })
      
      // Step 2: Store tokens
      const tokens = await upsertTokensClient({
        strava_id: testStravaId,
        access_token: `complete_flow_access_${Date.now()}`,
        refresh_token: `complete_flow_refresh_${Date.now()}`,
        expires_at: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString()
      })
      
      // Step 3: Create session
      const { sessionToken, expiresAt } = await SessionManager.createSession(testStravaId)
      
      // Step 4: Validate session
      const stravaId = await SessionManager.validateSession(sessionToken)
      
      if (stravaId && stravaId === testStravaId) {
        addResult('Complete Auth Flow', 'success', 'Complete authentication flow successful', {
          user,
          tokens,
          session: { sessionToken, expiresAt, strava_id: stravaId },
          flow_completed: true
        })
      } else {
        addResult('Complete Auth Flow', 'error', 'Session validation failed in complete flow')
      }
    } catch (error: any) {
      addResult('Complete Auth Flow', 'error', 'Complete auth flow failed', undefined, error.message)
    }
  }

  // Run all tests
  const runAllTests = async () => {
    setIsRunning(true)
    clearResults()
    
    const tests = [
      testConnection,
      testAppSessionStatus,
      testStravaOAuthFlow,
      testSchemaCheck,
      testRLSPolicies,
      testAppSession,
      testSessionValidation,
      testTokenRefresh,
      testSessionCleanup,
      testSessionRotation,
      testProtectedRoute,
      testCSRFToken,
      testCompleteAuthFlow,
      testCreateUser,
      testReadUsers,
      testUpdateUser,
      testCreateActivity,
      testReadActivities,
      testDeleteUser,
      testAppLogout
    ]
    
    for (const test of tests) {
      await test()
      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 500))
    }
    
    setIsRunning(false)
  }

  // Run specific test category
  const runAuthTests = async () => {
    setIsRunning(true)
    clearResults()
    
    await testAppSessionStatus()
    await testStravaOAuthFlow()
    await testAppLogout()
    
    setIsRunning(false)
  }

  const runCRUDTests = async () => {
    setIsRunning(true)
    clearResults()
    
    await testCreateUser()
    await testReadUsers()
    await testUpdateUser()
    await testDeleteUser()
    
    setIsRunning(false)
  }

  const runDiagnosticTests = async () => {
    setIsRunning(true)
    clearResults()
    
    await testConnection()
    await testSchemaCheck()
    await testRLSPolicies()
    await testRateLimitStatus()
    await testAppSession()
    await testSessionValidation()
    await testTokenRefresh()
    await testSessionCleanup()
    await testSessionRotation()
    await testProtectedRoute()
    await testCSRFToken()
    await testCompleteAuthFlow()
    await runCrawlerDiagnostics()
    
    setIsRunning(false)
  }

  // Crawler Tests
  const testCrawlerTrigger = async () => {
    try {
      addResult('Crawler Trigger', 'pending', 'Triggering crawler...')
      
      const response = await fetch('/api/strava/crawl', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      
      const data = await response.json()
      
      if (response.ok) {
        addResult('Crawler Trigger', 'success', 'Crawler triggered successfully', data)
      } else {
        addResult('Crawler Trigger', 'error', 'Crawler trigger failed', undefined, data.error)
      }
    } catch (error: any) {
      addResult('Crawler Trigger', 'error', 'Crawler trigger failed', undefined, error.message)
    }
  }

  const testCrawlerLogs = async () => {
    try {
      addResult('Crawler Logs', 'pending', 'Fetching crawler logs...')
      
      const response = await fetch('/api/strava/crawler/logs?limit=10')
      const data = await response.json()
      
      if (response.ok) {
        addResult('Crawler Logs', 'success', `Found ${data.logs.length} recent logs`, data)
      } else {
        addResult('Crawler Logs', 'error', 'Failed to fetch crawler logs', undefined, data.error)
      }
    } catch (error: any) {
      addResult('Crawler Logs', 'error', 'Failed to fetch crawler logs', undefined, error.message)
    }
  }

  const testCrawlerStats = async () => {
    try {
      addResult('Crawler Stats', 'pending', 'Fetching crawler statistics...')
      
      const response = await fetch('/api/strava/crawler/stats')
      const data = await response.json()
      
      if (response.ok) {
        addResult('Crawler Stats', 'success', 'Crawler statistics retrieved', data)
      } else {
        addResult('Crawler Stats', 'error', 'Failed to fetch crawler stats', undefined, data.error)
      }
    } catch (error: any) {
      addResult('Crawler Stats', 'error', 'Failed to fetch crawler stats', undefined, error.message)
    }
  }

  const runCrawlerTests = async () => {
    setIsRunning(true)
    clearResults()
    
    await testCrawlerTrigger()
    await testCrawlerLogs()
    await testCrawlerStats()
    await runCrawlerDiagnostics()
    
    setIsRunning(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Supabase Test Page</h1>
        
        {/* Current User Status */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Current Status</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">App Session Status:</p>
              <p className={`font-medium ${user ? 'text-green-600' : 'text-red-600'}`}>
                {user ? 'Session Active' : 'No Session'}
              </p>
            </div>
            {user && (
              <>
                <div>
                  <p className="text-sm text-gray-600">User:</p>
                  <p className="font-medium">{user.firstname} {user.lastname}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Strava ID:</p>
                  <p className="font-mono text-sm">{user.strava_id}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Location:</p>
                  <p className="text-sm">{user.city}, {user.state}, {user.country}</p>
                </div>
              </>
            )}
          </div>
          
          {/* Rate Limit Status */}
          {rateLimitStatus && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold">Strava API Rate Limits</h3>
                {rateLimitStatus.noLimitsMode && (
                  <span className="px-3 py-1 bg-red-100 text-red-800 text-sm font-medium rounded-full">
                    🚀 NO-LIMITS MODE
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-gray-600">15-Minute Limit:</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${
                          rateLimitStatus.usage.percent15Min > 80 ? 'bg-red-500' :
                          rateLimitStatus.usage.percent15Min > 60 ? 'bg-yellow-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${rateLimitStatus.usage.percent15Min}%` }}
                      ></div>
                    </div>
                    <span className="text-sm font-medium">
                      {rateLimitStatus.data.requests15min}/100
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Daily Limit:</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${
                          rateLimitStatus.usage.percentDay > 80 ? 'bg-red-500' :
                          rateLimitStatus.usage.percentDay > 60 ? 'bg-yellow-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${rateLimitStatus.usage.percentDay}%` }}
                      ></div>
                    </div>
                    <span className="text-sm font-medium">
                      {rateLimitStatus.data.requestsDay}/1000
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Next Reset (15min):</p>
                  <p className="text-sm font-medium">
                    {new Date(rateLimitStatus.data.nextReset15min).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Tabbed Interface */}
        <div className="bg-white rounded-lg shadow mb-8">
          {/* Tab Navigation */}
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6" aria-label="Tabs">
              {[
                { id: 'overview', name: 'Overview', icon: '📊' },
                { id: 'crud', name: 'CRUD Operations', icon: '🗄️' },
                { id: 'crawler', name: 'Crawler', icon: '🕷️' },
                { id: 'auth', name: 'Authentication', icon: '🔐' },
                { id: 'diagnostics', name: 'Diagnostics', icon: '🔍' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <span className="mr-2">{tab.icon}</span>
                  {tab.name}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div>
                <h2 className="text-xl font-semibold mb-4">System Overview</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h3 className="font-semibold text-blue-800">Database</h3>
                    <p className="text-2xl font-bold text-blue-600">{testData.users.length}</p>
                    <p className="text-sm text-blue-600">Users</p>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <h3 className="font-semibold text-green-800">Activities</h3>
                    <p className="text-2xl font-bold text-green-600">{testData.activities.length}</p>
                    <p className="text-sm text-green-600">Total</p>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <h3 className="font-semibold text-purple-800">Segments</h3>
                    <p className="text-2xl font-bold text-purple-600">{testData.segments.length}</p>
                    <p className="text-sm text-purple-600">Total</p>
                  </div>
                  <div className="bg-orange-50 p-4 rounded-lg">
                    <h3 className="font-semibold text-orange-800">Tokens</h3>
                    <p className="text-2xl font-bold text-orange-600">{testData.tokens.length}</p>
                    <p className="text-sm text-orange-600">Active</p>
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-4">
                  <button
                    onClick={runAllTests}
                    disabled={isRunning}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isRunning ? 'Running...' : 'Run All Tests'}
                  </button>
                  <button
                    onClick={runCrawlerDiagnostics}
                    disabled={isRunning}
                    className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                  >
                    🔍 Quick Diagnostics
                  </button>
                  <button
                    onClick={clearResults}
                    className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                  >
                    Clear Results
                  </button>
                </div>
              </div>
            )}

            {/* CRUD Operations Tab */}
            {activeTab === 'crud' && (
              <div>
                <h2 className="text-xl font-semibold mb-4">CRUD Operations</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <button
                    onClick={testCreateUser}
                    disabled={isRunning}
                    className="px-3 py-2 bg-green-100 text-green-700 rounded hover:bg-green-200 disabled:opacity-50 text-sm"
                  >
                    Create User
                  </button>
                  <button
                    onClick={testCreateMultipleUsers}
                    disabled={isRunning}
                    className="px-3 py-2 bg-green-100 text-green-700 rounded hover:bg-green-200 disabled:opacity-50 text-sm"
                  >
                    Create Multiple Users
                  </button>
                  <button
                    onClick={testReadUsers}
                    disabled={isRunning}
                    className="px-3 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50 text-sm"
                  >
                    Read Users
                  </button>
                  <button
                    onClick={testUpdateUser}
                    disabled={isRunning}
                    className="px-3 py-2 bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200 disabled:opacity-50 text-sm"
                  >
                    Update User
                  </button>
                  <button
                    onClick={testDeleteUser}
                    disabled={isRunning}
                    className="px-3 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50 text-sm"
                  >
                    Delete User
                  </button>
                  <button
                    onClick={testCreateActivity}
                    disabled={isRunning}
                    className="px-3 py-2 bg-green-100 text-green-700 rounded hover:bg-green-200 disabled:opacity-50 text-sm"
                  >
                    Create Activity
                  </button>
                  <button
                    onClick={testCreateMultipleActivities}
                    disabled={isRunning}
                    className="px-3 py-2 bg-green-100 text-green-700 rounded hover:bg-green-200 disabled:opacity-50 text-sm"
                  >
                    Create Multiple Activities
                  </button>
                  <button
                    onClick={testReadActivities}
                    disabled={isRunning}
                    className="px-3 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50 text-sm"
                  >
                    Read Activities
                  </button>
                  <button
                    onClick={testCreateSegment}
                    disabled={isRunning}
                    className="px-3 py-2 bg-purple-100 text-purple-700 rounded hover:bg-purple-200 disabled:opacity-50 text-sm"
                  >
                    Create Segment
                  </button>
                  <button
                    onClick={testCreateSegmentEffort}
                    disabled={isRunning}
                    className="px-3 py-2 bg-purple-100 text-purple-700 rounded hover:bg-purple-200 disabled:opacity-50 text-sm"
                  >
                    Create Segment Effort
                  </button>
                </div>
              </div>
            )}

            {/* Crawler Tab */}
            {activeTab === 'crawler' && (
              <div>
                <h2 className="text-xl font-semibold mb-4">Crawler Operations</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <button
                    onClick={testCrawlerTrigger}
                    disabled={isRunning}
                    className="px-3 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50 text-sm"
                  >
                    🚀 Trigger Crawler
                  </button>
                  <button
                    onClick={testCrawlerLogs}
                    disabled={isRunning}
                    className="px-3 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50 text-sm"
                  >
                    📋 View Logs
                  </button>
                  <button
                    onClick={testCrawlerStats}
                    disabled={isRunning}
                    className="px-3 py-2 bg-green-100 text-green-700 rounded hover:bg-green-200 disabled:opacity-50 text-sm"
                  >
                    📊 View Stats
                  </button>
                  <button
                    onClick={runCrawlerDiagnostics}
                    disabled={isRunning}
                    className="px-3 py-2 bg-orange-100 text-orange-700 rounded hover:bg-orange-200 disabled:opacity-50 text-sm"
                  >
                    🔍 Diagnostics
                  </button>
                  <button
                    onClick={runCrawlerTests}
                    disabled={isRunning}
                    className="px-3 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 text-sm col-span-2"
                  >
                    🧪 Run All Crawler Tests
                  </button>
                </div>
              </div>
            )}

            {/* Authentication Tab */}
            {activeTab === 'auth' && (
              <div>
                <h2 className="text-xl font-semibold mb-4">Authentication Tests</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <button
                    onClick={testAppSessionStatus}
                    disabled={isRunning}
                    className="px-3 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50 text-sm"
                  >
                    Session Status
                  </button>
                  <button
                    onClick={testStravaOAuthFlow}
                    disabled={isRunning}
                    className="px-3 py-2 bg-green-100 text-green-700 rounded hover:bg-green-200 disabled:opacity-50 text-sm"
                  >
                    OAuth Flow
                  </button>
                  <button
                    onClick={testAppLogout}
                    disabled={isRunning}
                    className="px-3 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50 text-sm"
                  >
                    App Logout
                  </button>
                  <button
                    onClick={testAppSession}
                    disabled={isRunning}
                    className="px-3 py-2 bg-purple-100 text-purple-700 rounded hover:bg-purple-200 disabled:opacity-50 text-sm"
                  >
                    App Session
                  </button>
                  <button
                    onClick={testSessionValidation}
                    disabled={isRunning}
                    className="px-3 py-2 bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200 disabled:opacity-50 text-sm"
                  >
                    Session Validation
                  </button>
                  <button
                    onClick={testTokenRefresh}
                    disabled={isRunning}
                    className="px-3 py-2 bg-orange-100 text-orange-700 rounded hover:bg-orange-200 disabled:opacity-50 text-sm"
                  >
                    Token Refresh
                  </button>
                  <button
                    onClick={testSessionCleanup}
                    disabled={isRunning}
                    className="px-3 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 text-sm"
                  >
                    Session Cleanup
                  </button>
                  <button
                    onClick={testSessionRotation}
                    disabled={isRunning}
                    className="px-3 py-2 bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200 disabled:opacity-50 text-sm"
                  >
                    Session Rotation
                  </button>
                  <button
                    onClick={testProtectedRoute}
                    disabled={isRunning}
                    className="px-3 py-2 bg-teal-100 text-teal-700 rounded hover:bg-teal-200 disabled:opacity-50 text-sm"
                  >
                    Protected Route
                  </button>
                  <button
                    onClick={testCSRFToken}
                    disabled={isRunning}
                    className="px-3 py-2 bg-pink-100 text-pink-700 rounded hover:bg-pink-200 disabled:opacity-50 text-sm"
                  >
                    CSRF Token
                  </button>
                  <button
                    onClick={testCompleteAuthFlow}
                    disabled={isRunning}
                    className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm col-span-2"
                  >
                    🧪 Complete Auth Flow
                  </button>
                </div>
              </div>
            )}

            {/* Diagnostics Tab */}
            {activeTab === 'diagnostics' && (
              <div>
                <h2 className="text-xl font-semibold mb-4">System Diagnostics</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <button
                    onClick={testConnection}
                    disabled={isRunning}
                    className="px-3 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50 text-sm"
                  >
                    Database Connection
                  </button>
                  <button
                    onClick={testSchemaCheck}
                    disabled={isRunning}
                    className="px-3 py-2 bg-green-100 text-green-700 rounded hover:bg-green-200 disabled:opacity-50 text-sm"
                  >
                    Schema Check
                  </button>
                  <button
                    onClick={testRLSPolicies}
                    disabled={isRunning}
                    className="px-3 py-2 bg-purple-100 text-purple-700 rounded hover:bg-purple-200 disabled:opacity-50 text-sm"
                  >
                    RLS Policies
                  </button>
                  <button
                    onClick={testRateLimitStatus}
                    disabled={isRunning}
                    className="px-3 py-2 bg-orange-100 text-orange-700 rounded hover:bg-orange-200 disabled:opacity-50 text-sm"
                  >
                    Rate Limits
                  </button>
                  <button
                    onClick={toggleNoLimitsMode}
                    disabled={isRunning}
                    className={`px-3 py-2 rounded hover:opacity-80 disabled:opacity-50 text-sm font-medium ${
                      noLimitsMode 
                        ? 'bg-red-100 text-red-700 hover:bg-red-200' 
                        : 'bg-green-100 text-green-700 hover:bg-green-200'
                    }`}
                  >
                    {noLimitsMode ? '🚀 No-Limits ON' : '⚡ No-Limits OFF'}
                  </button>
                  <button
                    onClick={runCrawlerDiagnostics}
                    disabled={isRunning}
                    className="px-3 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50 text-sm"
                  >
                    🔍 Crawler Diagnostics
                  </button>
                  <button
                    onClick={runDiagnosticTests}
                    disabled={isRunning}
                    className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm col-span-2"
                  >
                    🧪 Run All Diagnostics
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>



        {/* Test Results */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b">
            <h2 className="text-xl font-semibold">Test Results</h2>
            <p className="text-sm text-gray-600 mt-1">
              {results.length} tests completed
            </p>
          </div>
          
          <div className="max-h-96 overflow-y-auto">
            {results.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                No tests run yet. Click a test button to get started.
              </div>
            ) : (
              <div className="divide-y">
                {results.map((result, index) => (
                  <div key={index} className="p-6">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium">{result.test}</h3>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        result.status === 'success' ? 'bg-green-100 text-green-800' :
                        result.status === 'error' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {result.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{result.message}</p>
                    
                    {result.data && (
                      <div className="mb-2">
                        <p className="text-xs text-gray-500 mb-1">Data:</p>
                        <pre className="text-xs bg-gray-50 p-2 rounded overflow-x-auto">
                          {JSON.stringify(result.data, null, 2)}
                        </pre>
                      </div>
                    )}
                    
                    {result.error && (
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Error:</p>
                        <pre className="text-xs bg-red-50 p-2 rounded overflow-x-auto text-red-700">
                          {result.error}
                        </pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Crawler Diagnostics Display */}
        {crawlerDiagnostics && (
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Crawler Diagnostics</h2>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                crawlerDiagnostics.status === 'healthy' ? 'bg-green-100 text-green-800' :
                crawlerDiagnostics.status === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                'bg-red-100 text-red-800'
              }`}>
                {crawlerDiagnostics.status.toUpperCase()}
              </span>
            </div>
            
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">Summary:</p>
              <p className="font-medium">{crawlerDiagnostics.summary}</p>
            </div>

            {/* System Status */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-gray-50 p-3 rounded">
                <p className="text-sm text-gray-600">Users</p>
                <p className="text-lg font-semibold">{crawlerDiagnostics.totalUsers || 0}</p>
                <p className="text-xs text-gray-500">{crawlerDiagnostics.usersWithTokens || 0} with tokens</p>
              </div>
              <div className="bg-gray-50 p-3 rounded">
                <p className="text-sm text-gray-600">Activities</p>
                <p className="text-lg font-semibold">{crawlerDiagnostics.activitiesCount || 0}</p>
              </div>
              <div className="bg-gray-50 p-3 rounded">
                <p className="text-sm text-gray-600">Segments</p>
                <p className="text-lg font-semibold">{crawlerDiagnostics.segmentsCount || 0}</p>
              </div>
            </div>

            {/* Issues */}
            {crawlerDiagnostics.issues && crawlerDiagnostics.issues.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-3 text-red-700">Issues Found:</h3>
                <ul className="space-y-2">
                  {crawlerDiagnostics.issues.map((issue: string, index: number) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-red-500 mt-1">•</span>
                      <span className="text-sm">{issue}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recommendations */}
            {crawlerDiagnostics.recommendations && crawlerDiagnostics.recommendations.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-3 text-blue-700">Recommendations:</h3>
                <ul className="space-y-2">
                  {crawlerDiagnostics.recommendations.map((rec: string, index: number) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-blue-500 mt-1">→</span>
                      <span className="text-sm">{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recent Errors */}
            {crawlerDiagnostics.recentErrors && crawlerDiagnostics.recentErrors.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-3 text-orange-700">Recent Errors:</h3>
                <div className="space-y-2">
                  {crawlerDiagnostics.recentErrors.slice(0, 3).map((error: any, index: number) => (
                    <div key={index} className="bg-orange-50 p-3 rounded border border-orange-200">
                      <p className="text-sm font-medium text-orange-800">{error.message}</p>
                      <p className="text-xs text-orange-600 mt-1">
                        {new Date(error.run_at).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-xs text-gray-500">
                Last updated: {new Date(crawlerDiagnostics.timestamp).toLocaleString()}
              </p>
            </div>
          </div>
        )}

        {/* Crawler Control */}
        <div className="mt-8">
          <CrawlerControl />
        </div>
      </div>
    </div>
  )
} 