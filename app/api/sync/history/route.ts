import { NextRequest, NextResponse } from 'next/server'
import { AuthServiceServer } from '@/lib/services/auth-service-server'
import { SyncJobsRepository } from '@/lib/repositories/sync-jobs-repository'

export async function GET(request: NextRequest) {
  try {
    // Get session token from cookies
    const cookies = request.headers.get('cookie')
    const sessionToken = cookies?.split(';')
      .find(c => c.trim().startsWith('app_session='))
      ?.split('=')[1]

    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get current user from session
    const user = await AuthServiceServer.getCurrentUser(sessionToken)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const jobsRepo = new SyncJobsRepository()
    const jobs = await jobsRepo.getRecentJobsForUser(user.strava_id, 10)

    return NextResponse.json({ jobs })
  } catch (error: any) {
    console.error('Error fetching sync history:', error)
    return NextResponse.json(
      { error: 'Failed to fetch sync history', details: error?.message },
      { status: 500 }
    )
  }
}
