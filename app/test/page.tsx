'use client'

import { useState, useEffect } from 'react'
import { createClientComponentClient } from '@/lib/supabase'
import { supabase as serverSupabase } from '@/lib/database'

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

  // Test 2: Auth Status Check
  const testAuthStatus = async () => {
    try {
      addResult('Auth Status', 'pending', 'Checking auth status...')
      
      const { data: { user }, error } = await supabase.auth.getUser()
      
      if (error) throw error
      
      if (user) {
        addResult('Auth Status', 'success', 'User authenticated', { 
          id: user.id, 
          email: user.email,
          created_at: user.created_at 
        })
        setUser(user)
      } else {
        addResult('Auth Status', 'success', 'No user authenticated')
      }
    } catch (error: any) {
      addResult('Auth Status', 'error', 'Auth check failed', undefined, error.message)
    }
  }

  // Test 3: Sign In (Anonymous)
  const testSignIn = async () => {
    try {
      addResult('Sign In', 'pending', 'Attempting anonymous sign in...')
      
      const { data, error } = await supabase.auth.signInAnonymously()
      
      if (error) throw error
      
      addResult('Sign In', 'success', 'Anonymous sign in successful', {
        user_id: data.user?.id,
        session: !!data.session
      })
      setUser(data.user)
    } catch (error: any) {
      addResult('Sign In', 'error', 'Sign in failed', undefined, error.message)
    }
  }

  // Test 4: Sign Out
  const testSignOut = async () => {
    try {
      addResult('Sign Out', 'pending', 'Signing out...')
      
      const { error } = await supabase.auth.signOut()
      
      if (error) throw error
      
      addResult('Sign Out', 'success', 'Sign out successful')
      setUser(null)
    } catch (error: any) {
      addResult('Sign Out', 'error', 'Sign out failed', undefined, error.message)
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
      
      const { data, error } = await supabase
        .from('users')
        .insert(testUser)
        .select()
        .single()
      
      if (error) throw error
      
      addResult('Create User', 'success', 'User created successfully', data)
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
      const { data: existingUser } = await supabase
        .from('users')
        .select('*')
        .eq('strava_id', testStravaId)
        .single()
      
      if (!existingUser) {
        await supabase
          .from('users')
          .insert({
            strava_id: testStravaId,
            firstname: 'Test',
            lastname: 'User'
          })
      }
      
      // Test session creation
      const { data: session, error } = await supabase
        .from('app_sessions')
        .insert({
          strava_id: testStravaId,
          session_token: `test_token_${Date.now()}`,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        })
        .select()
        .single()
      
      if (error) throw error
      
      addResult('App Session', 'success', 'Session created successfully', session)
    } catch (error: any) {
      addResult('App Session', 'error', 'Session creation failed', undefined, error.message)
    }
  }

  // Test 14: Session Validation
  const testSessionValidation = async () => {
    try {
      addResult('Session Validation', 'pending', 'Testing session validation...')
      
      // Create a test session
      const testToken = `test_validation_${Date.now()}`
      const testStravaId = 123456
      
      await supabase
        .from('app_sessions')
        .insert({
          strava_id: testStravaId,
          session_token: testToken,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        })
      
      // Test validation
      const { data: session, error } = await supabase
        .from('app_sessions')
        .select('strava_id, expires_at')
        .eq('session_token', testToken)
        .single()
      
      if (error) throw error
      
      const isValid = session && new Date(session.expires_at) > new Date()
      
      if (isValid) {
        addResult('Session Validation', 'success', 'Session validation successful', session)
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
      
      // Create expired token
      const expiredToken = {
        strava_id: 123456,
        access_token: 'expired_token',
        refresh_token: 'valid_refresh_token',
        expires_at: new Date(Date.now() - 3600000).toISOString() // 1 hour ago
      }
      
      // Insert expired token
      const { data: token, error } = await supabase
        .from('strava_tokens')
        .upsert(expiredToken, { onConflict: 'strava_id' })
        .select()
        .single()
      
      if (error) throw error
      
      // Check if token is expired
      const isExpired = new Date(token.expires_at) < new Date()
      
      if (isExpired) {
        addResult('Token Refresh', 'success', 'Token expiration detected correctly', {
          token_id: token.id,
          expires_at: token.expires_at,
          is_expired: isExpired
        })
      } else {
        addResult('Token Refresh', 'error', 'Token expiration check failed')
      }
    } catch (error: any) {
      addResult('Token Refresh', 'error', 'Token refresh test failed', undefined, error.message)
    }
  }

  // Test 16: Session Cleanup
  const testSessionCleanup = async () => {
    try {
      addResult('Session Cleanup', 'pending', 'Testing session cleanup...')
      
      // Create expired session
      const expiredSession = {
        strava_id: 123456,
        session_token: `expired_${Date.now()}`,
        expires_at: new Date(Date.now() - 3600000).toISOString() // 1 hour ago
      }
      
      await supabase
        .from('app_sessions')
        .insert(expiredSession)
      
      // Clean up expired sessions
      const { data: deletedSessions, error } = await supabase
        .from('app_sessions')
        .delete()
        .lt('expires_at', new Date().toISOString())
        .select()
      
      if (error) throw error
      
      addResult('Session Cleanup', 'success', `Cleaned up ${deletedSessions?.length || 0} expired sessions`, deletedSessions)
    } catch (error: any) {
      addResult('Session Cleanup', 'error', 'Session cleanup failed', undefined, error.message)
    }
  }

  // Run all tests
  const runAllTests = async () => {
    setIsRunning(true)
    clearResults()
    
    const tests = [
      testConnection,
      testAuthStatus,
      testSignIn,
      testSchemaCheck,
      testRLSPolicies,
      testAppSession,
      testSessionValidation,
      testTokenRefresh,
      testSessionCleanup,
      testCreateUser,
      testReadUsers,
      testUpdateUser,
      testCreateActivity,
      testReadActivities,
      testDeleteUser,
      testSignOut
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
    
    await testAuthStatus()
    await testSignIn()
    await testSignOut()
    
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
    await testAppSession()
    await testSessionValidation()
    await testTokenRefresh()
    await testSessionCleanup()
    
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
              <p className="text-sm text-gray-600">Authentication Status:</p>
              <p className={`font-medium ${user ? 'text-green-600' : 'text-red-600'}`}>
                {user ? 'Authenticated' : 'Not Authenticated'}
              </p>
            </div>
            {user && (
              <div>
                <p className="text-sm text-gray-600">User ID:</p>
                <p className="font-mono text-sm">{user.id}</p>
              </div>
            )}
          </div>
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
              onClick={testAuthStatus}
              disabled={isRunning}
              className="px-3 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 text-sm"
            >
              Auth Status
            </button>
            <button
              onClick={testSignIn}
              disabled={isRunning}
              className="px-3 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 text-sm"
            >
              Sign In
            </button>
            <button
              onClick={testSignOut}
              disabled={isRunning}
              className="px-3 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 text-sm"
            >
              Sign Out
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