// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom'

// Mock environment variables for tests
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
process.env.STRAVA_CLIENT_ID = 'test-client-id'
process.env.STRAVA_CLIENT_SECRET = 'test-client-secret'
process.env.STRAVA_REDIRECT_URI = 'http://localhost:3000/api/auth/callback'

// Mock fetch globally
global.fetch = jest.fn()

// Mock crypto for session token generation
Object.defineProperty(global, 'crypto', {
  value: {
    randomBytes: jest.fn(() => ({
      toString: jest.fn(() => 'mock-random-token')
    }))
  }
})

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    prefetch: jest.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
})) 