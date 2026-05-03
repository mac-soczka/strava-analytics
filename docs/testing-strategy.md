# Testing Strategy for Strava Crawler

## Overview

This document outlines the comprehensive testing strategy for the Strava crawler system, covering unit tests, integration tests, and end-to-end (E2E) tests.

## Live Strava API Policy

**Policy Updated:** 2026-05-03

- Automated tests must not call live Strava API endpoints.
- Use mocked `StravaApiClient` responses for all third-party Strava interactions.
- Keep integration tests focused on real database behavior plus mocked third-party boundaries.
- If a test needs realistic activity/segment payloads, use fixtures checked into the test suite.

## Test Types

### 1. Unit Tests

**Purpose**: Test individual components in isolation with mocked dependencies.

**Coverage**:
- `StravaService` - Token management, API calls, rate limiting
- `RateLimitTracker` - Rate limit tracking and calculations
- `ActivitiesRepository` - Database operations for activities
- `SegmentsRepository` - Database operations for segments
- `StravaCrawlerService` - Core crawler logic

**Key Test Scenarios**:
```typescript
// Token Management
- Valid token retrieval
- Expired token refresh
- Missing token handling
- Database connection errors

// API Integration
- Successful activity fetching
- Rate limit handling (429 errors)
- Network failures
- Invalid responses

// Rate Limiting
- 15-minute request tracking
- Daily request tracking
- Counter resets
- Delay calculations
```

**Run Command**: `yarn test`

### 2. Integration Tests

**Purpose**: Test component interactions and database operations.

**Coverage**:
- `StravaCrawlerService` with mocked Strava API
- Database operations with test database
- Repository interactions
- Error handling across components

**Key Test Scenarios**:
```typescript
// Crawler Workflow
- Complete user processing
- Multiple user handling
- Partial failure scenarios
- Logging and statistics

// Database Integration
- Activity storage and retrieval
- Segment storage and retrieval
- Foreign key constraints
- Data integrity
```

**Run Command**: `yarn test:integration`

### 3. E2E Tests

**Purpose**: Test complete workflows from UI to database.

**Coverage**:
- Full crawler workflow via UI
- API endpoint testing
- Rate limit monitoring
- Error handling in UI

**Key Test Scenarios**:
```typescript
// UI Workflows
- Crawler triggering via button
- Results display
- Error handling
- Rate limit status display

// API Endpoints
- POST /api/strava/crawl
- GET /api/strava/crawler/logs
- GET /api/strava/crawler/stats
- GET /api/strava/rate-limit
```

**Run Command**: `yarn test:e2e`

## Test Structure

```
tests/
├── unit/
│   ├── services/
│   │   ├── strava-service.test.ts
│   │   ├── strava-crawler-service.test.ts
│   │   └── rate-limit-tracker.test.ts
│   └── repositories/
│       ├── activities-repository.test.ts
│       └── segments-repository.test.ts
├── integration/
│   ├── strava-crawler-service.test.ts
│   └── database.test.ts
└── e2e/
    ├── crawler-workflow.test.ts
    └── api-endpoints.test.ts
```

## Mock Strategy

### External Dependencies

1. **Strava API**: Mock `fetch` calls with realistic responses
2. **Supabase**: Mock `createClient` and database operations
3. **Environment Variables**: Mock in Jest setup
4. **Time-based Operations**: Mock `setTimeout` and `Date`

### Mock Examples

```typescript
// Strava API Mock
const mockActivities = [
  {
    id: 123456789,
    name: "Morning Ride",
    distance: 25000,
    moving_time: 3600,
    // ... other fields
  }
]

;(fetch as jest.Mock).mockResolvedValue({
  ok: true,
  json: () => Promise.resolve(mockActivities)
})

// Supabase Mock
const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn().mockResolvedValue({
    data: mockData,
    error: null
  })
}
```

## Test Data

### Sample Activities
```typescript
const sampleActivities = [
  {
    id: 123456789,
    name: "Morning Ride",
    distance: 25000,
    moving_time: 3600,
    elapsed_time: 3600,
    total_elevation_gain: 150,
    type: "Ride",
    start_date: "2025-07-26T10:00:00Z",
    start_date_local: "2025-07-26T10:00:00Z"
  }
]
```

### Sample Segments
```typescript
const sampleSegments = [
  {
    id: 987654321,
    segment: {
      id: 12345,
      name: "Test Segment",
      distance: 1000,
      average_grade: 5.2,
      maximum_grade: 8.1,
      elevation_high: 100,
      elevation_low: 50,
      climb_category: 3,
      city: "Test City",
      state: "Test State",
      country: "Test Country",
      private: false,
      hazardous: false,
      starred: false
    },
    elapsed_time: 180,
    moving_time: 180,
    start_date: "2025-07-26T10:00:00Z",
    start_date_local: "2025-07-26T10:00:00Z"
  }
]
```

## Performance Testing

### Load Testing Scenarios
```typescript
// Test with large datasets
- 1000+ activities
- Multiple users
- High rate limit usage
- Memory consumption
- Execution time limits
```

### Performance Benchmarks
- **Activity Sync**: < 5 seconds per 100 activities
- **Memory Usage**: < 100MB for 1000 activities
- **Database Operations**: < 1 second per batch
- **API Calls**: Respect rate limits (100/15min, 1000/day)

## Continuous Integration

### GitHub Actions Workflow
```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: yarn install
      - run: yarn test
      - run: yarn test:coverage
      - run: yarn test:e2e
```

### Coverage Requirements
- **Lines**: 70%
- **Functions**: 70%
- **Branches**: 70%
- **Statements**: 70%

## Running Tests

### Development
```bash
# Run all tests
yarn test

# Run tests in watch mode
yarn test:watch

# Run with coverage
yarn test:coverage

# Run E2E tests
yarn test:e2e

# Run E2E tests with UI
yarn test:e2e:ui

# Run E2E tests in debug mode
yarn test:e2e:debug
```

### Specific Test Files
```bash
# Run specific test file
yarn test strava-service.test.ts

# Run tests matching pattern
yarn test --testNamePattern="token"

# Run tests in specific directory
yarn test tests/unit/services/
```

## Best Practices

### Test Organization
1. **Arrange**: Set up test data and mocks
2. **Act**: Execute the function being tested
3. **Assert**: Verify the expected outcomes

### Naming Conventions
- Test files: `*.test.ts` or `*.spec.ts`
- Test descriptions: "should [expected behavior]"
- Mock variables: `mock[ComponentName]`

### Error Testing
- Test both success and failure scenarios
- Verify error messages and types
- Test edge cases and boundary conditions

### Async Testing
- Use `async/await` for asynchronous operations
- Mock timers for time-based operations
- Test promise rejections and error handling

## Debugging Tests

### Jest Debugging
```bash
# Run specific test with debugging
yarn test --verbose --no-coverage

# Debug with Node.js inspector
node --inspect-brk node_modules/.bin/jest --runInBand
```

### Playwright Debugging
```bash
# Run with debug mode
yarn test:e2e:debug

# Run with UI mode
yarn test:e2e:ui

# Generate trace
yarn test:e2e --trace on
```

## Future Enhancements

### Planned Test Improvements
1. **Visual Regression Testing**: Screenshot comparisons
2. **Performance Testing**: Automated performance benchmarks
3. **Security Testing**: Vulnerability scanning
4. **Contract Testing**: API contract validation
5. **Chaos Testing**: Failure injection testing

### Test Infrastructure
1. **Test Database**: Dedicated test database setup
2. **Test Data Factory**: Automated test data generation
3. **Test Environment**: Isolated test environment
4. **Monitoring**: Test execution monitoring and alerting 