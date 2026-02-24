import pytest
from garmin_planner.main import createWorkoutJson, serialize
from garmin_planner.constant import SportType
import json


class TestSerialize:
    """Test serialization helper function"""
    
    def test_serialize_with_to_dict_method(self):
        from garmin_planner.constant import SportType
        result = serialize(SportType.RUNNING)
        assert isinstance(result, dict)
        assert result['sportTypeId'] == 1
    
    def test_serialize_with_enum_value(self):
        from enum import Enum
        
        class TestEnum(Enum):
            VALUE1 = "value1"
        
        result = serialize(TestEnum.VALUE1)
        assert result == "value1"


class TestCreateWorkoutJson:
    """Test workout JSON creation"""
    
    def test_create_running_workout_json(self):
        steps = [
            {"warmup": "15min @H(z2)"},
            {"repeat": [
                {"run": "30sec @P(5:30-6:00)"},
                {"recovery": "1200m"}
            ]},
            {"cooldown": "15min @H(z2)"}
        ]
        
        json_result = createWorkoutJson("interval_vo2max", steps)
        workout_dict = json.loads(json_result)
        
        assert workout_dict['workoutName'] == 'interval_vo2max'
        assert workout_dict['sportType']['sportTypeKey'] == 'running'
        assert len(workout_dict['workoutSegments']) == 1
        assert len(workout_dict['workoutSegments'][0]['workoutSteps']) == 3
    
    def test_create_strength_workout_json(self):
        steps = [
            {"warmup": [
                {"cardio": "lap"}
            ]},
            {"repeat": [
                {"Goblet Squat": "10 reps"},
                {"rest": "lap"}
            ]}
        ]
        
        json_result = createWorkoutJson("strength_test", steps)
        workout_dict = json.loads(json_result)
        
        assert workout_dict['workoutName'] == 'strength_test'
        assert workout_dict['sportType']['sportTypeKey'] == 'strength_training'
        assert len(workout_dict['workoutSegments']) == 1
    
    def test_create_strength_workout_with_exercise_names(self):
        steps = [
            {"warmup": [
                {"cardio": "lap"}
            ]},
            {"repeat": [
                {"Goblet Squat": "10 reps"},
                {"rest": "lap"}
            ]}
        ]
        
        json_result = createWorkoutJson("strength_test", steps)
        workout_dict = json.loads(json_result)
        
        # Find the exercise step in the repeat
        repeat_step = None
        for step in workout_dict['workoutSegments'][0]['workoutSteps']:
            if step.get('stepType', {}).get('stepTypeKey') == 'repeat':
                repeat_step = step
                break
        
        assert repeat_step is not None
        assert len(repeat_step['workoutSteps']) == 2
        
        # Check the exercise step
        exercise_step = repeat_step['workoutSteps'][0]
        assert exercise_step['stepType']['stepTypeKey'] == 'interval'
        assert exercise_step.get('exerciseName') == 'GOBLET_SQUAT'
        assert exercise_step.get('category') == 'SQUAT'
        assert exercise_step['endCondition']['conditionTypeKey'] == 'reps'
        assert exercise_step['endConditionValue'] == 10


class TestWorkoutStepCreation:
    """Test individual workout step creation"""
    
    def test_warmup_step_creation(self):
        from garmin_planner.main import createWorkoutStep
        from garmin_planner.constant import StepType, ConditionType
        
        step = {"warmup": "15min"}
        step_count = [0]
        result = createWorkoutStep(step, step_count)
        
        assert result.stepType == StepType.WARMUP
        assert result.endCondition == ConditionType.TIME
        assert result.endConditionValue == 900  # 15 minutes
    
    def test_exercise_step_with_reps(self):
        from garmin_planner.main import createWorkoutStep
        from garmin_planner.constant import StepType, ConditionType
        
        step = {"Goblet Squat": "10 reps"}
        step_count = [0]
        result = createWorkoutStep(step, step_count)
        
        assert result.stepType == StepType.INTERVAL
        assert result.exerciseName == 'GOBLET_SQUAT'
        assert result.category == 'SQUAT'
        assert result.endCondition == ConditionType.REPS
        assert result.endConditionValue == 10
    
    def test_cardio_step(self):
        from garmin_planner.main import createWorkoutStep
        from garmin_planner.constant import StepType, ConditionType
        
        step = {"cardio": "lap"}
        step_count = [0]
        result = createWorkoutStep(step, step_count)
        
        assert result.stepType == StepType.INTERVAL
        assert result.category == 'CARDIO'
        assert result.endCondition == ConditionType.LAP_BUTTON
    
    def test_warmup_with_nested_cardio(self):
        from garmin_planner.main import createWorkoutStep
        from garmin_planner.constant import StepType, ConditionType
        
        step = {"warmup": [
            {"cardio": "lap"}
        ]}
        step_count = [0]
        result = createWorkoutStep(step, step_count)
        
        assert result.stepType == StepType.WARMUP
        assert result.category == 'CARDIO'
        assert result.exerciseName == ''
        assert result.endCondition == ConditionType.LAP_BUTTON
    
    def test_exercise_with_description(self):
        from garmin_planner.main import createWorkoutStep
        from garmin_planner.constant import StepType, ConditionType
        
        step = {"Goblet Squat": "lap | KB RDL Into Goblet Squat x10"}
        step_count = [0]
        result = createWorkoutStep(step, step_count)
        
        assert result.stepType == StepType.INTERVAL
        assert result.exerciseName == 'GOBLET_SQUAT'
        assert result.category == 'SQUAT'
        assert result.endCondition == ConditionType.LAP_BUTTON
        assert result.description == "KB RDL Into Goblet Squat x10"
    
    def test_hyphenated_exercise_name(self):
        from garmin_planner.main import createWorkoutStep
        from garmin_planner.constant import StepType, ConditionType
        
        step = {"Kettlebell Floor to Shelf": "lap"}
        step_count = [0]
        result = createWorkoutStep(step, step_count)
        
        assert result.stepType == StepType.INTERVAL
        assert result.exerciseName == 'KETTLEBELL_FLOOR_TO_SHELF'
        assert result.category == 'DEADLIFT'
    
    def test_lat_pulldown_exercise_name_conversion(self):
        from garmin_planner.main import createWorkoutStep
        from garmin_planner.constant import StepType, ConditionType
        
        step = {"30-degree Lat Pull-down": "lap"}
        step_count = [0]
        result = createWorkoutStep(step, step_count)
        
        assert result.stepType == StepType.INTERVAL
        assert result.exerciseName == '_30_DEGREE_LAT_PULLDOWN'
        assert result.category == 'PULL_UP'
    
    def test_bulgarian_split_squat_category(self):
        from garmin_planner.main import createWorkoutStep
        from garmin_planner.constant import StepType, ConditionType
        
        step = {"Dumbbell Bulgarian Split Squat": "10 reps"}
        step_count = [0]
        result = createWorkoutStep(step, step_count)
        
        assert result.stepType == StepType.INTERVAL
        assert result.exerciseName == 'DUMBBELL_BULGARIAN_SPLIT_SQUAT'
        assert result.category == 'LUNGE'
        assert result.endCondition == ConditionType.REPS
        assert result.endConditionValue == 10
    
    def test_good_morning_category(self):
        from garmin_planner.main import createWorkoutStep
        from garmin_planner.constant import StepType, ConditionType
        
        step = {"Bar Good Morning": "12 reps"}
        step_count = [0]
        result = createWorkoutStep(step, step_count)
        
        assert result.stepType == StepType.INTERVAL
        assert result.exerciseName == 'BAR_GOOD_MORNING'
        assert result.category == 'LEG_CURL'
        assert result.endCondition == ConditionType.REPS
        assert result.endConditionValue == 12
    
    def test_clean_and_jerk_category(self):
        from garmin_planner.main import createWorkoutStep
        from garmin_planner.constant import StepType, ConditionType
        
        step = {"Dumbbell Power Clean and Jerk": "lap | 6 reps"}
        step_count = [0]
        result = createWorkoutStep(step, step_count)
        
        assert result.stepType == StepType.INTERVAL
        assert result.exerciseName == 'DUMBBELL_POWER_CLEAN_AND_JERK'
        assert result.category == 'OLYMPIC_LIFT'
        assert result.endCondition == ConditionType.LAP_BUTTON
        assert result.description == "6 reps"
    
    def test_medicine_ball_slam_category(self):
        from garmin_planner.main import createWorkoutStep
        from garmin_planner.constant import StepType, ConditionType
        
        step = {"Medicine Ball Slam": "lap | Kneeling x 8"}
        step_count = [0]
        result = createWorkoutStep(step, step_count)
        
        assert result.stepType == StepType.INTERVAL
        assert result.exerciseName == 'MEDICINE_BALL_SLAM'
        assert result.category == 'PLYO'
        assert result.endCondition == ConditionType.LAP_BUTTON
        assert result.description == "Kneeling x 8"
    
    def test_ski_moguls_category(self):
        from garmin_planner.main import createWorkoutStep
        from garmin_planner.constant import StepType, ConditionType
        
        step = {"Ski Moguls": "200m"}
        step_count = [0]
        result = createWorkoutStep(step, step_count)
        
        assert result.stepType == StepType.INTERVAL
        assert result.exerciseName == 'SKI_MOGULS'
        assert result.category == 'CARDIO'
        assert result.endCondition == ConditionType.DISTANCE
        assert result.endConditionValue == 200
    
    def test_pike_pushup_category(self):
        from garmin_planner.main import createWorkoutStep
        from garmin_planner.constant import StepType, ConditionType
        
        step = {"Pike Push-up": "8 reps"}
        step_count = [0]
        result = createWorkoutStep(step, step_count)
        
        assert result.stepType == StepType.INTERVAL
        assert result.exerciseName == 'PIKE_PUSH_UP'
        assert result.category == 'PUSH_UP'
        assert result.endCondition == ConditionType.REPS
        assert result.endConditionValue == 8
    
    def test_inverted_row_category(self):
        from garmin_planner.main import createWorkoutStep
        from garmin_planner.constant import StepType, ConditionType
        
        step = {"TRX Inverted Row": "12 reps"}
        step_count = [0]
        result = createWorkoutStep(step, step_count)
        
        assert result.stepType == StepType.INTERVAL
        assert result.exerciseName == 'TRX_INVERTED_ROW'
        assert result.category == 'ROW'
        assert result.endCondition == ConditionType.REPS
        assert result.endConditionValue == 12
    
    def test_row_category(self):
        from garmin_planner.main import createWorkoutStep
        from garmin_planner.constant import StepType, ConditionType
        
        step = {"Bent-over Row": "10 reps"}
        step_count = [0]
        result = createWorkoutStep(step, step_count)
        
        assert result.stepType == StepType.INTERVAL
        assert result.exerciseName == 'BENT_OVER_ROW'
        assert result.category == 'ROW'
        assert result.endCondition == ConditionType.REPS
        assert result.endConditionValue == 10
    
    def test_reps_only_without_lap_button(self):
        from garmin_planner.main import createWorkoutStep
        from garmin_planner.constant import StepType, ConditionType
        
        step = {"Dumbbell Bulgarian Split Squat": "10 reps"}
        step_count = [0]
        result = createWorkoutStep(step, step_count)
        
        assert result.stepType == StepType.INTERVAL
        assert result.endCondition == ConditionType.REPS
        assert result.endConditionValue == 10
        # Should NOT have lap button when only reps specified
        assert result.endCondition != ConditionType.LAP_BUTTON
    
    def test_distance_based_end_condition(self):
        from garmin_planner.main import createWorkoutStep
        from garmin_planner.constant import StepType, ConditionType
        
        step = {"Ski Moguls": "200m"}
        step_count = [0]
        result = createWorkoutStep(step, step_count)
        
        assert result.stepType == StepType.INTERVAL
        assert result.endCondition == ConditionType.DISTANCE
        assert result.endConditionValue == 200
        # Should NOT have lap button when distance specified
        assert result.endCondition != ConditionType.LAP_BUTTON
    
    def test_full_hyrox_week5_workout_structure(self):
        """Test the complete HYROX Week 5 workout with all 4 supersets"""
        steps = [
            {"warmup": [
                {"cardio": "lap"}
            ]},
            {"repeat(3)": [
                {"30-degree Lat Pull-down": "lap | Straight Arm Pull down x 10"},
                {"Goblet Squat": "lap | KB RDL Into Goblet Squat x10"},
                {"Kettlebell Floor to Shelf": "lap | KB Bottoms Up Press x8 each side"},
                {"rest": "lap"}
            ]},
            {"repeat(3)": [
                {"Incline Dumbbell Bench Press": "lap | 8 reps"},
                {"Dumbbell Power Clean and Jerk": "lap | 6 reps"},
                {"Dumbbell Bulgarian Split Squat": "10 reps"},
                {"rest": "lap"}
            ]},
            {"repeat(3)": [
                {"Bar Good Morning": "12 reps"},
                {"TRX Inverted Row": "12 reps"},
                {"rest": "lap"}
            ]},
            {"repeat(3)": [
                {"Medicine Ball Slam": "lap | Kneeling x 8"},
                {"Ski Moguls": "200m"},
                {"Pike Push-up": "8 reps"},
                {"rest": "lap"}
            ]}
        ]
        
        json_result = createWorkoutJson("fullhyroxweek5", steps)
        workout_dict = json.loads(json_result)
        
        assert workout_dict['workoutName'] == 'fullhyroxweek5'
        assert workout_dict['sportType']['sportTypeKey'] == 'strength_training'
        
        workout_steps = workout_dict['workoutSegments'][0]['workoutSteps']
        
        # Check warmup
        assert workout_steps[0]['stepType']['stepTypeKey'] == 'warmup'
        assert workout_steps[0]['category'] == 'CARDIO'
        
        # Check all 4 repeats exist
        assert len([s for s in workout_steps if s.get('stepType', {}).get('stepTypeKey') == 'repeat']) == 4
        
        # Check first repeat (superset 1)
        repeat1 = workout_steps[1]
        assert repeat1['numberOfIterations'] == 3
        assert repeat1['workoutSteps'][0]['exerciseName'] == '_30_DEGREE_LAT_PULLDOWN'
        assert repeat1['workoutSteps'][0]['category'] == 'PULL_UP'
        assert repeat1['workoutSteps'][1]['exerciseName'] == 'GOBLET_SQUAT'
        assert repeat1['workoutSteps'][1]['category'] == 'SQUAT'
        
        # Check second repeat (superset 2)
        repeat2 = workout_steps[2]
        assert repeat2['workoutSteps'][0]['exerciseName'] == 'INCLINE_DUMBBELL_BENCH_PRESS'
        assert repeat2['workoutSteps'][0]['category'] == 'BENCH_PRESS'
        assert repeat2['workoutSteps'][1]['exerciseName'] == 'DUMBBELL_POWER_CLEAN_AND_JERK'
        assert repeat2['workoutSteps'][1]['category'] == 'OLYMPIC_LIFT'
        assert repeat2['workoutSteps'][2]['exerciseName'] == 'DUMBBELL_BULGARIAN_SPLIT_SQUAT'
        assert repeat2['workoutSteps'][2]['category'] == 'LUNGE'
        
        # Check third repeat (superset 3)
        repeat3 = workout_steps[3]
        assert repeat3['workoutSteps'][0]['exerciseName'] == 'BAR_GOOD_MORNING'
        assert repeat3['workoutSteps'][0]['category'] == 'LEG_CURL'
        assert repeat3['workoutSteps'][1]['exerciseName'] == 'TRX_INVERTED_ROW'
        assert repeat3['workoutSteps'][1]['category'] == 'ROW'
        
        # Check fourth repeat (superset 4)
        repeat4 = workout_steps[4]
        assert repeat4['workoutSteps'][0]['exerciseName'] == 'MEDICINE_BALL_SLAM'
        assert repeat4['workoutSteps'][0]['category'] == 'PLYO'
        assert repeat4['workoutSteps'][1]['exerciseName'] == 'SKI_MOGULS'
        assert repeat4['workoutSteps'][1]['category'] == 'CARDIO'
        assert repeat4['workoutSteps'][1]['endCondition']['conditionTypeKey'] == 'distance'
        assert repeat4['workoutSteps'][1]['endConditionValue'] == 200
        assert repeat4['workoutSteps'][2]['exerciseName'] == 'PIKE_PUSH_UP'
        assert repeat4['workoutSteps'][2]['category'] == 'PUSH_UP'


class TestWorkoutTypeDetection:
    """Test automatic workout type detection"""
    
    def test_detects_running_workout(self):
        steps = [
            {"warmup": "15min"},
            {"run": "5k"},
            {"cooldown": "15min"}
        ]
        
        json_result = createWorkoutJson("run_test", steps)
        workout_dict = json.loads(json_result)
        
        assert workout_dict['sportType']['sportTypeKey'] == 'running'
    
    def test_detects_strength_workout_by_exercise(self):
        steps = [
            {"warmup": [
                {"cardio": "lap"}
            ]},
            {"Goblet Squat": "10 reps"}
        ]
        
        json_result = createWorkoutJson("strength_test", steps)
        workout_dict = json.loads(json_result)
        
        assert workout_dict['sportType']['sportTypeKey'] == 'strength_training'
    
    def test_detects_strength_workout_by_keyword(self):
        steps = [
            {"cardio": "lap"},
            {"rest": "lap"}
        ]
        
        json_result = createWorkoutJson("strength_test", steps)
        workout_dict = json.loads(json_result)
        
        assert workout_dict['sportType']['sportTypeKey'] == 'strength_training'
    
    def test_create_hyrox_style_workout(self):
        """Test creating a HYROX-style workout with descriptions"""
        steps = [
            {"warmup": [
                {"cardio": "lap"}
            ]},
            {"repeat": [
                {"30-degree Lat Pull-down": "lap | Straight Arm Pull down x 10"},
                {"Goblet Squat": "lap | KB RDL Into Goblet Squat x10"},
                {"Kettlebell Floor to Shelf": "lap | KB Bottoms Up Press x8 each side"},
                {"rest": "lap"}
            ]}
        ]
        
        json_result = createWorkoutJson("hyrox_test", steps)
        workout_dict = json.loads(json_result)
        
        assert workout_dict['workoutName'] == 'hyrox_test'
        assert workout_dict['sportType']['sportTypeKey'] == 'strength_training'
        
        # Check warmup has CARDIO category
        warmup_step = workout_dict['workoutSegments'][0]['workoutSteps'][0]
        assert warmup_step['stepType']['stepTypeKey'] == 'warmup'
        assert warmup_step['category'] == 'CARDIO'
        
        # Check repeat has correct structure
        repeat_step = workout_dict['workoutSegments'][0]['workoutSteps'][1]
        assert repeat_step['stepType']['stepTypeKey'] == 'repeat'
        assert repeat_step['numberOfIterations'] == 1  # Default when not specified
        
        # Check first exercise in repeat
        first_exercise = repeat_step['workoutSteps'][0]
        assert first_exercise['stepType']['stepTypeKey'] == 'interval'
        assert first_exercise['exerciseName'] == '_30_DEGREE_LAT_PULLDOWN'
        assert first_exercise['category'] == 'PULL_UP'
        assert first_exercise['description'] == 'Straight Arm Pull down x 10'

