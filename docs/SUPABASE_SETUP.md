# Supabase Setup Guide

This guide will help you add Supabase to your existing Next.js StravaHeatmap project.

## Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note down your project URL and API keys from the Settings > API page

## Step 2: Add Environment Variables

Add these to your `.env.local` file:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Keep your existing Strava variables
STRAVA_CLIENT_ID=your_strava_client_id
STRAVA_CLIENT_SECRET=your_strava_client_secret
```

## Step 3: Set Up Database Schema

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy and paste the contents of `supabase/schema.sql`
4. Run the SQL to create all tables and indexes

## Step 4: Deploy Edge Functions

1. Install Supabase CLI:
   ```bash
   npm install -g supabase
   ```

2. Login to Supabase:
   ```bash
   supabase login
   ```

3. Link your project:
   ```bash
   supabase link --project-ref your_project_ref
   ```

4. Deploy the edge function:
   ```bash
   supabase functions deploy fetch-segments
   ```

## Step 5: Migrate Your Data

Run the migration script to move your existing data to Supabase:

```bash
node scripts/migrate-to-supabase.js
```

This will:
- Migrate all activities from `data/activities.json`
- Migrate all segments from `data/segments/` directory
- Migrate tokens from `data/tokens.json` (if available)

## Step 6: Update Your Components

### Replace Local File Reading with Supabase Queries

**Before (reading from local files):**
```javascript
// Old way
const activities = JSON.parse(fs.readFileSync('data/activities.json', 'utf8'))
```

**After (using Supabase):**
```javascript
// New way
import { createClientComponentClient } from '@/lib/supabase'

const supabase = createClientComponentClient()
const { data: activities } = await supabase
  .from('activities')
  .select('*')
  .order('start_date', { ascending: false })
```

### Example: Update Activities Page

```typescript
// app/activities/page.tsx
import { createClientComponentClient } from '@/lib/supabase'

export default async function ActivitiesPage() {
  const supabase = createClientComponentClient()
  
  const { data: activities } = await supabase
    .from('activities')
    .select(`
      *,
      segments (
        id,
        segment_name,
        elapsed_time,
        moving_time
      )
    `)
    .order('start_date', { ascending: false })

  return (
    <div>
      {activities?.map(activity => (
        <div key={activity.id}>
          <h3>{activity.name}</h3>
          <p>Segments: {activity.segments?.length || 0}</p>
        </div>
      ))}
    </div>
  )
}
```

## Step 7: Set Up Automated Segment Fetching

### Option A: Using Supabase Cron (Recommended)

Add this to your Supabase SQL Editor:

```sql
-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create a cron job that runs every 6 hours
SELECT cron.schedule(
  'fetch-strava-segments',
  '0 */6 * * *', -- Every 6 hours
  $$
  SELECT net.http_post(
    url := 'https://your-project-ref.supabase.co/functions/v1/fetch-segments',
    headers := '{"Authorization": "Bearer your-anon-key", "Content-Type": "application/json"}',
    body := '{}'
  );
  $$
);
```

### Option B: Manual Trigger

Create an API route to trigger segment fetching:

```typescript
// app/api/fetch-segments/route.ts
import { createServerComponentClient } from '@/lib/supabase'

export async function POST() {
  const supabase = createServerComponentClient()
  
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/fetch-segments`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
    }
  )

  const result = await response.json()
  
  return Response.json(result)
}
```

## Step 8: Add Token Management

If you don't have tokens in your database, add them manually:

```sql
INSERT INTO tokens (access_token, refresh_token, expires_at) 
VALUES (
  'your_access_token_here',
  'your_refresh_token_here', 
  '2025-01-01T00:00:00Z'
);
```

Or use the setup script:
```bash
node scripts/setup-with-code.js
```

## Step 9: Test Everything

1. Start your development server:
   ```bash
   yarn dev
   ```

2. Visit your app and verify data is loading from Supabase

3. Test the segment fetching:
   ```bash
   curl -X POST http://localhost:3000/api/fetch-segments
   ```

## Benefits of This Setup

✅ **Real-time updates** - Data changes are reflected immediately  
✅ **Automatic token refresh** - No more manual token management  
✅ **Scalable** - Can handle large amounts of data  
✅ **Cost-effective** - Supabase free tier is generous  
✅ **Built-in monitoring** - Track jobs and progress  
✅ **Production ready** - Can deploy to Vercel with Supabase backend  

## Troubleshooting

### Common Issues:

1. **"No tokens found"** - Add tokens to the database manually
2. **"Function not found"** - Make sure you deployed the edge function
3. **"Permission denied"** - Check your API keys and RLS policies
4. **"Rate limit exceeded"** - The function handles this automatically

### Debugging:

- Check Supabase logs in the dashboard
- Monitor the `jobs` table for progress
- Use the Supabase dashboard to inspect data

## Next Steps

1. **Add real-time subscriptions** for live updates
2. **Implement user authentication** if needed
3. **Add data visualization** with real-time charts
4. **Set up monitoring and alerts**

Your app is now ready for production with a robust, scalable backend! 🚀 