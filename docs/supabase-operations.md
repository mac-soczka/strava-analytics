# 🗄️ Supabase Operations Guide

**Last Updated:** 2026-04-22

Complete guide for working with Supabase in the Strava Heatmap project, covering migrations, database operations, and deployment workflows.

---

## 📋 Table of Contents

1. [Quick Reference](#quick-reference)
2. [Local Development](#local-development)
3. [Migrations](#migrations)
4. [Production Operations](#production-operations)
5. [Database Seeding](#database-seeding)
6. [Troubleshooting](#troubleshooting)
7. [Available Scripts](#available-scripts)

---

## 🚀 Quick Reference

### Most Common Commands

```bash
# Start local Supabase
yarn supabase:local:start

# Create new migration
yarn supabase:migration:new <migration_name>

# Apply migrations locally
yarn supabase:local:reset

# Push migrations to production
yarn supabase:prod:push

# Open Supabase Studio
yarn supabase:local:studio
```

---

## 💻 Local Development

### 1. Start Local Supabase

**First time setup:**
```bash
# Start Supabase (downloads Docker images on first run)
yarn supabase:local:start

# Or use the full setup script
yarn db:local:setup
```

**What it does:**
- Starts PostgreSQL database on port `54422`
- Starts Supabase API on port `54421`
- Starts Supabase Studio on port `54423`
- Starts Inbucket (email testing) on port `54424`
- Applies all migrations automatically

**Expected output:**
```
Started supabase local development setup.

         API URL: http://127.0.0.1:54421
          DB URL: postgresql://postgres:postgres@127.0.0.1:54422/postgres
      Studio URL: http://127.0.0.1:54423
    Inbucket URL: http://127.0.0.1:54424
        anon key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
service_role key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 2. Check Status

```bash
# Check if Supabase is running
yarn supabase:local:status

# Output shows all services and their status
```

### 3. Open Supabase Studio

```bash
# Open Studio in browser
yarn supabase:local:studio

# Or visit directly
open http://127.0.0.1:54423
```

**Studio features:**
- Table Editor - View and edit data
- SQL Editor - Run custom queries
- Database - View schema and relationships
- API - Test API endpoints

### 4. Stop Local Supabase

```bash
# Stop all Supabase services
yarn supabase:local:stop

# Docker containers are stopped but data persists
```

---

## 🔄 Migrations

### Creating Migrations

#### Method 1: Create Empty Migration (Recommended)

```bash
# Create new migration file
yarn supabase:migration:new add_clubs_table

# Creates: supabase/migrations/YYYYMMDDHHMMSS_add_clubs_table.sql
```

Then edit the file:
```sql
-- Migration: Add clubs table
-- Created: 2026-04-22

CREATE TABLE clubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id BIGINT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  sport_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes
CREATE INDEX idx_clubs_club_id ON clubs(club_id);

-- Add RLS policies
ALTER TABLE clubs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clubs can be viewed by all users"
  ON clubs FOR SELECT
  USING (true);
```

#### Method 2: Generate from Schema Diff

```bash
# Make changes in Supabase Studio or via SQL
# Then generate migration from changes
yarn supabase:local:diff -f add_my_changes

# Creates migration with detected changes
```

### Migration Best Practices

**✅ DO:**
- Use descriptive migration names: `add_clubs_table`, `add_user_email_index`
- Include comments explaining the purpose
- Use `IF NOT EXISTS` for idempotent operations
- Add `CASCADE` when dropping tables with dependencies
- Test migrations locally before production

**❌ DON'T:**
- Modify existing migration files (create new ones instead)
- Use `DROP TABLE` without `IF EXISTS`
- Forget to add indexes for foreign keys
- Skip RLS policies on new tables

### Applying Migrations Locally

#### Reset Database (Recommended)

```bash
# Drop and recreate database, apply all migrations
yarn supabase:local:reset

# This is the safest way to ensure clean state
```

**What it does:**
1. Drops all tables and data
2. Recreates schema from scratch
3. Applies all migrations in order
4. Seeds data (if seed file exists)

#### Apply Specific Migration

```bash
# Migrations are applied automatically on reset
# To apply manually, use psql:
psql postgresql://postgres:postgres@127.0.0.1:54422/postgres \
  -f supabase/migrations/YYYYMMDDHHMMSS_migration_name.sql
```

### Listing Migrations

```bash
# List local migrations
yarn supabase:migration:list:local

# List production migrations
yarn supabase:migration:list:prod

# Compare local vs production
yarn supabase:migration:list
```

---

## 🚀 Production Operations

### Prerequisites

Before pushing to production:

1. **Link to production project:**
   ```bash
   npx supabase link --project-ref <your-project-ref>
   
   # Find project ref at: https://supabase.com/dashboard
   # Format: abcdefghijklmnop
   ```

2. **Verify connection:**
   ```bash
   yarn supabase:local:status
   ```

### Push Migrations to Production

#### Standard Push (Recommended)

```bash
# Push all pending migrations
yarn supabase:prod:push

# Supabase will:
# 1. Show which migrations will be applied
# 2. Ask for confirmation
# 3. Apply migrations in order
# 4. Report success/failure
```

**Example output:**
```
Applying migration 20260422082513_remove_fake_tables_cleanup.sql...
✓ Applied migration 20260422082513_remove_fake_tables_cleanup.sql
```

#### Push All (Including Schema Changes)

```bash
# Push migrations + schema changes
yarn supabase:prod:push:all

# Use when you've made direct schema changes
```

#### Dry Run (Check Before Applying)

```bash
# See what would be applied without actually applying
npx supabase db push --dry-run
```

### Pull from Production

```bash
# Pull production schema to local
yarn supabase:prod:pull

# Creates migration file with production changes
# Useful when production was modified directly
```

### Production Deployment Workflow

**Recommended workflow:**

```bash
# 1. Test locally
yarn supabase:local:reset
yarn dev
# Test your changes...

# 2. Commit migrations
git add supabase/migrations/
git commit -m "Add clubs table migration"
git push

# 3. Push to production
yarn supabase:prod:push

# 4. Verify in production
# Visit: https://supabase.com/dashboard → SQL Editor
# Run: SELECT * FROM clubs LIMIT 1;

# 5. Deploy Next.js app
vercel deploy --prod
```

---

## 🌱 Database Seeding

### Create Seed File

```bash
# Create seed file
touch supabase/seed.sql
```

**Example seed file:**
```sql
-- supabase/seed.sql
-- Seed data for local development

-- Insert test user
INSERT INTO users (id, strava_id, firstname, lastname, profile_picture)
VALUES (
  gen_random_uuid(),
  12345678,
  'Test',
  'User',
  'https://via.placeholder.com/150'
) ON CONFLICT (strava_id) DO NOTHING;

-- Insert test tokens
INSERT INTO strava_tokens (strava_id, access_token, refresh_token, expires_at)
VALUES (
  12345678,
  'test_access_token_local_dev',
  'test_refresh_token_local_dev',
  NOW() + INTERVAL '6 hours'
) ON CONFLICT (strava_id) DO NOTHING;

-- Insert sample activities
INSERT INTO activities (
  strava_id,
  activity_id,
  name,
  distance,
  moving_time,
  elapsed_time,
  type,
  start_date,
  average_speed,
  max_speed
) VALUES 
(
  12345678,
  9876543210,
  'Morning Ride',
  25000,
  3600,
  3800,
  'Ride',
  NOW() - INTERVAL '1 day',
  6.94,
  12.5
),
(
  12345678,
  9876543211,
  'Evening Run',
  8000,
  2400,
  2500,
  'Run',
  NOW() - INTERVAL '2 days',
  3.33,
  5.2
) ON CONFLICT (activity_id) DO NOTHING;
```

### Apply Seed Data

```bash
# Seeds are applied automatically on reset
yarn supabase:local:reset

# Or apply manually
psql postgresql://postgres:postgres@127.0.0.1:54422/postgres \
  -f supabase/seed.sql
```

### Manual Seeding via psql

```bash
# Connect to database
psql postgresql://postgres:postgres@127.0.0.1:54422/postgres

# Run SQL commands
INSERT INTO users (strava_id, firstname, lastname) 
VALUES (12345, 'John', 'Doe');

# Exit
\q
```

### Manual Seeding via Studio

1. Open Studio: `yarn supabase:local:studio`
2. Go to **Table Editor**
3. Select table
4. Click **Insert row**
5. Fill in data
6. Click **Save**

---

## 🔍 Database Operations

### Viewing Schema

#### Via psql

```bash
# Connect to database
psql postgresql://postgres:postgres@127.0.0.1:54422/postgres

# List all tables
\dt

# Describe table structure
\d activities
\d segments
\d users

# List all indexes
\di

# List all functions
\df

# Exit
\q
```

#### Via Supabase Studio

1. Open Studio: http://127.0.0.1:54423
2. Navigate to **Database** → **Tables**
3. View schema, relationships, and data

### Exporting Schema

```bash
# Export complete schema
pg_dump -h 127.0.0.1 -p 54422 -U postgres -d postgres \
  --schema-only --no-owner --no-privileges \
  > docs/schema-reference.sql

# Export specific table
pg_dump -h 127.0.0.1 -p 54422 -U postgres -d postgres \
  --table=activities --schema-only \
  > activities-schema.sql
```

### Backup & Restore

#### Backup Local Database

```bash
# Full backup (schema + data)
pg_dump -h 127.0.0.1 -p 54422 -U postgres -d postgres \
  > backup-$(date +%Y%m%d).sql

# Schema only
pg_dump -h 127.0.0.1 -p 54422 -U postgres -d postgres \
  --schema-only > schema-backup.sql

# Data only
pg_dump -h 127.0.0.1 -p 54422 -U postgres -d postgres \
  --data-only > data-backup.sql
```

#### Restore from Backup

```bash
# Restore full backup
psql postgresql://postgres:postgres@127.0.0.1:54422/postgres \
  < backup-20260422.sql

# Or use Supabase reset and manual restore
yarn supabase:local:reset
psql postgresql://postgres:postgres@127.0.0.1:54422/postgres \
  < data-backup.sql
```

---

## 🛠️ Troubleshooting

### Port Conflicts

**Problem:** `Port 54421 is already in use`

**Solution:**
```bash
# Check what's using the port
lsof -i :54421

# Stop other Supabase instances
cd /path/to/other/project
npx supabase stop

# Or change ports in supabase/config.toml
[api]
port = 54521  # Different port

[db]
port = 54522
```

### Migration Errors

**Problem:** Migration fails with error

**Solution:**
```bash
# 1. Check migration syntax
cat supabase/migrations/YYYYMMDDHHMMSS_migration.sql

# 2. Test migration manually
psql postgresql://postgres:postgres@127.0.0.1:54422/postgres \
  -f supabase/migrations/YYYYMMDDHHMMSS_migration.sql

# 3. If error, fix migration file and reset
yarn supabase:local:reset

# 4. If migration is bad, rename to .bak
mv supabase/migrations/bad_migration.sql \
   supabase/migrations/bad_migration.sql.bak
```

### Database Connection Issues

**Problem:** Can't connect to database

**Solution:**
```bash
# 1. Check if Supabase is running
yarn supabase:local:status

# 2. If not running, start it
yarn supabase:local:start

# 3. Check Docker
docker ps | grep supabase

# 4. Restart Docker if needed
# (Docker Desktop → Restart)

# 5. Reset Supabase
yarn supabase:local:stop
yarn supabase:local:start
```

### Schema Out of Sync

**Problem:** Local schema doesn't match migrations

**Solution:**
```bash
# Nuclear option: complete reset
yarn supabase:local:stop
yarn supabase:local:start
yarn supabase:local:reset

# This ensures clean state
```

### Production Push Fails

**Problem:** `supabase db push` fails

**Solution:**
```bash
# 1. Check if project is linked
npx supabase projects list

# 2. Re-link if needed
npx supabase link --project-ref <your-ref>

# 3. Check for conflicts
yarn supabase:prod:diff

# 4. Pull production changes first
yarn supabase:prod:pull

# 5. Resolve conflicts and push
yarn supabase:prod:push
```

---

## 📜 Available Scripts

### Local Development

| Script | Command | Description |
|--------|---------|-------------|
| `yarn supabase:local:start` | `npx supabase start` | Start local Supabase |
| `yarn supabase:local:stop` | `npx supabase stop` | Stop local Supabase |
| `yarn supabase:local:status` | `npx supabase status` | Check status |
| `yarn supabase:local:studio` | `npx supabase studio` | Open Studio |
| `yarn supabase:local:reset` | `npx supabase db reset` | Reset database |
| `yarn supabase:local:pull` | `npx supabase db pull` | Pull remote schema |
| `yarn supabase:local:diff` | `npx supabase db diff` | Show schema diff |

### Migrations

| Script | Command | Description |
|--------|---------|-------------|
| `yarn supabase:migration:new` | `npx supabase migration new` | Create new migration |
| `yarn supabase:migration:list` | `npx supabase migration list` | List all migrations |
| `yarn supabase:migration:list:local` | `npx supabase migration list --local` | List local migrations |
| `yarn supabase:migration:list:prod` | `npx supabase migration list` | List production migrations |

### Production

| Script | Command | Description |
|--------|---------|-------------|
| `yarn supabase:prod:push` | `npx supabase db push` | Push migrations to prod |
| `yarn supabase:prod:push:all` | `npx supabase db push --include-all` | Push all changes |
| `yarn supabase:prod:pull` | `npx supabase db pull` | Pull prod schema |
| `yarn supabase:prod:diff` | `npx supabase db diff` | Compare local vs prod |

### Convenience Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `yarn dev:full` | Start Supabase + Next.js | Full dev environment |
| `yarn db:local:setup` | Start + Reset + Studio | Complete local setup |
| `yarn db:local:studio` | Start + Studio | Quick Studio access |
| `yarn db:prod:apply` | Push all to production | Deploy migrations |
| `yarn db:prod:sync` | Pull + Push | Sync with production |

---

## 🔗 Useful Links

- **Supabase CLI Docs**: https://supabase.com/docs/guides/cli
- **Migrations Guide**: https://supabase.com/docs/guides/cli/local-development#database-migrations
- **Local Development**: https://supabase.com/docs/guides/cli/local-development
- **Supabase Dashboard**: https://supabase.com/dashboard
- **PostgreSQL Docs**: https://www.postgresql.org/docs/

---

## 📝 Quick Cheat Sheet

```bash
# Daily workflow
yarn supabase:local:start              # Start Supabase
yarn dev                                # Start Next.js
# ... develop ...
yarn supabase:local:stop               # Stop when done

# Create feature with migration
yarn supabase:migration:new add_feature
# Edit migration file
yarn supabase:local:reset              # Test locally
git add supabase/migrations/
git commit -m "Add feature migration"

# Deploy to production
git push
yarn supabase:prod:push                # Push migrations
vercel deploy --prod                   # Deploy app

# Troubleshooting
yarn supabase:local:status             # Check status
yarn supabase:local:reset              # Reset if issues
yarn supabase:local:studio             # View in Studio
```

---

**Last Updated:** 2026-04-22  
**Project:** Strava Heatmap  
**Database:** PostgreSQL 17 via Supabase
