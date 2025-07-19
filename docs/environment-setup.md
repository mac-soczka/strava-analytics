# Environment Setup Guide

This document provides comprehensive instructions for setting up environment variables for different deployment environments.

## 🌍 Environment Configuration

The application automatically detects the environment and configures the appropriate redirect URLs:

- **Vercel Deployments**: `https://{VERCEL_URL}/api/auth/callback` (automatic)
- **Custom Domain**: `{NEXT_PUBLIC_APP_URL}/api/auth/callback` (if set)
- **Local Development**: `http://localhost:3000/api/auth/callback` (fallback)

## 🔧 Required Environment Variables

### Supabase Configuration
```bash
# Required for database operations
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

### Strava Configuration
```bash
# Required for Strava API integration
STRAVA_CLIENT_ID=your_strava_client_id
STRAVA_CLIENT_SECRET=your_strava_client_secret

# Optional: Override default redirect URI (recommended for production)
STRAVA_REDIRECT_URI=https://strava-heatmap-alpha.vercel.app/api/auth/callback

# Optional: Custom app URL (if not using Vercel's automatic detection)
NEXT_PUBLIC_APP_URL=https://your-custom-domain.com
```

## 🚀 Deployment Environments

### 1. Local Development

Create a `.env.local` file in your project root:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Strava
STRAVA_CLIENT_ID=your_client_id
STRAVA_CLIENT_SECRET=your_client_secret
# STRAVA_REDIRECT_URI is optional - defaults to http://localhost:3000/api/auth/callback
```

### 2. Vercel Production

Configure these environment variables in your Vercel project settings:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Strava
STRAVA_CLIENT_ID=your_client_id
STRAVA_CLIENT_SECRET=your_client_secret
# STRAVA_REDIRECT_URI is optional - defaults to production URL
```

### 3. Vercel Preview Deployments

Preview deployments automatically use the `VERCEL_URL` environment variable:

```bash
# All the same variables as production
# The redirect URI will automatically be: https://{VERCEL_URL}/api/auth/callback
```

## 🔗 Strava App Configuration

### 1. Strava API Application Setup

1. Go to [Strava API Settings](https://www.strava.com/settings/api)
2. Create a new application or edit existing one
3. Configure the following settings:

#### For Local Development:
- **Authorization Callback Domain**: `localhost:3000`
- **Redirect URI**: `http://localhost:3000/api/auth/callback`

#### For Production:
- **Authorization Callback Domain**: `your-production-domain.com` (or Vercel domain)
- **Redirect URI**: `https://your-production-domain.com/api/auth/callback` (or Vercel URL)

#### For Preview Deployments:
- **Authorization Callback Domain**: `*.vercel.app`
- **Redirect URI**: `https://{preview-url}.vercel.app/api/auth/callback`

### 2. Required Scopes

Ensure your Strava application has these scopes enabled:
- `read` - Read user profile and activities
- `activity:read` - Read detailed activity data

## 🔄 Flexible Domain Configuration

The application uses a flexible approach to determine the redirect URI, prioritizing environment variables over hardcoded values:

### Priority Order:
1. **`STRAVA_REDIRECT_URI`** - Explicit override (highest priority) ⭐ **Recommended for production**
2. **`VERCEL_URL`** - Automatic Vercel detection
3. **`NEXT_PUBLIC_APP_URL`** - Custom domain configuration
4. **Localhost** - Development fallback

### Automatic Redirect URI Detection

The application automatically detects the environment and sets the appropriate redirect URI:

```typescript
// lib/config.ts
function getDefaultRedirectUri(): string {
  // Use VERCEL_URL if available (works for both production and preview deployments)
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}/api/auth/callback`
  }
  
  // Use custom domain if specified
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback`
  }
  
  // Fallback to localhost for development
  return 'http://localhost:3000/api/auth/callback'
}
```

## 🛠️ Manual Override

If you need to override the automatic redirect URI detection, set the `STRAVA_REDIRECT_URI` environment variable:

```bash
# Example: Custom redirect URI
STRAVA_REDIRECT_URI=https://your-custom-domain.com/api/auth/callback
```

## 🔍 Validation

The application validates required environment variables on startup:

```typescript
// lib/config.ts
export function validateConfig() {
  const required = [
    'STRAVA_CLIENT_ID',
    'STRAVA_CLIENT_SECRET',
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
  ]

  const missing = required.filter(key => !process.env[key])
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
  }
}
```

## 🚨 Troubleshooting

### Common Issues

1. **"Invalid redirect_uri" Error**
   - Ensure the redirect URI in your Strava app settings matches exactly
   - Check that the domain is correctly configured
   - Verify the protocol (http vs https)

2. **"Missing environment variables" Error**
   - Check that all required variables are set in your deployment environment
   - Verify variable names are correct (case-sensitive)
   - Ensure no extra spaces or quotes

3. **"OAuth Error" in Production**
   - Verify the production domain is added to Strava app settings
   - Check that the redirect URI uses HTTPS in production
   - Ensure the callback route is accessible

### Debugging Steps

1. **Check Environment Variables**
   ```bash
   # Local development
   echo $STRAVA_CLIENT_ID
   echo $STRAVA_REDIRECT_URI
   
   # Vercel (check in dashboard)
   # Go to Project Settings > Environment Variables
   ```

2. **Test OAuth Flow**
   ```bash
   # Test local development
   curl "http://localhost:3000/api/auth/login"
   
   # Test production (replace with your actual domain)
   curl "https://your-production-domain.com/api/auth/login"
   ```

3. **Check Application Logs**
   - Vercel Function Logs
   - Browser Developer Tools
   - Network tab for redirect URLs

## 📋 Checklist

### Before Deployment
- [ ] All environment variables configured in Vercel
- [ ] Strava app settings updated for production domain
- [ ] Redirect URI matches exactly in Strava settings
- [ ] HTTPS enabled for production URLs
- [ ] Required scopes enabled in Strava app

### After Deployment
- [ ] OAuth flow works in production
- [ ] Redirect URI is correctly set
- [ ] No environment variable errors in logs
- [ ] Application can authenticate with Strava
- [ ] Token refresh works correctly

This configuration ensures seamless OAuth authentication across all deployment environments while maintaining security and reliability.

## 🔧 Quick Fix for "Bad Request - invalid redirect_uri"

If you're getting the "Bad Request - invalid redirect_uri" error with double slashes (`//`), here's the immediate fix:

### 1. Set Explicit Redirect URI in Vercel

Add this environment variable in your Vercel project settings:

```bash
STRAVA_REDIRECT_URI=https://strava-heatmap-alpha.vercel.app/api/auth/callback
```

### 2. Verify Strava App Settings

1. Go to [Strava API Settings](https://www.strava.com/settings/api)
2. Set **Authorization Callback Domain** to: `strava-heatmap-alpha.vercel.app`
3. Ensure the redirect URI matches exactly: `https://strava-heatmap-alpha.vercel.app/api/auth/callback`

### 3. Test the Fix

After setting the environment variable and redeploying:

```bash
# Test the login endpoint
curl "https://strava-heatmap-alpha.vercel.app/api/auth/login"
```

This should redirect to Strava with the correct redirect URI without double slashes. 