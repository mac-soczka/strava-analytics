# Sync API Endpoints

**Last Updated:** 2026-05-02

API documentation for the sync system endpoints.

## Authentication

All sync endpoints require authentication. Include the user's session token in requests.

## Endpoints

### POST /api/sync/start

Start a new sync job for the authenticated user.

**Request:**
```http
POST /api/sync/start
Content-Type: application/json
```

**Response (Success):**
```json
{
  "success": true,
  "job": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "pending",
    "created_at": "2026-04-22T10:00:00Z"
  }
}
```

**Response (Job Already Running):**
```json
{
  "error": "A sync job is already running. Please wait for it to complete."
}
```
Status: `409 Conflict`

**Response (Unauthorized):**
```json
{
  "error": "Unauthorized"
}
```
Status: `401 Unauthorized`

---

### GET /api/sync/status/[jobId]

Get the current status of a sync job.

**Request:**
```http
GET /api/sync/status/550e8400-e29b-41d4-a716-446655440000
```

**Response (abridged):**
```json
{
  "job": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "strava_id": 12345678,
    "type": "full_sync",
    "status": "running",
    "total_items": 150,
    "processed_items": 75,
    "failed_items": 2,
    "current_phase": "discover_activities",
    "progress": {
      "activities": { "total": 2558, "processed": 413, "failed": 0 },
      "segments": { "total": 0, "processed": 0, "failed": 0 },
      "segment_efforts": { "total": 0, "processed": 0, "failed": 0 }
    },
    "cursor_before_epoch": 1711843199,
    "cursor_after_epoch": null,
    "requests_used_15m": 74,
    "requests_used_daily": 641,
    "error_message": null,
    "error_details": null,
    "started_at": "2026-04-22T10:00:05Z",
    "completed_at": null,
    "estimated_completion_at": "2026-04-22T10:15:00Z",
    "triggered_by": "user",
    "created_at": "2026-04-22T10:00:00Z",
    "updated_at": "2026-04-22T10:05:30Z"
  },
  "exactState": {
    "phase": "discover_activities",
    "checkpoints": {
      "cursorBeforeEpoch": 1711843199,
      "cursorAfterEpoch": null,
      "lastProcessedActivityId": null
    },
    "requestBudget": {
      "requestsUsed15m": 74,
      "requestsUsedDaily": 641
    }
  }
}
```

**Response (Not Found):**
```json
{
  "error": "Job not found"
}
```
Status: `404 Not Found`

**Response (Forbidden):**
```json
{
  "error": "Forbidden"
}
```
Status: `403 Forbidden` (job belongs to different user)

---

### GET /api/sync/history

Get recent sync jobs for the authenticated user.

**Request:**
```http
GET /api/sync/history
```

**Response:**
```json
{
  "jobs": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "type": "full_sync",
      "status": "completed",
      "total_items": 150,
      "processed_items": 148,
      "failed_items": 2,
      "started_at": "2026-04-22T10:00:05Z",
      "completed_at": "2026-04-22T10:12:30Z",
      "created_at": "2026-04-22T10:00:00Z"
    },
    {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "type": "full_sync",
      "status": "failed",
      "error_message": "Rate limit exceeded",
      "created_at": "2026-04-21T15:30:00Z"
    }
  ]
}
```

Returns up to 10 most recent jobs, ordered by creation date (newest first).

---

## Job Status Values

- `pending`: Job created, waiting to start
- `running`: Job is currently executing
- `completed`: Job finished successfully
- `failed`: Job encountered an error
- `cancelled`: Job was cancelled (manually or by timeout)
- `paused`: Job paused automatically (typically due to Strava rate limits) and resumable at `resume_at`

## Job Types

- `full_sync`: Sync all data (activities, routes, stats)
- `activities_only`: Sync only activities
- `routes_only`: Sync only routes
- `stats_only`: Sync only athlete stats

## Job Phases (for `current_phase`)

- `discover_activities`: oldest-first activity backfill scan (progress may reflect scanned activities)
- `ensure_segments`: ensure segment catalog from activity details
- `ensure_segment_efforts`: ensure segment-effort rows are persisted
- `completed`: terminal success
- `failed`: terminal failure

## Error Handling

All endpoints return appropriate HTTP status codes:
- `200 OK`: Success
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: Not authorized to access resource
- `404 Not Found`: Resource not found
- `409 Conflict`: Duplicate operation (job already running)
- `500 Internal Server Error`: Server error

Error responses include:
```json
{
  "error": "Human-readable error message",
  "details": "Optional technical details"
}
```

## Rate Limiting

Sync jobs respect Strava API rate limits:
- 100 requests per 15 minutes
- 1000 requests per day

When limits are reached:
- Job status transitions to `paused`
- `resume_at` is set for automatic continuation
- latest cursor/checkpoint is persisted to avoid restarting from scratch

## Polling Recommendations

When monitoring job status:
- Poll every 2-5 seconds while job is running
- Stop polling when status is `completed`, `failed`, or `cancelled`
- Use exponential backoff if polling frequently
- Maximum recommended poll duration: 30 minutes

## Example Usage

### JavaScript/TypeScript

```typescript
// Start sync
const startResponse = await fetch('/api/sync/start', {
  method: 'POST',
})
const { job } = await startResponse.json()

// Poll for status
const pollInterval = setInterval(async () => {
  const statusResponse = await fetch(`/api/sync/status/${job.id}`)
  const { job: currentJob } = await statusResponse.json()
  
  if (['completed', 'failed', 'cancelled'].includes(currentJob.status)) {
    clearInterval(pollInterval)
    console.log('Sync finished:', currentJob.status)
  } else {
    console.log(`Phase: ${currentJob.current_phase}`)
    console.log(`Progress: ${currentJob.processed_items}/${currentJob.total_items}`)
    if (currentJob.status === 'paused') {
      console.log(`Will resume at: ${currentJob.resume_at}`)
    }
  }
}, 2000)
```

### cURL

```bash
# Start sync
curl -X POST https://your-app.com/api/sync/start \
  -H "Cookie: your-session-cookie"

# Get status
curl https://your-app.com/api/sync/status/550e8400-e29b-41d4-a716-446655440000 \
  -H "Cookie: your-session-cookie"

# Get history
curl https://your-app.com/api/sync/history \
  -H "Cookie: your-session-cookie"
```
