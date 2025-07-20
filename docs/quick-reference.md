# 🚀 Quick Reference - Supabase Commands

## 🏠 **LOCAL** Development

| Command | Description | When to Use |
|---------|-------------|-------------|
| `npm run dev:full` | Start everything (local Supabase + Next.js) | **Daily development** |
| `npm run db:sync:local` | Reset local DB + open Studio | **Clean slate needed** |
| `npm run supabase:studio` | Open local database UI | **Inspect local data** |
| `npm run supabase:start` | Start local Supabase services | **Start development** |
| `npm run supabase:stop` | Stop local Supabase services | **Port conflicts** |
| `npm run supabase:status` | Check local Supabase status | **Troubleshooting** |

## 🔄 **LOCAL** Database Changes

| Command | Description | When to Use |
|---------|-------------|-------------|
| `npm run supabase:migration:new name` | Create new migration | **Adding tables/columns** |
| `npm run supabase:reset` | Apply migrations to local DB | **After editing migration** |
| `npm run supabase:diff` | See what will change | **Before pushing to prod** |

## 🌐 **PRODUCTION** Commands

| Command | Description | When to Use |
|---------|-------------|-------------|
| `npm run db:prod:push` | Deploy local changes to production | **Ready to deploy** |
| `npm run db:prod:pull` | Get latest from production | **Start of day** |
| `npm run db:sync:prod` | Full sync (pull + push) | **Resolve conflicts** |

## 🎯 Most Used Commands

```bash
# 🏠 LOCAL development
npm run dev:full                    # Start everything (local)
npm run supabase:studio            # Open local database UI
npm run supabase:reset             # Apply migrations locally

# 🌐 PRODUCTION deployment
npm run db:prod:push               # Deploy changes to production
npm run db:prod:pull               # Get latest from production

# 🔧 Troubleshooting (local)
npm run db:sync:local              # Reset everything (local)
npm run supabase:stop              # Stop local services
npm run supabase:start             # Restart local services
```

## 📋 Workflow Examples

### 🏠 **LOCAL** Feature Development
```bash
npm run dev:full                   # Start local development
npm run supabase:migration:new add_feature
# Edit migration file
npm run supabase:reset            # Apply to local DB
# Test your changes locally
```

### 🌐 **PRODUCTION** Deployment
```bash
npm run db:prod:push              # Deploy local changes to production
```

### 🔄 **COMBINED** Start of Day
```bash
npm run db:prod:pull              # Get latest from production
npm run dev:full                  # Start local development
```

### 🔧 **LOCAL** Troubleshooting
```bash
npm run supabase:stop             # Stop local services
npm run supabase:start            # Restart local services
npm run db:sync:local             # Reset local DB if needed
```

## 🔧 Prerequisites

- Docker Desktop running
- Supabase CLI installed: `npm install -g supabase`
- Environment variables set in `.env.local`

## 📚 Full Documentation

See [Supabase Commands Reference](./supabase-commands.md) for complete details. 