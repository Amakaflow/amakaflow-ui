from enum import Enum

# A constant used to convert pace to certain value recognized by Garmin Connect
PACE_CONST = 16.66666

DATE_FORMAT = "%Y-%m-%d"

# Workout data 
class SportType(Enum):
    RUNNING = {
      "sportTypeId": 1,
      "sportTypeKey": "running",
      "displayOrder": 1
    }
    STRENGTH = {
      "sportTypeId": 5,
      "sportTypeKey": "strength_training",
      "displayOrder": 5
    }
    HIIT = {
      "sportTypeId": 9,
      "sportTypeKey": "hiit",
      "displayOrder": 7
    }

    def to_dict(self):
        return self.value


class DistanceUnit(Enum):
    KILOMETER = {
      "unitKey": "kilometer"
    }
    MILE = {
      "unitKey": "mile"
    }

    def to_dict(self):
        return self.value

class StepType(Enum):
    WARMUP = {
        "stepTypeId": 1,
        "stepTypeKey": "warmup",
        "displayOrder": 1
    }
    COOLDOWN = {
        "stepTypeId": 2,
        "stepTypeKey": "cooldown",
        "displayOrder": 2
    }
    INTERVAL = {
        "stepTypeId": 3,
        "stepTypeKey": "interval",
        "displayOrder": 3
    }
    RECOVERY = {
        "stepTypeId": 4,
        "stepTypeKey": "recovery",
        "displayOrder": 4
    }
    REPEAT = {
        "stepTypeId": 6,
        "stepTypeKey": "repeat",
        "displayOrder": 6
    }
    EXERCISE = {
        "stepTypeId": 7,
        "stepTypeKey": "exercise",
        "displayOrder": 7
    }
    REST = {
        "stepTypeId": 5,
        "stepTypeKey": "rest",
        "displayOrder": 5
    }
    CARDIO = {
        "stepTypeId": 9,
        "stepTypeKey": "cardio",
        "displayOrder": 9
    }

    def to_dict(self):
        return self.value


class ConditionType(Enum):
    LAP_BUTTON = {
        "conditionTypeId": 1,
        "conditionTypeKey": "lap.button",
        "displayOrder": 1,
        "displayable": True
    }
    TIME = {
        "conditionTypeId": 2,
        "conditionTypeKey": "time",
        "displayOrder": 2,
        "displayable": True
    }
    DISTANCE = {
        "conditionTypeId": 3,
        "conditionTypeKey": "distance",
        "displayOrder": 3,
        "displayable": True
    }
    ITERATION_ENDS = {
        "conditionTypeId": 7,
        "conditionTypeKey": "iterations",
        "displayOrder": 7,
        "displayable": False
    }
    REPS = {
        "conditionTypeId": 10,
        "conditionTypeKey": "reps",
        "displayOrder": 10,
        "displayable": True
    }

    def to_dict(self):
        return self.value


class TargetType(Enum):
    NO_TARGET = {
        "workoutTargetTypeId": 1,
        "workoutTargetTypeKey": "no.target",
        "displayOrder": 1
    }
    # This need targetValueOne, Two
    PACE = {
        "workoutTargetTypeId": 6,
        "workoutTargetTypeKey": "pace.zone",
        "displayOrder": 6
    }
    HEART_RATE_ZONE = {
        "workoutTargetTypeId": 4,
        "workoutTargetTypeKey": "heart.rate.zone",
        "displayOrder": 4
    }

    def to_dict(self):
        return self.value