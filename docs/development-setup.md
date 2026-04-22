# 🛠️ Development Setup Guide

## ⚠️ Important: Localhost Authentication Limitation

Since your Strava app is configured for the production domain (`strava-heatmap-alpha.vercel.app`), **you cannot use localhost for OAuth authentication**.

### Why This Happens

Strava only allows one Authorization Callback Domain per application. When you set it to your production domain, localhost authentication stops working.

### Development Workflow

#### Option 1: Use Production for Authentication (Recommended)

1. **Local Development**: Run `npm run dev` for local development
2. **Authentication**: Use the production URL for OAuth
   - Login: `https://strava-heatmap-alpha.vercel.app/api/auth/login`
   - After auth, you'll be redirected to production dashboard
   - Copy the URL and continue development locally

#### Option 2: Create Separate Strava App for Development

1. **Create New Strava App**: https://www.strava.com/settings/api
2. **Set Callback Domain**: `localhost:3001`
3. **Use Different Environment Variables**:
   ```bash
   # .env.local
   STRAVA_CLIENT_ID=your_dev_client_id
   STRAVA_CLIENT_SECRET=your_dev_client_secret
   STRAVA_REDIRECT_URI=http://localhost:3001/api/auth/callback
   ```

### Current Configuration

The application is configured to use the production redirect URI even in development:

```typescript
// lib/config.ts
function getDefaultRedirectUri(): string {
  // ... other logic ...
  
  // Note: localhost won't work if Strava app is configured for production domain
  console.warn('⚠️ Warning: Using production redirect URI for local development');
  return "https://strava-heatmap-alpha.vercel.app/api/auth/callback";
}
```

### Testing OAuth Flow

1. **Production Testing**: Use the production URL for full OAuth testing
2. **Local Development**: Focus on non-OAuth features locally
3. **Token Testing**: Use the tokens from production auth for local API testing

### Environment Variables for Local Development

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Strava tokens (get these from production auth)
STRAVA_ACCESS_TOKEN=your_access_token
STRAVA_REFRESH_TOKEN=your_refresh_token
```

### Workflow Summary

1. **Develop locally** for most features
2. **Test OAuth** on production
3. **Use production tokens** for local API testing
4. **Deploy** to test full integration

This approach ensures you can develop locally while maintaining OAuth functionality. 