export type WorkoutType = 'run' | 'strength' | 'hyrox' | 'class' | 'home_workout' | 'mobility' | 'recovery';

export type WorkoutSource = 
  | 'manual' 
  | 'gym_manual_sync'
  | 'connected_calendar'
  | 'smart_planner'
  | 'template'
  | 'gym_class' 
  | 'amaka' 
  | 'instagram' 
  | 'tiktok' 
  | 'garmin';

export type ConnectedCalendarType = 
  | 'runna'
  | 'apple'
  | 'google'
  | 'outlook'
  | 'ics_custom';

export type ConnectedCalendarIntegrationType = 
  | 'ics_url'
  | 'oauth'
  | 'os_integration';

export interface ConnectedCalendar {
  id: string;
  name: string;
  type: ConnectedCalendarType;
  integration_type: ConnectedCalendarIntegrationType;
  is_workout_calendar: boolean;
  ics_url?: string;
  last_sync?: string;
  sync_status: 'active' | 'error' | 'paused';
  workouts_this_week?: number;
  created_at: string;
}

export type EventStatus = 'planned' | 'completed';

export type PrimaryMuscle = 'upper' | 'lower' | 'full_body' | 'core' | 'none';

export type IntensityLevel = 0 | 1 | 2 | 3; // 0=recovery, 1=easy, 2=moderate, 3=hard

export interface CalendarEvent {
  id: string;
  user_id: string;
  title: string;
  date: string; // YYYY-MM-DD
  start_time?: string; // HH:MM:SS
  end_time?: string; // HH:MM:SS
  type: WorkoutType;
  source: WorkoutSource;
  status: EventStatus;
  is_anchor?: boolean; // True for key workouts (long runs, tempo, recurring trainer sessions)
  primary_muscle?: PrimaryMuscle; // For strength workouts
  intensity?: IntensityLevel; // 0=recovery, 1=easy, 2=moderate, 3=hard
  recurrence_rule?: string; // e.g. "RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR"
  connected_calendar_id?: string; // ID of the connected calendar this event came from
  connected_calendar_type?: ConnectedCalendarType; // Type for display badge
  external_event_url?: string; // Link to open in original calendar
  json_payload?: any;
  created_at: string;
  updated_at: string;
}
