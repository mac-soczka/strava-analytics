# Database Migration Guide

This guide will help you apply the initial database schema migration to both your local development environment and production Supabase instance.

## 📋 What's in the Migration

The migration creates the following database structure:

### Tables
- **`users`** - Store Strava user profiles
- **`strava_tokens`** - Secure storage for OAuth tokens
- **`activities`** - Store Strava activities with detailed metrics

### Features
- **Row Level Security (RLS)** - Data protection policies
- **Indexes** - Performance optimization
- **Application-managed timestamps** - `updated_at` handled in code for easier testing
- **Foreign Keys** - Data integrity constraints
- **UUID Primary Keys** - Scalable ID system

## 🚀 Step 1: Local Development Setup

### Option A: Using Supabase CLI (Recommended)

1. **Install Supabase CLI** (if not already installed):
   ```bash
   npm install -g supabase
   ```

2. **Start local Supabase**:
   ```bash
   supabase start
   ```

3. **Apply the migration**:
   ```bash
   supabase db reset
   ```

### Option B: Manual Application

1. **Start local Supabase**:
   ```bash
   supabase start
   ```

2. **Open Supabase Studio**:
   - Go to: http://localhost:54323
   - Navigate to SQL Editor

3. **Copy and paste the migration SQL**:
   ```bash
   cat supabase/migrations/20241201000000_initial_schema.sql
   ```

4. **Execute the SQL** in the Supabase Studio SQL Editor

## 🚀 Step 2: Production Setup

### Option A: Using Supabase CLI

1. **Link your production project**:
   ```bash
   supabase link --project-ref YOUR_PROJECT_REF
   ```

2. **Apply migration to production**:
   ```bash
   supabase db push
   ```

### Option B: Manual Application (Recommended for first-time setup)

1. **Go to your Supabase Dashboard**:
   - Visit: https://supabase.com/dashboard
   - Select your project

2. **Navigate to SQL Editor**:
   - Click on "SQL Editor" in the left sidebar

3. **Copy the migration SQL**:
   ```bash
   cat supabase/migrations/20241201000000_initial_schema.sql
   ```

4. **Paste and execute** the SQL in the Supabase Dashboard SQL Editor

## 🔧 Step 3: Verify the Migration

### Check Tables Created
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('users', 'strava_tokens', 'activities');
```

### Check RLS Policies
```sql
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE schemaname = 'public';
```

### Check Indexes
```sql
SELECT indexname, tablename 
FROM pg_indexes 
WHERE schemaname = 'public' 
AND indexname LIKE 'idx_%';
```

## 🛠️ Troubleshooting

### Common Issues

#### 1. "Extension uuid-ossp does not exist"
**Solution**: This extension is usually available by default. If not, contact Supabase support.

#### 2. "Permission denied" errors
**Solution**: Make sure you're using the service role key for migrations, not the anon key.

#### 3. "Table already exists" errors
**Solution**: The migration uses `CREATE TABLE IF NOT EXISTS`, so this shouldn't happen. If it does, the table structure might be different.

#### 4. RLS Policy conflicts
**Solution**: Drop existing policies first:
```sql
DROP POLICY IF EXISTS "Users can view their own data" ON users;
DROP POLICY IF EXISTS "Users can update their own data" ON users;
-- ... repeat for other policies
```

### Environment Variables

Make sure your `.env.local` file has the correct Supabase credentials:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Strava Configuration
STRAVA_CLIENT_ID=your-strava-client-id
STRAVA_CLIENT_SECRET=your-strava-client-secret
```

## 📊 Migration Scripts

### Using the Node.js Script
```bash
# Apply to both local and production
node scripts/apply-migration.js

# Apply to local only
node scripts/apply-migration.js local

# Apply to production only
node scripts/apply-migration.js production
```

### Using the PowerShell Script (Windows)
```powershell
# Apply to both local and production
.\scripts\apply-migration.ps1

# Apply to local only
.\scripts\apply-migration.ps1 local

# Apply to production only
.\scripts\apply-migration.ps1 production
```

## 🔄 After Migration

Once the migration is applied:

1. **Test the OAuth flow** - Try logging in with Strava
2. **Check the navbar** - Should show user profile information
3. **Verify data storage** - User data and tokens should be saved
4. **Test activities page** - Should load data from Supabase

## 📝 Next Steps

After successful migration:

1. **Update your components** to use Supabase queries instead of local files
2. **Set up automated data fetching** with Supabase Edge Functions
3. **Configure additional RLS policies** for your specific use case
4. **Set up monitoring** for your database performance

## 🆘 Need Help?

If you encounter issues:

1. **Check the Supabase logs** in the dashboard
2. **Verify your environment variables** are correctly set
3. **Test with a simple query** to ensure connectivity
4. **Check the migration file** for syntax errors

The migration is designed to be idempotent, so you can run it multiple times safely. 