import pytest
from garmin_planner.model.workoutModel import WorkoutStep, RepeatStep, WorkoutSegment, WorkoutModel
from garmin_planner.constant import SportType, StepType, ConditionType, TargetType, DistanceUnit


class TestWorkoutStep:
    """Test WorkoutStep dataclass"""
    
    def test_create_workout_step_basic(self):
        step = WorkoutStep(
            stepId=1,
            stepOrder=1,
            stepType=StepType.WARMUP,
            endCondition=ConditionType.TIME,
            endConditionValue=900
        )
        
        assert step.stepId == 1
        assert step.stepOrder == 1
        assert step.stepType == StepType.WARMUP
        assert step.endCondition == ConditionType.TIME
        assert step.endConditionValue == 900
        assert step.type == "ExecutableStepDTO"
        assert step.childStepId is None
        assert step.category is None
        assert step.exerciseName is None
    
    def test_create_workout_step_with_exercise_info(self):
        step = WorkoutStep(
            stepId=2,
            stepOrder=2,
            stepType=StepType.INTERVAL,
            endCondition=ConditionType.REPS,
            endConditionValue=10,
            exerciseName="GOBLET_SQUAT",
            category="SQUAT",
            childStepId=1
        )
        
        assert step.exerciseName == "GOBLET_SQUAT"
        assert step.category == "SQUAT"
        assert step.childStepId == 1
    
    def test_create_workout_step_with_description(self):
        step = WorkoutStep(
            stepId=4,
            stepOrder=4,
            stepType=StepType.INTERVAL,
            endCondition=ConditionType.LAP_BUTTON,
            endConditionValue=1,
            exerciseName="GOBLET_SQUAT",
            category="SQUAT",
            description="KB RDL Into Goblet Squat x10"
        )
        
        assert step.exerciseName == "GOBLET_SQUAT"
        assert step.category == "SQUAT"
        assert step.description == "KB RDL Into Goblet Squat x10"
    
    def test_create_workout_step_with_target(self):
        step = WorkoutStep(
            stepId=3,
            stepOrder=3,
            stepType=StepType.WARMUP,
            endCondition=ConditionType.TIME,
            endConditionValue=900,
            targetType=TargetType.HEART_RATE_ZONE,
            zoneNumber=2
        )
        
        assert step.targetType == TargetType.HEART_RATE_ZONE
        assert step.zoneNumber == 2


class TestRepeatStep:
    """Test RepeatStep dataclass"""
    
    def test_create_repeat_step_basic(self):
        child_step = WorkoutStep(
            stepId=2,
            stepOrder=2,
            stepType=StepType.INTERVAL,
            endCondition=ConditionType.TIME,
            endConditionValue=30
        )
        
        repeat = RepeatStep(
            stepId=1,
            stepOrder=1,
            numberOfIterations=8,
            workoutSteps=[child_step]
        )
        
        assert repeat.stepId == 1
        assert repeat.stepOrder == 1
        assert repeat.numberOfIterations == 8
        assert len(repeat.workoutSteps) == 1
        assert repeat.stepType == StepType.REPEAT
        assert repeat.type == "RepeatGroupDTO"
        assert repeat.endCondition == ConditionType.ITERATION_ENDS
        assert repeat.smartRepeat is False
        assert repeat.skipLastRestStep is False
        assert repeat.childStepId == 1


class TestWorkoutSegment:
    """Test WorkoutSegment dataclass"""
    
    def test_create_workout_segment(self):
        step = WorkoutStep(
            stepId=1,
            stepOrder=1,
            stepType=StepType.WARMUP,
            endCondition=ConditionType.TIME,
            endConditionValue=900
        )
        
        segment = WorkoutSegment(
            segmentOrder=1,
            sportType=SportType.RUNNING,
            workoutSteps=[step]
        )
        
        assert segment.segmentOrder == 1
        assert segment.sportType == SportType.RUNNING
        assert len(segment.workoutSteps) == 1
    
    def test_create_workout_segment_with_repeat(self):
        child_step = WorkoutStep(
            stepId=2,
            stepOrder=2,
            stepType=StepType.INTERVAL,
            endCondition=ConditionType.TIME,
            endConditionValue=30
        )
        
        repeat = RepeatStep(
            stepId=1,
            stepOrder=1,
            numberOfIterations=3,
            workoutSteps=[child_step]
        )
        
        segment = WorkoutSegment(
            segmentOrder=1,
            sportType=SportType.STRENGTH,
            workoutSteps=[repeat]
        )
        
        assert segment.sportType == SportType.STRENGTH
        assert len(segment.workoutSteps) == 1
        assert isinstance(segment.workoutSteps[0], RepeatStep)


class TestWorkoutModel:
    """Test WorkoutModel dataclass"""
    
    def test_create_running_workout_model(self):
        step = WorkoutStep(
            stepId=1,
            stepOrder=1,
            stepType=StepType.WARMUP,
            endCondition=ConditionType.TIME,
            endConditionValue=900
        )
        
        segment = WorkoutSegment(
            segmentOrder=1,
            sportType=SportType.RUNNING,
            workoutSteps=[step]
        )
        
        workout = WorkoutModel(
            workoutName="test_run",
            sportType=SportType.RUNNING,
            subSportType=None,
            workoutSegments=[segment],
            avgTrainingSpeed=0.0,
            estimatedDistanceUnit=None,
            estimatedDurationInSecs=None,
            estimatedDistanceInMeters=None,
            estimateType=None
        )
        
        assert workout.workoutName == "test_run"
        assert workout.sportType == SportType.RUNNING
        assert len(workout.workoutSegments) == 1
    
    def test_create_strength_workout_model(self):
        step = WorkoutStep(
            stepId=1,
            stepOrder=1,
            stepType=StepType.INTERVAL,
            endCondition=ConditionType.REPS,
            endConditionValue=10,
            exerciseName="GOBLET_SQUAT",
            category="SQUAT"
        )
        
        segment = WorkoutSegment(
            segmentOrder=1,
            sportType=SportType.STRENGTH,
            workoutSteps=[step]
        )
        
        workout = WorkoutModel(
            workoutName="strength_test",
            sportType=SportType.STRENGTH,
            subSportType=None,
            workoutSegments=[segment],
            avgTrainingSpeed=0.0,
            estimatedDistanceUnit=None,
            estimatedDurationInSecs=None,
            estimatedDistanceInMeters=None,
            estimateType=None
        )
        
        assert workout.workoutName == "strength_test"
        assert workout.sportType == SportType.STRENGTH
        assert workout.workoutSegments[0].workoutSteps[0].exerciseName == "GOBLET_SQUAT"

