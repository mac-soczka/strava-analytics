export interface StravaSegment {
  id: number;
  name: string;
  distance: number;
  average_grade: number;
  maximum_grade: number;
  elevation_high: number;
  elevation_low: number;
  climb_category: number;
  city: string;
  state: string;
  country: string;
  private: boolean;
  hazardous: boolean;
  starred: boolean;
  map?: {
    polyline: string;
  };
}

export interface StravaSegmentEffort {
  id: number;
  segment: StravaSegment;
  elapsed_time: number;
  moving_time: number;
  start_date: string;
  start_date_local: string;
  average_watts?: number;
  max_watts?: number;
  average_heartrate?: number;
  max_heartrate?: number;
  average_cadence?: number;
  max_cadence?: number;
  average_temp?: number;
}

export interface StravaActivity {
  id: number;
  name: string;
  distance: number;
  moving_time: number;
  elapsed_time: number;
  total_elevation_gain: number;
  type: string;
  sport_type?: string; // Optional since database doesn't have this column
  workout_type?: number;
  start_date: string;
  start_date_local: string;
  timezone?: string; // Optional since database doesn't have this column
  utc_offset?: number; // Optional since database doesn't have this column
}

export interface DatabaseActivity {
  id?: string; // UUID primary key (optional for inserts)
  strava_id: number;
  activity_id: number;
  name: string;
  distance: number;
  moving_time: number;
  elapsed_time: number;
  total_elevation_gain: number;
  type: string;
  start_date: string;
  start_date_local: string;
  average_speed?: number;
  max_speed?: number;
  average_watts?: number;
  max_watts?: number;
  average_heartrate?: number;
  max_heartrate?: number;
  polyline?: string;
  created_at?: string;
  updated_at?: string;
} 