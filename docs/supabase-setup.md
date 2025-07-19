# 🗄️ Supabase Setup Guide

## 📋 Prerequisites

1. **Supabase Account**: Create one at [supabase.com](https://supabase.com)
2. **New Project**: Create a new Supabase project
3. **Environment Variables**: Already configured in your Vercel project

## 🚀 Setup Steps

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Click "New Project"
3. Choose your organization
4. Enter project details:
   - **Name**: `strava-heatmap`
   - **Database Password**: Choose a strong password
   - **Region**: Choose closest to your users

### 2. Get Project Credentials

1. Go to **Settings** → **API**
2. Copy the following values:
   - **Project URL**: `https://your-project.supabase.co`
   - **Anon Key**: `your_anon_key`
   - **Service Role Key**: `your_service_role_key`

### 3. Set Environment Variables

Add these to your Vercel project:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 4. Run Database Schema

1. Go to **SQL Editor** in your Supabase dashboard
2. Copy the contents of `supabase/schema.sql`
3. Paste and run the SQL commands

This will create:
- `users` table for user profiles
- `strava_tokens` table for secure token storage
- `activities` table for Strava activities
- Proper indexes and RLS policies

### 5. Verify Setup

After running the schema, you should see:
- ✅ 3 tables created (`users`, `strava_tokens`, `activities`)
- ✅ Indexes created for performance
- ✅ RLS policies enabled
- ✅ Triggers for `updated_at` timestamps

## 🔐 Security Features

### Row Level Security (RLS)
- All tables have RLS enabled
- Policies allow service role to manage data
- Users can only access their own data

### Token Storage
- Access tokens stored securely
- Refresh tokens for automatic renewal
- Expiration tracking

## 🧪 Testing the Integration

### 1. Test OAuth Flow
Visit: `https://strava-heatmap-alpha.vercel.app/api/auth/login`

After authentication, check:
- User data saved to `users` table
- Tokens saved to `strava_tokens` table
- Redirect to dashboard

### 2. Check Database
In Supabase dashboard:
1. Go to **Table Editor**
2. Check `users` table for your profile
3. Check `strava_tokens` table for tokens

### 3. Verify Data Structure
```sql
-- Check user data
SELECT * FROM users WHERE strava_id = 42137242;

-- Check tokens (access_token will be masked)
SELECT strava_id, expires_at, updated_at FROM strava_tokens;
```

## 🔄 Next Steps

After successful setup:

1. **Fetch Activities**: Use stored tokens to fetch Strava activities
2. **Store Activities**: Save activities to the `activities` table
3. **Build Dashboard**: Display user data and activities
4. **Token Refresh**: Implement automatic token renewal

## 🚨 Troubleshooting

### Common Issues

1. **RLS Policy Errors**
   - Check that service role key is used for server operations
   - Verify RLS policies are correctly configured

2. **Token Storage Issues**
   - Ensure `strava_tokens` table exists
   - Check for unique constraint violations

3. **User Data Not Saving**
   - Verify Supabase client initialization
   - Check for network connectivity issues

### Debug Commands

```sql
-- Check table structure
\d users
\d strava_tokens
\d activities

-- Check RLS policies
SELECT * FROM pg_policies WHERE tablename = 'users';

-- Test service role access
-- (Run in SQL editor with service role)
SELECT * FROM users LIMIT 1;
```

## 📊 Database Schema Overview

```
users
├── id (UUID, Primary Key)
├── strava_id (BIGINT, Unique)
├── firstname, lastname
├── city, state, country
├── profile_picture
└── timestamps

strava_tokens
├── id (UUID, Primary Key)
├── strava_id (BIGINT, Foreign Key)
├── access_token, refresh_token
├── expires_at
└── timestamps

activities
├── id (UUID, Primary Key)
├── strava_id (BIGINT, Foreign Key)
├── activity_id (BIGINT, Unique)
├── name, distance, moving_time
├── type, start_date
├── performance metrics
├── polyline (route data)
└── timestamps
```

This setup provides a solid foundation for storing and managing Strava data securely! 🎯 