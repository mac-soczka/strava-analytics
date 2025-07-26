import { TokenHealthService } from '@/lib/services/token-health-service'

export async function GET() {
  try {
    const tokenHealthService = new TokenHealthService()
    const healthStatuses = await tokenHealthService.checkAllTokenHealth()
    
    const summary = {
      total_users: healthStatuses.length,
      valid_tokens: healthStatuses.filter(s => s.token_status === 'valid').length,
      expired_tokens: healthStatuses.filter(s => s.token_status === 'expired').length,
      invalid_tokens: healthStatuses.filter(s => s.token_status === 'invalid').length,
      missing_tokens: healthStatuses.filter(s => s.token_status === 'missing').length,
      needs_reauthentication: healthStatuses.filter(s => s.needs_reauthentication).length
    }
    
    return Response.json({
      success: true,
      summary,
      users: healthStatuses
    })
  } catch (error) {
    console.error('Failed to check token health:', error)
    
    return Response.json({
      success: false,
      error: error?.message || 'Unknown error'
    }, { status: 500 })
  }
}

export async function POST() {
  try {
    const tokenHealthService = new TokenHealthService()
    
    // Check if this is a cleanup request
    const cleanupResult = await tokenHealthService.cleanupInvalidTokens()
    
    return Response.json({
      success: true,
      message: 'Token cleanup completed',
      result: cleanupResult
    })
  } catch (error) {
    console.error('Failed to cleanup tokens:', error)
    
    return Response.json({
      success: false,
      error: error?.message || 'Unknown error'
    }, { status: 500 })
  }
} 