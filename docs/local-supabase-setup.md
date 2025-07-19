# 🗄️ Local Supabase Setup Guide

## 📋 Prerequisites

1. **Supabase CLI**: Install the Supabase CLI
2. **Docker**: Required for local Supabase development
3. **Node.js**: Your development environment

## 🚀 Step-by-Step Setup

### 1. Install Supabase CLI

```bash
# Using npm
npm install -g supabase

# Using yarn
yarn global add supabase

# Or using Homebrew (macOS)
brew install supabase/tap/supabase
```

### 2. Initialize Supabase in Your Project

```bash
# Navigate to your project root
cd strava-heatmap

# Initialize Supabase
supabase init
```

This will create:
- `supabase/config.toml` - Configuration file
- `supabase/seed.sql` - Seed data (optional)
- `.env.local` - Local environment variables

### 3. Start Local Supabase

```bash
# Start the local Supabase instance
supabase start
```

This will:
- Start PostgreSQL database
- Start Supabase API
- Start Supabase Studio (web interface)
- Generate local credentials

### 4. Set Up Environment Variables

After running `supabase start`, you'll see output like this:

```
API URL: http://127.0.0.1:54321
DB URL: postgresql://postgres:postgres@127.0.0.1:54322/5432
Studio URL: http://127.0.0.1:54323
Inbucket URL: http://127.0.0.1:54324
JWT secret: super-secret-jwt-token-with-at-least-32-characters-long
anon key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
service_role key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Create or update your `.env.local` file:

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_local_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_local_service_role_key

# Strava configuration
STRAVA_CLIENT_ID=your_strava_client_id
STRAVA_CLIENT_SECRET=your_strava_client_secret
STRAVA_REDIRECT_URI=http://localhost:3000/api/auth/callback
```

### 5. Run Database Migration

```bash
# Apply the schema to your local database
supabase db reset
```

This will:
- Drop all tables (if any exist)
- Run the schema from `supabase/schema.sql`
- Create all tables, indexes, and policies

### 6. Verify the Setup

```bash
# Check database status
supabase status

# Open Supabase Studio
supabase studio
```

Visit `http://127.0.0.1:54323` to see the Supabase Studio interface.

## 🧪 Testing the Setup

### 1. Test Database Connection

Create a test script to verify the connection:

```bash
# Create test script
cat > test-db.js << 'EOF'
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function testConnection() {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('count')
      .limit(1)
    
    if (error) {
      console.error('❌ Database connection failed:', error)
    } else {
      console.log('✅ Database connection successful!')
      console.log('Tables created successfully.')
    }
  } catch (err) {
    console.error('❌ Error:', err)
  }
}

testConnection()
EOF

# Run the test
node test-db.js
```

### 2. Test OAuth Flow Locally

Since you've configured Strava for production, you'll need to:

1. **Use production for OAuth**: Visit `https://strava-heatmap-alpha.vercel.app/api/auth/login`
2. **Data will be stored locally**: The callback will save data to your local Supabase
3. **Check local database**: Use Supabase Studio to see the data

### 3. Check Tables in Supabase Studio

1. Open `http://127.0.0.1:54323`
2. Go to **Table Editor**
3. You should see:
   - `users` table
   - `strava_tokens` table
   - `activities` table

## 🔄 Development Workflow

### Daily Development

```bash
# Start your development environment
npm run dev

# In another terminal, start Supabase (if not already running)
supabase start

# Your app will connect to local Supabase
```

### Database Changes

```bash
# After modifying schema.sql
supabase db reset

# Or apply specific migrations
supabase migration up
```

### Stop Local Supabase

```bash
# Stop the local instance
supabase stop

# Start again when needed
supabase start
```

## 🚨 Troubleshooting

### Common Issues

1. **Port Conflicts**
   ```bash
   # Check if ports are in use
   lsof -i :54321
   lsof -i :54322
   lsof -i :54323
   ```

2. **Docker Issues**
   ```bash
   # Restart Docker
   docker system prune -a
   supabase start
   ```

3. **Database Connection Errors**
   ```bash
   # Reset everything
   supabase stop
   supabase start
   supabase db reset
   ```

### Useful Commands

```bash
# View logs
supabase logs

# Check status
supabase status

# Reset database
supabase db reset

# Generate types (if using TypeScript)
supabase gen types typescript --local > types/supabase.ts
```

## 📊 Database Schema Overview

Your local database will have:

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

## 🎯 Next Steps

After setup:

1. **Test OAuth flow** with production Strava
2. **Verify data storage** in local Supabase
3. **Build features** using local database
4. **Deploy** when ready for production

Your local development environment is now ready! 🚀 