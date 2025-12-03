import { CalendarEvent, ConnectedCalendar } from '../types/calendar';

// Mock Connected Calendars
export const mockConnectedCalendars: ConnectedCalendar[] = [
  {
    id: 'conn-cal-runna-1',
    name: 'Runna – Subscribed',
    type: 'runna',
    integration_type: 'ics_url',
    is_workout_calendar: true,
    ics_url: 'https://runna.com/calendar/user123.ics',
    last_sync: new Date(Date.now() - 17 * 60 * 1000).toISOString(), // 17 minutes ago
    sync_status: 'active',
    workouts_this_week: 3,
    created_at: '2024-10-15T10:00:00Z',
  },
  {
    id: 'conn-cal-apple-1',
    name: 'Apple Calendar',
    type: 'apple',
    integration_type: 'os_integration',
    is_workout_calendar: true,
    sync_status: 'active',
    workouts_this_week: 4,
    created_at: '2024-11-01T14:30:00Z',
  },
  {
    id: 'conn-cal-google-1',
    name: 'Google Calendar',
    type: 'google',
    integration_type: 'oauth',
    is_workout_calendar: false,
    sync_status: 'active',
    created_at: '2024-11-10T09:00:00Z',
  },
];

export const sampleCalendarEvents: CalendarEvent[] = [
  // ============================================
  // ANCHOR EVENTS - Week of Nov 23-29, 2024
  // ============================================
  
  // Sunday, Nov 23 - Long Run (Runna Connected Calendar)
  {
    id: 'anchor-long-run-nov23',
    user_id: 'demo-user-1',
    title: 'Long Run',
    source: 'connected_calendar',
    connected_calendar_id: 'conn-cal-runna-1',
    connected_calendar_type: 'runna',
    external_event_url: 'https://runna.com/workouts/long-run-nov23',
    date: '2024-11-23',
    start_time: '06:00:00',
    end_time: '08:00:00',
    type: 'run',
    status: 'planned',
    is_anchor: true,
    intensity: 2, // Moderate
    json_payload: {
      workout_type: 'long_run',
      distance_km: 20,
      target_pace: '5:30/km'
    },
    created_at: '2024-11-20T10:00:00Z',
    updated_at: '2024-11-20T10:00:00Z'
  },

  // Monday, Nov 25 - Easy Run (Runna Connected Calendar)
  {
    id: 'anchor-easy-run-nov25',
    user_id: 'demo-user-1',
    title: 'Easy Run',
    source: 'connected_calendar',
    connected_calendar_id: 'conn-cal-runna-1',
    connected_calendar_type: 'runna',
    external_event_url: 'https://runna.com/workouts/easy-run-nov25',
    date: '2024-11-25',
    start_time: '06:00:00',
    end_time: '07:00:00',
    type: 'run',
    status: 'planned',
    is_anchor: true,
    intensity: 1, // Easy
    json_payload: {
      workout_type: 'easy',
      distance_km: 8,
      target_pace: '6:00/km'
    },
    created_at: '2024-11-20T10:00:00Z',
    updated_at: '2024-11-20T10:00:00Z'
  },

  // Wednesday, Nov 27 - Tempo Run (Runna Connected Calendar)
  {
    id: 'anchor-tempo-run-nov27',
    user_id: 'demo-user-1',
    title: 'Tempo Run',
    source: 'connected_calendar',
    connected_calendar_id: 'conn-cal-runna-1',
    connected_calendar_type: 'runna',
    external_event_url: 'https://runna.com/workouts/tempo-run-nov27',
    date: '2024-11-27',
    start_time: '06:00:00',
    end_time: '07:00:00',
    type: 'run',
    status: 'planned',
    is_anchor: true,
    intensity: 3, // Hard
    json_payload: {
      workout_type: 'tempo',
      distance_km: 10,
      target_pace: '4:45/km'
    },
    created_at: '2024-11-20T10:00:00Z',
    updated_at: '2024-11-20T10:00:00Z'
  },

  // Wednesday, Nov 27 - Trainer Heavy Lower Body (Manual Recurring)
  {
    id: 'anchor-trainer-lower-nov27',
    user_id: 'demo-user-1',
    title: 'Trainer — Heavy Lower Body',
    source: 'manual',
    date: '2024-11-27',
    start_time: '11:00:00',
    end_time: '12:00:00',
    type: 'strength',
    status: 'planned',
    is_anchor: true,
    primary_muscle: 'lower',
    intensity: 3, // Hard
    recurrence_rule: 'RRULE:FREQ=WEEKLY;BYDAY=WE',
    json_payload: {
      recurring: true,
      focus: 'squats, deadlifts, leg press'
    },
    created_at: '2024-11-20T10:00:00Z',
    updated_at: '2024-11-20T10:00:00Z'
  },

  // Thursday, Nov 28 - Zwift Recovery Ride (Imported)
  {
    id: 'anchor-zwift-recovery-nov28',
    user_id: 'demo-user-1',
    title: 'Zwift Recovery Ride',
    source: 'garmin',
    date: '2024-11-28',
    start_time: '06:00:00',
    end_time: '06:45:00',
    type: 'recovery',
    status: 'planned',
    is_anchor: true,
    intensity: 0, // Recovery
    json_payload: {
      source: 'zwift',
      workout_type: 'recovery_ride',
      duration_minutes: 45,
      avg_watts: 150
    },
    created_at: '2024-11-20T10:00:00Z',
    updated_at: '2024-11-20T10:00:00Z'
  },

  // Thursday, Nov 28 - CrossFit Class (Apple Calendar)
  {
    id: 'apple-cal-crossfit-nov28',
    user_id: 'demo-user-1',
    title: 'CrossFit METCON',
    source: 'connected_calendar',
    connected_calendar_id: 'conn-cal-apple-1',
    connected_calendar_type: 'apple',
    date: '2024-11-28',
    start_time: '17:30:00',
    end_time: '18:30:00',
    type: 'class',
    status: 'planned',
    is_anchor: true,
    intensity: 3,
    json_payload: {
      venue: 'Local Box',
      class_name: 'CrossFit METCON'
    },
    created_at: '2024-11-22T10:00:00Z',
    updated_at: '2024-11-22T10:00:00Z'
  },

  // Friday, Nov 29 - Trainer Upper Body (Manual Recurring)
  {
    id: 'anchor-trainer-upper-nov29',
    user_id: 'demo-user-1',
    title: 'Trainer — Upper Body',
    source: 'manual',
    date: '2024-11-29',
    start_time: '11:00:00',
    end_time: '12:00:00',
    type: 'strength',
    status: 'planned',
    is_anchor: true,
    primary_muscle: 'upper',
    intensity: 2, // Moderate
    recurrence_rule: 'RRULE:FREQ=WEEKLY;BYDAY=FR',
    json_payload: {
      recurring: true,
      focus: 'bench press, rows, shoulder press'
    },
    created_at: '2024-11-20T10:00:00Z',
    updated_at: '2024-11-20T10:00:00Z'
  },

  // Monday, Nov 25 - Morning Yoga (Apple Calendar)
  {
    id: 'apple-cal-yoga-nov25',
    user_id: 'demo-user-1',
    title: 'Morning Yoga & Stretch',
    source: 'connected_calendar',
    connected_calendar_id: 'conn-cal-apple-1',
    connected_calendar_type: 'apple',
    date: '2024-11-25',
    start_time: '07:30:00',
    end_time: '08:15:00',
    type: 'mobility',
    status: 'planned',
    is_anchor: true,
    intensity: 0,
    json_payload: {
      class_type: 'Yoga'
    },
    created_at: '2024-11-22T10:00:00Z',
    updated_at: '2024-11-22T10:00:00Z'
  },

  // Wednesday, Nov 27 - Swim Session (Apple Calendar)
  {
    id: 'apple-cal-swim-nov27',
    user_id: 'demo-user-1',
    title: 'Pool Swim - 2000m',
    source: 'connected_calendar',
    connected_calendar_id: 'conn-cal-apple-1',
    connected_calendar_type: 'apple',
    date: '2024-11-27',
    start_time: '18:00:00',
    end_time: '19:00:00',
    type: 'recovery',
    status: 'planned',
    is_anchor: true,
    intensity: 1,
    json_payload: {
      distance_m: 2000
    },
    created_at: '2024-11-22T10:00:00Z',
    updated_at: '2024-11-22T10:00:00Z'
  },

  // Saturday, Nov 30 - Park Run (Apple Calendar)
  {
    id: 'apple-cal-parkrun-nov30',
    user_id: 'demo-user-1',
    title: 'Park Run 5K',
    source: 'connected_calendar',
    connected_calendar_id: 'conn-cal-apple-1',
    connected_calendar_type: 'apple',
    date: '2024-11-30',
    start_time: '09:00:00',
    end_time: '09:30:00',
    type: 'run',
    status: 'planned',
    is_anchor: true,
    intensity: 2,
    json_payload: {
      distance_km: 5,
      event: 'Park Run'
    },
    created_at: '2024-11-22T10:00:00Z',
    updated_at: '2024-11-22T10:00:00Z'
  },

  // ============================================
  // REGULAR EVENTS
  // ============================================
  
  // Monday, Nov 25
  {
    id: '550e8400-e29b-41d4-a716-446655440004',
    user_id: 'demo-user-1',
    title: 'Tempo Run - 3x2km',
    source: 'runna',
    date: '2024-11-25',
    start_time: '18:30:00',
    end_time: '19:15:00',
    type: 'run',
    status: 'completed',
    json_payload: {
      source: 'runna',
      workout_id: 'runna_12344',
      workout_type: 'tempo',
      intervals: [
        {
          type: 'warmup',
          distance_km: 2,
          pace: '5:45/km'
        },
        {
          type: 'tempo',
          reps: 3,
          distance_km: 2,
          target_pace: '4:30/km',
          rest: '2 min walk'
        },
        {
          type: 'cooldown',
          distance_km: 2,
          pace: '6:00/km'
        }
      ],
      actual_pace: '4:28/km',
      notes: 'Felt strong, negative split on last interval'
    },
    created_at: '2024-11-24T10:00:00Z',
    updated_at: '2024-11-25T19:15:00Z'
  },
  // Tuesday, Nov 26
  {
    id: '550e8400-e29b-41d4-a716-446655440015',
    user_id: 'demo-user-1',
    title: 'Morning Run - 8km',
    source: 'garmin',
    date: '2024-11-26',
    start_time: '06:00:00',
    end_time: '06:48:00',
    type: 'run',
    status: 'completed',
    json_payload: {
      source: 'garmin',
      workout_id: 'garmin_67890',
      activity_type: 'running',
      distance_km: 8.0,
      duration_seconds: 2880,
      average_pace: '6:00/km',
      average_heart_rate: 145,
      max_heart_rate: 162,
      calories: 580,
      elevation_gain_m: 120,
      garmin_connect_url: 'https://connect.garmin.com/modern/activity/67890'
    },
    created_at: '2024-11-26T06:48:00Z',
    updated_at: '2024-11-26T06:48:00Z'
  },
  // Wednesday, Nov 27
  {
    id: '550e8400-e29b-41d4-a716-446655440001',
    user_id: 'demo-user-1',
    title: 'Easy Run - 5km',
    source: 'runna',
    date: '2024-11-27',
    start_time: '06:30:00',
    end_time: '07:15:00',
    type: 'run',
    status: 'planned',
    json_payload: {
      source: 'runna',
      workout_id: 'runna_12345',
      distance_km: 5,
      pace: '5:30/km',
      description: 'Easy conversational pace. Focus on form and breathing.',
      workout_type: 'easy_run',
      duration_minutes: 45,
      warmup: '5 min walk',
      cooldown: '5 min walk'
    },
    created_at: '2024-11-26T10:00:00Z',
    updated_at: '2024-11-26T10:00:00Z'
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440005',
    user_id: 'demo-user-1',
    title: 'HIIT Class - F45',
    source: 'gym_class',
    date: '2024-11-27',
    start_time: '19:00:00',
    end_time: '19:45:00',
    type: 'class',
    status: 'planned',
    json_payload: {
      source: 'gym_class',
      class_name: 'F45 Training - Athletica',
      location: 'F45 Downtown',
      instructor: 'Sarah Johnson',
      class_type: 'HIIT',
      duration_minutes: 45,
      description: 'High-intensity interval training with functional movements',
      equipment: ['dumbbells', 'kettlebells', 'battle ropes', 'rower'],
      intensity: 'high'
    },
    created_at: '2024-11-26T14:00:00Z',
    updated_at: '2024-11-26T14:00:00Z'
  },
  // Thursday, Nov 28
  {
    id: '550e8400-e29b-41d4-a716-446655440011',
    user_id: 'demo-user-1',
    title: 'Home Workout - Full Body Circuit',
    source: 'amaka',
    date: '2024-11-28',
    start_time: '07:00:00',
    end_time: '07:30:00',
    type: 'home_workout',
    status: 'planned',
    json_payload: {
      source: 'amaka',
      workout_id: 'amaka_workout_003',
      title: 'Home Workout - Full Body Circuit',
      blocks: [
        {
          label: 'Circuit 1',
          structure: 'circuit',
          exercises: [
            { name: 'Push-ups', reps: 15, sets: 3 },
            { name: 'Bodyweight Squats', reps: 20, sets: 3 },
            { name: 'Plank', duration_sec: 45, sets: 3 },
            { name: 'Jumping Jacks', reps: 30, sets: 3 }
          ],
          rest_sec: 30,
          reps: 3
        }
      ],
      estimated_duration_minutes: 30,
      equipment: ['none'],
      location: 'home'
    },
    created_at: '2024-11-26T15:00:00Z',
    updated_at: '2024-11-26T15:00:00Z'
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440014',
    user_id: 'demo-user-1',
    title: '10-Minute Core Blast',
    source: 'instagram',
    date: '2024-11-28',
    start_time: '12:00:00',
    end_time: '12:10:00',
    type: 'home_workout',
    status: 'planned',
    json_payload: {
      source: 'instagram',
      workout_id: 'ig_post_12345',
      title: '10-Minute Core Blast',
      creator: '@fitnesscoach',
      blocks: [
        {
          label: 'Core Circuit',
          structure: 'circuit',
          exercises: [
            { name: 'Plank', duration_sec: 45 },
            { name: 'Russian Twists', reps: 20 },
            { name: 'Bicycle Crunches', reps: 30 },
            { name: 'Mountain Climbers', reps: 20 }
          ],
          reps: 3,
          rest_sec: 30
        }
      ],
      estimated_duration_minutes: 10,
      equipment: ['none']
    },
    created_at: '2024-11-26T16:00:00Z',
    updated_at: '2024-11-26T16:00:00Z'
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440009',
    user_id: 'demo-user-1',
    title: 'Upper Body Strength - Push Focus',
    source: 'amaka',
    date: '2024-11-28',
    start_time: '17:00:00',
    end_time: '18:00:00',
    type: 'strength',
    status: 'planned',
    json_payload: {
      source: 'amaka',
      workout_id: 'amaka_workout_001',
      title: 'Upper Body Strength - Push Focus',
      blocks: [
        {
          label: 'Warm-up',
          structure: 'circuit',
          exercises: [
            { name: 'Arm Circles', duration_sec: 30, sets: 2 },
            { name: 'Shoulder Dislocations', reps: 10, sets: 2 }
          ]
        },
        {
          label: 'Main Workout',
          structure: 'straight',
          exercises: [
            { name: 'Barbell Bench Press', reps: 8, sets: 4, rest_sec: 120, notes: 'Last set to failure' },
            { name: 'Incline Dumbbell Press', reps: 10, sets: 3, rest_sec: 90 },
            { name: 'Overhead Press', reps: 8, sets: 3, rest_sec: 90 },
            { name: 'Lateral Raises', reps: 12, sets: 3, rest_sec: 60 },
            { name: 'Tricep Dips', reps: 10, sets: 3, rest_sec: 60 }
          ]
        }
      ],
      estimated_duration_minutes: 60,
      equipment: ['barbell', 'dumbbells', 'bench', 'dip station']
    },
    created_at: '2024-11-26T15:00:00Z',
    updated_at: '2024-11-26T15:00:00Z'
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440006',
    user_id: 'demo-user-1',
    title: 'Vinyasa Flow Yoga',
    source: 'gym_class',
    date: '2024-11-28',
    start_time: '18:00:00',
    end_time: '19:00:00',
    type: 'mobility',
    status: 'planned',
    json_payload: {
      source: 'gym_class',
      class_name: 'Vinyasa Flow',
      location: 'Yoga Studio Central',
      instructor: 'Emma Chen',
      class_type: 'Yoga',
      duration_minutes: 60,
      description: 'Dynamic flow sequence focusing on strength and flexibility',
      level: 'intermediate',
      focus: ['hip_openers', 'backbends', 'arm_balances']
    },
    created_at: '2024-11-26T14:00:00Z',
    updated_at: '2024-11-26T14:00:00Z'
  },
  // Friday, Nov 29
  {
    id: '550e8400-e29b-41d4-a716-446655440002',
    user_id: 'demo-user-1',
    title: 'Interval Training - 8x400m',
    source: 'runna',
    date: '2024-11-29',
    start_time: '18:00:00',
    end_time: '19:00:00',
    type: 'run',
    status: 'planned',
    json_payload: {
      source: 'runna',
      workout_id: 'runna_12346',
      workout_type: 'interval',
      intervals: [
        {
          type: 'warmup',
          distance_km: 1.5,
          pace: '6:00/km'
        },
        {
          type: 'interval',
          reps: 8,
          distance_m: 400,
          pace: '4:00/km',
          rest: '90s jog'
        },
        {
          type: 'cooldown',
          distance_km: 1.5,
          pace: '6:00/km'
        }
      ],
      total_distance_km: 6.2,
      description: '8x400m at 5K pace with 90s jog recovery'
    },
    created_at: '2024-11-26T10:00:00Z',
    updated_at: '2024-11-26T10:00:00Z'
  },
  // Saturday, Nov 30
  {
    id: '550e8400-e29b-41d4-a716-446655440007',
    user_id: 'demo-user-1',
    title: 'Spin Class - Power Hour',
    source: 'gym_class',
    date: '2024-11-30',
    start_time: '06:00:00',
    end_time: '07:00:00',
    type: 'class',
    status: 'planned',
    json_payload: {
      source: 'gym_class',
      class_name: 'Power Hour Spin',
      location: 'Cycle Studio',
      instructor: 'Mike Rodriguez',
      class_type: 'Cycling',
      duration_minutes: 60,
      description: 'High-energy indoor cycling with music and intervals',
      resistance_levels: 'Moderate to High',
      music_theme: 'Electronic Dance'
    },
    created_at: '2024-11-26T14:00:00Z',
    updated_at: '2024-11-26T14:00:00Z'
  },
  // Sunday, Dec 1
  {
    id: '550e8400-e29b-41d4-a716-446655440003',
    user_id: 'demo-user-1',
    title: 'Long Run - 21km',
    source: 'runna',
    date: '2024-12-01',
    start_time: '07:00:00',
    end_time: '09:30:00',
    type: 'run',
    status: 'planned',
    json_payload: {
      source: 'runna',
      workout_id: 'runna_12347',
      workout_type: 'long_run',
      distance_km: 21,
      pace: '6:00/km',
      description: 'Steady long run. Practice race day nutrition and hydration.',
      target_time_minutes: 126,
      fueling: 'Gel at 45min, 90min, 135min'
    },
    created_at: '2024-11-26T10:00:00Z',
    updated_at: '2024-11-26T10:00:00Z'
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440012',
    user_id: 'demo-user-1',
    title: 'Lower Body Strength - Leg Day',
    source: 'amaka',
    date: '2024-12-01',
    start_time: '17:00:00',
    end_time: '18:15:00',
    type: 'strength',
    status: 'planned',
    json_payload: {
      source: 'amaka',
      workout_id: 'amaka_workout_004',
      title: 'Lower Body Strength - Leg Day',
      blocks: [
        {
          label: 'Warm-up',
          structure: 'straight',
          exercises: [
            { name: 'Leg Swings', reps: 10, sets: 2, notes: 'Each leg' },
            { name: 'Bodyweight Squats', reps: 15, sets: 2 }
          ]
        },
        {
          label: 'Main Workout',
          structure: 'straight',
          exercises: [
            { name: 'Barbell Back Squat', reps: 6, sets: 4, rest_sec: 180, notes: 'Heavy weight, focus on depth' },
            { name: 'Romanian Deadlift', reps: 8, sets: 4, rest_sec: 120 },
            { name: 'Bulgarian Split Squats', reps: 10, sets: 3, rest_sec: 90, notes: 'Each leg' },
            { name: 'Leg Press', reps: 12, sets: 3, rest_sec: 90 },
            { name: 'Leg Curls', reps: 12, sets: 3, rest_sec: 60 },
            { name: 'Calf Raises', reps: 15, sets: 3, rest_sec: 60 }
          ]
        }
      ],
      estimated_duration_minutes: 75,
      equipment: ['barbell', 'dumbbells', 'leg_press', 'leg_curl_machine']
    },
    created_at: '2024-11-26T15:00:00Z',
    updated_at: '2024-11-26T15:00:00Z'
  },
  // Monday, Dec 2
  {
    id: '550e8400-e29b-41d4-a716-446655440008',
    user_id: 'demo-user-1',
    title: 'CrossFit WOD - Fran',
    source: 'gym_class',
    date: '2024-12-02',
    start_time: '17:30:00',
    end_time: '18:30:00',
    type: 'class',
    status: 'planned',
    json_payload: {
      source: 'gym_class',
      class_name: 'CrossFit WOD',
      location: 'CrossFit Downtown',
      instructor: 'Coach James',
      class_type: 'CrossFit',
      wod_name: 'Fran',
      wod_description: '21-15-9 reps for time: Thrusters (95/65 lbs) and Pull-ups',
      duration_minutes: 60,
      scaled_options: ['65 lbs thrusters', 'ring rows']
    },
    created_at: '2024-11-26T14:00:00Z',
    updated_at: '2024-11-26T14:00:00Z'
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440013',
    user_id: 'demo-user-1',
    title: 'Recovery - Mobility & Stretching',
    source: 'amaka',
    date: '2024-12-02',
    start_time: '19:00:00',
    end_time: '19:45:00',
    type: 'recovery',
    status: 'planned',
    json_payload: {
      source: 'amaka',
      workout_id: 'amaka_workout_005',
      title: 'Recovery - Mobility & Stretching',
      blocks: [
        {
          label: 'Foam Rolling',
          structure: 'straight',
          exercises: [
            { name: 'Foam Roll Quads', duration_sec: 60, notes: 'Each leg' },
            { name: 'Foam Roll Hamstrings', duration_sec: 60, notes: 'Each leg' },
            { name: 'Foam Roll IT Band', duration_sec: 60, notes: 'Each leg' },
            { name: 'Foam Roll Calves', duration_sec: 60, notes: 'Each leg' }
          ]
        },
        {
          label: 'Static Stretching',
          structure: 'straight',
          exercises: [
            { name: 'Pigeon Pose', duration_sec: 90, notes: 'Each side' },
            { name: 'Hamstring Stretch', duration_sec: 60, notes: 'Each leg' },
            { name: 'Quad Stretch', duration_sec: 60, notes: 'Each leg' },
            { name: 'Shoulder Stretch', duration_sec: 60, notes: 'Each arm' }
          ]
        }
      ],
      estimated_duration_minutes: 45,
      equipment: ['foam_roller', 'yoga_mat']
    },
    created_at: '2024-11-26T15:00:00Z',
    updated_at: '2024-11-26T15:00:00Z'
  },
  // Tuesday, Dec 3
  {
    id: '550e8400-e29b-41d4-a716-446655440010',
    user_id: 'demo-user-1',
    title: 'Hyrox Training - Workout Simulation',
    source: 'amaka',
    date: '2024-12-03',
    start_time: '18:00:00',
    end_time: '19:30:00',
    type: 'hyrox',
    status: 'planned',
    json_payload: {
      source: 'amaka',
      workout_id: 'amaka_workout_002',
      title: 'Hyrox Training - Workout Simulation',
      description: 'Simulated Hyrox race format with 8x1km runs and functional stations',
      blocks: [
        {
          label: 'Warm-up',
          structure: 'straight',
          exercises: [
            { name: 'Dynamic Warm-up', duration_sec: 600 }
          ]
        },
        {
          label: 'Main Workout',
          structure: 'circuit',
          exercises: [
            { name: '1km Run', distance_m: 1000, target_pace: '4:00/km' },
            { name: '100m SkiErg', reps: 100, notes: 'As fast as possible' },
            { name: '50m Sled Push', distance_m: 50, notes: 'Heavy sled' },
            { name: '80m Burpee Broad Jump', distance_m: 80 },
            { name: '1km Row', distance_m: 1000, target_time_sec: 240 },
            { name: '200m Farmers Walk', distance_m: 200, notes: 'Heavy kettlebells' },
            { name: '100m Sandbag Lunges', distance_m: 100 },
            { name: '100 Wall Balls', reps: 100, notes: '9kg ball to 3m target' }
          ],
          reps: 1
        }
      ],
      estimated_duration_minutes: 90,
      equipment: ['treadmill', 'skierg', 'sled', 'rower', 'kettlebells', 'sandbag', 'wall_ball']
    },
    created_at: '2024-11-26T15:00:00Z',
    updated_at: '2024-11-26T15:00:00Z'
  }
];

// Helper function to seed calendar with sample data
export function seedCalendarData(): CalendarEvent[] {
  return sampleCalendarEvents;
}

// Helper to get events for a date range
export function getEventsInRange(startStr: string, endStr: string, events: CalendarEvent[] = sampleCalendarEvents): CalendarEvent[] {
  return events.filter(event => {
    return event.date >= startStr && event.date <= endStr;
  });
}