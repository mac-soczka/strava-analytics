# 🔧 Fix Redirect URI Issue

## Immediate Solution

The double slash issue is caused by the `VERCEL_URL` environment variable. Here's how to fix it:

### 1. Set Environment Variable in Vercel

1. Go to your Vercel dashboard
2. Navigate to your project: `strava-heatmap-alpha`
3. Go to **Settings** → **Environment Variables**
4. Add a new environment variable:

```
Name: STRAVA_REDIRECT_URI
Value: https://strava-heatmap-alpha.vercel.app/api/auth/callback
Environment: Production
```

### 2. Redeploy

After adding the environment variable, redeploy your application.

### 3. Test

Visit: `https://strava-heatmap-alpha.vercel.app/api/debug`

This will show you the current configuration and confirm the fix.

### 4. Verify Strava Settings

1. Go to [Strava API Settings](https://www.strava.com/settings/api)
2. Set **Authorization Callback Domain** to: `strava-heatmap-alpha.vercel.app`
3. The redirect URI should be: `https://strava-heatmap-alpha.vercel.app/api/auth/callback`

## Alternative: Quick Test

If you want to test immediately without setting the environment variable, the code now includes a special case for your domain that should prevent the double slash issue.

## Debug Endpoint

Visit `https://strava-heatmap-alpha.vercel.app/api/debug` to see:
- Current environment variables
- Final redirect URI being used
- Whether double slashes are detected
- Configuration details 