-- ============================================================================
-- Seed Program Templates
-- AMA-465: Build Program Templates Library
--
-- Seeds 12 program templates covering all training goals and experience levels.
-- Uses fixed UUIDs for idempotent re-runs with ON CONFLICT DO UPDATE.
--
-- Standardized Muscle Group Vocabulary:
--   Upper body: chest, back, lats, upper_back, shoulders, rear_delts,
--               biceps, triceps, traps, forearms
--   Lower body: quadriceps, hamstrings, glutes, calves
--   Core: core
--   Compound areas: upper_chest, lower_back (for specific emphasis)
-- ============================================================================

-- ============================================================================
-- BEGINNER TEMPLATES (4 templates, all 3 sessions/week, 8 weeks, full_body)
-- ============================================================================

-- 1. Beginner Full Body Foundations (general_fitness)
INSERT INTO program_templates (id, name, goal, periodization_model, experience_level, duration_weeks, structure, is_system_template, created_by, usage_count)
VALUES (
    '11111111-1111-1111-1111-111111111101'::uuid,
    'Beginner Full Body Foundations',
    'general_fitness',
    'linear',
    'beginner',
    8,
    '{
        "mesocycle_length": 4,
        "deload_frequency": 4,
        "split_type": "full_body",
        "sessions_per_week": 3,
        "weeks": [{
            "week_pattern": 1,
            "focus": "Foundation Building",
            "workouts": [
                {
                    "day_of_week": 1,
                    "name": "Full Body A",
                    "workout_type": "full_body",
                    "muscle_groups": ["chest", "back", "quadriceps", "hamstrings", "glutes", "shoulders", "core"],
                    "exercise_slots": 6,
                    "target_duration_minutes": 45
                },
                {
                    "day_of_week": 3,
                    "name": "Full Body B",
                    "workout_type": "full_body",
                    "muscle_groups": ["chest", "back", "quadriceps", "hamstrings", "glutes", "shoulders", "core"],
                    "exercise_slots": 6,
                    "target_duration_minutes": 45
                },
                {
                    "day_of_week": 5,
                    "name": "Full Body C",
                    "workout_type": "full_body",
                    "muscle_groups": ["chest", "back", "quadriceps", "hamstrings", "glutes", "shoulders", "core"],
                    "exercise_slots": 6,
                    "target_duration_minutes": 45
                }
            ]
        }]
    }'::jsonb,
    TRUE,
    NULL,
    0
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    goal = EXCLUDED.goal,
    periodization_model = EXCLUDED.periodization_model,
    experience_level = EXCLUDED.experience_level,
    duration_weeks = EXCLUDED.duration_weeks,
    structure = EXCLUDED.structure,
    is_system_template = EXCLUDED.is_system_template;

-- 2. Beginner Strength Builder (strength)
INSERT INTO program_templates (id, name, goal, periodization_model, experience_level, duration_weeks, structure, is_system_template, created_by, usage_count)
VALUES (
    '11111111-1111-1111-1111-111111111102'::uuid,
    'Beginner Strength Builder',
    'strength',
    'linear',
    'beginner',
    8,
    '{
        "mesocycle_length": 4,
        "deload_frequency": 4,
        "split_type": "full_body",
        "sessions_per_week": 3,
        "weeks": [{
            "week_pattern": 1,
            "focus": "Strength Foundation",
            "workouts": [
                {
                    "day_of_week": 1,
                    "name": "Strength Day A",
                    "workout_type": "full_body",
                    "muscle_groups": ["chest", "back", "quadriceps", "hamstrings", "glutes", "shoulders"],
                    "exercise_slots": 5,
                    "target_duration_minutes": 50
                },
                {
                    "day_of_week": 3,
                    "name": "Strength Day B",
                    "workout_type": "full_body",
                    "muscle_groups": ["quadriceps", "hamstrings", "glutes", "back", "chest", "biceps", "triceps"],
                    "exercise_slots": 5,
                    "target_duration_minutes": 50
                },
                {
                    "day_of_week": 5,
                    "name": "Strength Day C",
                    "workout_type": "full_body",
                    "muscle_groups": ["quadriceps", "hamstrings", "glutes", "shoulders", "back", "core"],
                    "exercise_slots": 5,
                    "target_duration_minutes": 50
                }
            ]
        }]
    }'::jsonb,
    TRUE,
    NULL,
    0
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    goal = EXCLUDED.goal,
    periodization_model = EXCLUDED.periodization_model,
    experience_level = EXCLUDED.experience_level,
    duration_weeks = EXCLUDED.duration_weeks,
    structure = EXCLUDED.structure,
    is_system_template = EXCLUDED.is_system_template;

-- 3. Beginner Hypertrophy (hypertrophy)
INSERT INTO program_templates (id, name, goal, periodization_model, experience_level, duration_weeks, structure, is_system_template, created_by, usage_count)
VALUES (
    '11111111-1111-1111-1111-111111111103'::uuid,
    'Beginner Hypertrophy',
    'hypertrophy',
    'linear',
    'beginner',
    8,
    '{
        "mesocycle_length": 4,
        "deload_frequency": 4,
        "split_type": "full_body",
        "sessions_per_week": 3,
        "weeks": [{
            "week_pattern": 1,
            "focus": "Muscle Building",
            "workouts": [
                {
                    "day_of_week": 1,
                    "name": "Hypertrophy A",
                    "workout_type": "full_body",
                    "muscle_groups": ["chest", "back", "quadriceps", "hamstrings", "glutes", "biceps", "triceps"],
                    "exercise_slots": 6,
                    "target_duration_minutes": 55
                },
                {
                    "day_of_week": 3,
                    "name": "Hypertrophy B",
                    "workout_type": "full_body",
                    "muscle_groups": ["shoulders", "quadriceps", "hamstrings", "glutes", "back", "chest", "core"],
                    "exercise_slots": 6,
                    "target_duration_minutes": 55
                },
                {
                    "day_of_week": 5,
                    "name": "Hypertrophy C",
                    "workout_type": "full_body",
                    "muscle_groups": ["quadriceps", "hamstrings", "glutes", "chest", "back", "biceps", "triceps", "shoulders"],
                    "exercise_slots": 6,
                    "target_duration_minutes": 55
                }
            ]
        }]
    }'::jsonb,
    TRUE,
    NULL,
    0
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    goal = EXCLUDED.goal,
    periodization_model = EXCLUDED.periodization_model,
    experience_level = EXCLUDED.experience_level,
    duration_weeks = EXCLUDED.duration_weeks,
    structure = EXCLUDED.structure,
    is_system_template = EXCLUDED.is_system_template;

-- 4. Beginner Fat Loss Circuit (fat_loss)
INSERT INTO program_templates (id, name, goal, periodization_model, experience_level, duration_weeks, structure, is_system_template, created_by, usage_count)
VALUES (
    '11111111-1111-1111-1111-111111111104'::uuid,
    'Beginner Fat Loss Circuit',
    'fat_loss',
    'linear',
    'beginner',
    8,
    '{
        "mesocycle_length": 4,
        "deload_frequency": 4,
        "split_type": "full_body",
        "sessions_per_week": 3,
        "weeks": [{
            "week_pattern": 1,
            "focus": "Fat Loss & Conditioning",
            "workouts": [
                {
                    "day_of_week": 1,
                    "name": "Circuit Training A",
                    "workout_type": "full_body",
                    "muscle_groups": ["quadriceps", "hamstrings", "glutes", "chest", "back", "shoulders", "core"],
                    "exercise_slots": 8,
                    "target_duration_minutes": 40
                },
                {
                    "day_of_week": 3,
                    "name": "Circuit Training B",
                    "workout_type": "full_body",
                    "muscle_groups": ["quadriceps", "hamstrings", "glutes", "back", "chest", "biceps", "triceps", "core"],
                    "exercise_slots": 8,
                    "target_duration_minutes": 40
                },
                {
                    "day_of_week": 5,
                    "name": "Circuit Training C",
                    "workout_type": "full_body",
                    "muscle_groups": ["quadriceps", "hamstrings", "glutes", "shoulders", "back", "chest", "core"],
                    "exercise_slots": 8,
                    "target_duration_minutes": 40
                }
            ]
        }]
    }'::jsonb,
    TRUE,
    NULL,
    0
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    goal = EXCLUDED.goal,
    periodization_model = EXCLUDED.periodization_model,
    experience_level = EXCLUDED.experience_level,
    duration_weeks = EXCLUDED.duration_weeks,
    structure = EXCLUDED.structure,
    is_system_template = EXCLUDED.is_system_template;

-- ============================================================================
-- INTERMEDIATE TEMPLATES (6 templates)
-- ============================================================================

-- 5. Intermediate PPL Hypertrophy (hypertrophy, 6 sessions, 12 weeks, push_pull_legs)
INSERT INTO program_templates (id, name, goal, periodization_model, experience_level, duration_weeks, structure, is_system_template, created_by, usage_count)
VALUES (
    '11111111-1111-1111-1111-111111111105'::uuid,
    'Intermediate PPL Hypertrophy',
    'hypertrophy',
    'undulating',
    'intermediate',
    12,
    '{
        "mesocycle_length": 4,
        "deload_frequency": 4,
        "split_type": "push_pull_legs",
        "sessions_per_week": 6,
        "weeks": [{
            "week_pattern": 1,
            "focus": "Muscle Building",
            "workouts": [
                {
                    "day_of_week": 1,
                    "name": "Push Day",
                    "workout_type": "push",
                    "muscle_groups": ["chest", "shoulders", "triceps"],
                    "exercise_slots": 5,
                    "target_duration_minutes": 60
                },
                {
                    "day_of_week": 2,
                    "name": "Pull Day",
                    "workout_type": "pull",
                    "muscle_groups": ["back", "rear_delts", "biceps"],
                    "exercise_slots": 5,
                    "target_duration_minutes": 60
                },
                {
                    "day_of_week": 3,
                    "name": "Legs Day",
                    "workout_type": "legs",
                    "muscle_groups": ["quadriceps", "hamstrings", "glutes", "calves"],
                    "exercise_slots": 5,
                    "target_duration_minutes": 60
                },
                {
                    "day_of_week": 4,
                    "name": "Push Day",
                    "workout_type": "push",
                    "muscle_groups": ["chest", "shoulders", "triceps"],
                    "exercise_slots": 5,
                    "target_duration_minutes": 60
                },
                {
                    "day_of_week": 5,
                    "name": "Pull Day",
                    "workout_type": "pull",
                    "muscle_groups": ["back", "rear_delts", "biceps"],
                    "exercise_slots": 5,
                    "target_duration_minutes": 60
                },
                {
                    "day_of_week": 6,
                    "name": "Legs Day",
                    "workout_type": "legs",
                    "muscle_groups": ["quadriceps", "hamstrings", "glutes", "calves"],
                    "exercise_slots": 5,
                    "target_duration_minutes": 60
                }
            ]
        }]
    }'::jsonb,
    TRUE,
    NULL,
    0
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    goal = EXCLUDED.goal,
    periodization_model = EXCLUDED.periodization_model,
    experience_level = EXCLUDED.experience_level,
    duration_weeks = EXCLUDED.duration_weeks,
    structure = EXCLUDED.structure,
    is_system_template = EXCLUDED.is_system_template;

-- 6. Intermediate Upper/Lower (hypertrophy, 4 sessions, 8 weeks, upper_lower)
INSERT INTO program_templates (id, name, goal, periodization_model, experience_level, duration_weeks, structure, is_system_template, created_by, usage_count)
VALUES (
    '11111111-1111-1111-1111-111111111106'::uuid,
    'Intermediate Upper/Lower',
    'hypertrophy',
    'undulating',
    'intermediate',
    8,
    '{
        "mesocycle_length": 4,
        "deload_frequency": 4,
        "split_type": "upper_lower",
        "sessions_per_week": 4,
        "weeks": [{
            "week_pattern": 1,
            "focus": "Balanced Hypertrophy",
            "workouts": [
                {
                    "day_of_week": 1,
                    "name": "Upper Body A",
                    "workout_type": "upper",
                    "muscle_groups": ["chest", "back", "shoulders", "biceps", "triceps"],
                    "exercise_slots": 6,
                    "target_duration_minutes": 60
                },
                {
                    "day_of_week": 2,
                    "name": "Lower Body A",
                    "workout_type": "lower",
                    "muscle_groups": ["quadriceps", "hamstrings", "glutes", "calves", "core"],
                    "exercise_slots": 5,
                    "target_duration_minutes": 55
                },
                {
                    "day_of_week": 4,
                    "name": "Upper Body B",
                    "workout_type": "upper",
                    "muscle_groups": ["back", "chest", "shoulders", "triceps", "biceps"],
                    "exercise_slots": 6,
                    "target_duration_minutes": 60
                },
                {
                    "day_of_week": 5,
                    "name": "Lower Body B",
                    "workout_type": "lower",
                    "muscle_groups": ["hamstrings", "quadriceps", "glutes", "calves", "core"],
                    "exercise_slots": 5,
                    "target_duration_minutes": 55
                }
            ]
        }]
    }'::jsonb,
    TRUE,
    NULL,
    0
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    goal = EXCLUDED.goal,
    periodization_model = EXCLUDED.periodization_model,
    experience_level = EXCLUDED.experience_level,
    duration_weeks = EXCLUDED.duration_weeks,
    structure = EXCLUDED.structure,
    is_system_template = EXCLUDED.is_system_template;

-- 7. Strength 5/3/1 (strength, 4 sessions, 16 weeks, upper_lower)
INSERT INTO program_templates (id, name, goal, periodization_model, experience_level, duration_weeks, structure, is_system_template, created_by, usage_count)
VALUES (
    '11111111-1111-1111-1111-111111111107'::uuid,
    'Strength 5/3/1',
    'strength',
    'undulating',
    'intermediate',
    16,
    '{
        "mesocycle_length": 4,
        "deload_frequency": 4,
        "split_type": "upper_lower",
        "sessions_per_week": 4,
        "weeks": [{
            "week_pattern": 1,
            "focus": "Strength Building",
            "workouts": [
                {
                    "day_of_week": 1,
                    "name": "Squat Day",
                    "workout_type": "lower",
                    "muscle_groups": ["quadriceps", "glutes", "hamstrings", "core"],
                    "exercise_slots": 4,
                    "target_duration_minutes": 60
                },
                {
                    "day_of_week": 2,
                    "name": "Bench Day",
                    "workout_type": "upper",
                    "muscle_groups": ["chest", "triceps", "shoulders"],
                    "exercise_slots": 4,
                    "target_duration_minutes": 60
                },
                {
                    "day_of_week": 4,
                    "name": "Deadlift Day",
                    "workout_type": "lower",
                    "muscle_groups": ["hamstrings", "glutes", "back", "core"],
                    "exercise_slots": 4,
                    "target_duration_minutes": 60
                },
                {
                    "day_of_week": 5,
                    "name": "Overhead Press Day",
                    "workout_type": "upper",
                    "muscle_groups": ["shoulders", "triceps", "upper_chest"],
                    "exercise_slots": 4,
                    "target_duration_minutes": 60
                }
            ]
        }]
    }'::jsonb,
    TRUE,
    NULL,
    0
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    goal = EXCLUDED.goal,
    periodization_model = EXCLUDED.periodization_model,
    experience_level = EXCLUDED.experience_level,
    duration_weeks = EXCLUDED.duration_weeks,
    structure = EXCLUDED.structure,
    is_system_template = EXCLUDED.is_system_template;

-- 8. Intermediate Fat Loss (fat_loss, 4 sessions, 12 weeks, upper_lower)
INSERT INTO program_templates (id, name, goal, periodization_model, experience_level, duration_weeks, structure, is_system_template, created_by, usage_count)
VALUES (
    '11111111-1111-1111-1111-111111111108'::uuid,
    'Intermediate Fat Loss',
    'fat_loss',
    'linear',
    'intermediate',
    12,
    '{
        "mesocycle_length": 4,
        "deload_frequency": 4,
        "split_type": "upper_lower",
        "sessions_per_week": 4,
        "weeks": [{
            "week_pattern": 1,
            "focus": "Fat Loss & Muscle Retention",
            "workouts": [
                {
                    "day_of_week": 1,
                    "name": "Upper Body Metabolic",
                    "workout_type": "upper",
                    "muscle_groups": ["chest", "back", "shoulders", "biceps", "triceps"],
                    "exercise_slots": 6,
                    "target_duration_minutes": 50
                },
                {
                    "day_of_week": 2,
                    "name": "Lower Body Metabolic",
                    "workout_type": "lower",
                    "muscle_groups": ["quadriceps", "hamstrings", "glutes", "calves"],
                    "exercise_slots": 6,
                    "target_duration_minutes": 50
                },
                {
                    "day_of_week": 4,
                    "name": "Upper Body Circuit",
                    "workout_type": "upper",
                    "muscle_groups": ["back", "chest", "shoulders", "core"],
                    "exercise_slots": 6,
                    "target_duration_minutes": 50
                },
                {
                    "day_of_week": 5,
                    "name": "Lower Body Circuit",
                    "workout_type": "lower",
                    "muscle_groups": ["glutes", "hamstrings", "quadriceps", "core"],
                    "exercise_slots": 6,
                    "target_duration_minutes": 50
                }
            ]
        }]
    }'::jsonb,
    TRUE,
    NULL,
    0
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    goal = EXCLUDED.goal,
    periodization_model = EXCLUDED.periodization_model,
    experience_level = EXCLUDED.experience_level,
    duration_weeks = EXCLUDED.duration_weeks,
    structure = EXCLUDED.structure,
    is_system_template = EXCLUDED.is_system_template;

-- 9. Muscular Endurance Builder (endurance, 4 sessions, 8 weeks, upper_lower)
INSERT INTO program_templates (id, name, goal, periodization_model, experience_level, duration_weeks, structure, is_system_template, created_by, usage_count)
VALUES (
    '11111111-1111-1111-1111-111111111109'::uuid,
    'Muscular Endurance Builder',
    'endurance',
    'linear',
    'intermediate',
    8,
    '{
        "mesocycle_length": 4,
        "deload_frequency": 4,
        "split_type": "upper_lower",
        "sessions_per_week": 4,
        "weeks": [{
            "week_pattern": 1,
            "focus": "Endurance & Work Capacity",
            "workouts": [
                {
                    "day_of_week": 1,
                    "name": "Upper Endurance",
                    "workout_type": "upper",
                    "muscle_groups": ["chest", "back", "shoulders", "biceps", "triceps", "core"],
                    "exercise_slots": 7,
                    "target_duration_minutes": 50
                },
                {
                    "day_of_week": 2,
                    "name": "Lower Endurance",
                    "workout_type": "lower",
                    "muscle_groups": ["quadriceps", "hamstrings", "glutes", "calves"],
                    "exercise_slots": 6,
                    "target_duration_minutes": 50
                },
                {
                    "day_of_week": 4,
                    "name": "Upper Conditioning",
                    "workout_type": "upper",
                    "muscle_groups": ["back", "chest", "shoulders", "core"],
                    "exercise_slots": 7,
                    "target_duration_minutes": 50
                },
                {
                    "day_of_week": 5,
                    "name": "Lower Conditioning",
                    "workout_type": "lower",
                    "muscle_groups": ["glutes", "quadriceps", "hamstrings", "core"],
                    "exercise_slots": 6,
                    "target_duration_minutes": 50
                }
            ]
        }]
    }'::jsonb,
    TRUE,
    NULL,
    0
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    goal = EXCLUDED.goal,
    periodization_model = EXCLUDED.periodization_model,
    experience_level = EXCLUDED.experience_level,
    duration_weeks = EXCLUDED.duration_weeks,
    structure = EXCLUDED.structure,
    is_system_template = EXCLUDED.is_system_template;

-- 10. General Fitness Intermediate (general_fitness, 4 sessions, 8 weeks, upper_lower)
INSERT INTO program_templates (id, name, goal, periodization_model, experience_level, duration_weeks, structure, is_system_template, created_by, usage_count)
VALUES (
    '11111111-1111-1111-1111-111111111110'::uuid,
    'General Fitness Intermediate',
    'general_fitness',
    'linear',
    'intermediate',
    8,
    '{
        "mesocycle_length": 4,
        "deload_frequency": 4,
        "split_type": "upper_lower",
        "sessions_per_week": 4,
        "weeks": [{
            "week_pattern": 1,
            "focus": "Balanced Fitness",
            "workouts": [
                {
                    "day_of_week": 1,
                    "name": "Upper Body Balanced",
                    "workout_type": "upper",
                    "muscle_groups": ["chest", "back", "shoulders", "biceps", "triceps", "core"],
                    "exercise_slots": 6,
                    "target_duration_minutes": 55
                },
                {
                    "day_of_week": 2,
                    "name": "Lower Body Balanced",
                    "workout_type": "lower",
                    "muscle_groups": ["quadriceps", "hamstrings", "glutes", "calves"],
                    "exercise_slots": 5,
                    "target_duration_minutes": 50
                },
                {
                    "day_of_week": 4,
                    "name": "Upper Body Power",
                    "workout_type": "upper",
                    "muscle_groups": ["chest", "back", "shoulders", "core"],
                    "exercise_slots": 6,
                    "target_duration_minutes": 55
                },
                {
                    "day_of_week": 5,
                    "name": "Lower Body Power",
                    "workout_type": "lower",
                    "muscle_groups": ["glutes", "quadriceps", "hamstrings", "core"],
                    "exercise_slots": 5,
                    "target_duration_minutes": 50
                }
            ]
        }]
    }'::jsonb,
    TRUE,
    NULL,
    0
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    goal = EXCLUDED.goal,
    periodization_model = EXCLUDED.periodization_model,
    experience_level = EXCLUDED.experience_level,
    duration_weeks = EXCLUDED.duration_weeks,
    structure = EXCLUDED.structure,
    is_system_template = EXCLUDED.is_system_template;

-- ============================================================================
-- ADVANCED TEMPLATES (2 templates)
-- ============================================================================

-- 11. Advanced PPL Volume (hypertrophy, 6 sessions, 12 weeks, push_pull_legs)
INSERT INTO program_templates (id, name, goal, periodization_model, experience_level, duration_weeks, structure, is_system_template, created_by, usage_count)
VALUES (
    '11111111-1111-1111-1111-111111111111'::uuid,
    'Advanced PPL Volume',
    'hypertrophy',
    'undulating',
    'advanced',
    12,
    '{
        "mesocycle_length": 4,
        "deload_frequency": 4,
        "split_type": "push_pull_legs",
        "sessions_per_week": 6,
        "weeks": [{
            "week_pattern": 1,
            "focus": "High Volume Hypertrophy",
            "workouts": [
                {
                    "day_of_week": 1,
                    "name": "Push - Chest Focus",
                    "workout_type": "push",
                    "muscle_groups": ["chest", "shoulders", "triceps"],
                    "exercise_slots": 6,
                    "target_duration_minutes": 75
                },
                {
                    "day_of_week": 2,
                    "name": "Pull - Back Width",
                    "workout_type": "pull",
                    "muscle_groups": ["lats", "rear_delts", "biceps", "forearms"],
                    "exercise_slots": 6,
                    "target_duration_minutes": 75
                },
                {
                    "day_of_week": 3,
                    "name": "Legs - Quad Focus",
                    "workout_type": "legs",
                    "muscle_groups": ["quadriceps", "glutes", "calves", "core"],
                    "exercise_slots": 6,
                    "target_duration_minutes": 75
                },
                {
                    "day_of_week": 4,
                    "name": "Push - Shoulder Focus",
                    "workout_type": "push",
                    "muscle_groups": ["shoulders", "upper_chest", "triceps"],
                    "exercise_slots": 6,
                    "target_duration_minutes": 75
                },
                {
                    "day_of_week": 5,
                    "name": "Pull - Back Thickness",
                    "workout_type": "pull",
                    "muscle_groups": ["upper_back", "traps", "biceps", "rear_delts"],
                    "exercise_slots": 6,
                    "target_duration_minutes": 75
                },
                {
                    "day_of_week": 6,
                    "name": "Legs - Hamstring Focus",
                    "workout_type": "legs",
                    "muscle_groups": ["hamstrings", "glutes", "quadriceps", "calves"],
                    "exercise_slots": 6,
                    "target_duration_minutes": 75
                }
            ]
        }]
    }'::jsonb,
    TRUE,
    NULL,
    0
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    goal = EXCLUDED.goal,
    periodization_model = EXCLUDED.periodization_model,
    experience_level = EXCLUDED.experience_level,
    duration_weeks = EXCLUDED.duration_weeks,
    structure = EXCLUDED.structure,
    is_system_template = EXCLUDED.is_system_template;

-- 12. Advanced Strength Block (strength, 4 sessions, 12 weeks, upper_lower)
INSERT INTO program_templates (id, name, goal, periodization_model, experience_level, duration_weeks, structure, is_system_template, created_by, usage_count)
VALUES (
    '11111111-1111-1111-1111-111111111112'::uuid,
    'Advanced Strength Block',
    'strength',
    'block',
    'advanced',
    12,
    '{
        "mesocycle_length": 4,
        "deload_frequency": 4,
        "split_type": "upper_lower",
        "sessions_per_week": 4,
        "weeks": [{
            "week_pattern": 1,
            "focus": "Maximal Strength",
            "workouts": [
                {
                    "day_of_week": 1,
                    "name": "Lower - Squat Emphasis",
                    "workout_type": "lower",
                    "muscle_groups": ["quadriceps", "glutes", "core", "hamstrings"],
                    "exercise_slots": 5,
                    "target_duration_minutes": 75
                },
                {
                    "day_of_week": 2,
                    "name": "Upper - Bench Emphasis",
                    "workout_type": "upper",
                    "muscle_groups": ["chest", "triceps", "shoulders", "upper_back"],
                    "exercise_slots": 5,
                    "target_duration_minutes": 75
                },
                {
                    "day_of_week": 4,
                    "name": "Lower - Deadlift Emphasis",
                    "workout_type": "lower",
                    "muscle_groups": ["hamstrings", "glutes", "lower_back", "core"],
                    "exercise_slots": 5,
                    "target_duration_minutes": 75
                },
                {
                    "day_of_week": 5,
                    "name": "Upper - Press Emphasis",
                    "workout_type": "upper",
                    "muscle_groups": ["shoulders", "triceps", "upper_chest", "back"],
                    "exercise_slots": 5,
                    "target_duration_minutes": 75
                }
            ]
        }]
    }'::jsonb,
    TRUE,
    NULL,
    0
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    goal = EXCLUDED.goal,
    periodization_model = EXCLUDED.periodization_model,
    experience_level = EXCLUDED.experience_level,
    duration_weeks = EXCLUDED.duration_weeks,
    structure = EXCLUDED.structure,
    is_system_template = EXCLUDED.is_system_template;

-- ============================================================================
-- Verification comment
-- ============================================================================
-- To verify templates were seeded correctly, run:
-- SELECT id, name, goal, experience_level, duration_weeks
-- FROM program_templates
-- WHERE is_system_template = TRUE
-- ORDER BY experience_level, goal;
--
-- Expected: 12 templates
-- - Beginner (4): general_fitness, strength, hypertrophy, fat_loss
-- - Intermediate (6): hypertrophy (2), strength, fat_loss, endurance, general_fitness
-- - Advanced (2): hypertrophy, strength
