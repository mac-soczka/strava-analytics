# Services Documentation

This document describes the services layer of the StravaHeatmap application, which encapsulates business logic and external API integrations.

## 🏗️ Service Layer Overview

The service layer acts as an intermediary between the presentation layer (components) and the data access layer (repositories). It contains business logic, orchestrates data operations, and manages external API integrations.

## 📦 Available Services

### 1. StravaService

**Purpose**: Manages all Strava API interactions and business logic related to activities and segments.

**Location**: `lib/services/strava-service.ts`

#### Key Features

- **Token Management**: Automatic token refresh and validation
- **Activity Synchronization**: Sync activities from Strava to local database
- **Segment Fetching**: Fetch and store segment efforts for activities
- **Statistics**: Generate comprehensive activity and segment statistics
- **Error Handling**: Robust error handling with retry logic

#### Methods

##### `getValidTokens(): Promise<StravaTokens>`
Retrieves valid Strava access tokens, automatically refreshing if expired.

```typescript
const stravaService = new StravaService()
const tokens = await stravaService.getValidTokens()
// Returns: { access_token, refresh_token, expires_at }
```

##### `fetchActivities(page: number, perPage: number): Promise<StravaActivity[]>`
Fetches activities directly from Strava API.

```typescript
const activities = await stravaService.fetchActivities(1, 30)
// Returns array of Strava activities
```

##### `fetchActivitySegments(activityId: number): Promise<StravaSegmentEffort[]>`
Fetches segment efforts for a specific activity.

```typescript
const segments = await stravaService.fetchActivitySegments(12345)
// Returns array of segment efforts
```

##### `syncActivities(limit: number): Promise<{ synced: number; errors: number }>`
Synchronizes activities from Strava to the local database.

```typescript
const result = await stravaService.syncActivities(50)
console.log(`Synced ${result.synced} activities, ${result.errors} errors`)
```

##### `syncSegments(batchSize: number): Promise<{ processed: number; segmentsAdded: number; errors: number }>`
Synchronizes segments for activities that need them.

```typescript
const result = await stravaService.syncSegments(10)
console.log(`Processed ${result.processed} activities, added ${result.segmentsAdded} segments`)
```

##### `getActivityStatistics(): Promise<ActivityStatistics>`
Generates comprehensive statistics for activities and segments.

```typescript
const stats = await stravaService.getActivityStatistics()
// Returns: { activities, segments, summary }
```

##### `searchActivities(searchTerm: string, limit: number): Promise<StravaActivity[]>`
Searches activities by name.

```typescript
const results = await stravaService.searchActivities('morning ride', 20)
// Returns matching activities
```

##### `getActivityDetails(activityId: number): Promise<ActivityWithSegments>`
Gets complete activity details including segments.

```typescript
const activity = await stravaService.getActivityDetails(12345)
// Returns activity with segments
```

#### Usage Examples

##### Basic Activity Sync
```typescript
import { StravaService } from '@/lib/services/strava-service'

export async function syncNewActivities() {
  const stravaService = new StravaService()
  
  try {
    const result = await stravaService.syncActivities(50)
    console.log(`Successfully synced ${result.synced} activities`)
    return result
  } catch (error) {
    console.error('Failed to sync activities:', error)
    throw error
  }
}
```

##### Background Segment Processing
```typescript
export async function processSegments() {
  const stravaService = new StravaService()
  
  try {
    const result = await stravaService.syncSegments(10)
    console.log(`Processed ${result.processed} activities`)
    console.log(`Added ${result.segmentsAdded} segments`)
    return result
  } catch (error) {
    console.error('Failed to process segments:', error)
    throw error
  }
}
```

##### Dashboard Statistics
```typescript
export async function getDashboardStats() {
  const stravaService = new StravaService()
  
  try {
    const stats = await stravaService.getActivityStatistics()
    return {
      totalActivities: stats.summary.totalActivities,
      totalDistance: stats.summary.totalDistance,
      totalTime: stats.summary.totalTime,
      totalElevation: stats.summary.totalElevation,
      segmentEfforts: stats.summary.totalSegmentEfforts,
      uniqueSegments: stats.summary.uniqueSegments
    }
  } catch (error) {
    console.error('Failed to get statistics:', error)
    throw error
  }
}
```

## 🔄 Service Lifecycle

### 1. Initialization
```typescript
const stravaService = new StravaService()
// Creates instances of:
// - Supabase client
// - ActivitiesRepository
// - SegmentsRepository
```

### 2. Token Validation
```typescript
// Every API call first validates tokens
const tokens = await stravaService.getValidTokens()
// Automatically refreshes if expired
```

### 3. Data Processing
```typescript
// Services coordinate between repositories and external APIs
const activities = await stravaService.fetchActivities(1, 30)
await stravaService.syncActivities(50)
```

### 4. Error Handling
```typescript
// Services provide consistent error handling
try {
  const result = await stravaService.syncActivities(50)
} catch (error) {
  // Handle service-level errors
  console.error('Service error:', error.message)
}
```

## 🛡️ Error Handling

### Token Errors
```typescript
// Automatic token refresh on 401 errors
if (response.status === 401) {
  const newTokens = await this.refreshTokens(tokens.refresh_token)
  return this.fetchActivities(page, perPage) // Retry with new tokens
}
```

### Rate Limiting
```typescript
// Built-in rate limiting for Strava API
await new Promise(resolve => setTimeout(resolve, 1100)) // 1.1 second delay
```

### Partial Failures
```typescript
// Continue processing even if individual items fail
for (const activity of activities) {
  try {
    await this.activitiesRepo.createActivity(activity)
    synced++
  } catch (error) {
    console.error(`Error syncing activity ${activity.id}:`, error)
    errors++
  }
}
```

## 🔧 Configuration

### Environment Variables
```bash
# Required for Strava API
STRAVA_CLIENT_ID=your_client_id
STRAVA_CLIENT_SECRET=your_client_secret
STRAVA_REDIRECT_URI=your_redirect_uri

# Required for Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### Rate Limiting Configuration
```typescript
// Configurable delays for API calls
const RATE_LIMIT_DELAY = 1100 // milliseconds
const BATCH_SIZE = 10 // activities per batch
```

## 🧪 Testing

### Unit Testing
```typescript
// Mock repositories for testing
jest.mock('@/lib/repositories/activities-repository')
jest.mock('@/lib/repositories/segments-repository')

describe('StravaService', () => {
  let stravaService: StravaService
  let mockActivitiesRepo: jest.Mocked<ActivitiesRepository>

  beforeEach(() => {
    stravaService = new StravaService()
    mockActivitiesRepo = new ActivitiesRepository() as jest.Mocked<ActivitiesRepository>
  })

  it('should sync activities successfully', async () => {
    // Test implementation
  })
})
```

### Integration Testing
```typescript
// Test with real Supabase instance
describe('StravaService Integration', () => {
  it('should connect to Supabase and fetch data', async () => {
    const stravaService = new StravaService()
    const stats = await stravaService.getActivityStatistics()
    expect(stats).toBeDefined()
  })
})
```

## 📊 Monitoring

### Performance Metrics
```typescript
// Track service performance
const startTime = Date.now()
const result = await stravaService.syncActivities(50)
const duration = Date.now() - startTime

console.log(`Sync completed in ${duration}ms`)
```

### Error Tracking
```typescript
// Log errors for monitoring
try {
  await stravaService.syncActivities(50)
} catch (error) {
  console.error('Service error:', {
    timestamp: new Date().toISOString(),
    error: error.message,
    stack: error.stack
  })
}
```

## 🚀 Performance Optimization

### Batch Processing
```typescript
// Process activities in batches to avoid memory issues
const BATCH_SIZE = 50
for (let i = 0; i < totalActivities; i += BATCH_SIZE) {
  const batch = activities.slice(i, i + BATCH_SIZE)
  await processBatch(batch)
}
```

### Caching
```typescript
// Cache frequently accessed data
const cacheKey = `activity_${activityId}`
let activity = cache.get(cacheKey)
if (!activity) {
  activity = await stravaService.getActivityDetails(activityId)
  cache.set(cacheKey, activity, 300000) // 5 minutes
}
```

### Parallel Processing
```typescript
// Process multiple activities in parallel
const promises = activities.map(activity => 
  stravaService.fetchActivitySegments(activity.id)
)
const results = await Promise.all(promises)
```

## 🔮 Future Enhancements

### Planned Services

1. **AnalyticsService**: Advanced analytics and insights
2. **NotificationService**: Real-time notifications
3. **ExportService**: Data export functionality
4. **BackupService**: Automated data backup

### Service Extensions

1. **Caching Layer**: Redis integration for performance
2. **Queue System**: Background job processing
3. **Webhook Handler**: Real-time Strava webhooks
4. **Data Validation**: Enhanced data validation

This service layer provides a robust foundation for managing business logic and external integrations while maintaining clean separation of concerns and excellent testability. 