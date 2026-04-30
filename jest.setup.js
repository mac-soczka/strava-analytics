// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom'

// Default environment variables (only if not already provided).
// This lets integration/E2E run against a real local Supabase when configured,
// while keeping unit tests functional out of the box.
process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'https://test.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= 'test-anon-key'
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-service-role-key'
process.env.STRAVA_CLIENT_ID ||= 'test-client-id'
process.env.STRAVA_CLIENT_SECRET ||= 'test-client-secret'

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  // Uncomment to ignore a specific log level
  // log: jest.fn(),
  // debug: jest.fn(),
  // info: jest.fn(),
  // warn: jest.fn(),
  // error: jest.fn(),
}

// Mock fetch globally by default (tests may override per-suite).
global.fetch = global.fetch || jest.fn()

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks()
}) 