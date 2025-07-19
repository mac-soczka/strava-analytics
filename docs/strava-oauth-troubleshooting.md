# 🔧 Strava OAuth Troubleshooting Guide

## ✅ Issue Resolved

The double slash issue has been fixed by updating the environment variable in Vercel. The configuration now works correctly with clean URLs.

## 🔍 Root Cause Analysis

The error can be caused by two main issues:

### 1. Double Slash in URL (Current Issue)
The redirect URI contains `//` instead of `/`, which Strava rejects.

### 2. Redirect URI Not Registered in Strava
The redirect URI isn't configured in your Strava app settings.

## 🛠️ Solutions

### Solution 1: Fix Environment Variable (Immediate)

1. **Go to Vercel Dashboard**
   - Navigate to your project settings
   - Go to **Settings** → **Environment Variables**

2. **Update STRAVA_REDIRECT_URI**
   - Find `STRAVA_REDIRECT_URI`
   - Remove any double slashes from the value
   - Ensure it matches your actual domain

3. **Redeploy**
   - Save the environment variable
   - Redeploy your application

### Solution 2: Verify Strava App Settings

1. **Go to Strava API Settings**
   - Visit: https://www.strava.com/settings/api

2. **Configure Authorization Callback Domain**
   - Set to your production domain (e.g., `your-domain.vercel.app`)

3. **Verify Redirect URI**
   - The redirect URI should be: `https://your-domain.vercel.app/api/auth/callback`
   - Make sure there are NO double slashes

### Solution 3: Test the Fix

After making changes:

1. **Check Debug Endpoint**
   ```
   https://your-domain.vercel.app/api/debug
   ```
   Should show: `"hasDoubleSlash":false`

2. **Test Login Flow**
   ```
   https://your-domain.vercel.app/api/auth/login
   ```

## 🔄 Configuration

The configuration now uses clean environment variables without any URL manipulation:

```typescript
// Use explicit redirect URI if set (highest priority)
if (process.env.STRAVA_REDIRECT_URI) {
  return process.env.STRAVA_REDIRECT_URI
}
```

The environment variable should be set correctly in Vercel without any double slashes.

## 📋 Checklist

- [ ] Environment variable `STRAVA_REDIRECT_URI` is set correctly (no double slashes)
- [ ] Strava app Authorization Callback Domain is set to `strava-heatmap-alpha.vercel.app`
- [ ] Application has been redeployed after environment variable changes
- [ ] Debug endpoint shows `"hasDoubleSlash":false`
- [ ] Login flow redirects to Strava without errors

## 🚨 Common Mistakes

1. **Double Slash in Environment Variable**: `//api/auth/callback` instead of `/api/auth/callback`
2. **Wrong Domain in Strava**: Using `localhost` instead of production domain
3. **Missing Protocol**: Using `strava-heatmap-alpha.vercel.app` instead of `https://strava-heatmap-alpha.vercel.app`
4. **Trailing Slash**: Adding `/` at the end of the redirect URI

## 🔗 Useful Links

- [Strava API Settings](https://www.strava.com/settings/api)
- [Vercel Environment Variables](https://vercel.com/docs/projects/environment-variables)
- [Debug Endpoint](https://your-domain.vercel.app/api/debug) 