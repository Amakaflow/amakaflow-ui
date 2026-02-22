"""Workout matching use case for auto-detection.

Part of AMA-688: Matches wearable-detected exercises against scheduled workouts.

Scoring formula:
- schedule_proximity * 0.35 + exercise_overlap * 0.45 + sport_match * 0.20
- schedule_proximity: 1.0 if within 1h, linear decay to 0.0 at 3h
- exercise_overlap: Jaccard similarity — len(detected ∩ program) / len(detected ∪ program)
- sport_match: 1.0 if sport matches, else 0.0

Returns match if score > 0.85, otherwise returns no-match with reason code.
"""

from datetime import datetime, timedelta
from typing import Optional

from api.schemas.detection import DetectionRequest, DetectionMatch, ScheduledWorkout


# Mock repository for scheduled workouts (in production, would call mapper-api)
class ScheduledWorkoutRepository:
    """Repository for querying scheduled workouts.
    
    In production, this would call the mapper-api to fetch scheduled workouts.
    For testing, we use an in-memory store.
    """
    
    def __init__(self):
        self._workouts: list[ScheduledWorkout] = []
    
    def add_workout(self, workout: ScheduledWorkout):
        """Add a workout to the repository (for testing)."""
        self._workouts.append(workout)
    
    def clear(self):
        """Clear all workouts (for testing)."""
        self._workouts.clear()
    
    async def get_scheduled_workouts(
        self, 
        user_id: str, 
        timestamp: datetime,
        window_hours: int = 2
    ) -> list[ScheduledWorkout]:
        """Get workouts scheduled within the specified window around timestamp."""
        window_start = timestamp - timedelta(hours=window_hours)
        window_end = timestamp + timedelta(hours=window_hours)
        
        return [
            w for w in self._workouts
            if w.scheduled_time >= window_start 
            and w.scheduled_time <= window_end
            and w.sport != ""  # Exclude placeholder/empty workouts
        ]


# Global repository instance
_workout_repo = ScheduledWorkoutRepository()


def get_scheduled_workout_repository() -> ScheduledWorkoutRepository:
    """Get the global workout repository instance."""
    return _workout_repo


def calculate_schedule_proximity(
    detected_time: datetime, 
    scheduled_time: datetime
) -> float:
    """Calculate schedule proximity score.
    
    1.0 if within 1h, linear decay to 0.0 at 3h.
    """
    diff_hours = abs((detected_time - scheduled_time).total_seconds()) / 3600
    
    if diff_hours <= 1.0:
        return 1.0
    elif diff_hours >= 3.0:
        return 0.0
    else:
        # Linear decay from 1.0 to 0.0 between 1h and 3h
        return 1.0 - (diff_hours - 1.0) / 2.0


def calculate_exercise_overlap(
    detected_exercises: list[str],
    program_exercises: list[str]
) -> float:
    """Calculate Jaccard similarity between detected and program exercises.
    
    Jaccard = len(intersection) / len(union)
    """
    if not detected_exercises or not program_exercises:
        return 0.0
    
    detected_set = set(e.lower() for e in detected_exercises)
    program_set = set(e.lower() for e in program_exercises)
    
    intersection = len(detected_set & program_set)
    union = len(detected_set | program_set)
    
    if union == 0:
        return 0.0
    
    return intersection / union


def calculate_sport_match(detected_sport: str, workout_sport: str) -> float:
    """Calculate sport match score.
    
    1.0 if sports match, 0.0 otherwise.
    """
    if not detected_sport or not workout_sport:
        return 0.0
    
    return 1.0 if detected_sport.lower() == workout_sport.lower() else 0.0


def calculate_match_score(
    detected_time: datetime,
    scheduled_time: datetime,
    detected_exercises: list[str],
    program_exercises: list[str],
    detected_sport: str,
    workout_sport: str
) -> float:
    """Calculate overall match score using weighted formula."""
    schedule_proximity = calculate_schedule_proximity(detected_time, scheduled_time)
    exercise_overlap = calculate_exercise_overlap(detected_exercises, program_exercises)
    sport_match = calculate_sport_match(detected_sport, workout_sport)
    
    # Weighted formula: schedule_proximity * 0.35 + exercise_overlap * 0.45 + sport_match * 0.20
    score = (schedule_proximity * 0.35) + (exercise_overlap * 0.45) + (sport_match * 0.20)
    
    return score


async def match_workout(
    request: DetectionRequest,
    repo: Optional[ScheduledWorkoutRepository] = None
) -> DetectionMatch:
    """Match detected exercises against scheduled workouts.
    
    Args:
        request: The detection request from the wearable device
        repo: Optional repository instance (uses global if not provided)
    
    Returns:
        DetectionMatch with match result and details
    """
    if repo is None:
        repo = get_scheduled_workout_repository()
    
    # Query scheduled workouts within ±2h window
    scheduled_workouts = await repo.get_scheduled_workouts(
        user_id=request.user_id,
        timestamp=request.timestamp,
        window_hours=2
    )
    
    # No scheduled workouts in window
    if not scheduled_workouts:
        return DetectionMatch(
            matched=False,
            reason="no_scheduled_workout"
        )
    
    # Score each workout
    best_match = None
    best_score = 0.0
    
    for workout in scheduled_workouts:
        score = calculate_match_score(
            detected_time=request.timestamp,
            scheduled_time=workout.scheduled_time,
            detected_exercises=request.detected_exercises,
            program_exercises=workout.exercises,
            detected_sport=request.sport,
            workout_sport=workout.sport
        )
        
        if score > best_score:
            best_score = score
            best_match = workout
    
    # Return best match if score > 0.85
    if best_match and best_score > 0.85:
        return DetectionMatch(
            matched=True,
            workout_id=best_match.id,
            workout_name=best_match.name,
            confidence=round(best_score, 3)
        )
    
    # No match found
    if best_match is None:
        return DetectionMatch(
            matched=False,
            reason="no_scheduled_workout"
        )
    
    # Determine the reason for no match
    sport_match = calculate_sport_match(request.sport, best_match.sport)
    if sport_match == 0.0:
        return DetectionMatch(
            matched=False,
            reason="sport_mismatch"
        )
    else:
        return DetectionMatch(
            matched=False,
            reason="low_confidence",
            confidence=round(best_score, 3)
        )
