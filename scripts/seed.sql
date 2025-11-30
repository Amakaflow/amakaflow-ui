-- Development Seed Data
-- Run with: psql $DATABASE_URL -f scripts/seed.sql
-- Or via Supabase dashboard SQL editor

-- Note: This is for LOCAL DEVELOPMENT only. 
-- Do not run in production!

-- Sample profile
INSERT INTO profiles (id, email, name, devices)
VALUES 
  ('dev_user_001', 'dev@example.com', 'Development User', ARRAY['garmin', 'apple'])
ON CONFLICT (id) DO NOTHING;

-- Sample linked account (Strava)
INSERT INTO linked_accounts (id, profile_id, provider, provider_account_id)
VALUES 
  ('dev_linked_001', 'dev_user_001', 'strava', 'strava_12345')
ON CONFLICT (profile_id, provider) DO NOTHING;

-- Sample workout
INSERT INTO workouts (id, profile_id, title, workout_data, device, sources)
VALUES 
  (
    'dev_workout_001',
    'dev_user_001',
    'Sample Strength Workout',
    '{
      "title": "Sample Strength Workout",
      "blocks": [
        {
          "label": "Warmup",
          "structure": "regular",
          "exercises": [
            {"name": "Jumping Jacks", "duration_sec": 60},
            {"name": "Arm Circles", "duration_sec": 30}
          ]
        },
        {
          "label": "Main Set",
          "structure": "regular",
          "rounds": 3,
          "exercises": [
            {"name": "Squats", "reps": 10},
            {"name": "Push Ups", "reps": 10},
            {"name": "Lunges", "reps": 10}
          ]
        }
      ]
    }'::jsonb,
    'garmin',
    ARRAY['manual']
  )
ON CONFLICT (id) DO NOTHING;

-- Sample follow-along workout
INSERT INTO follow_along_workouts (id, user_id, source, source_url, title, video_duration_sec)
VALUES 
  (
    'dev_follow_001',
    'dev_user_001',
    'youtube',
    'https://www.youtube.com/watch?v=example123',
    'Sample Follow-Along Workout',
    1800
  )
ON CONFLICT (id) DO NOTHING;

-- Sample follow-along steps
INSERT INTO follow_along_steps (id, follow_along_workout_id, "order", label, start_time_sec, end_time_sec, duration_sec)
VALUES 
  ('dev_step_001', 'dev_follow_001', 1, 'Warmup', 0, 120, 120),
  ('dev_step_002', 'dev_follow_001', 2, 'Squats', 120, 300, 180),
  ('dev_step_003', 'dev_follow_001', 3, 'Push Ups', 300, 480, 180),
  ('dev_step_004', 'dev_follow_001', 4, 'Cooldown', 480, 600, 120)
ON CONFLICT (id) DO NOTHING;

-- Verify seed data
SELECT 'Profiles:' as table_name, count(*) as count FROM profiles
UNION ALL
SELECT 'Linked Accounts:', count(*) FROM linked_accounts
UNION ALL
SELECT 'Workouts:', count(*) FROM workouts
UNION ALL
SELECT 'Follow-Along Workouts:', count(*) FROM follow_along_workouts
UNION ALL
SELECT 'Follow-Along Steps:', count(*) FROM follow_along_steps;
