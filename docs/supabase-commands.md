# Supabase Commands Reference

This document explains all the Supabase commands available in `package.json` for day-to-day development.

## 🚀 Quick Start Commands

### `npm run dev:full`
**Start everything for development:**
- Starts local Supabase
- Starts Next.js dev server
- Opens both services

```bash
npm run dev:full
```

### `npm run db:sync:local`
**Reset and sync local database:**
- Starts local Supabase
- Resets database to clean state
- Opens Supabase Studio

```bash
npm run db:sync:local
```

## 📊 Database Management

### 🏠 **LOCAL DEVELOPMENT** Commands

> **These commands work with your local Supabase instance (Docker)**

#### `npm run supabase:start` 🟢
**Start local Supabase services (Docker required):**
```bash
npm run supabase:start
```

#### `npm run supabase:stop` 🔴
**Stop local Supabase services:**
```bash
npm run supabase:stop
```

#### `npm run supabase:status` ℹ️
**Check status of local Supabase services:**
```bash
npm run supabase:status
```

#### `npm run supabase:reset` 🔄
**Reset local database to clean state (applies all migrations):**
```bash
npm run supabase:reset
```

#### `npm run supabase:studio` 🖥️
**Open Supabase Studio in browser (local):**
```bash
npm run supabase:studio
```

### 🌐 **PRODUCTION** Commands

> **These commands interact with your production Supabase instance**

#### `npm run supabase:push` ⬆️
**Push local schema changes to production:**
```bash
npm run supabase:push
```

#### `npm run supabase:pull` ⬇️
**Pull production schema to local:**
```bash
npm run supabase:pull
```

#### `npm run supabase:diff` 🔍
**Show differences between local and production:**
```bash
npm run supabase:diff
```

## 🔄 Migration Management

#### `npm run supabase:migration:new`
Create a new migration file:
```bash
npm run supabase:migration:new migration_name
```

#### `npm run supabase:migration:list`
List all migrations:
```bash
npm run supabase:migration:list
```

## 🎯 Convenience Commands

### 🏠 **LOCAL** Convenience Commands

#### `npm run db:local:reset` 🔄
**Start Supabase and reset database (local):**
```bash
npm run db:local:reset
```

#### `npm run db:local:studio` 🖥️
**Start Supabase and open Studio (local):**
```bash
npm run db:local:studio
```

### 🌐 **PRODUCTION** Convenience Commands

#### `npm run db:prod:push` ⬆️
**Push changes to production:**
```bash
npm run db:prod:push
```

#### `npm run db:prod:pull` ⬇️
**Pull changes from production:**
```bash
npm run db:prod:pull
```

#### `npm run db:sync:prod` 🔄
**Pull from production, then push back (sync):**
```bash
npm run db:sync:prod
```

## 🔧 Edge Functions (Future Use)

#### `npm run supabase:functions:serve`
Serve Edge Functions locally:
```bash
npm run supabase:functions:serve
```

#### `npm run supabase:functions:deploy`
Deploy Edge Functions to production:
```bash
npm run supabase:functions:deploy
```

## 📋 Daily Workflow Examples

### 🏠 **LOCAL** Development Workflows

#### Starting Local Development
```bash
# Start everything (local)
npm run dev:full

# Or step by step
npm run supabase:start    # Start local Supabase
npm run dev               # Start Next.js
```

#### Making Local Database Changes
```bash
# 1. Create new migration
npm run supabase:migration:new add_new_table

# 2. Edit the migration file in supabase/migrations/

# 3. Apply to local database
npm run supabase:reset

# 4. Test your changes locally
```

#### Resetting Local Development
```bash
# Clean slate (local only)
npm run db:sync:local
```

### 🌐 **PRODUCTION** Workflows

#### Deploying Changes to Production
```bash
# After testing locally, push to production
npm run db:prod:push
```

#### Syncing with Production
```bash
# Pull latest changes from production
npm run db:prod:pull

# Or full sync (pull then push)
npm run db:sync:prod
```

### 🔄 **COMBINED** Workflows

#### Complete Feature Development
```bash
# 1. Start local development
npm run dev:full

# 2. Create and test migration locally
npm run supabase:migration:new add_feature
# Edit migration file
npm run supabase:reset

# 3. Test your changes locally

# 4. Deploy to production
npm run db:prod:push
```

#### Start of Day (Get Latest Changes)
```bash
# 1. Pull latest from production
npm run db:prod:pull

# 2. Start local development
npm run dev:full
```

## 🛠️ Troubleshooting

### Common Issues

#### "Supabase CLI not found"
```bash
npm install -g supabase
```

#### "Docker not running"
Start Docker Desktop before running Supabase commands.

#### "Port already in use"
```bash
# Stop Supabase
npm run supabase:stop

# Or kill processes on ports 54322, 54323, 54324
```

#### "Migration conflicts"
```bash
# Reset local database
npm run supabase:reset

# Or pull from production
npm run db:prod:pull
```

### Checking Status
```bash
# Check Supabase status
npm run supabase:status

# Check migration status
npm run supabase:migration:list
```

## 🔐 Environment Setup

Make sure you have these environment variables set:

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## 📚 Related Documentation

- [Migration Guide](./migration-guide.md) - How to apply migrations
- [Testing Without Triggers](./testing-without-triggers.md) - Database testing approach
- [Design Patterns](./design-patterns.md) - Architecture patterns

## 🎯 Pro Tips

1. **Use `dev:full`** for daily development
2. **Use `db:sync:local`** when you need a clean database
3. **Use `db:prod:push`** to deploy schema changes
4. **Use `supabase:diff`** before pushing to see what will change
5. **Use `supabase:studio`** to inspect data and test queries

These commands make Supabase development much more efficient! 