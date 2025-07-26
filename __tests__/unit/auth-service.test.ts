import { AuthService, SessionManager, TokenManager } from '@/lib/services/auth-service'
import { upsertUser, upsertTokens, getUserByStravaId } from '@/lib/database'

// Add Jest types
declare global {
  namespace jest {
    interface Matchers<R> {
      toHaveProperty(prop: string): R
    }
  }
}

// Mock the database functions
jest.mock('@/lib/database', () => ({
  upsertUser: jest.fn(),
  upsertTokens: jest.fn(),
  getUserByStravaId: jest.fn(),
  getTokensByStravaId: jest.fn(),
}))

// Mock Supabase client
jest.mock('@/lib/supabase', () => ({
  createClientComponentClient: jest.fn(() => ({
    from: jest.fn(() => ({
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ data: { id: 'test-session-id' }, error: null }))
        }))
      })),
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ data: { strava_id: 123456 }, error: null }))
        }))
      })),
      delete: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({ error: null }))
      })),
      update: jest.fn(() => ({
        eq: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({ data: { session_token: 'new-token' }, error: null }))
          }))
        }))
      })),
      lt: jest.fn(() => Promise.resolve({ error: null }))
    }))
  }))
}))

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('authenticateUser', () => {
    it('should authenticate user and create session', async () => {
      const mockUser = {
        id: 'user-1',
        strava_id: 123456,
        firstname: 'Test',
        lastname: 'User',
        city: 'Test City',
        state: 'Test State',
        country: 'Test Country',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }

      ;(getUserByStravaId as jest.Mock).mockResolvedValue(mockUser)

      const result = await AuthService.authenticateUser(123456)

      expect(result).toHaveProperty('sessionToken')
      expect(result).toHaveProperty('user')
      expect(result.user).toEqual({
        id: mockUser.id,
        strava_id: mockUser.strava_id,
        firstname: mockUser.firstname,
        lastname: mockUser.lastname,
        city: mockUser.city,
        state: mockUser.state,
        country: mockUser.country
      })
    })

    it('should throw error if user not found', async () => {
      ;(getUserByStravaId as jest.Mock).mockRejectedValue(new Error('User not found'))

      await expect(AuthService.authenticateUser(999999)).rejects.toThrow('Authentication failed')
    })
  })

  describe('getCurrentUser', () => {
    it('should return user if session is valid', async () => {
      const mockUser = {
        id: 'user-1',
        strava_id: 123456,
        firstname: 'Test',
        lastname: 'User'
      }

      ;(getUserByStravaId as jest.Mock).mockResolvedValue(mockUser)

      const result = await AuthService.getCurrentUser('valid-session-token')

      expect(result).toEqual({
        id: mockUser.id,
        strava_id: mockUser.strava_id,
        firstname: mockUser.firstname,
        lastname: mockUser.lastname
      })
    })

    it('should return null if session is invalid', async () => {
      const result = await AuthService.getCurrentUser('invalid-session-token')

      expect(result).toBeNull()
    })
  })

  describe('generateCSRFToken', () => {
    it('should generate a CSRF token', () => {
      const token = AuthService.generateCSRFToken()

      expect(token).toBeDefined()
      expect(typeof token).toBe('string')
      expect(token.length).toBeGreaterThan(0)
    })
  })

  describe('validateCSRFToken', () => {
    it('should validate matching tokens', () => {
      const token = 'test-token'
      const storedToken = 'test-token'

      const result = AuthService.validateCSRFToken(token, storedToken)

      expect(result).toBe(true)
    })

    it('should reject non-matching tokens', () => {
      const token = 'test-token'
      const storedToken = 'different-token'

      const result = AuthService.validateCSRFToken(token, storedToken)

      expect(result).toBe(false)
    })
  })
})

describe('SessionManager', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('createSession', () => {
    it('should create a new session', async () => {
      const result = await SessionManager.createSession(123456)

      expect(result).toHaveProperty('sessionToken')
      expect(result).toHaveProperty('expiresAt')
      expect(result.sessionToken).toBeDefined()
      expect(result.expiresAt).toBeDefined()
    })
  })

  describe('validateSession', () => {
    it('should validate existing session', async () => {
      const result = await SessionManager.validateSession('valid-token')

      expect(result).toBe(123456)
    })

    it('should return null for invalid session', async () => {
      const result = await SessionManager.validateSession('invalid-token')

      expect(result).toBeNull()
    })
  })

  describe('deleteSession', () => {
    it('should delete session', async () => {
      await expect(SessionManager.deleteSession('test-token')).resolves.not.toThrow()
    })
  })

  describe('rotateSession', () => {
    it('should rotate session token', async () => {
      const result = await SessionManager.rotateSession('old-token')

      expect(result).toBeDefined()
      expect(result).not.toBe('old-token')
    })
  })
})

describe('TokenManager', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('getValidTokens', () => {
    it('should return valid tokens', async () => {
      const mockTokens = {
        access_token: 'valid-token',
        refresh_token: 'refresh-token',
        expires_at: new Date(Date.now() + 3600000).toISOString() // 1 hour from now
      }

      ;(getTokensByStravaId as jest.Mock).mockResolvedValue(mockTokens)

      const result = await TokenManager.getValidTokens(123456)

      expect(result).toEqual(mockTokens)
    })

    it('should refresh expired tokens', async () => {
      const mockExpiredTokens = {
        access_token: 'expired-token',
        refresh_token: 'refresh-token',
        expires_at: new Date(Date.now() - 3600000).toISOString() // 1 hour ago
      }

      ;(getTokensByStravaId as jest.Mock).mockResolvedValue(mockExpiredTokens)

      // Mock fetch for token refresh
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          access_token: 'new-token',
          refresh_token: 'new-refresh-token',
          expires_at: Math.floor(Date.now() / 1000) + 3600
        })
      })

      const result = await TokenManager.getValidTokens(123456)

      expect(result).toHaveProperty('access_token')
      expect(result.access_token).toBe('new-token')
    })
  })
}) 