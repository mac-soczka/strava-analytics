'use client'

import { useState, useEffect } from 'react'
import Sidebar from './Sidebar'
import Navbar from './Navbar'

interface User {
  id: string
  firstname: string
  lastname: string
  profile: string
  city: string
  state: string
  country: string
}

interface AuthenticatedLayoutProps {
  children: React.ReactNode
}

export default function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/session')
        if (response.ok) {
          const data = await response.json()
          if (data.authenticated) {
            setUser(data.user)
          }
        }
      } catch (error) {
        console.error('Error checking auth:', error)
      } finally {
        setIsLoading(false)
      }
    }

    checkAuth()
  }, [])

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    )
  }

  // If not authenticated, only show the children (which should be the main page or auth prompts)
  if (!user) {
    return <>{children}</>
  }

  // If authenticated, show the full layout with navbar and sidebar
  return (
    <div className="flex flex-col min-h-screen">
      {/* Top Navbar - Full Width */}
      <Navbar />
      
      {/* Content Area with Sidebar */}
      <div className="flex flex-1">
        {/* Sidebar */}
        <div className="hidden md:block">
          <Sidebar />
        </div>
        {/* Main Content */}
        <main className="flex-1 bg-gray-50 dark:bg-gray-900 h-[calc(100vh-4rem)] overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
} 