"""Rule-based spaCy NER pipeline for workout entity extraction.

Phase 1 of AMA-578 (spaCy NER for workout extraction).
Builds a rule-based NER pipeline using spaCy EntityRuler plus regex
to extract structured workout data from unstructured text.

Target: 80% accuracy on structured workout text.
Entity labels: EXERCISE, SETS, REPS, REST, DURATION, LOAD
"""

import logging
import re
from dataclasses import dataclass
from functools import lru_cache
from typing import Dict, List, Optional, Tuple

import spacy
from spacy.language import Language
from spacy.tokens import Doc

logger = logging.getLogger(__name__)

# Maximum text length to prevent DoS via memory exhaustion
MAX_TEXT_LENGTH = 10000


# =============================================================================
# Exercise Patterns (50+ exercises across categories)
# =============================================================================

# Bodyweight exercises
BW_EXERCISES = [
    "push-up", "pushup", "push ups", "pushups",
    "pull-up", "pullup", "pull ups", "pullups",
    "chin-up", "chinup", "chin ups", "chinups",
    "dip", "dips",
    "burpee", "burpees",
    "squat", "squats",
    "lunge", "lunges",
    "plank", "planks",
    "crunch", "crunches",
    "sit-up", "situp", "sit ups", "situps",
    "mountain climber", "mountain climbers",
    "jumping jack", "jumping jacks",
    "box jump", "box jumps",
    "pike push-up", "pike pushup",
    "handstand push-up", "handstand pushup",
    "leg raise", "leg raises",
    "hollow hold",
    "v-up", "vups",
    "bicycle crunch", "bicycle crunches",
    "russian twist",
    "flutter kick", "flutter kicks",
    "dead bug", "dead bugs",
]

# Barbell exercises
BARBELL_EXERCISES = [
    "barbell bench press",
    "barbell squat",
    "barbell deadlift",
    "barbell row",
    "barbell curl",
    "barbell press",
    "barbell overhead press",
    "barbell shoulder press",
    "barbell thruster",
    "barbell front squat",
    "barbell rdl", "barbell romanian deadlift",
    "barbell curl",
    "barbell skull crusher",
    "barbell tricep extension",
    "barbell shrug", "barbell shrugs",
    "barbell lunge",
    "barbell step-up", "barbell step up",
]

# Dumbbell exercises
DUMBBELL_EXERCISES = [
    "dumbbell bench press",
    "dumbbell squat",
    "dumbbell row",
    "dumbbell curl",
    "dumbbell press",
    "dumbbell overhead press",
    "dumbbell shoulder press",
    "dumbbell fly", "dumbbell flye",
    "dumbbell raise",
    "lateral raise",
    "front raise",
    "rear delt fly",
    "dumbbell lunge",
    "dumbbell step-up", "dumbbell step up",
    "dumbbell thruster",
    "dumbbell skull crusher",
    "dumbbell tricep extension",
    "dumbbell shrug", "dumbbell shrugs",
    "dumbbell crunch",
    "dumbbell deadlift",
]

# CrossFit/Hyrox exercises
CROSSFIT_EXERCISES = [
    "wall ball", "wall balls",
    "box jump",
    "burpee",
    "double under", "double unders",
    "single under", "single unders",
    "pull-up", "pullup",
    "chest-to-bar", "chest to bar",
    "bar muscle-up", "bar muscle up",
    "ring muscle-up", "ring muscle up",
    "toes-to-bar", "toes to bar",
    "kipping pull-up", "kipping pullup",
    "kipping dip",
    "thruster", "thrusters",
    "clean", "cleans",
    "snatch", "snatches",
    "deadlift", "deadlifts",
    "front squat",
    "back squat",
    "hang squat clean",
    "power clean",
    "power snatch",
    "sprint", "sprints",
]

# Cardio exercises
CARDIO_EXERCISES = [
    "run", "running",
    "jog", "jogging",
    "walk", "walking",
    "bike", "biking", "cycling",
    "row", "rowing",
    "swim", "swimming",
    "elliptical",
    "stair climber", "stair climbing",
    "treadmill",
    "jump rope", "jump roping",
    "sprint", "sprinting",
]

# Cable/Machine exercises
CABLE_EXERCISES = [
    "cable curl",
    "cable tricep pushdown",
    "cable fly", "cable flye",
    "cable row",
    "cable lat pulldown",
    "cable face pull",
    "cable lateral raise",
    "cable crossover",
    "cable crunch",
    "machine press",
    "machine squat",
    "machine leg press",
    "machine leg curl",
    "machine leg extension",
    "machine chest press",
    "machine fly",
    "machine row",
    "smith machine squat",
    "smith machine bench press",
]


# =============================================================================
# Modifier patterns
# =============================================================================

MODIFIERS = [
    "weighted",
    "strict",
    "kipping",
    "banded",
    "decline",
    "incline",
    "close grip",
    "wide grip",
    "narrow grip",
    "neutral grip",
    "overhand",
    "underhand",
    "alternating",
    "single arm",
    "single leg",
    "double",
]


# =============================================================================
# All exercises combined (for pattern matching)
# =============================================================================

ALL_EXERCISES = (
    BW_EXERCISES
    + BARBELL_EXERCISES
    + DUMBBELL_EXERCISES
    + CROSSFIT_EXERCISES
    + CARDIO_EXERCISES
    + CABLE_EXERCISES
)


# =============================================================================
# Data classes for extracted entities
# =============================================================================


@dataclass
class WorkoutEntity:
    """Represents a single extracted workout entity."""
    label: str
    text: str
    start: int
    end: int


@dataclass
class ExtractedWorkout:
    """Represents all extracted workout entities from text."""
    exercises: List[WorkoutEntity]
    sets: List[WorkoutEntity]
    reps: List[WorkoutEntity]
    rest: List[WorkoutEntity]
    duration: List[WorkoutEntity]
    load: List[WorkoutEntity]


# =============================================================================
# Helper functions
# =============================================================================


def _build_exercise_patterns() -> List[Dict[str, str]]:
    """Build exercise patterns for EntityRuler."""
    patterns = []
    for exercise in ALL_EXERCISES:
        patterns.append({"label": "EXERCISE", "pattern": exercise})
    # Add modifier patterns as EXERCISE (they modify existing exercises)
    for modifier in MODIFIERS:
        patterns.append({"label": "EXERCISE", "pattern": modifier})
    return patterns


def _build_numeric_patterns() -> List[Dict[str, str]]:
    """Build numeric patterns for SETS, REPS, REST, DURATION."""
    patterns = []

    # Sets patterns (e.g., "3 sets", "4x", "4 sets of", "4 rounds")
    sets_patterns = [
        {"label": "SETS", "pattern": [{"SHAPE": "d"}]},
        {"label": "SETS", "pattern": [{"TEXT": {"REGEX": r"^\d+x$"}}]},
        {"label": "SETS", "pattern": "set"},
        {"label": "SETS", "pattern": "sets"},
        {"label": "SETS", "pattern": "round"},
        {"label": "SETS", "pattern": "rounds"},
        {"label": "SETS", "pattern": "circuit"},
        {"label": "SETS", "pattern": "circuits"},
    ]

    # Reps patterns (e.g., "10 reps", "10", "reps")
    reps_patterns = [
        {"label": "REPS", "pattern": [{"SHAPE": "d"}]},
        {"label": "REPS", "pattern": "rep"},
        {"label": "REPS", "pattern": "reps"},
        {"label": "REPS", "pattern": "repetitions"},
    ]

    # Rest patterns (e.g., "60 seconds rest", "1 minute rest", "rest 90s")
    rest_patterns = [
        {"label": "REST", "pattern": "rest"},
        {"label": "REST", "pattern": "break"},
        {"label": "REST", "pattern": "pause"},
    ]

    # Duration patterns (e.g., "30 seconds", "1 minute", "45s")
    duration_patterns = [
        {"label": "DURATION", "pattern": "second"},
        {"label": "DURATION", "pattern": "seconds"},
        {"label": "DURATION", "pattern": "minute"},
        {"label": "DURATION", "pattern": "minutes"},
        {"label": "DURATION", "pattern": "min"},
        {"label": "DURATION", "pattern": "mins"},
        {"label": "DURATION", "pattern": "sec"},
        {"label": "DURATION", "pattern": "secs"},
        {"label": "DURATION", "pattern": "s"},
    ]

    # Load patterns (e.g., "100 lbs", "50 kg", "bodyweight")
    load_patterns = [
        {"label": "LOAD", "pattern": "pound"},
        {"label": "LOAD", "pattern": "pounds"},
        {"label": "LOAD", "pattern": "lb"},
        {"label": "LOAD", "pattern": "lbs"},
        {"label": "LOAD", "pattern": "kilogram"},
        {"label": "LOAD", "pattern": "kilograms"},
        {"label": "LOAD", "pattern": "kg"},
        {"label": "LOAD", "pattern": "bodyweight"},
        {"label": "LOAD", "pattern": "BW"},
    ]

    return sets_patterns + reps_patterns + rest_patterns + duration_patterns + load_patterns


# =============================================================================
# Main NER functions
# =============================================================================


@lru_cache(maxsize=1)
def build_workout_nlp() -> Language:
    """Build the spaCy NLP pipeline with EntityRuler for workout extraction.

    This function is cached to avoid reloading the spaCy model on every call.
    Loading spaCy models is expensive (1-2 seconds).

    Returns:
        A spaCy Language pipeline with EntityRuler before NER.
    """
    # Load blank English model or small model
    try:
        nlp = spacy.load("en_core_web_sm")
    except OSError:
        logger.warning("en_core_web_sm not found, using blank English model")
        nlp = spacy.blank("en")

    # Create EntityRuler with exercise patterns
    ruler = nlp.add_pipe("entity_ruler", before="ner")
    ruler.add_patterns(_build_exercise_patterns())
    ruler.add_patterns(_build_numeric_patterns())

    return nlp


def extract_entities(text: str, nlp: Optional[Language] = None) -> ExtractedWorkout:
    """Extract workout entities from text using spaCy NER pipeline.

    Args:
        text: The input text to extract entities from.
        nlp: Optional spaCy NLP pipeline. If not provided, uses cached pipeline.

    Returns:
        ExtractedWorkout containing all extracted entities.

    Raises:
        ValueError: If text exceeds MAX_TEXT_LENGTH (10000 characters).
    """
    if len(text) > MAX_TEXT_LENGTH:
        raise ValueError(
            f"Input text exceeds maximum length of {MAX_TEXT_LENGTH} characters. "
            f"Provided text length: {len(text)} characters."
        )

    if nlp is None:
        nlp = build_workout_nlp()

    doc = nlp(text)

    exercises: List[WorkoutEntity] = []
    sets: List[WorkoutEntity] = []
    reps: List[WorkoutEntity] = []
    rest: List[WorkoutEntity] = []
    duration: List[WorkoutEntity] = []
    load: List[WorkoutEntity] = []

    for ent in doc.ents:
        entity = WorkoutEntity(
            label=ent.label_,
            text=ent.text,
            start=ent.start_char,
            end=ent.end_char,
        )
        if ent.label_ == "EXERCISE":
            exercises.append(entity)
        elif ent.label_ == "SETS":
            sets.append(entity)
        elif ent.label_ == "REPS":
            reps.append(entity)
        elif ent.label_ == "REST":
            rest.append(entity)
        elif ent.label_ == "DURATION":
            duration.append(entity)
        elif ent.label_ == "LOAD":
            load.append(entity)

    # Apply regex-based post-processing for better accuracy
    exercises = _extract_exercises_with_regex(text, exercises)
    sets, reps = _extract_sets_reps_with_regex(text, sets, reps)
    rest, duration = _extract_rest_duration_with_regex(text, rest, duration)
    load = _extract_load_with_regex(text, load)

    return ExtractedWorkout(
        exercises=exercises,
        sets=sets,
        reps=reps,
        rest=rest,
        duration=duration,
        load=load,
    )


def _extract_exercises_with_regex(
    text: str, entities: List[WorkoutEntity]
) -> List[WorkoutEntity]:
    """Extract exercises using regex patterns as fallback/enhancement.
    
    Optimized to use a single compiled regex pattern with all exercises
    using alternation instead of looping through each exercise (O(n*m) -> O(n)).
    """
    existing_texts = {e.text.lower() for e in entities}
    found_entities = list(entities)

    # Build a single regex pattern with all exercises using alternation
    # Sort by length (longest first) to ensure longer matches take precedence
    sorted_exercises = sorted(ALL_EXERCISES, key=len, reverse=True)
    
    # Escape and join all exercises into a single pattern
    # Use word boundaries for non-hyphenated, capture groups for hyphenated
    exercise_patterns = []
    for exercise in sorted_exercises:
        # Escape special regex characters
        escaped = re.escape(exercise.lower())
        exercise_patterns.append(escaped)
    
    # Compile single pattern with alternation
    combined_pattern = re.compile(
        r'\b(' + '|'.join(exercise_patterns) + r')\b',
        re.IGNORECASE
    )
    
    # Find all matches in one pass
    for match in combined_pattern.finditer(text):
        match_text = match.group(0)
        if match_text.lower() not in existing_texts:
            entity = WorkoutEntity(
                label="EXERCISE",
                text=match_text,
                start=match.start(),
                end=match.end(),
            )
            found_entities.append(entity)
            existing_texts.add(match_text.lower())

    return found_entities


def _extract_sets_reps_with_regex(
    text: str, sets_entities: List[WorkoutEntity], reps_entities: List[WorkoutEntity]
) -> Tuple[List[WorkoutEntity], List[WorkoutEntity]]:
    """Extract SETS and REPS using regex patterns (NxM shorthand handling)."""
    # NxM shorthand pattern (e.g., "3x10", "4x12", "5x5")
    nxm_pattern = re.compile(r"\b(\d+)\s*x\s*(\d+)\b", re.IGNORECASE)

    existing_sets = {e.text for e in sets_entities}
    existing_reps = {e.text for e in reps_entities}
    found_sets = list(sets_entities)
    found_reps = list(reps_entities)

    for match in nxm_pattern.finditer(text):
        sets_val = match.group(1)
        reps_val = match.group(2)

        if sets_val not in existing_sets:
            entity = WorkoutEntity(
                label="SETS",
                text=sets_val,
                start=match.start(1),
                end=match.end(1),
            )
            found_sets.append(entity)
            existing_sets.add(sets_val)

        if reps_val not in existing_reps:
            entity = WorkoutEntity(
                label="REPS",
                text=reps_val,
                start=match.start(2),
                end=match.end(2),
            )
            found_reps.append(entity)
            existing_reps.add(reps_val)

    # Pattern for "X sets of Y reps" or "X rounds of Y reps"
    sets_of_reps_pattern = re.compile(
        r"\b(\d+)\s*(?:sets?|rounds?|circuits?)\s*(?:of\s*)?(\d+)\s*(?:reps?)?\b",
        re.IGNORECASE,
    )

    for match in sets_of_reps_pattern.finditer(text):
        sets_val = match.group(1)
        reps_val = match.group(2)

        if sets_val not in existing_sets:
            entity = WorkoutEntity(
                label="SETS",
                text=sets_val,
                start=match.start(1),
                end=match.end(1),
            )
            found_sets.append(entity)
            existing_sets.add(sets_val)

        if reps_val not in existing_reps:
            entity = WorkoutEntity(
                label="REPS",
                text=reps_val,
                start=match.start(2),
                end=match.end(2),
            )
            found_reps.append(entity)
            existing_reps.add(reps_val)

    # Pattern for standalone numbers followed by "reps"
    standalone_reps_pattern = re.compile(r"\b(\d+)\s*(?:reps?)\b", re.IGNORECASE)

    for match in standalone_reps_pattern.finditer(text):
        reps_val = match.group(1)
        if reps_val not in existing_reps:
            entity = WorkoutEntity(
                label="REPS",
                text=reps_val,
                start=match.start(1),
                end=match.end(1),
            )
            found_reps.append(entity)
            existing_reps.add(reps_val)

    # Pattern for standalone numbers followed by "sets"
    standalone_sets_pattern = re.compile(r"\b(\d+)\s*(?:sets?|rounds?|circuits?)\b", re.IGNORECASE)

    for match in standalone_sets_pattern.finditer(text):
        sets_val = match.group(1)
        if sets_val not in existing_sets:
            entity = WorkoutEntity(
                label="SETS",
                text=sets_val,
                start=match.start(1),
                end=match.end(1),
            )
            found_sets.append(entity)
            existing_sets.add(sets_val)

    return found_sets, found_reps


def _extract_rest_duration_with_regex(
    text: str, rest_entities: List[WorkoutEntity], duration_entities: List[WorkoutEntity]
) -> Tuple[List[WorkoutEntity], List[WorkoutEntity]]:
    """Extract REST and DURATION using regex patterns."""
    existing_rest = {e.text for e in rest_entities}
    existing_duration = {e.text for e in duration_entities}
    found_rest = list(rest_entities)
    found_duration = list(duration_entities)

    # Pattern for rest intervals: "rest X seconds/minutes"
    rest_pattern = re.compile(
        r"\b(?:rest|break|pause)\s*(?:for\s*)?(\d+)\s*(seconds?|minutes?|secs?|mins?|s|m)\b",
        re.IGNORECASE,
    )

    for match in rest_pattern.finditer(text):
        rest_val = match.group(0)
        if rest_val.lower() not in existing_rest:
            entity = WorkoutEntity(
                label="REST",
                text=rest_val,
                start=match.start(),
                end=match.end(),
            )
            found_rest.append(entity)
            existing_rest.add(rest_val.lower())

    # Pattern for duration: "X seconds/minutes" (without "rest")
    duration_pattern = re.compile(
        r"\b(\d+)\s*(seconds?|minutes?|secs?|mins?|s|m)\b",
        re.IGNORECASE,
    )

    for match in duration_pattern.finditer(text):
        # Skip if this is already captured as rest
        if match.group(0).lower().startswith(("rest", "break", "pause")):
            continue
        dur_val = match.group(0)
        if dur_val.lower() not in existing_duration:
            entity = WorkoutEntity(
                label="DURATION",
                text=dur_val,
                start=match.start(),
                end=match.end(),
            )
            found_duration.append(entity)
            existing_duration.add(dur_val.lower())

    return found_rest, found_duration


def _extract_load_with_regex(
    text: str, load_entities: List[WorkoutEntity]
) -> List[WorkoutEntity]:
    """Extract LOAD using regex patterns (including bodyweight/BW)."""
    existing_load = {e.text.lower() for e in load_entities}
    found_load = list(load_entities)

    # Pattern for weight: "X lbs/kg"
    weight_pattern = re.compile(
        r"\b(\d+(?:\.\d+)?)\s*(lbs?|pounds?|kg|kilograms?|kgs?)\b",
        re.IGNORECASE,
    )

    for match in weight_pattern.finditer(text):
        weight_val = match.group(0)
        if weight_val.lower() not in existing_load:
            entity = WorkoutEntity(
                label="LOAD",
                text=weight_val,
                start=match.start(),
                end=match.end(),
            )
            found_load.append(entity)
            existing_load.add(weight_val.lower())

    # Pattern for bodyweight/BW
    bw_pattern = re.compile(r"\b(bodyweight|BW)\b", re.IGNORECASE)

    for match in bw_pattern.finditer(text):
        bw_val = match.group(0)
        if bw_val.lower() not in existing_load:
            entity = WorkoutEntity(
                label="LOAD",
                text=bw_val,
                start=match.start(),
                end=match.end(),
            )
            found_load.append(entity)
            existing_load.add(bw_val.lower())

    return found_load
