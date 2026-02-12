"""Automated workout quality scoring against a rubric.

Scores generated workouts on: exercise count, variety, volume sanity,
equipment match, and hallucination detection. Runs sync, logs scores,
does not block the user pipeline.

Part of AMA-567 Phase F.
"""

import logging
import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# Thresholds
MIN_EXERCISES = 3
MAX_EXERCISES = 20
SANE_REP_MIN = 1
SANE_REP_MAX = 100
SANE_SET_MIN = 1
SANE_SET_MAX = 20
MAX_EXERCISE_NAME_WORDS = 6
MAX_WORD_LENGTH = 12  # Real exercise words rarely exceed this

# Common words found in legitimate exercise names.  Not exhaustive, but gives
# a baseline for a "looks real" check.  Words not in this set *and* longer than
# a threshold get flagged.
_KNOWN_EXERCISE_WORDS: set[str] = {
    # movements
    "press", "push", "pull", "row", "curl", "raise", "fly", "flye",
    "extension", "flexion", "rotation", "crunch", "sit", "plank",
    "squat", "lunge", "deadlift", "clean", "snatch", "jerk", "swing",
    "thruster", "burpee", "dip", "step", "jump", "hop", "walk",
    "sprint", "run", "climb", "hold", "hang", "shrug", "twist",
    "rollout", "kickback", "pushdown", "pullover", "pulldown",
    "hyperextension", "glute", "hip", "bridge", "thrust",
    # body parts
    "chest", "back", "shoulder", "arm", "leg", "calf", "calves",
    "bicep", "biceps", "tricep", "triceps", "quad", "quads",
    "hamstring", "hamstrings", "ab", "abs", "core", "forearm",
    "wrist", "neck", "trap", "traps", "lat", "lats", "delt", "delts",
    "pec", "pecs", "glutes", "oblique", "obliques",
    # equipment/modifiers
    "barbell", "dumbbell", "kettlebell", "cable", "machine", "smith",
    "band", "resistance", "bodyweight", "bench", "incline", "decline",
    "flat", "seated", "standing", "lying", "overhead", "front",
    "rear", "lateral", "reverse", "wide", "narrow", "close", "grip",
    "single", "double", "alternate", "alternating", "weighted",
    "assisted", "deficit", "pause", "tempo", "explosive",
    # common exercise names
    "pushup", "push-up", "push-ups", "pullup", "pull-up", "pull-ups",
    "chin-up", "chin-ups", "sit-up", "sit-ups", "up", "ups", "down",
    "over", "out", "in", "box", "ball", "swiss", "stability",
    "foam", "roller", "wall", "floor", "ring", "bar", "ez",
    "t-bar", "hack", "leg", "calf", "pec", "cable", "face",
    "skull", "crusher", "crushers", "skullcrusher",
}


@dataclass
class QualityScore:
    """Composite quality score for a generated workout."""

    exercise_count: float = 0.0  # 0-1: meets min/max
    variety: float = 0.0  # 0-1: unique exercises / total
    volume_sanity: float = 0.0  # 0-1: reps and sets in sane ranges
    equipment_match: float = 0.0  # 0-1: exercises use requested equipment
    hallucination: float = 0.0  # 0-1: exercise names look real
    issues: List[str] = field(default_factory=list)

    @property
    def overall(self) -> float:
        """Weighted average: count(20%) + variety(20%) + volume(25%) + equip(15%) + hallucination(20%)."""
        return (
            self.exercise_count * 0.20
            + self.variety * 0.20
            + self.volume_sanity * 0.25
            + self.equipment_match * 0.15
            + self.hallucination * 0.20
        )


class WorkoutQualityEvaluator:
    """Score a workout dict against quality rubric."""

    def evaluate(
        self,
        workout: Dict[str, Any],
        requested_equipment: Optional[List[str]] = None,
    ) -> QualityScore:
        exercises = workout.get("exercises", [])
        score = QualityScore()

        # Exercise count
        n = len(exercises)
        if n == 0:
            score.exercise_count = 0.0
            score.issues.append("No exercises in workout")
        elif n < MIN_EXERCISES:
            score.exercise_count = n / MIN_EXERCISES
            score.issues.append(f"Only {n} exercises (minimum {MIN_EXERCISES})")
        elif n > MAX_EXERCISES:
            score.exercise_count = MAX_EXERCISES / n
            score.issues.append(f"{n} exercises exceeds maximum {MAX_EXERCISES}")
        else:
            score.exercise_count = 1.0

        # Variety (unique names / total)
        if n > 0:
            names = [e.get("name", "").lower().strip() for e in exercises]
            unique = len(set(names))
            score.variety = unique / n
            if unique < n:
                dupes = n - unique
                score.issues.append(f"{dupes} duplicate exercise(s)")
        else:
            score.variety = 0.0

        # Volume sanity
        if n > 0:
            sane = 0
            for ex in exercises:
                reps = ex.get("reps")
                sets = ex.get("sets")
                ok = True
                if isinstance(reps, (int, float)) and not (SANE_REP_MIN <= reps <= SANE_REP_MAX):
                    score.issues.append(
                        f"'{ex.get('name', '?')}' has {reps} reps (expected {SANE_REP_MIN}-{SANE_REP_MAX})"
                    )
                    ok = False
                if isinstance(sets, (int, float)) and not (SANE_SET_MIN <= sets <= SANE_SET_MAX):
                    score.issues.append(
                        f"'{ex.get('name', '?')}' has {sets} sets (expected {SANE_SET_MIN}-{SANE_SET_MAX})"
                    )
                    ok = False
                if ok:
                    sane += 1
            score.volume_sanity = sane / n
        else:
            score.volume_sanity = 0.0

        # Equipment match
        if requested_equipment and n > 0:
            req_set = {e.lower() for e in requested_equipment}
            matched = 0
            for ex in exercises:
                eq = (ex.get("equipment") or "").lower()
                if not eq or eq in req_set:
                    matched += 1
                else:
                    score.issues.append(
                        f"'{ex.get('name', '?')}' uses '{eq}' (not in requested equipment)"
                    )
            score.equipment_match = matched / n
        else:
            score.equipment_match = 1.0  # No equipment constraint

        # Hallucination detection (heuristic)
        if n > 0:
            real_looking = 0
            for ex in exercises:
                name = ex.get("name", "")
                words = name.split()
                flagged = False

                if len(words) > MAX_EXERCISE_NAME_WORDS:
                    score.issues.append(f"'{name}' looks hallucinated (too many words)")
                    flagged = True
                elif re.search(r"[^a-zA-Z0-9\s\-/()']", name):
                    score.issues.append(f"'{name}' contains unusual characters")
                    flagged = True
                else:
                    # Check how many words are recognised exercise vocabulary
                    lower_words = [w.lower().strip("-") for w in words]
                    unknown = [
                        w for w in lower_words
                        if w not in _KNOWN_EXERCISE_WORDS and len(w) > 3
                    ]
                    # Also flag words that are unusually long (scientific jargon)
                    long_words = [w for w in lower_words if len(w) > MAX_WORD_LENGTH]

                    if long_words:
                        score.issues.append(
                            f"'{name}' looks hallucinated (unusually long words)"
                        )
                        flagged = True
                    elif len(unknown) >= 2:
                        score.issues.append(
                            f"'{name}' looks hallucinated (unrecognised terms)"
                        )
                        flagged = True

                if not flagged:
                    real_looking += 1

            score.hallucination = real_looking / n
        else:
            score.hallucination = 0.0

        return score
