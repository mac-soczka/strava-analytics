# Package.json Scripts Reference

This document explains all the scripts in `package.json` and clearly distinguishes between local development and production commands.

## 📋 Script Categories

### 🚀 **Next.js Commands** (Standard)
```json
"dev": "next dev --turbopack"      // Local development server
"build": "next build"              // Production build
"start": "next start"              // Production server
"lint": "next lint"                // Code linting
```

### 🏠 **LOCAL DEVELOPMENT** Commands

> **These commands work with your local Supabase instance (Docker) - SAFE to run anytime**

#### **Core Local Commands:**
```json
"dev:full": "npm run supabase:start && npm run dev"  // Start everything (local)
"supabase:start": "supabase start"                   // Start local Supabase
"supabase:stop": "supabase stop"                     // Stop local Supabase
"supabase:status": "supabase status"                 // Check local status
"supabase:studio": "supabase studio"                 // Open local database UI
"supabase:reset": "supabase db reset"                // Reset local database
```

#### **Local Migration Commands:**
```json
"supabase:migration:new": "supabase migration new"   // Create new migration
"supabase:migration:list": "supabase migration list" // List migrations
"supabase:diff": "supabase db diff"                  // See local changes
```

#### **Local Convenience Commands:**
```json
"db:local:reset": "npm run supabase:start && npm run supabase:reset"     // Start + reset
"db:local:studio": "npm run supabase:start && npm run supabase:studio"   // Start + studio
"db:sync:local": "npm run supabase:start && npm run supabase:reset && npm run supabase:studio"  // Full local reset
```

### 🌐 **PRODUCTION** Commands

> **These commands interact with your production Supabase instance - USE WITH CAUTION**

#### **Production Database Commands:**
```json
"supabase:push": "supabase db push"                  // Push local → production
"supabase:pull": "supabase db pull"                  // Pull production → local
```

#### **Production Convenience Commands:**
```json
"db:prod:push": "npm run supabase:push"              // Deploy to production
"db:prod:pull": "npm run supabase:pull"              // Get from production
"db:sync:prod": "npm run supabase:pull && npm run supabase:push"  // Full sync
```

### 🔧 **Edge Functions** (Future Use)
```json
"supabase:functions:serve": "supabase functions serve"     // Local functions
"supabase:functions:deploy": "supabase functions deploy"   // Deploy functions
```

## 🎯 **Quick Reference by Environment**

### **🏠 LOCAL (Safe for daily development):**
- `npm run dev:full` - Start everything
- `npm run supabase:studio` - Open database UI
- `npm run supabase:reset` - Reset local database
- `npm run db:sync:local` - Complete local reset

### **🌐 PRODUCTION (Use with caution):**
- `npm run db:prod:push` - Deploy changes
- `npm run db:prod:pull` - Get latest changes
- `npm run db:sync:prod` - Full sync

## 📊 **Command Organization in package.json**

The scripts are organized in this logical order:

1. **Next.js Commands** - Standard development commands
2. **Development Starter** - `dev:full` for easy startup
3. **Local Supabase Commands** - Core local operations
4. **Local Convenience Commands** - Multi-step local operations
5. **Production Commands** - Production operations (clearly separated)

## 🚨 **Safety Guidelines**

### **✅ SAFE Commands (Local Only):**
- All commands starting with `supabase:` (except `push`/`pull`)
- All commands with `:local:` in the name
- `dev:full` - Only affects local environment

### **⚠️ PRODUCTION Commands (Use Carefully):**
- `supabase:push` / `db:prod:push` - Deploys to production
- `supabase:pull` / `db:prod:pull` - Gets from production
- `db:sync:prod` - Syncs with production

## 📋 **Daily Workflow Examples**

### **Start of Day:**
```bash
npm run db:prod:pull    # Get latest from production (PRODUCTION)
npm run dev:full        # Start local development (LOCAL)
```

### **Making Changes:**
```bash
npm run supabase:migration:new feature  # Create migration (LOCAL)
# Edit migration file
npm run supabase:reset                  # Apply locally (LOCAL)
# Test changes
npm run db:prod:push                    # Deploy when ready (PRODUCTION)
```

### **Troubleshooting:**
```bash
npm run supabase:stop                   # Stop local services (LOCAL)
npm run supabase:start                  # Restart local services (LOCAL)
npm run db:sync:local                   # Reset local database (LOCAL)
```

## 🔧 **Prerequisites**

Before using these commands, ensure you have:
- Docker Desktop running
- Supabase CLI installed: `npm install -g supabase`
- Environment variables set in `.env.local`
- Supabase project linked: `supabase link --project-ref YOUR_REF`

This organization makes it crystal clear which commands are safe for daily development and which ones affect your production environment! 