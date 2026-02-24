-- Migration: Add atomic program creation function
-- Part of AMA-489: Add Transaction Handling for Program Creation
--
-- This function creates a program with all weeks and workouts atomically
-- within a single transaction, preventing orphaned records on partial failures.

-- Function: create_program_with_weeks_workouts
-- Atomically creates a program with all its weeks and workouts
CREATE OR REPLACE FUNCTION create_program_with_weeks_workouts(
    p_program JSONB,
    p_weeks JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_program_id UUID;
    v_week JSONB;
    v_week_id UUID;
    v_workout JSONB;
    v_workout_id UUID;
    v_result JSONB;
    v_week_ids JSONB := '[]'::JSONB;
    v_workout_ids JSONB := '[]'::JSONB;
BEGIN
    -- Validate required inputs
    IF p_program IS NULL THEN
        RAISE EXCEPTION 'program data is required';
    END IF;

    IF p_program->>'user_id' IS NULL THEN
        RAISE EXCEPTION 'user_id is required in program data';
    END IF;

    IF p_program->>'name' IS NULL THEN
        RAISE EXCEPTION 'name is required in program data';
    END IF;

    IF p_program->>'goal' IS NULL THEN
        RAISE EXCEPTION 'goal is required in program data';
    END IF;

    IF p_weeks IS NULL THEN
        p_weeks := '[]'::JSONB;
    END IF;

    -- Insert the program
    -- Note: training_programs table does not have a 'description' column
    INSERT INTO training_programs (
        id,
        user_id,
        name,
        goal,
        periodization_model,
        duration_weeks,
        sessions_per_week,
        experience_level,
        equipment_available,
        status,
        generation_metadata
    )
    VALUES (
        COALESCE((p_program->>'id')::UUID, gen_random_uuid()),
        p_program->>'user_id',
        p_program->>'name',
        p_program->>'goal',
        COALESCE(p_program->>'periodization_model', 'linear'),
        (p_program->>'duration_weeks')::INTEGER,
        (p_program->>'sessions_per_week')::INTEGER,
        p_program->>'experience_level',
        COALESCE(
            ARRAY(SELECT jsonb_array_elements_text(p_program->'equipment_available')),
            '{}'::TEXT[]
        ),
        COALESCE(p_program->>'status', 'draft'),
        COALESCE(p_program->'generation_metadata', '{}'::JSONB)
    )
    RETURNING id INTO v_program_id;

    -- Insert each week and its workouts
    FOR v_week IN SELECT * FROM jsonb_array_elements(p_weeks)
    LOOP
        INSERT INTO program_weeks (
            program_id,
            week_number,
            focus,
            intensity_percentage,
            volume_modifier,
            is_deload,
            notes
        )
        VALUES (
            v_program_id,
            (v_week->>'week_number')::INTEGER,
            v_week->>'focus',
            (v_week->>'intensity_percentage')::INTEGER,
            COALESCE((v_week->>'volume_modifier')::DECIMAL, 1.0),
            COALESCE((v_week->>'is_deload')::BOOLEAN, FALSE),
            v_week->>'notes'
        )
        RETURNING id INTO v_week_id;

        v_week_ids := v_week_ids || to_jsonb(v_week_id);

        -- Insert workouts for this week
        IF v_week->'workouts' IS NOT NULL AND jsonb_array_length(v_week->'workouts') > 0 THEN
            FOR v_workout IN SELECT * FROM jsonb_array_elements(v_week->'workouts')
            LOOP
                INSERT INTO program_workouts (
                    week_id,
                    day_of_week,
                    name,
                    workout_type,
                    target_duration_minutes,
                    exercises,
                    notes,
                    sort_order
                )
                VALUES (
                    v_week_id,
                    COALESCE((v_workout->>'day_of_week')::INTEGER, 0),
                    v_workout->>'name',
                    COALESCE(v_workout->>'workout_type', 'full_body'),
                    (v_workout->>'target_duration_minutes')::INTEGER,
                    COALESCE(v_workout->'exercises', '[]'::JSONB),
                    v_workout->>'notes',
                    COALESCE((v_workout->>'sort_order')::INTEGER, 0)
                )
                RETURNING id INTO v_workout_id;

                v_workout_ids := v_workout_ids || to_jsonb(v_workout_id);
            END LOOP;
        END IF;
    END LOOP;

    -- Build result
    v_result := jsonb_build_object(
        'program', jsonb_build_object('id', v_program_id),
        'weeks', v_week_ids,
        'workouts', v_workout_ids
    );

    RETURN v_result;
END;
$$;

-- Grant execute to service role (used by API)
GRANT EXECUTE ON FUNCTION create_program_with_weeks_workouts(JSONB, JSONB) TO service_role;

COMMENT ON FUNCTION create_program_with_weeks_workouts IS
    'Atomically create a program with all weeks and workouts in a single transaction';
