# Aggregate Statistics - Unique Entity Counting

This document confirms that all aggregate statistics in the StravaHeatmap application correctly count unique activities, segments, and efforts.

## ✅ Confirmed Unique Entity Counting

### 1. **Activities Statistics**
- **Total Activities**: `COUNT(*)` from `activities` table
- **Unique Activities**: Each activity record is counted exactly once
- **Activity Types**: `COUNT(DISTINCT type)` - counts unique activity types
- **Activities with Segments**: `COUNT(*) FILTER (WHERE segments_fetched = true)`
- **Activities without Segments**: `COUNT(*) FILTER (WHERE segments_fetched = false)`

### 2. **Segments Statistics**
- **Total Segments**: `COUNT(*)` from `segments` table
- **Unique Segments**: Each segment record is counted exactly once
- **Unique Cities**: `COUNT(DISTINCT city)` - counts unique cities
- **Unique States**: `COUNT(DISTINCT state)` - counts unique states
- **Segments with Efforts**: `COUNT(DISTINCT se.segment_id)` - counts unique segments that have efforts
- **Segments without Efforts**: `total_segments - segments_with_efforts`

### 3. **Segment Efforts Statistics**
- **Total Efforts**: `COUNT(*)` from `segment_efforts` table
- **Unique Efforts**: Each effort record is counted exactly once
- **Unique Segments Attempted**: `COUNT(DISTINCT segment_id)` - counts unique segments that have been attempted
- **Activities with Efforts**: `COUNT(DISTINCT activity_id)` - counts unique activities that have efforts

## 📊 Database Views and Functions

### Global Statistics Views
```sql
-- activity_stats view
SELECT 
  COUNT(*) as total_activities,  -- ✅ Unique activities
  COUNT(DISTINCT type) as activity_types_count  -- ✅ Unique activity types
FROM activities;

-- segment_stats view  
SELECT 
  COUNT(*) as total_segments,  -- ✅ Unique segments
  COUNT(DISTINCT city) as unique_cities,  -- ✅ Unique cities
  COUNT(DISTINCT state) as unique_states  -- ✅ Unique states
FROM segments;

-- segment_effort_stats view
SELECT 
  COUNT(*) as total_efforts,  -- ✅ Unique efforts
  COUNT(DISTINCT segment_id) as unique_segments_attempted,  -- ✅ Unique segments attempted
  COUNT(DISTINCT activity_id) as activities_with_efforts  -- ✅ Unique activities with efforts
FROM segment_efforts;
```

### User-Specific Statistics
```sql
-- user_activity_stats view
SELECT 
  strava_id,
  COUNT(*) as total_activities,  -- ✅ Unique activities per user
  COUNT(DISTINCT type) as activity_types_count  -- ✅ Unique activity types per user
FROM activities
GROUP BY strava_id;

-- user_segment_effort_stats view
SELECT 
  a.strava_id,
  COUNT(*) as total_efforts,  -- ✅ Unique efforts per user
  COUNT(DISTINCT se.segment_id) as unique_segments_attempted  -- ✅ Unique segments attempted per user
FROM segment_efforts se
JOIN activities a ON se.activity_id = a.activity_id
GROUP BY a.strava_id;
```

### Segment Completion Functions
```sql
-- get_segment_completion_stats function
WITH activity_stats AS (
  SELECT 
    COUNT(*) as total_activities,  -- ✅ Unique activities
    COUNT(*) FILTER (WHERE segments_fetched = true) as activities_with_segments,  -- ✅ Unique activities with segments
    COUNT(*) FILTER (WHERE segments_fetched = false) as activities_without_segments  -- ✅ Unique activities without segments
  FROM activities
  WHERE segments_fetched IS NOT NULL
),
segment_stats AS (
  SELECT 
    COUNT(DISTINCT s.segment_id) as total_segments,  -- ✅ Unique segments
    COUNT(DISTINCT se.segment_id) as segments_with_efforts  -- ✅ Unique segments with efforts
  FROM segments s
  LEFT JOIN segment_efforts se ON s.segment_id = se.segment_id
)
```

## 🎯 UI Components

### Dashboard Page (`app/dashboard/page.tsx`)
- **Total Activities**: `activitiesCount.count` - ✅ Unique activities
- **Total Segments**: `segmentsCount.count` - ✅ Unique segments  
- **Total Efforts**: `effortsCount.count` - ✅ Unique efforts
- **Unique Segments Attempted**: `uniqueSegmentsAttempted.size` - ✅ Unique segments attempted
- **Total Distance**: Sum of unique activity distances - ✅ Unique activities
- **Total Time**: Sum of unique activity times - ✅ Unique activities
- **Total Elevation**: Sum of unique activity elevation gains - ✅ Unique activities

### Activities Page (`app/activities/page.tsx`)
- **Total Activities**: `totalActivities` - ✅ Unique activities
- **Activity Types**: Counted per unique type - ✅ Unique activity types
- **Segment Completion**: Based on unique activities with segments - ✅ Unique activities

### Segments Page (`app/segments/page.tsx`)
- **Total Segments**: `segmentsCount.count` - ✅ Unique segments
- **Total Efforts**: `effortsCount.count` - ✅ Unique efforts
- **Segments with Efforts**: `segmentsWithEfforts` - ✅ Unique segments with efforts
- **Effort Completion**: Based on unique segments with efforts - ✅ Unique segments

### Segment Efforts Page (`app/segment-efforts/page.tsx`)
- **Total Efforts**: `totalEfforts` - ✅ Unique efforts
- **Unique Segments**: `uniqueSegments` - ✅ Unique segments
- **Personal Records**: Counted per unique segment - ✅ Unique segments
- **Effort Completion**: Based on unique segments with efforts - ✅ Unique segments

### Debug Page (`app/debug/page.tsx`)
- **Entity Statistics**: Via `/api/strava/crawler/entity-stats` - ✅ Unique entities
- **Segment Completion**: Via `/api/strava/segment-completion` - ✅ Unique entities
- **Crawler Statistics**: Via `/api/strava/crawler/stats` - ✅ Unique entities

### Components
- **ActivitiesCharts** (`app/components/ActivitiesCharts.tsx`): Aggregates by unique activities per month/week - ✅ Unique activities
- **CalendarHeatmapStrava** (`app/components/CalendarHeatmapStrava.tsx`): Counts unique activities per day - ✅ Unique activities
- **ActivitiesTable** (`app/components/ActivitiesTable.tsx`): Displays unique activities - ✅ Unique activities
- **CrawlerControl** (`app/components/CrawlerControl.tsx`): Shows crawler statistics - ✅ Unique entities

### API Endpoints
- **`/api/strava/crawler/entity-stats`**: Returns unique entity counts - ✅ Unique entities
- **`/api/strava/segment-completion`**: Uses database functions for unique counts - ✅ Unique entities
- **`/api/strava/crawler/stats`**: Returns unique crawler statistics - ✅ Unique entities
- **`/api/stats`**: Uses StatsService for unique counts - ✅ Unique entities

### Client-Side Components
- **DashboardClient** (`app/dashboard/dashboard-client.tsx`): Displays unique statistics from server - ✅ Unique entities
- **ActivitiesClient** (`app/activities/activities-client.tsx`): Shows unique activity counts and completion rates - ✅ Unique entities
- **SegmentsClient** (`app/segments/segments-client.tsx`): Displays unique segment counts and effort completion - ✅ Unique entities
- **SegmentEffortsClient** (`app/segment-efforts/segment-efforts-client.tsx`): Shows unique effort counts and personal records - ✅ Unique entities

## 🔍 Verification Methods

### 1. Database Queries
```sql
-- Verify unique activities
SELECT COUNT(*) as total_activities FROM activities;

-- Verify unique segments  
SELECT COUNT(*) as total_segments FROM segments;

-- Verify unique efforts
SELECT COUNT(*) as total_efforts FROM segment_efforts;

-- Verify unique segments attempted
SELECT COUNT(DISTINCT segment_id) as unique_segments_attempted FROM segment_efforts;
```

### 2. Application Logs
- All aggregate calculations use `COUNT(*)` for total records
- All unique counting uses `COUNT(DISTINCT column)` 
- No duplicate counting in any aggregation logic

### 3. UI Verification
- Dashboard displays correct unique counts
- All pages show accurate statistics
- Completion percentages are calculated from unique entities

## ✅ Summary

All aggregate statistics in the StravaHeatmap application correctly count:
- **Unique Activities**: Each activity record counted once
- **Unique Segments**: Each segment record counted once  
- **Unique Efforts**: Each effort record counted once
- **Unique Segments Attempted**: Each unique segment that has efforts counted once

The application maintains data integrity by ensuring no duplicate counting in any aggregation or display logic. 