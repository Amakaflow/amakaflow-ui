// @generated — do not edit manually. Run: npm run generate:types:calendar
// Hand-maintained until generate script runs against live backend.

export interface WorkoutEvent {
  id: string;
  user_id: string;
  title: string;
  date: string; // YYYY-MM-DD
  source: string;
  type?: string;
  start_time?: string;
  end_time?: string;
  status: 'planned' | 'completed';
  is_anchor: boolean;
  primary_muscle?: string;
  intensity?: number;
  connected_calendar_id?: string;
  connected_calendar_type?: string;
  external_event_url?: string;
  recurrence_rule?: string;
  json_payload?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

export interface CreateWorkoutEvent {
  title: string;
  date: string;
  source?: string;
  type?: string;
  start_time?: string;
  end_time?: string;
  status?: 'planned' | 'completed';
  is_anchor?: boolean;
  primary_muscle?: string;
  intensity?: number;
  connected_calendar_id?: string;
  connected_calendar_type?: string;
  external_event_url?: string;
  recurrence_rule?: string;
  json_payload?: Record<string, any>;
}

export interface UpdateWorkoutEvent {
  title?: string;
  date?: string;
  source?: string;
  type?: string;
  start_time?: string;
  end_time?: string;
  status?: 'planned' | 'completed';
  is_anchor?: boolean;
  primary_muscle?: string;
  intensity?: number;
  connected_calendar_id?: string;
  connected_calendar_type?: string;
  external_event_url?: string;
  recurrence_rule?: string;
  json_payload?: Record<string, any>;
}

export interface ConnectedCalendar {
  id: string;
  user_id: string;
  name: string;
  type: 'runna' | 'apple' | 'google' | 'outlook' | 'ics_custom';
  integration_type: 'ics_url' | 'oauth' | 'os_integration';
  is_workout_calendar: boolean;
  ics_url?: string;
  last_sync?: string;
  sync_status: 'active' | 'error' | 'paused';
  sync_error_message?: string;
  color?: string;
  workouts_this_week: number;
  created_at?: string;
  updated_at?: string;
}

export interface CreateConnectedCalendar {
  name: string;
  type: 'runna' | 'apple' | 'google' | 'outlook' | 'ics_custom';
  integration_type: 'ics_url' | 'oauth' | 'os_integration';
  is_workout_calendar?: boolean;
  ics_url?: string;
  color?: string;
}

export interface SyncResult {
  success: boolean;
  events_created: number;
  events_updated: number;
  total_events: number;
}
