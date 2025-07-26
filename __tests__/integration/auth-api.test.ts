import { createMocks } from 'node-mocks-http'
import { GET, POST } from '@/app/api/auth/session/route'
import { POST as logoutPOST } from '@/app/api/auth/logout/route'

// Mock the auth service
jest.mock('@/lib/services/auth-service', () => ({
  AuthService: {
    getCurrentUser: jest.fn(),
    logout: jest.fn(),
  },
  SessionManager: {
    deleteSession: jest.fn(),
  },
}))

describe('/api/auth/session', () => {
  it('should return authenticated user when valid session', async () => {
    const { req, res } = createMocks({
      method: 'GET',
      headers: {
        cookie: 'app_session=valid-session-token',
      },
    })

    const mockUser = {
      id: 'user-1',
      strava_id: 123456,
      firstname: 'Test',
      lastname: 'User',
      city: 'Test City',
      state: 'Test State',
      country: 'Test Country',
    }

    const { AuthService } = require('@/lib/services/auth-service')
    ;(AuthService.getCurrentUser as jest.Mock).mockResolvedValue(mockUser)

    await GET(req)

    expect(res._getStatusCode()).toBe(200)
    const data = JSON.parse(res._getData())
    expect(data.authenticated).toBe(true)
    expect(data.user).toEqual(mockUser)
  })

  it('should return 401 when no session token', async () => {
    const { req, res } = createMocks({
      method: 'GET',
      headers: {},
    })

    await GET(req)

    expect(res._getStatusCode()).toBe(401)
    const data = JSON.parse(res._getData())
    expect(data.authenticated).toBe(false)
  })

  it('should return 401 when invalid session token', async () => {
    const { req, res } = createMocks({
      method: 'GET',
      headers: {
        cookie: 'app_session=invalid-token',
      },
    })

    const { AuthService } = require('@/lib/services/auth-service')
    ;(AuthService.getCurrentUser as jest.Mock).mockResolvedValue(null)

    await GET(req)

    expect(res._getStatusCode()).toBe(401)
    const data = JSON.parse(res._getData())
    expect(data.authenticated).toBe(false)
  })
})

describe('/api/auth/logout', () => {
  it('should logout user and clear session', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      headers: {
        cookie: 'app_session=valid-session-token',
      },
    })

    const { AuthService } = require('@/lib/services/auth-service')
    ;(AuthService.logout as jest.Mock).mockResolvedValue(undefined)

    await logoutPOST(req)

    expect(res._getStatusCode()).toBe(200)
    const data = JSON.parse(res._getData())
    expect(data.message).toBe('Logged out successfully')
    
    // Check that session cookie is cleared
    const cookies = res._getHeaders()['set-cookie']
    expect(cookies).toBeDefined()
    expect(cookies[0]).toContain('app_session=')
    expect(cookies[0]).toContain('Max-Age=0')
  })

  it('should handle logout without session gracefully', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      headers: {},
    })

    await logoutPOST(req)

    expect(res._getStatusCode()).toBe(200)
    const data = JSON.parse(res._getData())
    expect(data.message).toBe('Logged out successfully')
  })
}) 