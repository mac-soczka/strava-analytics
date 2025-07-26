# 🕒 Supabase Cron Setup for Strava Crawler

This document explains how to set up and manage automated cron jobs for the Strava data crawler using Supabase's `pg_cron` extension.

## **Overview**

The Supabase Cron system uses the `pg_cron` Postgres extension to schedule recurring jobs. For the Strava crawler, we've set up:

- **Frequent automated runs** every 15 minutes
- **Manual trigger function** for testing
- **Comprehensive logging** to track execution

## **Architecture**

```
┌─────────────────────────────────────────────────────────────┐
│                    SUPABASE CRON SYSTEM                     │
├─────────────────────────────────────────────────────────────┤
│  🕐 pg_cron Extension                                       │
│  ├── Scheduled Jobs (cron.job table)                       │
│  ├── Job Execution History (cron.job_run_details table)    │
│  └── Automatic Scheduling                                   │
├─────────────────────────────────────────────────────────────┤
│  🚀 Cron Functions                                          │
│  ├── trigger_strava_crawler_direct()                       │
│  ├── manual_trigger_strava_crawler()                       │
│  └── Logging & Monitoring                                   │
├─────────────────────────────────────────────────────────────┤
│  📊 Crawler Logs                                            │
│  ├── strava_crawler_logs table                             │
│  ├── Execution status & metrics                            │
│  └── Error tracking                                         │
└─────────────────────────────────────────────────────────────┘
```

## **Setup Steps**

### **1. Database Migrations**

The following migrations have been applied:

- `20250726000000_add_strava_crawler_cron.sql` - Initial setup
- `20250726000001_fix_cron_http.sql` - HTTP extension fix
- `20250726000002_direct_cron_function.sql` - Direct execution
- `20250726000003_update_cron_schedule.sql` - Update to 15-minute schedule
- `20250726000004_rename_cron_job.sql` - Rename job for clarity

### **2. Extensions Enabled**

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS http;
```

### **3. Cron Job Schedule**

```sql
-- Every 15 minutes
SELECT cron.schedule(
  'strava-crawler-15min',
  '*/15 * * * *',
  'SELECT trigger_strava_crawler_direct();'
);
```

**Schedule Benefits:**
- **Fresh data**: Activities and segments fetched every 15 minutes
- **Rate limit optimization**: Small batches spread across time
- **Real-time updates**: Users see new data within 15 minutes
- **Efficient processing**: Database checks prevent redundant API calls

## **Available Functions**

### **Manual Trigger Function**

```sql
-- Trigger the crawler manually
SELECT manual_trigger_strava_crawler();
```

### **Direct Cron Function**

```sql
-- Internal function called by cron
SELECT trigger_strava_crawler_direct();
```

## **Monitoring & Logs**

### **View Recent Logs**

```sql
-- Get recent crawler logs
SELECT * FROM strava_crawler_logs 
ORDER BY run_at DESC 
LIMIT 10;
```

### **Check Cron Job Status**

```sql
-- View scheduled jobs
SELECT * FROM cron.job;

-- View job execution history
SELECT * FROM cron.job_run_details 
ORDER BY start_time DESC 
LIMIT 10;
```

### **Test Script**

Run the test script to verify setup:

```bash
node scripts/test-cron-setup.js
```

## **Cron Schedule Options**

| Schedule | Description | Example |
|----------|-------------|---------|
| `0 6 * * *` | Daily at 6 AM | Current setup |
| `0 */6 * * *` | Every 6 hours | More frequent |
| `0 6,18 * * *` | Twice daily (6 AM, 6 PM) | Balanced |
| `0 6 * * 1` | Weekly on Monday | Less frequent |
| `*/15 * * * *` | Every 15 minutes | Development/testing |

## **Managing Cron Jobs**

### **Update Schedule**

```sql
-- Unschedule existing job
SELECT cron.unschedule('strava-crawler-daily');

-- Schedule with new timing
SELECT cron.schedule(
  'strava-crawler-daily',
  '0 */6 * * *',  -- Every 6 hours
  'SELECT trigger_strava_crawler_direct();'
);
```

### **Disable/Enable Jobs**

```sql
-- Disable job
UPDATE cron.job SET active = false WHERE jobname = 'strava-crawler-daily';

-- Enable job
UPDATE cron.job SET active = true WHERE jobname = 'strava-crawler-daily';
```

### **Delete Job**

```sql
-- Remove job completely
SELECT cron.unschedule('strava-crawler-daily');
```

## **Troubleshooting**

### **Common Issues**

1. **"schema 'net' does not exist"**
   - Solution: Enable `http` extension
   - Fixed in migration `20250726000001_fix_cron_http.sql`

2. **HTTP timeout errors**
   - Solution: Use direct function approach
   - Fixed in migration `20250726000002_direct_cron_function.sql`

3. **Permission denied**
   - Solution: Ensure service role key is configured
   - Check environment variables

### **Debug Commands**

```sql
-- Check if pg_cron is enabled
SELECT * FROM pg_extension WHERE extname = 'pg_cron';

-- Check cron jobs
SELECT * FROM cron.job;

-- Check recent executions
SELECT * FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'strava-crawler-daily')
ORDER BY start_time DESC;
```

## **Integration with Vercel**

The cron job is designed to work with your Vercel deployment at:
`https://strava-heatmap-alpha.vercel.app/`

### **API Endpoints**

- **Manual trigger**: `POST /api/strava/crawl`
- **Logs**: `GET /api/strava/crawler/logs`
- **Stats**: `GET /api/strava/crawler/stats`

### **UI Monitoring**

- **Test page**: `https://strava-heatmap-alpha.vercel.app/test`
- **Crawler logs**: `https://strava-heatmap-alpha.vercel.app/test/logs`

## **Best Practices**

### **1. Monitoring**

- Check logs regularly via UI or SQL
- Set up alerts for failed executions
- Monitor execution times

### **2. Scheduling**

- Avoid peak Strava API usage times
- Consider rate limits when setting frequency
- Test schedules in development first

### **3. Error Handling**

- All errors are logged to `strava_crawler_logs`
- Failed jobs don't stop the cron system
- Manual intervention may be needed for auth issues

### **4. Performance**

- Keep job execution under 10 minutes
- Monitor database performance
- Consider batch sizes for large datasets

## **Security Considerations**

- Cron functions use `SECURITY DEFINER`
- Service role key required for database access
- HTTP calls use secure endpoints
- All operations are logged for audit

## **Next Steps**

1. **Monitor the first automated run** (6 AM UTC daily)
2. **Set up alerts** for failed executions
3. **Optimize schedule** based on usage patterns
4. **Add more sophisticated error handling** if needed

## **Support**

For issues with the cron setup:

1. Check the logs in Supabase dashboard
2. Run the test script: `node scripts/test-cron-setup.js`
3. Review this documentation
4. Check the Supabase Cron documentation: https://supabase.com/docs/guides/functions/cron 