import pytest
from garmin_planner.constant import SportType, StepType, ConditionType, TargetType, DistanceUnit


class TestSportType:
    """Test SportType enum"""
    
    def test_running_sport_type(self):
        running = SportType.RUNNING
        assert running.value['sportTypeId'] == 1
        assert running.value['sportTypeKey'] == 'running'
        assert running.value['displayOrder'] == 1
    
    def test_strength_sport_type(self):
        strength = SportType.STRENGTH
        assert strength.value['sportTypeId'] == 5
        assert strength.value['sportTypeKey'] == 'strength_training'
        assert strength.value['displayOrder'] == 5
    
    def test_to_dict_method(self):
        running = SportType.RUNNING
        result = running.to_dict()
        assert result == running.value


class TestStepType:
    """Test StepType enum"""
    
    def test_warmup_step(self):
        warmup = StepType.WARMUP
        assert warmup.value['stepTypeId'] == 1
        assert warmup.value['stepTypeKey'] == 'warmup'
    
    def test_interval_step(self):
        interval = StepType.INTERVAL
        assert interval.value['stepTypeId'] == 3
        assert interval.value['stepTypeKey'] == 'interval'
    
    def test_rest_step(self):
        rest = StepType.REST
        assert rest.value['stepTypeId'] == 5
        assert rest.value['stepTypeKey'] == 'rest'
    
    def test_exercise_step(self):
        exercise = StepType.EXERCISE
        assert exercise.value['stepTypeId'] == 7
        assert exercise.value['stepTypeKey'] == 'exercise'
    
    def test_cardio_step(self):
        cardio = StepType.CARDIO
        assert cardio.value['stepTypeId'] == 9
        assert cardio.value['stepTypeKey'] == 'cardio'
    
    def test_repeat_step(self):
        repeat = StepType.REPEAT
        assert repeat.value['stepTypeId'] == 6
        assert repeat.value['stepTypeKey'] == 'repeat'


class TestConditionType:
    """Test ConditionType enum"""
    
    def test_lap_button_condition(self):
        lap_button = ConditionType.LAP_BUTTON
        assert lap_button.value['conditionTypeId'] == 1
        assert lap_button.value['conditionTypeKey'] == 'lap.button'
        assert lap_button.value['displayable'] is True
    
    def test_time_condition(self):
        time = ConditionType.TIME
        assert time.value['conditionTypeId'] == 2
        assert time.value['conditionTypeKey'] == 'time'
    
    def test_distance_condition(self):
        distance = ConditionType.DISTANCE
        assert distance.value['conditionTypeId'] == 3
        assert distance.value['conditionTypeKey'] == 'distance'
    
    def test_reps_condition(self):
        reps = ConditionType.REPS
        assert reps.value['conditionTypeId'] == 10
        assert reps.value['conditionTypeKey'] == 'reps'
        assert reps.value['displayable'] is True
    
    def test_iteration_ends_condition(self):
        iteration = ConditionType.ITERATION_ENDS
        assert iteration.value['conditionTypeId'] == 7
        assert iteration.value['conditionTypeKey'] == 'iterations'
        assert iteration.value['displayable'] is False


class TestTargetType:
    """Test TargetType enum"""
    
    def test_no_target(self):
        no_target = TargetType.NO_TARGET
        assert no_target.value['workoutTargetTypeId'] == 1
        assert no_target.value['workoutTargetTypeKey'] == 'no.target'
    
    def test_pace_target(self):
        pace = TargetType.PACE
        assert pace.value['workoutTargetTypeId'] == 6
        assert pace.value['workoutTargetTypeKey'] == 'pace.zone'
    
    def test_heart_rate_zone_target(self):
        hr_zone = TargetType.HEART_RATE_ZONE
        assert hr_zone.value['workoutTargetTypeId'] == 4
        assert hr_zone.value['workoutTargetTypeKey'] == 'heart.rate.zone'


class TestDistanceUnit:
    """Test DistanceUnit enum"""
    
    def test_kilometer_unit(self):
        km = DistanceUnit.KILOMETER
        assert km.value['unitKey'] == 'kilometer'
    
    def test_mile_unit(self):
        mile = DistanceUnit.MILE
        assert isinstance(mile.value, dict)
        assert mile.value['unitKey'] == 'mile'

