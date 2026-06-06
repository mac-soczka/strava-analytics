# Environment Setup Guide

**Last Updated:** 2026-06-06

This guide covers all environment variables needed for the StravaHeatmap application.

## Required Environment Variables

### Supabase Configuration
```bash
# Supabase URL (from your Supabase project settings)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co

# Supabase Anon Key (from your Supabase project settings)
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# Supabase Service Role Key (from your Supabase project settings)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

### Strava OAuth Configuration
```bash
# Strava Client ID (from your Strava API application)
STRAVA_CLIENT_ID=your-client-id-here

# Strava Client Secret (from your Strava API application)
STRAVA_CLIENT_SECRET=your-client-secret-here

# Optional: Custom redirect URI (defaults to localhost:3001 for development)
STRAVA_REDIRECT_URI=http://localhost:3001/api/auth/callback
```

## Optional Environment Variables

### Strava No-Limits Mode
```bash
# Disable internal rate limiting (let Strava handle limits naturally)
STRAVA_NO_LIMITS=true
```

**What is No-Limits Mode?**
- Disables the application's internal rate limiting system
- Lets Strava handle rate limits naturally (you'll get 429 errors when limits are hit)
- Useful for testing and development
- May hit Strava rate limits faster since no delays are applied

**To enable/disable:**
```bash
# Enable no-limits mode
yarn strava:no-limits:enable

# Disable no-limits mode
yarn strava:no-limits:disable

# Check current status
yarn strava:no-limits:status
```

**⚠️ Important:** Restart your development server after changing this setting.

### Deployment Configuration
```bash
# Custom app URL (for production deployments)
NEXT_PUBLIC_APP_URL=https://your-domain.com

# Vercel URL (automatically set by Vercel)
VERCEL_URL=your-vercel-url.vercel.app
```

## Environment File Setup

1. **Create `.env.local` file** in the project root:
```bash
cp .env.example .env.local
```

2. **Add your environment variables** to `.env.local`:
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Strava
STRAVA_CLIENT_ID=your-client-id-here
STRAVA_CLIENT_SECRET=your-client-secret-here

# Optional: No-limits mode for development
STRAVA_NO_LIMITS=true
```

3. **Restart your development server**:
```bash
yarn dev
```

## Environment Variable Validation

The application validates required environment variables on startup. If any are missing, you'll see an error message listing the missing variables.

## Security Notes

- **Never commit `.env.local`** to version control
- **Service Role Key** has full database access - keep it secure
- **Client Secret** should be kept private
- **No-Limits Mode** should only be used in development/testing

## Troubleshooting

### Missing Environment Variables
If you see "Missing required environment variables" errors:
1. Check that `.env.local` exists in the project root
2. Verify all required variables are set
3. Restart the development server

### Rate Limiting Issues
If you're hitting rate limits frequently:
1. Check if no-limits mode is enabled: `yarn strava:no-limits:status`
2. Disable it if needed: `yarn strava:no-limits:disable`
3. Restart the development server

### OAuth Redirect Issues
If OAuth isn't working:
1. Verify `STRAVA_REDIRECT_URI` matches your Strava app settings
2. For development, use `http://localhost:3001/api/auth/callback`
3. For production, use your actual domain 
