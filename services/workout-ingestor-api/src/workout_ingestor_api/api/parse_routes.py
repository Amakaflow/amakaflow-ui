"""
Parse endpoints for structured text parsing

Provides POST /parse/text for Instagram caption and general workout text parsing.
Returns structured exercise data with sets, reps, superset_group, etc.

Uses ParserService.parse_free_text_to_workout() as primary parser, with LLM fallback.
"""

import asyncio
import re
import logging
from typing import Any
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse

from workout_ingestor_api.auth import get_current_user

from workout_ingestor_api.models import Exercise, Workout
from workout_ingestor_api.services.parser_service import ParserService

logger = logging.getLogger(__name__)

router = APIRouter()

# Structured regex parsing can never be 100% certain (unlike LLM with semantic
# understanding), so confidence is capped at this value.
MAX_STRUCTURED_CONFIDENCE = 90

# Minimum confidence when exercises are found but none have structured data
# (e.g., bare exercise names without sets/reps). Prevents contradictory
# success=True with confidence=0.
MIN_BARE_CONFIDENCE = 15

# ---------------------------------------------------------------------------
# Request/Response Models
# ---------------------------------------------------------------------------

class ParseTextRequest(BaseModel):
    """Request model for POST /parse/text"""
    text: str = Field(..., max_length=50000, description="Text to parse (e.g., Instagram caption)")
    source: str | None = Field(default=None, max_length=100, pattern=r'^[a-z_]+$', description="Optional source hint (e.g., 'instagram_caption')")


class ParsedExerciseResponse(BaseModel):
    """Single parsed exercise response"""
    raw_name: str = Field(..., description="Original exercise name")
    sets: int | None = Field(default=None, description="Number of sets")
    reps: str | None = Field(default=None, description="Reps (may include ranges like '8-12')")
    distance: str | None = Field(default=None, description="Distance if applicable (e.g., '10m')")
    superset_group: str | None = Field(default=None, description="Group ID for supersets (e.g., 'A', 'B')")
    order: int = Field(..., description="Exercise order (0-indexed)")
    weight: str | None = Field(default=None)
    weight_unit: str | None = Field(default=None)
    rpe: float | None = Field(default=None)
    notes: str | None = Field(default=None)
    rest_seconds: int | None = Field(default=None)


class ParseTextResponse(BaseModel):
    """Response model for POST /parse/text"""
    success: bool
    exercises: list[ParsedExerciseResponse]
    detected_format: str | None = None
    confidence: float = Field(default=0, ge=0, le=100)
    source: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


# ---------------------------------------------------------------------------
# Patterns for preprocessing and custom parsing
# ---------------------------------------------------------------------------

# Patterns to skip (hashtags, CTAs, headers)
SKIP_PATTERNS = [
    re.compile(r'^#\w+'),  # Hashtags
    re.compile(r'^follow\s+me', re.IGNORECASE),  # CTAs
    re.compile(r'^subscribe', re.IGNORECASE),
    re.compile(r'^check\s+out', re.IGNORECASE),
    re.compile(r'^link\s+in\s+bio', re.IGNORECASE),
    re.compile(r'^save\s+this', re.IGNORECASE),
    re.compile(r'^upper\s+body:', re.IGNORECASE),  # Section headers
    re.compile(r'^lower\s+body:', re.IGNORECASE),
    re.compile(r'^warmup?:', re.IGNORECASE),
    re.compile(r'^cool\s*down?:', re.IGNORECASE),
    re.compile(r'^round\s+\d+:', re.IGNORECASE),
    re.compile(r'^day\s+\d+:', re.IGNORECASE),
    re.compile(r'^week\s+\d+:', re.IGNORECASE),
]

# Numbered/bullet patterns
NUMBERED_PATTERN = re.compile(r'^\s*(?:\d+[.):]|\d+\s*[.):])\s*(.+)')
BULLET_PATTERN = re.compile(r'^\s*[•\-→>]\s*(.+)')

# Compiled once at module level
_HAS_SETS_REPS = re.compile(r'\d+\s*[xX×]\s*\d+')

# Pattern to detect set/rep notation with named groups
SETS_REPS_PATTERN = re.compile(
    r'(?P<name>.+?)\s+(?P<sets>\d+)\s*[x×]\s*(?P<reps>\d+(?:[-–]\d+)?)(?:\s*(?P<unit>m|s|sec|seconds))?',
    re.IGNORECASE
)

# Pattern for distance notation (e.g., "5 x 10m")
DISTANCE_PATTERN = re.compile(
    r'(?P<name>.+?)\s+(?P<sets>\d+)\s*[x×]\s*(?P<distance>\d+)\s*(?P<unit>m|meters|yards|yd)',
    re.IGNORECASE
)

# Pattern for RPE notation
RPE_PATTERN = re.compile(
    r'@\s*RPE?\s*(?P<rpe>\d+(?:\.\d+)?)',
    re.IGNORECASE
)

# Superset split pattern
_SUPERSET_SPLIT = re.compile(r'\s*\+\s*')

# Standalone "Workout:" header
_WORKOUT_HEADER = re.compile(r'^workout[:\s]*$', re.IGNORECASE)


# ---------------------------------------------------------------------------
# Helper functions (preserved from original)
# ---------------------------------------------------------------------------

def should_skip_line(text: str) -> bool:
    """Check if line should be skipped (hashtag, CTA, header)"""
    trimmed = text.strip()
    if not trimmed:
        return True

    for pattern in SKIP_PATTERNS:
        if pattern.match(trimmed):
            return True

    # Skip standalone "Workout:" with nothing after
    if _WORKOUT_HEADER.match(trimmed):
        return True

    return False


def strip_workout_prefix(text: str) -> str:
    """Strip 'Workout:' prefix if present"""
    if text.lower().startswith('workout:'):
        return text[8:].strip()
    return text


def has_sets_reps_notation(text: str) -> bool:
    """Check if text contains set/rep notation like '4x8' or '3 x 10'"""
    return bool(_HAS_SETS_REPS.search(text))


def split_superset_intelligently(text: str) -> list[str]:
    """
    Split text on '+' only if both sides have set/rep notation.

    Examples:
    - "Pull-ups 4x8 + Z Press 4x8" -> ["Pull-ups 4x8", "Z Press 4x8"]
    - "Chin-up + Negative Hold" -> ["Chin-up + Negative Hold"] (kept together)
    """
    parts = _SUPERSET_SPLIT.split(text)

    if len(parts) <= 1:
        return [text]

    # Only split if ALL parts have set/rep notation
    all_have_sets_reps = all(has_sets_reps_notation(part) for part in parts)

    if all_have_sets_reps:
        return [p.strip() for p in parts]

    return [text]


def clean_exercise_name(name: str) -> str:
    """Clean up exercise name by removing annotations"""
    return (
        name
        .replace('→', '')    # U+2192
        .replace('➜', '')    # U+279C
        .replace('➡', '')    # U+27A1
        .replace('=>', '')
        .strip()
    )


# ---------------------------------------------------------------------------
# Preprocessing and manual parsing helpers
# ---------------------------------------------------------------------------

def preprocess_and_split_lines(text: str) -> tuple[list[str], dict[int, str]]:
    """
    Preprocess text into lines with superset detection.
    Returns (processed_lines, superset_mapping).

    The superset_mapping tracks which exercises belong to which superset group.
    """
    lines = text.strip().split('\n')
    processed_lines: list[str] = []
    superset_mapping: dict[int, str] = {}
    superset_counter = 0

    for line in lines:
        trimmed = line.strip()

        # Skip filtered content
        if should_skip_line(trimmed):
            continue

        # Strip "Workout:" prefix
        trimmed = strip_workout_prefix(trimmed)
        if not trimmed:
            continue

        # Try numbered/bullet patterns to extract content
        numbered_match = NUMBERED_PATTERN.match(trimmed)
        if numbered_match:
            trimmed = numbered_match.group(1).strip()
        else:
            bullet_match = BULLET_PATTERN.match(trimmed)
            if bullet_match:
                trimmed = bullet_match.group(1).strip()

        if not trimmed:
            continue

        # Handle supersets - split intelligently
        parts = split_superset_intelligently(trimmed)

        if len(parts) > 1:
            # This is a superset - assign group letter
            superset_counter += 1
            group_letter = chr(64 + min(superset_counter, 26))  # A-Z, capped

            for part in parts:
                superset_mapping[len(processed_lines)] = group_letter
                processed_lines.append(part)
        else:
            processed_lines.append(parts[0])

    return processed_lines, superset_mapping


async def parse_with_llm_fallback(text: str, source: str | None) -> ParseTextResponse:
    """
    Use LLM parsing as fallback when structured parsing doesn't find exercises.
    """
    try:
        workout = await asyncio.to_thread(
            ParserService.parse_free_text_to_workout, text, source or "text"
        )

        exercises: list[ParsedExerciseResponse] = []
        order = 0
        superset_counter = 0

        for block in workout.blocks:
            # Check if block label indicates superset
            is_superset = block.structure == "superset" or (block.label and "superset" in block.label.lower())

            superset_group = None
            if is_superset and block.exercises:
                superset_counter += 1
                superset_group = chr(64 + min(superset_counter, 26))  # A-Z, capped

            for ex in block.exercises:
                exercises.append(ParsedExerciseResponse(
                    raw_name=ex.name,
                    sets=ex.sets,
                    reps=str(ex.reps) if ex.reps else None,
                    distance=f"{ex.distance_m}m" if ex.distance_m else None,
                    superset_group=superset_group,
                    order=order,
                    weight=str(ex.weight_kg) if ex.weight_kg else None,
                    notes=ex.notes,
                ))
                order += 1

        return ParseTextResponse(
            success=len(exercises) > 0,
            exercises=exercises,
            detected_format="text_llm",
            confidence=70,
            source=source,
            metadata={"parser": "llm_fallback"}
        )

    except Exception as e:
        logger.warning(f"LLM fallback failed: {e}")
        return ParseTextResponse(
            success=False,
            exercises=[],
            detected_format="text_unstructured",
            confidence=0,
            source=source,
            metadata={"error": "Text could not be parsed. Please try a different format."}
        )


def _enrich_exercise(name: str, ex: Exercise) -> list[ParsedExerciseResponse]:
    """Extract sets/reps/distance/RPE from an exercise name and return one or
    more ParsedExerciseResponse objects (splitting supersets with '+' when both
    sides have NxN notation)."""

    # Try superset split first
    parts = split_superset_intelligently(name)
    results: list[dict] = []
    for part in parts:
        part = part.strip()

        # Try distance pattern (e.g., "Seated sled pull 5 x 10m")
        dm = DISTANCE_PATTERN.match(part)
        if dm:
            results.append({
                "raw_name": clean_exercise_name(dm.group("name").strip()),
                "sets": int(dm.group("sets")),
                "reps": None,
                "distance": f"{dm.group('distance')}{dm.group('unit')}",
                "rpe": None,
            })
            continue

        # Try sets/reps pattern (e.g., "Squats 4x8", "Squats 4x8-12", "Plank 3x30s")
        sm = SETS_REPS_PATTERN.match(part)
        if sm:
            rpe_match = RPE_PATTERN.search(part)
            reps_val = sm.group("reps")
            unit = sm.group("unit")
            if unit and unit.lower() in ("s", "sec", "seconds"):
                reps_val = f"{reps_val}{unit}"
            results.append({
                "raw_name": clean_exercise_name(sm.group("name").strip()),
                "sets": int(sm.group("sets")),
                "reps": reps_val,
                "distance": None,
                "rpe": float(rpe_match.group("rpe")) if rpe_match else None,
            })
            continue

        # No NxN — use whatever ParserService already extracted
        results.append({
            "raw_name": clean_exercise_name(part),
            "sets": ex.sets,
            "reps": str(ex.reps) if ex.reps else (ex.reps_range if ex.reps_range else None),
            "distance": f"{ex.distance_m}m" if ex.distance_m else None,
            "rpe": None,
        })

    return results


def workout_to_parse_response(
    workout: Workout,
    source: str | None,
    detected_format: str = "structured",
) -> ParseTextResponse:
    """Convert ParserService Workout to ParseTextResponse.

    Iterates both block.exercises and legacy block.supersets to collect all
    exercises.  For each exercise, ``_enrich_exercise`` extracts sets/reps/
    distance from the raw name (which ParserService leaves as the full line)
    and splits ``+`` supersets when both sides have NxN notation.
    """

    exercises: list[ParsedExerciseResponse] = []
    order = 0
    superset_counter = 0

    def _process_exercises(ex_list, superset_group):
        nonlocal order, superset_counter
        for ex in ex_list:
            enriched = _enrich_exercise(ex.name, ex)
            is_inline_superset = len(enriched) > 1

            if is_inline_superset and superset_group is None:
                # Inline superset discovered (e.g., "Pull-ups 4x8 + Z Press 4x8")
                # but exercise was not already in a superset group.
                superset_counter += 1
                ss_group = chr(64 + min(superset_counter, 26))
            elif superset_group is not None:
                # Exercise already belongs to a superset from block/legacy
                ss_group = superset_group
            else:
                ss_group = None

            for item in enriched:
                exercises.append(ParsedExerciseResponse(
                    raw_name=item["raw_name"],
                    sets=item["sets"],
                    reps=item["reps"],
                    distance=item["distance"],
                    rpe=item["rpe"],
                    superset_group=ss_group,
                    order=order,
                    notes=getattr(ex, "notes", None),
                ))
                order += 1

    for block in workout.blocks:
        is_superset = (
            block.structure == "superset"
            or (block.label and "superset" in block.label.lower())
        )

        superset_group = None
        if is_superset:
            superset_counter += 1
            superset_group = chr(64 + min(superset_counter, 26))

        _process_exercises(block.exercises, superset_group)

        # Legacy supersets (ParserService still uses Superset objects)
        for ss in getattr(block, "supersets", []):
            superset_counter += 1
            ss_group = chr(64 + min(superset_counter, 26))
            _process_exercises(ss.exercises, ss_group)

    # Confidence: proportion of exercises with structured data
    if not exercises:
        calc_confidence = 0
    else:
        structured = sum(1 for e in exercises if e.sets is not None)
        if structured == 0:
            calc_confidence = MIN_BARE_CONFIDENCE
        else:
            calc_confidence = min(MAX_STRUCTURED_CONFIDENCE, max(MIN_BARE_CONFIDENCE, int((structured / len(exercises)) * 100)))

    return ParseTextResponse(
        success=len(exercises) > 0,
        exercises=exercises,
        detected_format=detected_format,
        confidence=calc_confidence,
        source=source,
    )


# ---------------------------------------------------------------------------
# API Endpoint
# ---------------------------------------------------------------------------

@router.post("/parse/text")
async def parse_text(
    request: ParseTextRequest,
    user_id: str = Depends(get_current_user),
) -> JSONResponse:
    """
    Parse workout text (e.g., Instagram caption) into structured exercise data.

    Uses ParserService.parse_free_text_to_workout() as the primary parser,
    with LLM fallback when no exercises are found.

    ## Request Body
    - **text**: The text to parse (e.g., "Pull-ups 4x8 + Z Press 4x8")
    - **source**: Optional source hint (e.g., "instagram_caption")

    ## Response
    Returns structured exercise data with:
    - raw_name: Exercise name
    - sets: Number of sets
    - reps: Reps (may include ranges like "8-12")
    - distance: Distance if applicable (e.g., "10m")
    - superset_group: Group ID for supersets (e.g., "A", "B")
    - order: Exercise order (0-indexed)
    """
    if not request.text:
        raise HTTPException(status_code=400, detail="Text is required")

    text = request.text.strip()
    if not text:
        return JSONResponse(ParseTextResponse(
            success=False,
            exercises=[],
            detected_format="text_unstructured",
            confidence=0,
            source=request.source,
        ).model_dump())

    source = request.source or "instagram_caption"

    # Quick check: if all lines are junk (hashtags/CTAs), bail early
    lines, _ = preprocess_and_split_lines(text)
    if not lines:
        return JSONResponse(ParseTextResponse(
            success=False,
            exercises=[],
            detected_format="text_unstructured",
            confidence=0,
            source=source,
        ).model_dump())

    # Primary path: ParserService structured regex parsing
    try:
        workout = await asyncio.to_thread(
            ParserService.parse_free_text_to_workout, text, source
        )
        result = workout_to_parse_response(workout, source)

        if result.success and result.exercises:
            return JSONResponse(result.model_dump())
    except Exception as e:
        logger.warning(f"ParserService structured parsing failed: {e}")

    # Fallback: LLM parsing
    llm_result = await parse_with_llm_fallback(text, source)
    return JSONResponse(llm_result.model_dump())
