"""Shared utilities for workout data sanitization.

This module provides a centralized function for fixing common LLM structural
mistakes in workout data, used by both YouTube and Instagram ingest paths.
"""

import re
from typing import Dict

# Patterns that indicate the LLM put time-cap info in notes instead of time_cap_sec
_TIME_CAP_NOTES_RE = re.compile(
    r"\b\d+\s*(?:minute|min|second|sec)s?\s*(?:cap|window|limit)\b"
    r"|\btime\s*cap\b",
    re.IGNORECASE,
)


def sanitize_workout_data(workout_data: Dict) -> Dict:
    """Sanitize LLM output to fix common structural mistakes.

    Fixes:
    1. Preserve circuit/rounds/amrap/emom/for-time blocks (exercises stay in exercises[])
    2. If supersets is non-empty and NOT a circuit: set structure to "superset", clear exercises[]
    3. If structure == "superset" but supersets is empty: reset structure to null
    4. Validates blocks is a list and superset entries have exercises
    5. Propagate time_cap_sec: if block time_cap_sec is null but exercises have it, set from exercises
    6. Strip time-cap text from exercise notes when time_cap_sec is already set

    Args:
        workout_data: Raw workout dict from LLM parsing

    Returns:
        Sanitized workout dict with fixed structure
    """
    circuit_structures = {"circuit", "rounds", "amrap", "emom", "for-time"}

    blocks = workout_data.get("blocks")
    if not isinstance(blocks, list):
        return workout_data

    for block in blocks:
        structure = block.get("structure")

        # Preserve circuit-type blocks — exercises belong in exercises[], not supersets
        # But only if exercises[] is non-empty; if LLM put everything in supersets
        # with a circuit label, fall through to the superset path to avoid data loss
        if structure in circuit_structures and block.get("exercises"):
            block["supersets"] = []
            continue

        supersets = block.get("supersets", [])
        # Filter out malformed superset entries (must have exercises list)
        valid_supersets = [
            s for s in supersets
            if isinstance(s, dict) and isinstance(s.get("exercises"), list) and len(s["exercises"]) > 0
        ]
        block["supersets"] = valid_supersets

        if valid_supersets:
            block["structure"] = "superset"
            block["exercises"] = []
        elif structure == "superset":
            # Structure says superset but no valid supersets — reset
            block["structure"] = None

        # Normalize rest field aliases → rest_between_rounds_sec
        if "rest_sec" in block and "rest_between_rounds_sec" not in block:
            block["rest_between_rounds_sec"] = block.pop("rest_sec")
        elif "rest_sec" in block:
            block.pop("rest_sec")  # already has rest_between_rounds_sec, discard alias
        if "rest_between_sec" in block and "rest_between_rounds_sec" not in block:
            block["rest_between_rounds_sec"] = block.pop("rest_between_sec")
        elif "rest_between_sec" in block:
            block.pop("rest_between_sec")

        # Default missing exercise type to "strength"
        for exercise in block.get("exercises", []):
            if not exercise.get("type"):
                exercise["type"] = "strength"
        for superset in block.get("supersets", []):
            for exercise in superset.get("exercises", []):
                if not exercise.get("type"):
                    exercise["type"] = "strength"

    # Filter out blocks with no exercises AND no supersets (empty blocks)
    workout_data["blocks"] = [
        block for block in blocks
        if block.get("exercises") or block.get("supersets")
    ]

    # Post-pass: fix time_cap_sec propagation and strip redundant notes
    for block in workout_data["blocks"]:
        exercises = block.get("exercises") or []

        # If block-level time_cap_sec is missing but exercises have it, propagate up
        if not block.get("time_cap_sec"):
            ex_caps = [e.get("time_cap_sec") for e in exercises if e.get("time_cap_sec")]
            if ex_caps:
                block["time_cap_sec"] = max(ex_caps)

        # Strip time-cap text from exercise notes when time_cap_sec is set
        for ex in exercises:
            if ex.get("time_cap_sec") and ex.get("notes"):
                cleaned = _TIME_CAP_NOTES_RE.sub("", ex["notes"]).strip(" ,;-")
                ex["notes"] = cleaned if cleaned else None

    return workout_data
