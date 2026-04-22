# Syncing Your Strava Activities

**Last Updated:** 2026-04-22

This guide explains how to sync your Strava activities, routes, and stats to the Strava Heatmap application.

## Overview

The sync feature allows you to fetch all your Strava data including:
- Activities (runs, rides, swims, etc.)
- Activity laps and splits
- Activity streams (GPS, heart rate, power, etc.)
- Routes
- Athlete statistics

## How to Sync

### 1. Navigate to Dashboard

After signing in with your Strava account, go to the Dashboard page.

### 2. Click "Sync My Activities"

You'll see a sync section at the top of the dashboard with an orange "Sync My Activities" button.

### 3. Monitor Progress

Once you click the button:
- The sync starts immediately in the background
- A progress bar appears showing real-time updates
- You can see how many activities, laps, and streams have been processed
- The sync continues even if you navigate away from the page

### 4. Wait for Completion

- Small accounts (< 100 activities): 1-2 minutes
- Medium accounts (100-500 activities): 5-10 minutes  
- Large accounts (500+ activities): 15-30 minutes

You'll see a "Sync Complete!" message when finished.

## What Gets Synced

### Activities
- Basic info (name, type, distance, time)
- GPS data and route
- Performance metrics (speed, pace, elevation)
- Heart rate, power, cadence (if available)

### Laps & Splits
- Auto-generated laps
- Manual splits you created
- Lap-level metrics

### Streams
- GPS coordinates (latitude/longitude)
- Altitude/elevation
- Heart rate
- Power (watts)
- Cadence
- Temperature
- Velocity

### Routes
- Saved routes from Strava
- Route polylines for map display

### Stats
- All-time totals
- Recent totals (last 4 weeks)
- Year-to-date totals

## Limitations

- **One sync at a time**: You can't start a new sync while one is running
- **Rate limits**: Strava API has rate limits (100 requests per 15 minutes, 1000 per day)
- **Large accounts**: Very large accounts may take longer or require multiple syncs

## Troubleshooting

### Sync Failed

If your sync fails:
1. Check the error message displayed
2. Common issues:
   - **Token expired**: Sign out and sign in again
   - **Rate limit**: Wait 15 minutes and try again
   - **Network error**: Check your internet connection

### Partial Sync

If some activities fail:
- The sync continues with other activities
- Failed count is shown in the progress
- You can re-run the sync to retry failed items

### Sync Taking Too Long

For very large accounts:
- The sync may time out after 2 hours
- You can re-run to continue from where it left off
- Consider syncing during off-peak hours

## Privacy & Security

- Only you can see your synced data
- Data is stored securely in the database
- Row-level security ensures data isolation
- You can delete your data anytime by deleting your account

## Need Help?

If you encounter issues:
1. Check the error message
2. Try signing out and back in
3. Contact support with your sync job ID (shown in error messages)
