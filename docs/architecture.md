# Architecture Documentation

This document describes the architecture and design patterns implemented in the StravaHeatmap project.

## 🏗️ System Architecture

The application follows a **layered architecture** with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────┐
│                    Presentation Layer                       │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │   Server        │  │   Client        │  │   API        │ │
│  │  Components     │  │  Components     │  │  Routes      │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                    Business Logic Layer                     │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │   Services      │  │   Repositories  │  │   Utilities  │ │
│  │   (Strava)      │  │   (Data Access) │  │   (Helpers)  │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                    Data Access Layer                        │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │   Supabase      │  │   External      │  │   Local      │ │
│  │   Database      │  │   APIs (Strava) │  │   Storage    │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## 🎯 Design Patterns Implemented

### 1. Server Components + Client Components Pattern

**Purpose**: Separate data fetching from UI interactivity for optimal performance.

**Implementation**:

```typescript
// Server Component (app/activities/page.tsx)
export default async function ActivitiesPage() {
  const activitiesRepo = new ActivitiesRepository()
  
  // Server-side data fetching
  const activities = await activitiesRepo.getActivities(50)
  const stats = await activitiesRepo.getActivityStats()

  return (
    <main>
      <h1>Activities</h1>
      {/* Pass data to client component */}
      <ActivitiesClient 
        initialActivities={activities} 
        stats={stats}
      />
    </main>
  )
}

// Client Component (app/activities/activities-client.tsx)
'use client'
export default function ActivitiesClient({ initialActivities, stats }) {
  const [activities, setActivities] = useState(initialActivities)
  const [searchTerm, setSearchTerm] = useState('')
  
  // Client-side filtering and sorting
  const filteredActivities = useMemo(() => {
    return activities.filter(activity =>
      activity.name.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [activities, searchTerm])

  return (
    <div>
      <SearchInput value={searchTerm} onChange={setSearchTerm} />
      <ActivitiesTable activities={filteredActivities} />
    </div>
  )
}
```

**Benefits**:
- ✅ **Performance**: Data fetched on server, reducing client bundle size
- ✅ **SEO**: Server-rendered content for better search engine optimization
- ✅ **Interactivity**: Client components handle user interactions
- ✅ **Caching**: Server components can be cached at the edge

### 2. Repository Pattern

**Purpose**: Abstract data access logic and provide a clean interface for data operations.

**Implementation**:

```typescript
// lib/repositories/activities-repository.ts
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

  // ... more methods
}
```

**Usage**:

```typescript
// In server components or services
const activitiesRepo = new ActivitiesRepository()
const activities = await activitiesRepo.getActivities(20)
const activity = await activitiesRepo.getActivityById(123)
```

**Benefits**:
- ✅ **Abstraction**: Hide database implementation details
- ✅ **Testability**: Easy to mock for unit tests
- ✅ **Reusability**: Consistent data access across the application
- ✅ **Type Safety**: Strongly typed data operations

### 3. Service Layer Pattern

**Purpose**: Encapsulate business logic and external API integrations.

**Implementation**:

```typescript
// lib/services/strava-service.ts
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
            // ... other fields
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

  // ... more business logic methods
}
```

**Usage**:

```typescript
// In API routes or server components
const stravaService = new StravaService()

// Sync activities from Strava
const result = await stravaService.syncActivities(50)
console.log(`Synced ${result.synced} activities, ${result.errors} errors`)

// Get activity statistics
const stats = await stravaService.getActivityStatistics()
```

**Benefits**:
- ✅ **Business Logic**: Centralized business rules and workflows
- ✅ **External Integration**: Clean interface for third-party APIs
- ✅ **Error Handling**: Consistent error handling across the application
- ✅ **Reusability**: Business logic can be reused across different parts of the app

## 📁 File Structure

```
lib/
├── repositories/           # Data access layer
│   ├── activities-repository.ts
│   └── segments-repository.ts
├── services/              # Business logic layer
│   └── strava-service.ts
├── supabase.ts           # Supabase configuration
└── utils/                # Utility functions

app/
├── activities/           # Activities feature
│   ├── page.tsx         # Server component (data fetching)
│   └── activities-client.tsx  # Client component (interactivity)
├── segments/            # Segments feature
│   └── page.tsx
├── dashboard/           # Dashboard feature
│   └── page.tsx
└── api/                 # API routes
    ├── activities/
    └── segments/

types/                   # TypeScript definitions
├── strava.d.ts
├── react-calendar-heatmap.d.ts
└── react-leaflet.d.ts
```

## 🔄 Data Flow

### 1. Server-Side Data Flow

```
User Request → Server Component → Repository → Supabase → Database
                ↓
            Server Component → Client Component → User Interface
```

### 2. Client-Side Data Flow

```
User Interaction → Client Component → State Update → Re-render
                        ↓
                    Filtered/Sorted Data → UI Update
```

### 3. API Data Flow

```
External Request → API Route → Service → Repository → Database
                        ↓
                    Response → Client
```

## 🛡️ Error Handling

### Repository Layer
```typescript
async getActivityById(id: number) {
  const { data, error } = await this.supabase
    .from('activities')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error  // Let calling layer handle
  return data
}
```

### Service Layer
```typescript
async syncActivities(limit = 50) {
  try {
    // Business logic
    const activities = await this.fetchActivities(1, limit)
    
    for (const activity of activities) {
      try {
        await this.activitiesRepo.createActivity(activity)
      } catch (error) {
        // Log error but continue processing
        console.error(`Error syncing activity ${activity.id}:`, error)
      }
    }
  } catch (error) {
    // Re-throw for API layer to handle
    throw error
  }
}
```

### API Layer
```typescript
export async function POST(request: Request) {
  try {
    const stravaService = new StravaService()
    const result = await stravaService.syncActivities()
    
    return Response.json(result)
  } catch (error) {
    return Response.json(
      { error: error.message }, 
      { status: 500 }
    )
  }
}
```

## 🧪 Testing Strategy

### Unit Tests
- **Repositories**: Test data access methods with mocked Supabase
- **Services**: Test business logic with mocked repositories
- **Components**: Test UI logic with mocked props

### Integration Tests
- **API Routes**: Test complete request/response cycles
- **Database**: Test repository methods with real database

### E2E Tests
- **User Flows**: Test complete user journeys
- **External APIs**: Test Strava integration

## 🚀 Performance Considerations

### Server Components
- ✅ **Static Generation**: Pre-render pages at build time
- ✅ **Incremental Static Regeneration**: Update pages on demand
- ✅ **Edge Caching**: Cache responses at the edge

### Client Components
- ✅ **Memoization**: Use `useMemo` for expensive calculations
- ✅ **Debouncing**: Debounce search inputs
- ✅ **Virtualization**: For large lists

### Database
- ✅ **Indexing**: Proper database indexes
- ✅ **Pagination**: Limit result sets
- ✅ **Caching**: Cache frequently accessed data

## 🔧 Configuration

### Environment Variables
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Strava
STRAVA_CLIENT_ID=your_client_id
STRAVA_CLIENT_SECRET=your_client_secret
STRAVA_REDIRECT_URI=your_redirect_uri
```

### TypeScript Configuration
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    "types/**/*.d.ts"
  ]
}
```

## 📈 Scalability

### Horizontal Scaling
- **Stateless Services**: All services are stateless
- **Database**: Supabase handles database scaling
- **CDN**: Static assets served via CDN

### Vertical Scaling
- **Caching**: Implement Redis for session storage
- **Database**: Optimize queries and add indexes
- **CDN**: Cache API responses

### Monitoring
- **Error Tracking**: Log errors and exceptions
- **Performance**: Monitor response times
- **Usage**: Track API usage and limits

This architecture provides a solid foundation for building scalable, maintainable applications with clear separation of concerns and excellent developer experience. 