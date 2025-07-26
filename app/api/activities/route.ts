import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '200')
    const search = searchParams.get('search') || ''
    const sportType = searchParams.get('sportType') || ''
    
    // Dynamic import to avoid build-time initialization
    const { ActivitiesRepository } = await import('@/lib/repositories/activities-repository')
    const activitiesRepo = new ActivitiesRepository()
    
    // Calculate offset
    const offset = (page - 1) * limit
    
    // Get activities with pagination
    const activities = await activitiesRepo.getActivities(limit, offset)
    
    // Get total count for pagination
    const stats = await activitiesRepo.getActivityStats()
    
    // Filter activities if search or sport type is provided
    let filteredActivities = activities
    
    if (search) {
      filteredActivities = filteredActivities.filter(activity =>
        activity.name.toLowerCase().includes(search.toLowerCase())
      )
    }
    
    if (sportType && sportType !== 'all') {
      filteredActivities = filteredActivities.filter(activity =>
        activity.type === sportType
      )
    }
    
    return NextResponse.json({
      activities: filteredActivities,
      pagination: {
        page,
        limit,
        total: stats.totalActivities,
        totalPages: Math.ceil(stats.totalActivities / limit)
      },
      stats
    })
  } catch (error) {
    console.error('Error fetching activities:', error)
    
    // Check if it's a configuration error
    if (error instanceof Error && error.message.includes('supabaseUrl is required')) {
      return NextResponse.json(
        { 
          error: 'Supabase configuration required',
          message: 'Please configure your Supabase environment variables'
        },
        { status: 503 }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch activities' },
      { status: 500 }
    )
  }
} 