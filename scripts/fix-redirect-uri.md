# 🔧 Fix Redirect URI Issue

## Immediate Solution

The double slash issue is caused by the `VERCEL_URL` environment variable. Here's how to fix it:

### 1. Set Environment Variable in Vercel

1. Go to your Vercel dashboard
2. Navigate to your project settings
3. Go to **Settings** → **Environment Variables**
4. Add a new environment variable:

```
Name: STRAVA_REDIRECT_URI
Value: https://your-domain.vercel.app/api/auth/callback
Environment: Production
```

### 2. Redeploy

After adding the environment variable, redeploy your application.

### 3. Test

Visit: `https://your-domain.vercel.app/api/debug`

This will show you the current configuration and confirm the fix.

### 4. Verify Strava Settings

1. Go to [Strava API Settings](https://www.strava.com/settings/api)
2. Set **Authorization Callback Domain** to: `your-domain.vercel.app`
3. The redirect URI should be: `https://your-domain.vercel.app/api/auth/callback`

## Alternative: Automatic Detection

The application now automatically detects the correct URL using environment variables without any hardcoded domains.

## Debug Endpoint

Visit `https://your-domain.vercel.app/api/debug` to see:
- Current environment variables
- Final redirect URI being used
- Whether double slashes are detected
- Configuration details 