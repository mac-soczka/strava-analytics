# Strava API Rate Limits

**Last Updated:** 2026-04-22

## Official Documentation

- [Strava Rate Limits Documentation](https://developers.strava.com/docs/rate-limits/)
- [Strava API Reference](https://developers.strava.com/docs/reference/)

## Rate Limit Structure

Strava enforces two types of rate limits:

### 1. Short-Term Limit (15-minute window)
- **Limit**: 100 requests per 15 minutes
- **Window**: Rolling 15-minute window
- **Reset**: 15 minutes after the first request in the window
- **Purpose**: Prevent burst traffic and API abuse

### 2. Long-Term Limit (Daily)
- **Limit**: 1,000 requests per day
- **Window**: Calendar day in UTC timezone
- **Reset**: Midnight UTC (00:00:00 UTC)
- **Purpose**: Ensure fair usage across all applications

## Response Headers

Every Strava API response includes rate limit information in headers:

### X-RateLimit-Usage
Format: `"short_term_usage,daily_usage"`

Example: `"5,12"`
- 5 requests used in current 15-minute window
- 12 requests used today

### X-RateLimit-Limit
Format: `"short_term_limit,daily_limit"`

Example: `"100,1000"`
- 100 requests allowed per 15 minutes
- 1,000 requests allowed per day

## HTTP Status Codes

### 200 OK
Request successful, rate limits not exceeded

### 429 Too Many Requests
Rate limit exceeded. Response includes:
- Standard rate limit headers
- Error message in response body

## Reset Timing

### 15-Minute Window Reset
- **Type**: Rolling window
- **Calculation**: First request time + 15 minutes
- **Example**: 
  - First request at 10:00:00 UTC
  - Window resets at 10:15:00 UTC
  - New window starts with next request

### Daily Reset
- **Type**: Fixed daily reset
- **Time**: Midnight UTC (00:00:00 UTC)
- **Timezone**: Always UTC, regardless of user location
- **Example**:
  - Requests made on 2026-04-22
  - Counter resets at 2026-04-23 00:00:00 UTC
  - New daily quota available

## Best Practices

### 1. Read Headers on Every Response
```typescript
const response = await fetch('https://www.strava.com/api/v3/...')
const usage = response.headers.get('X-RateLimit-Usage')
const limits = response.headers.get('X-RateLimit-Limit')
```

### 2. Implement Adaptive Delays
- **High utilization (>90%)**: 2-second delay between requests
- **Medium utilization (75-90%)**: 1.5-second delay
- **Low utilization (<75%)**: 500ms-1s delay

### 3. Handle 429 Gracefully
- Don't treat as error - it's expected behavior
- Calculate time until reset
- Pause sync job with resume time
- Don't retry immediately

### 4. Plan for Daily Limits
- 1,000 requests per day = ~41 requests per hour average
- For large syncs (2000+ activities), plan multi-day sync
- Prioritize recent activities first

### 5. Avoid Polling
- Don't repeatedly check if limits have reset
- Calculate exact reset time from headers
- Schedule resume based on reset time
- Use exponential backoff if needed

## Implementation in This Project

### Rate Limit Service
Location: `lib/services/rate-limit-service.ts`

Features:
- Tracks current usage from headers
- Calculates time until reset
- Provides adaptive delays
- Recommends wait times

### Sync Job Pausing
When rate limit hit:
1. Sync job status → 'paused'
2. Calculate `resume_at` time (next reset)
3. Save progress (last processed activity)
4. Resume worker checks periodically
5. Auto-resumes when `resume_at` time passes

### Fallback Strategy
For activity details:
- If rate limited, use basic activity data
- Save activity without polyline
- Mark for later enrichment
- Continue sync with remaining quota

## Rate Limit Scenarios

### Scenario 1: Hit 15-Minute Limit
```
Current: 100/100 (15-min), 157/1000 (daily)
Action: Pause for 15 minutes
Resume: When 15-minute window resets
Result: Can continue with daily quota
```

### Scenario 2: Hit Daily Limit
```
Current: 45/100 (15-min), 1000/1000 (daily)
Action: Pause until midnight UTC
Resume: At 00:00:00 UTC next day
Result: Fresh quota for both limits
```

### Scenario 3: Hit Both Limits
```
Current: 100/100 (15-min), 1000/1000 (daily)
Action: Pause until midnight UTC (longer wait)
Resume: At 00:00:00 UTC next day
Result: Fresh quota for both limits
```

## Monitoring

### Console Output
Rate limits displayed after each API call:
```
┌─────────────────────────────────────────────────────────────┐
│ RATE LIMITS (from Strava API)                              │
├─────────────────────────────────────────────────────────────┤
│ 15-minute window:   5 / 100 ( 95 remaining) │
│ Daily window:      12 / 1000 (988 remaining) │
└─────────────────────────────────────────────────────────────┘
```

### Log Files
Location: `logs/sync-YYYY-MM-DDTHH-MM-SS.log`

Contains:
- Rate limit status after each request
- Pause/resume events
- Time until reset calculations

## References

- [Strava Developer Portal](https://developers.strava.com/)
- [Strava API Documentation](https://developers.strava.com/docs/)
- [Rate Limits Guide](https://developers.strava.com/docs/rate-limits/)
- [Getting Started](https://developers.strava.com/docs/getting-started/)
