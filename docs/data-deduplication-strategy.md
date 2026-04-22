# Data Deduplication Strategy

**Last Updated:** 2026-04-22

## Overview

The Strava Heatmap application uses **upsert operations** (INSERT ... ON CONFLICT UPDATE) to prevent duplicate data when syncing from the Strava API. This ensures that running multiple syncs won't create duplicate records.

## How It Works

### Database-Level Deduplication

All main tables have **unique constraints** that prevent duplicates:

```sql
-- Activities: unique on activity_id
ALTER TABLE activities ADD CONSTRAINT activities_activity_id_key UNIQUE (activity_id);

-- Segments: unique on segment_id  
ALTER TABLE segments ADD CONSTRAINT segments_segment_id_key UNIQUE (segment_id);

-- Segment Efforts: unique on (activity_id, segment_id) combination
ALTER TABLE segment_efforts ADD CONSTRAINT segment_efforts_activity_id_segment_id_key 
  UNIQUE (activity_id, segment_id);

-- Users: unique on strava_id
ALTER TABLE users ADD CONSTRAINT users_strava_id_key UNIQUE (strava_id);

-- Tokens: unique on strava_id
ALTER TABLE strava_tokens ADD CONSTRAINT strava_tokens_strava_id_key UNIQUE (strava_id);
```

### Application-Level Upsert Operations

The application uses Supabase's `upsert()` method with `onConflict` to handle duplicates:

#### 1. Activities
```typescript
// In StravaService or ActivitiesRepository
await supabase
  .from('activities')
  .upsert(activityData, { onConflict: 'activity_id' })
```

**Behavior:**
- If `activity_id` exists → **UPDATE** the existing record
- If `activity_id` doesn't exist → **INSERT** new record
- **Result:** No duplicates, always latest data

#### 2. Segments
```typescript
// repositories/segments-repository.ts
async bulkUpsertSegments(segments: Segment[]) {
  return await this.supabase
    .from('segments')
    .upsert(segments, { onConflict: 'segment_id' })
    .select()
}
```

**Behavior:**
- Bulk operation for efficiency
- Updates existing segments with latest data
- Inserts new segments

#### 3. Segment Efforts
```typescript
// repositories/segments-repository.ts
async bulkUpsertSegmentEfforts(efforts: SegmentEffort[]) {
  return await this.supabase
    .from('segment_efforts')
    .upsert(efforts, { onConflict: 'activity_id,segment_id' })
    .select()
}
```

**Behavior:**
- Composite key: (activity_id, segment_id)
- Same activity + same segment = same effort
- Updates if exists, inserts if new

#### 4. User Data & Tokens
```typescript
// database.ts
export async function upsertUser(userData) {
  return await supabase
    .from('users')
    .upsert(data, { onConflict: 'strava_id' })
}

export async function upsertTokens(tokenData) {
  return await supabase
    .from('strava_tokens')
    .upsert(data, { onConflict: 'strava_id' })
}
```

**Behavior:**
- One user per strava_id
- Tokens always updated with latest values

## Sync Job Deduplication

### Current Implementation

The sync job system **does NOT** prevent duplicate jobs from being created, but it **does** prevent duplicate data:

```typescript
// SyncOrchestrationService
async startFullSync(stravaId: number): Promise<SyncJob> {
  // Check for active job
  const activeJob = await this.jobsRepo.getActiveJobForUser(stravaId)
  if (activeJob) {
    throw new Error('A sync job is already running for this user')
  }
  
  // Create new job
  const job = await this.jobsRepo.createJob(stravaId, 'full_sync')
  // ...
}
```

**Protection:**
- ✅ Prevents starting a new job while one is running
- ✅ All data operations use upsert (no duplicate data)
- ❌ Allows creating a new job after previous one completes (even if it was recent)

### Potential Enhancement: Cooldown Period

To prevent users from spamming sync requests, you could add a cooldown:

```typescript
async startFullSync(stravaId: number): Promise<SyncJob> {
  // Check for active job
  const activeJob = await this.jobsRepo.getActiveJobForUser(stravaId)
  if (activeJob) {
    throw new Error('A sync job is already running')
  }
  
  // NEW: Check for recent completed job
  const recentJobs = await this.jobsRepo.getRecentJobsForUser(stravaId, 1)
  if (recentJobs.length > 0) {
    const lastJob = recentJobs[0]
    const minutesSinceLastSync = (Date.now() - new Date(lastJob.created_at).getTime()) / 1000 / 60
    
    if (minutesSinceLastSync < 5) { // 5-minute cooldown
      throw new Error(`Please wait ${Math.ceil(5 - minutesSinceLastSync)} minutes before syncing again`)
    }
  }
  
  // Create new job
  const job = await this.jobsRepo.createJob(stravaId, 'full_sync')
  // ...
}
```

## Benefits of Current Approach

### ✅ Advantages

1. **Idempotent Operations**: Running sync multiple times produces the same result
2. **Data Freshness**: Always gets latest data from Strava
3. **No Manual Cleanup**: No need to delete duplicates
4. **Atomic Updates**: Database handles conflicts automatically
5. **Performance**: Upsert is faster than SELECT + INSERT/UPDATE
6. **Simplicity**: No complex deduplication logic needed

### ⚠️ Considerations

1. **API Calls**: Each sync makes fresh API calls (respects rate limits)
2. **Bandwidth**: Re-fetches data even if unchanged
3. **Job History**: Multiple sync jobs in history (but only one active)

## Incremental Sync (Future Enhancement)

For very large accounts, you could implement incremental sync:

```typescript
// Fetch only activities after last sync
const lastSyncTime = await getLastSuccessfulSyncTime(stravaId)

const activities = await stravaService.fetchActivities({
  after: lastSyncTime, // Unix timestamp
  page: 1,
  perPage: 100
})
```

**Benefits:**
- Fewer API calls
- Faster sync for users who sync frequently
- Still uses upsert for data integrity

**Strava API Support:**
- `GET /athlete/activities?after={timestamp}` - Supported ✅
- `GET /athlete/activities?before={timestamp}` - Supported ✅

## Summary

**Current State:**
- ✅ **Data deduplication**: Fully implemented via upsert operations
- ✅ **Active job prevention**: Can't start sync while one is running
- ✅ **Database constraints**: Prevent duplicates at DB level
- ⚠️ **No cooldown**: Users can sync immediately after previous sync completes

**Recommendation:**
- Current implementation is **production-ready**
- Consider adding **5-minute cooldown** to reduce unnecessary API calls
- Consider **incremental sync** for users with 1000+ activities

## Testing Deduplication

To verify deduplication works:

```bash
# 1. Run first sync
curl -X POST http://localhost:3001/api/sync/start

# 2. Wait for completion
curl http://localhost:3001/api/sync/status/{jobId}

# 3. Run second sync immediately
curl -X POST http://localhost:3001/api/sync/start

# 4. Check database - should have same number of records
psql -d strava_heatmap -c "SELECT COUNT(*) FROM activities;"
```

**Expected Result:** Same count before and after second sync.
