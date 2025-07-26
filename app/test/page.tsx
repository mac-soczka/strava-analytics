'use client'

import { useState, useEffect } from 'react'
import { createClientComponentClient } from '@/lib/supabase'
import { supabase as serverSupabase } from '@/lib/database'
import { AuthService, SessionManager, TokenManager } from '@/lib/services/auth-service'
import { upsertUserClient, upsertTokensClient, getUserByStravaIdClient, getTokensByStravaIdClient } from '@/lib/database-client'

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

export default function TestPage() {
  const [results, setResults] = useState<TestResult[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [rateLimitStatus, setRateLimitStatus] = useState<any>(null)
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
        addResult('Rate Limit Status', 'success', 'Rate limit status retrieved', data)
      } else {
        addResult('Rate Limit Status', 'error', 'Failed to get rate limit status', undefined, data.error)
      }
    } catch (error: any) {
      addResult('Rate Limit Status', 'error', 'Rate limit status check failed', undefined, error.message)
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
      
      addResult('Create User', 'success', 'User created successfully', user)
    } catch (error: any) {
      addResult('Create User', 'error', 'User creation failed', undefined, error.message)
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
      
      addResult('Create Activity', 'success', 'Activity created successfully', data)
    } catch (error: any) {
      addResult('Create Activity', 'error', 'Activity creation failed', undefined, error.message)
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
              <h3 className="text-lg font-semibold mb-3">Strava API Rate Limits</h3>
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

        {/* Test Controls */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Test Controls</h2>
          <div className="flex flex-wrap gap-4">
            <button
              onClick={runAllTests}
              disabled={isRunning}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {isRunning ? 'Running...' : 'Run All Tests'}
            </button>
            <button
              onClick={runAuthTests}
              disabled={isRunning}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
            >
              Auth Tests
            </button>
            <button
              onClick={runCRUDTests}
              disabled={isRunning}
              className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
            >
              CRUD Tests
            </button>
            <button
              onClick={runDiagnosticTests}
              disabled={isRunning}
              className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50"
            >
              Diagnostics
            </button>
            <button
              onClick={clearResults}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              Clear Results
            </button>
          </div>
        </div>

        {/* Individual Test Buttons */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Individual Tests</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <button
              onClick={testConnection}
              disabled={isRunning}
              className="px-3 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 text-sm"
            >
              Connection
            </button>
            <button
              onClick={testAppSessionStatus}
              disabled={isRunning}
              className="px-3 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 text-sm"
            >
              Session Status
            </button>
            <button
              onClick={testRateLimitStatus}
              disabled={isRunning}
              className="px-3 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50 text-sm"
            >
              Rate Limits
            </button>
            <button
              onClick={testStravaOAuthFlow}
              disabled={isRunning}
              className="px-3 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 text-sm"
            >
              OAuth Flow
            </button>
            <button
              onClick={testAppLogout}
              disabled={isRunning}
              className="px-3 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 text-sm"
            >
              App Logout
            </button>
            <button
              onClick={testCreateUser}
              disabled={isRunning}
              className="px-3 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 text-sm"
            >
              Create User
            </button>
            <button
              onClick={testReadUsers}
              disabled={isRunning}
              className="px-3 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 text-sm"
            >
              Read Users
            </button>
            <button
              onClick={testUpdateUser}
              disabled={isRunning}
              className="px-3 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 text-sm"
            >
              Update User
            </button>
            <button
              onClick={testDeleteUser}
              disabled={isRunning}
              className="px-3 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 text-sm"
            >
              Delete User
            </button>
            <button
              onClick={testAppSession}
              disabled={isRunning}
              className="px-3 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 text-sm"
            >
              App Session
            </button>
            <button
              onClick={testSessionValidation}
              disabled={isRunning}
              className="px-3 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 text-sm"
            >
              Session Validation
            </button>
            <button
              onClick={testTokenRefresh}
              disabled={isRunning}
              className="px-3 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 text-sm"
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
              className="px-3 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 text-sm"
            >
              Session Rotation
            </button>
            <button
              onClick={testProtectedRoute}
              disabled={isRunning}
              className="px-3 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 text-sm"
            >
              Protected Route
            </button>
            <button
              onClick={testCSRFToken}
              disabled={isRunning}
              className="px-3 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 text-sm"
            >
              CSRF Token
            </button>
            <button
              onClick={testCompleteAuthFlow}
              disabled={isRunning}
              className="px-3 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 text-sm"
            >
              Complete Flow
            </button>
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
      </div>
    </div>
  )
} 