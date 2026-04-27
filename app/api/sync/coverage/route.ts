import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { AuthServiceServer } from '@/lib/services/auth-service-server'
import { loadSyncCoverage } from '@/lib/sync/sync-coverage'

export async function GET(request: NextRequest) {
  try {
    const cookies = request.headers.get('cookie')
    const sessionToken = cookies
      ?.split(';')
      .find((c) => c.trim().startsWith('app_session='))
      ?.split('=')[1]

    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await AuthServiceServer.getCurrentUser(sessionToken)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !serviceRoleKey) {
      return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
    }

    const supabase = createClient(url, serviceRoleKey)
    const coverage = await loadSyncCoverage(supabase, user.strava_id)
    return NextResponse.json({ coverage })
  } catch (error: any) {
    console.error('Error loading sync coverage:', error)
    return NextResponse.json(
      { error: 'Failed to load sync coverage', details: error?.message },
      { status: 500 }
    )
  }
}

