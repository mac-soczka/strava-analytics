# Strava Crawler Architecture

## Overview

This document describes the **shared architecture** for the Strava data crawler that can be triggered by different events while using the same core logic.

## 🏗️ Architecture Design

### **Core Principle: Separation of Concerns**
- **Shared Core Service**: One crawler service handles all the business logic
- **Multiple Triggers**: Different ways to invoke the same core service
- **Unified Monitoring**: Same logging and statistics regardless of trigger

## 📁 File Structure

```
lib/
├── services/
│   ├── strava-crawler-service.ts     # 🎯 SHARED CORE SERVICE
│   ├── strava-service.ts             # (existing - API wrapper)
│   └── auth-service.ts               # (existing)
├── triggers/
│   ├── cron-trigger.ts              # ⏰ Time-based trigger
│   └── serverless-trigger.ts        # 🔗 HTTP trigger
app/
├── api/
│   └── strava/
│       ├── crawl/route.js           # 🚀 Direct app access
│       └── crawler/
│           ├── logs/route.js        # 📊 Monitoring logs
│           └── stats/route.js       # 📈 Monitoring stats
└── components/
    └── CrawlerControl.tsx           # 🎛️ UI Control Panel
```

## 🔧 Core Service: `StravaCrawlerService`

### **Key Features:**
- **Multi-user support**: Can process single user or all users
- **Rate limiting**: Respects Strava API limits per user
- **Error isolation**: One user's failure doesn't affect others
- **Comprehensive logging**: Tracks all operations in database
- **Statistics**: Provides 24h performance metrics

### **Main Method:**
```typescript
async crawlStravaData(options: CrawlerOptions = {}): Promise<CrawlerResult[]>
```

### **Options:**
- `user_id`: Process specific user (or all users if undefined)
- `batch_size`: Number of activities to fetch per batch
- `include_segments`: Whether to fetch segments
- `dry_run`: Test mode without actual API calls

## 🚀 Trigger Methods

### **1. Cron Job Trigger (`cron-trigger.ts`)**
- **Purpose**: Automated, time-based execution
- **Use case**: Daily/weekly background sync
- **Authentication**: Uses service role key
- **Scope**: Processes all users with valid tokens

### **2. Serverless Function Trigger (`serverless-trigger.ts`)**
- **Purpose**: On-demand execution via HTTP
- **Use case**: User-triggered sync, manual runs
- **Authentication**: Can use user session or service role
- **Scope**: Single user (if authenticated) or all users

### **3. Direct App Access (`/api/strava/crawl`)**
- **Purpose**: UI-triggered execution
- **Use case**: Button clicks in your app
- **Authentication**: Uses user session
- **Scope**: Current authenticated user

## 📊 Monitoring & Logging

### **Database Table: `strava_crawler_logs`**
```sql
CREATE TABLE strava_crawler_logs (
  id UUID PRIMARY KEY,
  run_at TIMESTAMP WITH TIME ZONE,
  user_id BIGINT REFERENCES users(strava_id),
  status TEXT CHECK (status IN ('success', 'error', 'partial')),
  message TEXT,
  activities_fetched INTEGER,
  segments_fetched INTEGER,
  error TEXT,
  execution_time_ms INTEGER,
  rate_limit_status JSONB
);
```

### **API Endpoints:**
- `GET /api/strava/crawler/logs` - Recent execution logs
- `GET /api/strava/crawler/stats` - 24h performance statistics

### **UI Component: `CrawlerControl`**
- **Start/Stop**: Manual crawler execution
- **Real-time stats**: 24h performance metrics
- **Recent logs**: Latest execution results
- **Status monitoring**: Success/failure rates

## 🔐 Authentication Context

### **Strava API Access (Always User-Specific)**
- Requires user's Strava tokens
- Rate limits apply per user
- Cannot access other users' data

### **Supabase Access (Context-Dependent)**
- **Cron/Serverless**: Service role key (full access)
- **User context**: Session-based (RLS policies apply)
- **No rate limits**: Database operations unlimited

## 🎯 Usage Examples

### **Cron Job (Daily Sync)**
```typescript
// In Supabase cron job
import { cronTrigger } from '@/lib/triggers/cron-trigger'

// Runs automatically every day at 2 AM
export default cronTrigger
```

### **Serverless Function (Manual Trigger)**
```typescript
// Via HTTP request
POST /api/strava/crawl
Authorization: Bearer <session_token>

// Response
{
  "success": true,
  "user_id": 42137242,
  "users_processed": 1,
  "total_activities": 15,
  "total_segments": 3
}
```

### **UI Control (User Interface)**
```typescript
// In React component
<CrawlerControl />
// Provides button to start crawler + monitoring dashboard
```

## 🔄 Workflow

1. **Trigger Event** (cron, HTTP, UI button)
2. **Authentication** (service role or user session)
3. **User Selection** (single user or all users)
4. **Core Processing** (same logic for all triggers)
5. **Rate Limiting** (per-user tracking)
6. **Data Fetching** (activities + segments)
7. **Database Storage** (activities, segments, logs)
8. **Monitoring** (logs, stats, UI updates)

## 🎨 Benefits of This Architecture

### **1. Code Reuse**
- Single core service handles all scenarios
- No duplication of business logic
- Consistent behavior across triggers

### **2. Flexibility**
- Easy to add new trigger methods
- Can switch between cron and manual execution
- Supports both single-user and multi-user scenarios

### **3. Monitoring**
- Unified logging system
- Same statistics regardless of trigger
- Easy to debug and optimize

### **4. Scalability**
- Can handle multiple users efficiently
- Rate limiting prevents API abuse
- Error isolation prevents cascading failures

### **5. Maintainability**
- Clear separation of concerns
- Easy to test individual components
- Simple to add new features

## 🚀 Next Steps

1. **Test the implementation** using the UI control panel
2. **Set up Supabase cron job** for automated execution
3. **Monitor performance** and adjust rate limiting
4. **Add more users** when ready to scale
5. **Optimize based on usage patterns**

## 📝 Configuration

### **Environment Variables**
- `STRAVA_CLIENT_ID`: Strava OAuth client ID
- `STRAVA_CLIENT_SECRET`: Strava OAuth client secret
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: For cron/serverless access

### **Rate Limiting**
- 100 requests per 15 minutes per user
- 1000 requests per day per user
- Automatic delays between requests
- Retry logic for rate limit errors

This architecture provides a robust, scalable, and maintainable solution for Strava data synchronization that can grow with your needs! 