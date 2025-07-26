# Testing Strategy for Strava Heatmap Authentication

## Overview

This document outlines the comprehensive testing strategy for the authentication system, covering unit tests, integration tests, and end-to-end tests.

## Testing Pyramid

```
    E2E Tests (Few, Critical Paths)
         /\
        /  \
   Integration Tests (API, Database)
        /  \
       /    \
  Unit Tests (Services, Utils)
```

## 1. Unit Tests

### Purpose
- Test individual functions in isolation
- Fast execution (< 100ms per test)
- High coverage of business logic
- Mock external dependencies

### What to Test
- **AuthService** methods (authenticateUser, getCurrentUser, etc.)
- **SessionManager** methods (createSession, validateSession, etc.)
- **TokenManager** methods (getValidTokens, refreshTokens, etc.)
- **Database** utility functions (upsertUser, upsertTokens, etc.)
- **Utility functions** (CSRF token generation, validation)

### Example Test Structure
```typescript
// __tests__/unit/auth-service.test.ts
describe('AuthService', () => {
  describe('authenticateUser', () => {
    it('should authenticate user and create session', async () => {
      // Test implementation
    })
    
    it('should throw error if user not found', async () => {
      // Test error handling
    })
  })
})
```

### Running Unit Tests
```bash
yarn test                    # Run all unit tests
yarn test:watch             # Run in watch mode
yarn test:coverage          # Run with coverage report
```

## 2. Integration Tests

### Purpose
- Test API endpoints and database interactions
- Verify service integration
- Test error scenarios and edge cases
- Mock external services (Strava API)

### What to Test
- **API Routes** (`/api/auth/session`, `/api/auth/logout`, `/api/auth/callback`)
- **Database Operations** with real Supabase client
- **Service Integration** (AuthService + SessionManager + TokenManager)
- **Error Handling** (network failures, invalid tokens, etc.)

### Example Test Structure
```typescript
// __tests__/integration/auth-api.test.ts
describe('/api/auth/session', () => {
  it('should return authenticated user when valid session', async () => {
    // Test API endpoint with mocked services
  })
  
  it('should return 401 when no session token', async () => {
    // Test error response
  })
})
```

### Running Integration Tests
```bash
yarn test __tests__/integration/  # Run only integration tests
```

## 3. End-to-End Tests

### Purpose
- Test complete user flows
- Verify real browser interactions
- Test OAuth flow simulation
- Validate protected routes

### What to Test
- **Complete OAuth Flow** (login → callback → session creation → dashboard access)
- **Protected Routes** (redirects, session validation)
- **Test Page Functionality** (all test buttons work correctly)
- **Error Scenarios** (network failures, invalid tokens)

### Example Test Structure
```typescript
// e2e/auth-flow.spec.ts
test.describe('Authentication Flow', () => {
  test('should complete OAuth flow successfully', async ({ page }) => {
    // Navigate to login
    // Complete OAuth flow
    // Verify session creation
    // Access protected route
  })
})
```

### Running E2E Tests
```bash
yarn test:e2e              # Run all E2E tests
yarn test:e2e:ui           # Run with Playwright UI
yarn test:e2e:debug        # Run in debug mode
```

## 4. Test Data Management

### Test Database
- Use separate test database for integration tests
- Reset database state between tests
- Use test fixtures for consistent data

### Mock Data
```typescript
// __tests__/fixtures/auth-data.ts
export const mockUser = {
  id: 'user-1',
  strava_id: 123456,
  firstname: 'Test',
  lastname: 'User',
  // ... other fields
}

export const mockTokens = {
  access_token: 'test-access-token',
  refresh_token: 'test-refresh-token',
  expires_at: new Date(Date.now() + 3600000).toISOString()
}
```

## 5. Testing Best Practices

### Unit Tests
- **Arrange-Act-Assert** pattern
- Mock external dependencies
- Test both success and failure cases
- Keep tests focused and isolated

### Integration Tests
- Use real database connections
- Mock external APIs (Strava)
- Test API contracts
- Verify error responses

### E2E Tests
- Test critical user paths
- Use realistic test data
- Handle async operations properly
- Test cross-browser compatibility

## 6. Test Coverage Goals

- **Unit Tests**: 90%+ coverage
- **Integration Tests**: All API endpoints
- **E2E Tests**: Critical user flows

## 7. CI/CD Integration

### GitHub Actions Workflow
```yaml
name: Tests
on: [push, pull_request]
jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: yarn install
      - run: yarn test:coverage
  
  integration-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
    steps:
      - uses: actions/checkout@v3
      - run: yarn test __tests__/integration/
  
  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: yarn test:e2e
```

## 8. Testing Tools

### Unit & Integration Tests
- **Jest** - Test runner and assertion library
- **@testing-library/react** - React component testing
- **node-mocks-http** - HTTP request mocking
- **@testing-library/jest-dom** - Custom matchers

### E2E Tests
- **Playwright** - Browser automation
- **Multiple browsers** - Chrome, Firefox, Safari
- **Visual testing** - Screenshot comparisons
- **Network mocking** - API response simulation

## 9. Debugging Tests

### Unit Tests
```bash
yarn test --verbose        # Detailed output
yarn test --detectOpenHandles  # Find hanging processes
```

### Integration Tests
```bash
yarn test --runInBand      # Run tests sequentially
yarn test --detectLeaks    # Memory leak detection
```

### E2E Tests
```bash
yarn test:e2e:debug        # Run with debugger
yarn test:e2e --headed     # Run with visible browser
```

## 10. Performance Testing

### Load Testing
- Test session creation under load
- Verify database performance
- Monitor memory usage

### Security Testing
- Test CSRF protection
- Verify session security
- Test token refresh mechanisms

This testing strategy ensures comprehensive coverage of the authentication system while maintaining fast feedback loops for development. 