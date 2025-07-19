import { Suspense } from 'react'

// Force dynamic rendering to avoid ISR issues
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function ActivitiesPage() {
  return (
    <main className="flex min-h-screen flex-col p-8 bg-gray-50 dark:bg-gray-900">
      <h1 className="text-3xl font-bold mb-6">🚴‍♂️ Activities</h1>
      
      <Suspense fallback={<div>Loading activities...</div>}>
        <ActivitiesContent />
      </Suspense>
    </main>
  )
}

async function ActivitiesContent() {
  try {
    const { ActivitiesRepository } = await import('@/lib/repositories/activities-repository')
    const { default: ActivitiesClient } = await import('./activities-client')
    
    const activitiesRepo = new ActivitiesRepository()
    
    // Fetch only a small number of activities for initial load
    const activities = await activitiesRepo.getActivities(10) // Reduced to 10 for initial load
    const stats = await activitiesRepo.getActivityStats()

    return (
      <ActivitiesClient 
        initialActivities={activities} 
        stats={stats}
      />
    )
  } catch (error) {
    // Handle case where Supabase is not configured
    console.error('Error loading activities:', error)
    
    return (
      <div className="bg-yellow-50 dark:bg-yellow-900 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4">
        <h2 className="text-lg font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
          Configuration Required
        </h2>
        <p className="text-yellow-700 dark:text-yellow-300">
          Please configure your Supabase environment variables in <code>.env.local</code> to view activities.
        </p>
        <div className="mt-4 text-sm text-yellow-600 dark:text-yellow-400">
          <p>Required variables:</p>
          <ul className="list-disc list-inside mt-2">
            <li>NEXT_PUBLIC_SUPABASE_URL</li>
            <li>NEXT_PUBLIC_SUPABASE_ANON_KEY</li>
            <li>SUPABASE_SERVICE_ROLE_KEY</li>
          </ul>
        </div>
      </div>
    )
  }
}
