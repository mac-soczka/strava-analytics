# 🚀 Local Development Guide - 100% Offline Setup

**Last Updated:** 2026-04-22

Run the entire Strava Heatmap stack locally without any external services. Everything runs on your machine via Docker.

**⚠️ Note:** If you already have Supabase projects or local PostgreSQL databases running, see the **Port Conflict Resolution** section below to avoid conflicts.

---

## ✅ Action Plan Checklist

Follow this checklist to get up and running:

- [ ] **Choose setup path** (see table below)
- [ ] **Check prerequisites** (Docker, Node.js, Yarn)
- [ ] **Install Supabase CLI** (`npm install -g supabase`)
- [ ] **Start local Supabase** (`supabase start`)
- [ ] **Update .env.local** with credentials
- [ ] **Apply migrations** (`supabase db reset`)
- [ ] **Seed test data** (optional)
- [ ] **Start Next.js** (`yarn dev`)
- [ ] **Verify app** (http://localhost:3000)
- [ ] **Run quality gates** (`yarn lint && yarn tsc --noEmit && yarn test`)

---

## 🎯 Quick Start - Choose Your Path

**Already have infrastructure running?** Pick the best option for you:

| Your Situation | Recommended Option | Jump To |
|----------------|-------------------|---------|
| Have cloud Supabase project | Use existing cloud project | [Option A](#option-a-use-existing-cloud-supabase-simplest) |
| Have local PostgreSQL (port 5432) | Use existing PostgreSQL | [Option B](#option-b-use-existing-local-postgresql-advanced) |
| Have other Supabase projects running | Run on different ports | [Option C](#option-c-run-supabase-on-different-ports-recommended) |
| Fresh setup, nothing running | Follow standard setup | [Step 1](#step-1-install-docker-if-needed) |

---

## 📋 Prerequisites

### Required Software

- [ ] **Docker** - Container runtime for local Supabase
- [ ] **Node.js 20+** - JavaScript runtime
- [ ] **Yarn** - Package manager
- [ ] **Supabase CLI** - Local development tools

### Check What You Have

```bash
# Check Docker
docker --version
docker ps

# Check Node.js & Yarn
node --version
yarn --version

# Check Supabase CLI (install in next step if missing)
supabase --version
```

---

## 🛠️ Installation Steps

### Step 1: Install Docker (if needed)

**Linux:**
```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Start Docker daemon
sudo systemctl start docker

# Enable Docker on boot (optional)
sudo systemctl enable docker

# Verify installation
docker ps
```

**Alternative:** Follow official guide at https://docs.docker.com/engine/install/

---

### Step 2: Install Supabase CLI

```bash
# Install globally via npm
npm install -g supabase

# Verify installation
supabase --version
```

**Expected output:** `1.x.x` or higher

---

### Step 3: Start Local Supabase

**⚠️ If you have existing Supabase/PostgreSQL instances:**

You have **3 options**:

#### Option A: Use Existing Cloud Supabase (Simplest)

Skip local Supabase entirely and use your existing cloud project:

1. Get credentials from https://supabase.com/dashboard → Your Project → Settings → API
2. Update `.env.local` with cloud credentials
3. Skip to Step 5 (database migrations)
4. Run migrations against cloud: `supabase db push` (requires linking project)

**Pros:** No port conflicts, no Docker overhead  
**Cons:** Requires internet, shares data with cloud

---

#### Option B: Use Existing Local PostgreSQL (Advanced)

Use your existing PostgreSQL instance instead of Supabase's:

```bash
# Check your existing PostgreSQL port
psql -l  # Usually port 5432

# Create new database for this project
psql -U postgres
CREATE DATABASE strava_heatmap;
\q
```

Then manually apply migrations:
```bash
# Apply each migration file
for file in supabase/migrations/*.sql; do
  psql -U postgres -d strava_heatmap -f "$file"
done
```

Update `.env.local`:
```bash
NEXT_PUBLIC_SUPABASE_URL=http://localhost:3000/api  # Use Next.js API routes
DATABASE_URL=postgresql://postgres:password@localhost:5432/strava_heatmap
```

**Pros:** Use existing infrastructure  
**Cons:** Requires manual setup, no Supabase features (Auth, Storage, Realtime)

---

#### Option C: Run Supabase on Different Ports (Recommended)

Run this project's Supabase alongside your existing instances:

**Step 1: Check for port conflicts**
```bash
# Check if default Supabase ports are in use
lsof -i :54321  # Supabase API
lsof -i :54322  # PostgreSQL
lsof -i :54323  # Studio
lsof -i :54324  # Inbucket
```

**Step 2: Configure custom ports (if needed)**

Edit `supabase/config.toml`:
```toml
[api]
port = 54421  # Changed from 54321

[db]
port = 54422  # Changed from 54322

[studio]
port = 54423  # Changed from 54323

[inbucket]
port = 54424  # Changed from 54324
```

**Step 3: Start Supabase**
```bash
# Navigate to project root
cd /home/mac/workdir/strava-heatmap

# Start local Supabase stack
supabase start
```

**First run:** Downloads Docker images (~2-5 minutes, ~2-3 GB)  
**Subsequent runs:** Starts in ~10-30 seconds

**Expected output:**
```
Started supabase local development setup.

         API URL: http://127.0.0.1:54321  # Or your custom port
     GraphQL URL: http://127.0.0.1:54321/graphql/v1
          DB URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
      Studio URL: http://127.0.0.1:54323
    Inbucket URL: http://127.0.0.1:54324
      JWT secret: super-secret-jwt-token-with-at-least-32-characters-long
        anon key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
service_role key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**⚠️ IMPORTANT:** Copy the `anon key` and `service_role key` - you'll need them next!

---

### Step 4: Configure Environment Variables

Edit `.env.local` in the project root:

```bash
# Open in your editor
nano .env.local
# or
code .env.local
```

**Update these lines with values from `supabase start` output:**

```bash
# Local Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<paste_anon_key_from_supabase_start>
SUPABASE_SERVICE_ROLE_KEY=<paste_service_role_key_from_supabase_start>

# Strava Configuration (keep existing values)
STRAVA_CLIENT_ID=52510
STRAVA_CLIENT_SECRET=4a25afdf6a53d5cc330d3fff3595b768bf8a8b33

# Optional: Disable rate limiting for local development
STRAVA_NO_LIMITS=true

# Local app URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Save and close the file.**

---

### Step 5: Apply Database Migrations

```bash
# Reset database and apply all migrations
supabase db reset
```

**What this does:**
- Creates all database tables
- Applies 29+ migrations from `supabase/migrations/`
- Sets up indexes, constraints, and functions
- Creates views for analytics

**Expected output:**
```
Resetting local database...
Applying migration 20250720000000_recreate_schema.sql...
Applying migration 20250720160000_add_fake_table.sql...
...
Finished supabase db reset.
```

---

### Step 6: Verify Database Setup

```bash
# Check Supabase status
supabase status

# Open Supabase Studio in browser
supabase studio
```

**Or manually visit:** http://127.0.0.1:54323

**In Supabase Studio, verify these tables exist:**
- [ ] `users`
- [ ] `strava_tokens`
- [ ] `activities`
- [ ] `segments`
- [ ] `segment_efforts`
- [ ] `crawler_logs`
- [ ] `app_sessions`

---

### Step 7: Seed Test Data (Optional but Recommended)

**Option A: Via Supabase Studio**

1. Open http://127.0.0.1:54323
2. Go to **SQL Editor**
3. Paste and run:

```sql
-- Insert test user
INSERT INTO users (id, strava_id, firstname, lastname, profile_picture)
VALUES (
  gen_random_uuid(),
  12345678,
  'Test',
  'User',
  'https://via.placeholder.com/150'
);

-- Insert test tokens
INSERT INTO strava_tokens (strava_id, access_token, refresh_token, expires_at)
VALUES (
  12345678,
  'test_access_token_local_dev',
  'test_refresh_token_local_dev',
  NOW() + INTERVAL '6 hours'
);

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
);
```

**Option B: Via Command Line**

```bash
# Connect to local PostgreSQL
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres

# Paste the SQL above
# Exit with \q
```

---

### Step 8: Start Next.js Development Server

```bash
# In project root
yarn dev
```

**Expected output:**
```
yarn run v1.22.22
$ next dev
   ▲ Next.js 15.4.2
   - Local:        http://localhost:3000
   - Network:      http://192.168.0.189:3000

 ✓ Starting...
 ✓ Ready in 1390ms
```

**App is now running at:** http://localhost:3000

---

### Step 9: Verify Everything Works

**Checklist:**

- [ ] Visit http://localhost:3000 - Dashboard loads
- [ ] Visit http://127.0.0.1:54323 - Supabase Studio opens
- [ ] Check browser console - No errors
- [ ] Check Supabase Studio → Table Editor → `activities` - See test data
- [ ] Navigate to Activities page - See test activities
- [ ] Check Network tab - API calls go to `127.0.0.1:54321`

---

## 🔄 Daily Development Workflow

### Starting Your Day

```bash
# Terminal 1: Start Supabase (if not already running)
supabase start

# Terminal 2: Start Next.js
yarn dev
```

**Or use the convenience script:**
```bash
# Starts both Supabase + Next.js
yarn dev:full
```

### During Development

```bash
# Check Supabase status
supabase status

# View Supabase logs
supabase logs

# Open Studio UI
supabase studio

# Reset database (if needed)
supabase db reset
```

### Ending Your Day

```bash
# Stop Next.js
Ctrl+C in terminal

# Stop Supabase (optional - can leave running)
supabase stop
```

**Note:** Supabase can stay running between sessions. Data persists in Docker volumes.

---

## 🧪 Working Without Strava OAuth

Since Strava OAuth requires a production domain, here are your options for local development:

### Option 1: Use Test Data (Recommended)

Use the test data seeded in Step 7. Develop UI and features without real Strava API calls.

**Pros:**
- ✅ No external dependencies
- ✅ Fast development
- ✅ Predictable data

**Cons:**
- ❌ Not testing real Strava integration

---

### Option 2: Mock Strava API

Create mock API endpoints for development:

```typescript
// app/api/strava/mock/activities/route.ts
export async function GET() {
  return Response.json({
    activities: [
      {
        id: 123456,
        name: "Mock Morning Ride",
        distance: 25000,
        moving_time: 3600,
        type: "Ride"
      }
    ]
  })
}
```

---

### Option 3: Use Production Tokens Locally

1. Authenticate via production: https://strava-heatmap-alpha.vercel.app
2. Get tokens from production Supabase
3. Insert into local database:

```sql
INSERT INTO strava_tokens (strava_id, access_token, refresh_token, expires_at)
VALUES (
  <your_strava_id>,
  '<production_access_token>',
  '<production_refresh_token>',
  '<expiry_timestamp>'
);
```

**Pros:**
- ✅ Real Strava data
- ✅ Test actual API integration

**Cons:**
- ❌ Requires production setup first
- ❌ Tokens expire

---

## 📦 Available Yarn Scripts

```bash
# Development
yarn dev                          # Start Next.js only
yarn dev:full                     # Start Supabase + Next.js

# Supabase - Local
yarn supabase:local:start         # Start local Supabase
yarn supabase:local:stop          # Stop local Supabase
yarn supabase:local:status        # Check status
yarn supabase:local:studio        # Open Studio UI
yarn supabase:local:reset         # Reset database

# Supabase - Migrations
yarn supabase:migration:new       # Create new migration
yarn supabase:migration:list      # List all migrations

# Testing
yarn test                         # Run unit tests
yarn test:e2e                     # Run E2E tests

# Linting
yarn lint                         # Run ESLint

# Build
yarn build                        # Build for production
yarn start                        # Start production server
```

---

## 🚨 Troubleshooting

### Docker Not Running

**Symptom:** `Cannot connect to the Docker daemon`

**Solution:**
```bash
# Start Docker daemon
sudo systemctl start docker

# Check Docker is running
docker ps
```

---

### Port Conflicts

**Symptom:** `Port 54321 is already in use` or similar errors

**Cause:** You have existing Supabase projects or PostgreSQL instances running

**Solutions:**

**Option 1: Stop other Supabase instances**
```bash
# List all running Supabase projects
cd /path/to/other/project
supabase status

# Stop them temporarily
supabase stop

# Then start this project's Supabase
cd /home/mac/workdir/strava-heatmap
supabase start
```

**Option 2: Use custom ports (recommended)**

Edit `supabase/config.toml` and change ports:
```toml
[api]
port = 54421  # Instead of 54321

[db]
port = 54422  # Instead of 54322

[studio]
port = 54423  # Instead of 54323
```

Then update `.env.local` with the new API URL:
```bash
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421
```

**Option 3: Use existing cloud Supabase**

Skip local Supabase and use your cloud project (see Step 3, Option A)

**Option 4: Kill conflicting processes**
```bash
# Check what's using the port
lsof -i :54321

# Kill the process (use with caution)
kill -9 $(lsof -t -i:54321)
```

**Common ports used:**
- `54321` - Supabase API
- `54322` - PostgreSQL (Supabase)
- `54323` - Supabase Studio
- `5432` - Standard PostgreSQL
- `3000` - Next.js

---

### Migration Errors

**Symptom:** `Migration failed` or `Table already exists`

**Solution:**
```bash
# Complete database reset
supabase db reset

# If that fails, stop and restart
supabase stop
supabase start
supabase db reset
```

---

### Environment Variables Not Loading

**Symptom:** `Missing required environment variables`

**Solution:**
```bash
# Verify .env.local exists
ls -la .env.local

# Check file contents
cat .env.local

# Restart Next.js after changes
# Ctrl+C then yarn dev
```

---

### Supabase Studio Not Opening

**Symptom:** `Cannot access http://127.0.0.1:54323`

**Solution:**
```bash
# Check Supabase is running
supabase status

# Check Studio container
docker ps | grep studio

# Restart Supabase
supabase stop
supabase start
```

---

### Database Connection Errors

**Symptom:** `Failed to connect to database`

**Solution:**
```bash
# Check PostgreSQL is running
docker ps | grep postgres

# Test connection directly
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres

# If fails, reset Supabase
supabase stop
supabase start
```

---

### Next.js Build Errors

**Symptom:** `Module not found` or `Type errors`

**Solution:**
```bash
# Clean install dependencies
rm -rf node_modules yarn.lock
yarn install

# Clear Next.js cache
rm -rf .next

# Rebuild
yarn dev
```

---

## 🎯 What Runs Locally

**Services running in Docker:**
- ✅ PostgreSQL 17 database
- ✅ PostgREST API server
- ✅ Supabase Studio (web UI)
- ✅ Supabase Auth server
- ✅ Supabase Storage server
- ✅ Supabase Realtime server
- ✅ Inbucket (email testing)

**Services running on host:**
- ✅ Next.js development server (Node.js)

**What's NOT needed:**
- ❌ Cloud Supabase account
- ❌ External database
- ❌ Production deployment
- ❌ Internet connection (after initial setup)

---

## 📊 Database Schema Overview

Your local database includes:

```
users
├── id (UUID, Primary Key)
├── strava_id (BIGINT, Unique)
├── firstname, lastname
├── city, state, country
├── profile_picture
└── created_at, updated_at

strava_tokens
├── id (UUID, Primary Key)
├── strava_id (BIGINT, Foreign Key → users)
├── access_token, refresh_token
├── expires_at
└── created_at, updated_at

activities
├── id (UUID, Primary Key)
├── strava_id (BIGINT, Foreign Key → users)
├── activity_id (BIGINT, Unique)
├── name, distance, moving_time, elapsed_time
├── type, start_date
├── average_speed, max_speed
├── total_elevation_gain
├── polyline (route data)
├── segments_fetched (boolean)
└── created_at, updated_at

segments
├── id (UUID, Primary Key)
├── segment_id (BIGINT, Unique)
├── name, distance, average_grade
├── maximum_grade, elevation_high, elevation_low
├── climb_category
└── created_at, updated_at

segment_efforts
├── id (UUID, Primary Key)
├── activity_id (BIGINT, Foreign Key → activities)
├── segment_id (BIGINT, Foreign Key → segments)
├── strava_id (BIGINT)
├── elapsed_time, moving_time
├── start_date, start_index, end_index
└── created_at, updated_at

crawler_logs
├── id (UUID, Primary Key)
├── status (pending, running, completed, failed)
├── activities_processed, segments_processed
├── error_message
└── created_at, updated_at

app_sessions
├── id (UUID, Primary Key)
├── strava_id (BIGINT)
├── session_data (JSONB)
└── created_at, expires_at
```

---

## 🔍 Useful Commands

### Database Queries

```bash
# Connect to local database
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres

# List all tables
\dt

# Describe table structure
\d activities

# Count records
SELECT COUNT(*) FROM activities;

# View recent activities
SELECT name, type, distance, start_date 
FROM activities 
ORDER BY start_date DESC 
LIMIT 10;

# Exit
\q
```

### Docker Commands

```bash
# View all Supabase containers
docker ps | grep supabase

# View container logs
docker logs <container_id>

# Stop all Supabase containers
docker stop $(docker ps -q --filter name=supabase)

# Remove all Supabase containers (nuclear option)
docker rm $(docker ps -aq --filter name=supabase)
```

### Supabase CLI Commands

```bash
# Full status report
supabase status

# View logs (all services)
supabase logs

# View logs (specific service)
supabase logs db
supabase logs api
supabase logs studio

# Generate TypeScript types from database
supabase gen types typescript --local > types/supabase.ts

# Create new migration
supabase migration new add_new_feature

# List migrations
supabase migration list --local

# Diff database changes
supabase db diff
```

---

## ⚡ Quick Reference

### Start Everything
```bash
supabase start && yarn dev
```

### Stop Everything
```bash
# Ctrl+C to stop Next.js
supabase stop
```

### Reset Everything
```bash
supabase stop
supabase start
supabase db reset
yarn dev
```

### Check Everything
```bash
supabase status
docker ps
curl http://127.0.0.1:54321/rest/v1/
curl http://localhost:3000
```

---

## 📈 Next Steps

After getting the local environment running:

1. **Explore the codebase:**
   - `app/` - Next.js pages and components
   - `lib/` - Core libraries and services
   - `supabase/migrations/` - Database schema

2. **Read the documentation:**
   - `docs/architecture.md` - System design
   - `docs/testing-strategy.md` - Testing guidelines
   - `docs/services.md` - Service layer patterns

3. **Start developing:**
   - Create new features
   - Write tests
   - Experiment with UI

4. **When ready to deploy:**
   - See `docs/deployment-fixes.md`
   - Set up production Supabase
   - Deploy to Vercel

---

## 📞 Getting Help

**If you encounter issues:**

1. Check this troubleshooting section
2. Review Supabase logs: `supabase logs`
3. Check Docker containers: `docker ps`
4. Verify environment variables: `cat .env.local`
5. Reset everything: `supabase stop && supabase start && supabase db reset`

**Useful resources:**
- [Supabase Local Development Docs](https://supabase.com/docs/guides/local-development)
- [Next.js Documentation](https://nextjs.org/docs)
- [Docker Documentation](https://docs.docker.com/)

---

## ✅ Success Checklist

You're ready to develop when:

- [ ] Docker is running
- [ ] Supabase CLI is installed
- [ ] `supabase start` completes successfully
- [ ] `.env.local` has local Supabase credentials
- [ ] `supabase db reset` creates all tables
- [ ] Supabase Studio opens at http://127.0.0.1:54323
- [ ] Test data is seeded in database
- [ ] `yarn dev` starts Next.js successfully
- [ ] App loads at http://localhost:3000
- [ ] No errors in browser console

**Estimated setup time:** 15-30 minutes  
**Disk space required:** ~2-3 GB (Docker images)

---

**Happy coding! 🚴‍♂️💨**
