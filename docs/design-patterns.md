# Design Patterns Implementation Summary

This document provides a comprehensive overview of the design patterns implemented in the Strava Heatmap project.

## 🎯 Overview

The application implements three core design patterns to achieve:
- **Separation of Concerns**: Clear boundaries between data, business logic, and presentation
- **Maintainability**: Easy to modify and extend functionality
- **Testability**: Components can be tested in isolation
- **Scalability**: Architecture supports growth and complexity

## 🏗️ Pattern 1: Server Components + Client Components

### Purpose
Separate data fetching from UI interactivity for optimal performance and user experience.

### Implementation
```typescript
// Server Component (Data Fetching)
export default async function ActivitiesPage() {
  const activitiesRepo = new ActivitiesRepository()
  const activities = await activitiesRepo.getActivities(50)
  const stats = await activitiesRepo.getActivityStats()

  return (
    <main>
      <ActivitiesClient 
        initialActivities={activities} 
        stats={stats}
      />
    </main>
  )
}

// Client Component (Interactivity)
'use client'
export default function ActivitiesClient({ initialActivities, stats }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [filteredActivities, setFilteredActivities] = useState(initialActivities)

  // Client-side filtering and sorting
  const handleSearch = (term: string) => {
    setSearchTerm(term)
    const filtered = initialActivities.filter(activity =>
      activity.name.toLowerCase().includes(term.toLowerCase())
    )
    setFilteredActivities(filtered)
  }

  return (
    <div>
      <SearchInput value={searchTerm} onChange={handleSearch} />
      <ActivitiesTable activities={filteredActivities} />
    </div>
  )
}
```

### Benefits
- ✅ **Performance**: Data fetched on server, reducing client bundle size
- ✅ **SEO**: Server-rendered content for better search engine optimization
- ✅ **Interactivity**: Client components handle user interactions
- ✅ **Caching**: Server components can be cached at the edge

### Files
- `app/activities/page.tsx` - Server component
- `app/activities/activities-client.tsx` - Client component

## 🗄️ Pattern 2: Repository Pattern

### Purpose
Abstract data access logic and provide a clean interface for database operations.

### Implementation
```typescript
export class ActivitiesRepository {
  private supabase: ReturnType<typeof createServerComponentClient>

  constructor() {
    this.supabase = createServerComponentClient()
  }

  async getActivities(limit = 50, offset = 0) {
    const { data, error } = await this.supabase
      .from('activities')
      .select('*')
      .order('start_date', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error
    return data as StravaActivity[]
  }

  async getActivityById(id: number) {
    const { data, error } = await this.supabase
      .from('activities')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    return data as StravaActivity
  }

  async createActivity(activity: Omit<StravaActivity, 'id'>) {
    const { data, error } = await this.supabase
      .from('activities')
      .insert(activity)
      .select()
      .single()

    if (error) throw error
    return data as StravaActivity
  }

  async getActivityStats() {
    const { data, error } = await this.supabase
      .from('activities')
      .select('distance, moving_time, total_elevation_gain, sport_type')

    if (error) throw error

    return {
      totalActivities: data.length,
      totalDistance: data.reduce((sum, a) => sum + (a.distance || 0), 0),
      totalTime: data.reduce((sum, a) => sum + (a.moving_time || 0), 0),
      totalElevation: data.reduce((sum, a) => sum + (a.total_elevation_gain || 0), 0),
      bySportType: data.reduce((acc, a) => {
        acc[a.sport_type] = (acc[a.sport_type] || 0) + 1
        return acc
      }, {} as Record<string, number>)
    }
  }
}
```

### Benefits
- ✅ **Abstraction**: Hide database implementation details
- ✅ **Testability**: Easy to mock for unit tests
- ✅ **Reusability**: Consistent data access across the application
- ✅ **Type Safety**: Strongly typed data operations

### Files
- `lib/repositories/activities-repository.ts`
- `lib/repositories/segments-repository.ts`

## 🔧 Pattern 3: Service Layer Pattern

### Purpose
Encapsulate business logic and external API integrations.

### Implementation
```typescript
export class StravaService {
  private supabase: ReturnType<typeof createServerComponentClient>
  private activitiesRepo: ActivitiesRepository
  private segmentsRepo: SegmentsRepository

  constructor() {
    this.supabase = createServerComponentClient()
    this.activitiesRepo = new ActivitiesRepository()
    this.segmentsRepo = new SegmentsRepository()
  }

  async getValidTokens(): Promise<StravaTokens> {
    const { data: tokens } = await this.supabase
      .from('tokens')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!tokens) {
      throw new Error('No Strava tokens found')
    }

    // Check if token is expired and refresh if needed
    if (new Date(tokens.expires_at) <= new Date()) {
      return await this.refreshTokens(tokens.refresh_token)
    }

    return tokens
  }

  async syncActivities(limit = 50): Promise<{ synced: number; errors: number }> {
    let synced = 0
    let errors = 0

    try {
      const activities = await this.fetchActivities(1, limit)

      for (const activity of activities) {
        try {
          // Check if activity already exists
          const existing = await this.activitiesRepo.getActivityById(activity.id)
          if (existing) continue

          // Create activity in database
          await this.activitiesRepo.createActivity({
            name: activity.name,
            distance: activity.distance,
            moving_time: activity.moving_time,
            elapsed_time: activity.elapsed_time,
            total_elevation_gain: activity.total_elevation_gain,
            type: activity.type,
            sport_type: activity.sport_type,
            start_date: activity.start_date,
            start_date_local: activity.start_date_local,
            timezone: activity.timezone,
            utc_offset: activity.utc_offset,
          })

          synced++
        } catch (error) {
          console.error(`Error syncing activity ${activity.id}:`, error)
          errors++
        }
      }
    } catch (error) {
      console.error('Error in syncActivities:', error)
      throw error
    }

    return { synced, errors }
  }

  async syncSegments(batchSize = 10): Promise<{ processed: number; segmentsAdded: number; errors: number }> {
    let processed = 0
    let segmentsAdded = 0
    let errors = 0

    try {
      const activitiesNeedingSegments = await this.activitiesRepo.getActivitiesNeedingSegments(batchSize)

      for (const activity of activitiesNeedingSegments) {
        try {
          const segments = await this.fetchActivitySegments(activity.id)

          if (segments.length > 0) {
            const segmentEfforts = segments.map(segment => ({
              activity_id: activity.id,
              segment_id: segment.segment.id,
              segment_name: segment.segment.name,
              // ... other segment fields
            }))

            await this.segmentsRepo.createSegmentEfforts(segmentEfforts)
            segmentsAdded += segments.length
          }

          await this.activitiesRepo.markSegmentsFetched(activity.id)
          processed++

          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 1100))
        } catch (error) {
          console.error(`Error processing activity ${activity.id}:`, error)
          errors++
        }
      }
    } catch (error) {
      console.error('Error in syncSegments:', error)
      throw error
    }

    return { processed, segmentsAdded, errors }
  }
}
```

### Benefits
- ✅ **Business Logic**: Centralized business rules and workflows
- ✅ **External Integration**: Clean interface for third-party APIs
- ✅ **Error Handling**: Consistent error handling across the application
- ✅ **Reusability**: Business logic can be reused across different parts of the app

### Files
- `lib/services/strava-service.ts`

## 🔄 How Patterns Work Together

### Data Flow Example
```typescript
// 1. Server Component fetches data using Repository
export default async function ActivitiesPage() {
  const activitiesRepo = new ActivitiesRepository()
  const activities = await activitiesRepo.getActivities(50)
  
  return <ActivitiesClient activities={activities} />
}

// 2. Service orchestrates complex operations
export async function syncData() {
  const stravaService = new StravaService()
  const result = await stravaService.syncActivities(50)
  return result
}

// 3. Client Component handles user interactions
'use client'
export default function ActivitiesClient({ activities }) {
  const [filtered, setFiltered] = useState(activities)
  
  const handleSearch = (term: string) => {
    const filtered = activities.filter(a => 
      a.name.toLowerCase().includes(term.toLowerCase())
    )
    setFiltered(filtered)
  }

  return (
    <div>
      <SearchInput onChange={handleSearch} />
      <ActivitiesTable activities={filtered} />
    </div>
  )
}
```

### Layer Responsibilities

| Layer | Responsibility | Pattern |
|-------|---------------|---------|
| **Presentation** | UI rendering and user interactions | Server + Client Components |
| **Business Logic** | Complex operations and external APIs | Service Layer |
| **Data Access** | Database operations | Repository Pattern |

## 🧪 Testing Strategy

### Repository Testing
```typescript
// Mock Supabase for repository tests
jest.mock('@/lib/supabase', () => ({
  createServerComponentClient: () => ({
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: mockActivity, error: null })
  })
}))
```

### Service Testing
```typescript
// Mock repositories for service tests
jest.mock('@/lib/repositories/activities-repository')
jest.mock('@/lib/repositories/segments-repository')

describe('StravaService', () => {
  it('should sync activities successfully', async () => {
    const mockActivitiesRepo = {
      getActivityById: jest.fn().mockResolvedValue(null),
      createActivity: jest.fn().mockResolvedValue(mockActivity)
    }
    
    const stravaService = new StravaService()
    const result = await stravaService.syncActivities(1)
    
    expect(result.synced).toBe(1)
    expect(result.errors).toBe(0)
  })
})
```

### Component Testing
```typescript
// Test client components with mocked props
describe('ActivitiesClient', () => {
  it('should filter activities on search', () => {
    const activities = [
      { id: 1, name: 'Morning Ride' },
      { id: 2, name: 'Evening Run' }
    ]
    
    render(<ActivitiesClient activities={activities} />)
    
    const searchInput = screen.getByPlaceholderText('Search activities...')
    fireEvent.change(searchInput, { target: { value: 'ride' } })
    
    expect(screen.getByText('Morning Ride')).toBeInTheDocument()
    expect(screen.queryByText('Evening Run')).not.toBeInTheDocument()
  })
})
```

## 📈 Performance Benefits

### Server Components
- **Reduced Bundle Size**: Data fetching code stays on server
- **Faster Initial Load**: Pre-rendered content
- **Better SEO**: Search engines can crawl content

### Repository Pattern
- **Query Optimization**: Centralized query logic
- **Connection Pooling**: Efficient database connections
- **Caching**: Repository-level caching strategies

### Service Layer
- **Batch Processing**: Efficient bulk operations
- **Rate Limiting**: Controlled API usage
- **Error Recovery**: Graceful failure handling

## 🔮 Future Enhancements

### Additional Patterns to Consider

1. **Observer Pattern**: Real-time updates with Supabase subscriptions
2. **Factory Pattern**: Dynamic component creation
3. **Strategy Pattern**: Different data processing strategies
4. **Command Pattern**: Undo/redo functionality

### Pattern Extensions

1. **Repository Interface**: Abstract base repository class
2. **Service Interface**: Common service contract
3. **Component Composition**: Higher-order components
4. **Custom Hooks**: Reusable state logic

## 📚 Best Practices

### When to Use Each Pattern

| Pattern | Use Case | Example |
|---------|----------|---------|
| **Server + Client Components** | Data-heavy pages with interactivity | Activity lists, dashboards |
| **Repository Pattern** | Database operations | CRUD operations, data queries |
| **Service Layer** | Business logic, external APIs | Strava integration, data processing |

### Anti-Patterns to Avoid

1. **God Objects**: Don't put everything in one service
2. **Tight Coupling**: Don't directly access repositories from components
3. **Mixed Responsibilities**: Don't mix data access with business logic
4. **Over-Engineering**: Don't add patterns just for the sake of it

This implementation provides a solid foundation for building scalable, maintainable applications with clear separation of concerns and excellent developer experience. 