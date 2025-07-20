# Package.json Supabase Scripts Documentation

This document explains all the Supabase-related scripts in `package.json` with clear distinction between local and production environments.

## 🏠 Local Development Commands

### **Local Supabase Management**
```bash
# Start local Supabase instance
npm run supabase:local:start

# Stop local Supabase instance  
npm run supabase:local:stop

# Check local Supabase status
npm run supabase:local:status

# Open local Supabase Studio (web interface)
npm run supabase:local:studio

# Reset local database (applies all migrations)
npm run supabase:local:reset

# Pull schema from remote to local
npm run supabase:local:pull

# Show differences between local and remote
npm run supabase:local:diff
```

### **Local Convenience Commands**
```bash
# Complete local setup: start + reset + studio
npm run db:local:setup

# Start local and open studio
npm run db:local:studio

# Start local Supabase + Next.js dev server
npm run dev:full
```

## 🌐 Production Commands

### **Production Database Management**
```bash
# Push migrations to production (interactive)
npm run supabase:prod:push

# Push ALL migrations to production (including pending)
npm run supabase:prod:push:all

# Pull schema from production to local
npm run supabase:prod:pull

# Show differences between local and production
npm run supabase:prod:diff
```

### **Production Convenience Commands**
```bash
# Apply all pending migrations to production
npm run db:prod:apply

# Sync: pull from prod, then push all to prod
npm run db:prod:sync
```

## 📋 Migration Commands

### **Migration Management**
```bash
# Create new migration file
npm run supabase:migration:new <migration_name>

# List all migrations (local and remote)
npm run supabase:migration:list

# List local migrations only
npm run supabase:migration:list:local

# List production migrations only
npm run supabase:migration:list:prod
```

## 🚀 Common Workflows

### **Daily Development**
```bash
# 1. Start local development
npm run dev:full

# 2. Create new migration when needed
npm run supabase:migration:new add_new_feature

# 3. Apply to local for testing
npm run supabase:local:reset
```

### **Deploying to Production**
```bash
# 1. Apply all migrations to production
npm run db:prod:apply

# 2. Verify migration status
npm run supabase:migration:list:prod
```

### **Syncing Environments**
```bash
# Pull latest from production and apply all migrations
npm run db:prod:sync
```

## ⚠️ Important Notes

- **Local commands** work with your local Docker-based Supabase instance
- **Production commands** work with your remote Supabase project
- **Always test migrations locally** before applying to production
- **Use `--include-all` flag** when you have pending migrations
- **Migration files** are in `supabase/migrations/` directory

## 🔧 Troubleshooting

### **Local Issues**
```bash
# If local Supabase won't start
npm run supabase:local:stop
npm run supabase:local:start

# If local database is corrupted
npm run supabase:local:reset
```

### **Production Issues**
```bash
# If migrations fail to apply
npm run supabase:prod:diff
npm run supabase:prod:push:all
```

### **Migration Issues**
```bash
# Check migration status
npm run supabase:migration:list

# Compare local vs production
npm run supabase:local:diff
``` 