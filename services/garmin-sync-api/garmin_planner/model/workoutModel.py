from garmin_planner.constant import SportType, DistanceUnit, StepType, ConditionType, TargetType
from dataclasses import dataclass
from typing import Optional, List, Union

@dataclass
class WorkoutStep:
    stepId: int
    stepOrder: int
    stepType: StepType
    endCondition: ConditionType
    endConditionValue: int
    preferredEndConditionUnit: Optional[DistanceUnit] = None # this when end con is distance
    type: str = "ExecutableStepDTO"
    targetType: Optional[TargetType] = None
    targetValueOne: Optional[float] = None # when its custom
    targetValueTwo: Optional[float] = None # when its custom
    zoneNumber: Optional[int] = None # This needed when target = zone based
    targetValueUnit: Optional[str] = None
    stepAudioNote: Optional[str] = None
    childStepId: Optional[int] = None  # Needed for exercises within repeats
    category: Optional[str] = None  # Exercise category (e.g., "SQUAT", "CARDIO")
    exerciseName: Optional[str] = None  # Exercise name (e.g., "GOBLET_SQUAT")
    description: Optional[str] = None  # Exercise description/notes

@dataclass
class RepeatStep:
    stepId: int
    stepOrder: int
    workoutSteps: List[WorkoutStep] # can be nested repeat
    numberOfIterations: Optional[int] = None  # None for time-based repeats
    stepType: StepType = StepType.REPEAT
    smartRepeat: bool = False
    childStepId: int = 1 # havent figure out this, it seems all its child step need this
    type: str = "RepeatGroupDTO"
    skipLastRestStep: bool = False
    endCondition: ConditionType = ConditionType.ITERATION_ENDS
    endConditionValue: Optional[int] = None  # For time-based repeats (in seconds)

@dataclass
class WorkoutSegment:
    segmentOrder: int
    sportType: SportType 
    workoutSteps: List[WorkoutStep | RepeatStep]

@dataclass
class WorkoutModel:
    workoutName: str
    sportType: SportType
    subSportType: Optional[str]
    workoutSegments: List[WorkoutSegment]
    avgTrainingSpeed: float
    estimatedDistanceUnit: Optional[DistanceUnit]
    estimatedDurationInSecs: Optional[int]
    estimatedDistanceInMeters: Optional[float]
    estimateType: Optional[str]