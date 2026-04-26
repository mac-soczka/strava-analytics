import { cookies } from 'next/headers'
import { AuthServiceServer } from '@/lib/services/auth-service-server'

/**
 * Strava user id for the current browser session (app_session cookie), if valid.
 */
export async function getSessionStravaId(): Promise<number | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('app_session')?.value
  if (!token) return null
  const user = await AuthServiceServer.getCurrentUser(token)
  return user?.strava_id ?? null
}
