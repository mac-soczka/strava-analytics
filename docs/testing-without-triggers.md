# Testing Without Triggers

This document explains why we avoid database triggers and how to test database operations more effectively.

## 🚫 Why We Avoid Triggers

### Problems with Triggers:
1. **Hard to Test** - Triggers run automatically, making it difficult to verify their behavior
2. **Hidden Logic** - Business logic buried in database layer
3. **Debugging Issues** - Hard to trace trigger execution
4. **Performance Impact** - Can slow down operations unexpectedly
5. **Version Control** - Database schema changes are harder to track

### Benefits of Application-Level Timestamps:
1. **Easy to Test** - You can mock timestamps and verify exact data
2. **Transparent Logic** - All business logic is in your application code
3. **Better Debugging** - You can see exactly what data is being sent
4. **Consistent Behavior** - Same logic across all environments
5. **Type Safety** - TypeScript can catch errors at compile time

## 🧪 Testing Database Operations

### Before (with triggers):
```sql
-- Hard to test - trigger runs automatically
UPDATE users SET firstname = 'John' WHERE id = 1;
-- You can't easily verify the trigger updated updated_at
```

### After (application-level):
```typescript
// Easy to test - you control the timestamps
const userData = {
  strava_id: 12345,
  firstname: 'John',
  lastname: 'Doe'
};

const result = prepareUpdateData(userData);
// You can easily verify the exact data being sent
expect(result.updated_at).toBe('2024-01-01T00:00:00.000Z');
```

## 📝 Example Test

```typescript
import { prepareInsertData, prepareUpdateData } from '@/lib/database';

describe('Database Utilities', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));
  });

  it('should add timestamps to insert data', () => {
    const userData = {
      strava_id: 12345,
      firstname: 'John',
      lastname: 'Doe'
    };

    const result = prepareInsertData(userData);

    expect(result).toEqual({
      strava_id: 12345,
      firstname: 'John',
      lastname: 'Doe',
      created_at: '2024-01-01T00:00:00.000Z',
      updated_at: '2024-01-01T00:00:00.000Z'
    });
  });

  it('should add only updated_at to update data', () => {
    const userData = {
      strava_id: 12345,
      firstname: 'John',
      lastname: 'Smith' // Updated
    };

    const result = prepareUpdateData(userData);

    expect(result).toEqual({
      strava_id: 12345,
      firstname: 'John',
      lastname: 'Smith',
      updated_at: '2024-01-01T00:00:00.000Z'
    });
  });
});
```

## 🔧 Database Utilities

We provide utility functions in `lib/database.ts`:

### `prepareInsertData(data)`
Adds `created_at` and `updated_at` timestamps for new records.

### `prepareUpdateData(data)`
Adds only `updated_at` timestamp for existing records.

### `upsertUser(userData)`
Handles user data upsert with proper error handling.

### `upsertTokens(tokenData)`
Handles token data upsert with proper error handling.

## 🎯 Benefits in Practice

1. **Consistent Testing** - Same behavior in all environments
2. **Easy Debugging** - You can log exactly what data is sent
3. **Type Safety** - TypeScript ensures correct data structure
4. **Performance** - No hidden database operations
5. **Maintainability** - All logic is in your codebase

## 📊 Migration Impact

The migration now creates:
- ✅ Tables with timestamp columns
- ✅ Indexes for performance
- ✅ RLS policies for security
- ❌ No triggers (easier to test)
- ❌ No hidden database functions

This makes the database simpler and your application more testable! 