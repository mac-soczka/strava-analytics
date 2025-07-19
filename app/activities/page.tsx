import { Suspense } from 'react'
import { ActivitiesRepository } from '@/lib/repositories/activities-repository'
import ActivitiesClient from './activities-client'

// Force dynamic rendering to avoid ISR issues
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function ActivitiesPage() {
  const activitiesRepo = new ActivitiesRepository()
  
  // Fetch only a small number of activities for initial load
  const activities = await activitiesRepo.getActivities(10) // Reduced to 10 for initial load
  const stats = await activitiesRepo.getActivityStats()

  return (
    <main className="flex min-h-screen flex-col p-8 bg-gray-50 dark:bg-gray-900">
      <h1 className="text-3xl font-bold mb-6">🚴‍♂️ Activities</h1>
      
      <Suspense fallback={<div>Loading activities...</div>}>
        <ActivitiesClient 
          initialActivities={activities} 
          stats={stats}
        />
      </Suspense>
    </main>
  )
}
