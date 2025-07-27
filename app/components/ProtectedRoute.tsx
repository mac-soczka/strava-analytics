'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface ProtectedRouteProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

interface User {
  id: string
  strava_id: number
  firstname: string
  lastname: string
  city?: string
  state?: string
  country?: string
  profile_picture?: string
}

export default function ProtectedRoute({ children, fallback }: ProtectedRouteProps) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/session')
        
        if (response.ok) {
          const data = await response.json()
          if (data.authenticated) {
            setUser(data.user)
          } else {
            // Redirect to login if not authenticated
            router.push('/')
          }
        } else {
          // Redirect to login if session validation fails
          router.push('/')
        }
      } catch (error) {
        console.error('Auth check failed:', error)
        router.push('/')
      } finally {
        setLoading(false)
      }
    }

    checkAuth()
  }, [router])

  if (loading) {
    return fallback || (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-200 dark:from-gray-900 dark:to-gray-800">
        <div className="max-w-md w-full mx-auto p-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
            <div className="mb-6">
              <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🚴</span>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Authentication Required
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Please sign in with your Strava account to access this page.
              </p>
            </div>
            
            <div className="space-y-4">
              <a
                href="/api/auth/login"
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 px-6 rounded-lg shadow transition-colors inline-block"
              >
                Login with Strava
              </a>
              
              <div className="text-sm text-gray-500 dark:text-gray-400">
                <p>Don't have an account?</p>
                <p>Sign up for free at <a href="https://www.strava.com" target="_blank" rel="noopener noreferrer" className="text-orange-500 hover:text-orange-600">strava.com</a></p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return <>{children}</>
} 