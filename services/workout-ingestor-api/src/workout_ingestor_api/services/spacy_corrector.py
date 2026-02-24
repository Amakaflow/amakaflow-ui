"""Rule-based post-LLM corrections for workout data.

All corrections are regex-based — no spaCy model download required.
"""
from __future__ import annotations

import re
from typing import Dict, List, Optional

_ROUNDS_PATTERN = re.compile(
    r"(?:x\s*(\d+)\s*rounds?|(\d+)\s*x?\s*rounds?|repeat\s*(\d+)\s*times?)",
    re.IGNORECASE,
)
_REST_PATTERN = re.compile(
    r"rest\s+(\d+)(?:\s*[-–]\s*(\d+))?\s*(min(?:ute)?s?|sec(?:ond)?s?)",
    re.IGNORECASE,
)
_PER_SIDE_PATTERN = re.compile(
    r"\b(?:each|per)\s+(?:leg|side|arm|hand)\b",
    re.IGNORECASE,
)


class SpacyCorrector:
    """Apply rule-based corrections to LLM workout output.

    Note: Named SpacyCorrector for historical reasons. Implementation is
    pure regex — no spaCy model download required.
    """

    def correct(self, workout_data: Dict, raw_text: str) -> Dict:
        """Correct workout_data using patterns found in raw_text.

        Args:
            workout_data: Dict from UnifiedParser (already sanitized).
            raw_text: The original text that was parsed (for pattern matching).

        Returns:
            Mutated workout_data with corrections applied.
        """
        blocks: List[Dict] = workout_data.get("blocks") or []
        if not blocks:
            return workout_data

        rounds = self._extract_rounds(raw_text)
        rest_sec = self._extract_rest_sec(raw_text)

        for block in blocks:
            if rounds is not None and block.get("rounds") is None:
                block["rounds"] = rounds

            if rest_sec is not None and block.get("rest_between_rounds_sec") is None:
                block["rest_between_rounds_sec"] = rest_sec

            if self._block_has_per_side_language(block):
                self._apply_per_side(block)

            # Upgrade confidence if explicit round signal found in raw text
            if rounds is not None and block.get("structure_confidence", 0.0) < 1.0:
                block["structure_confidence"] = 1.0
                block["structure_options"] = []

        return workout_data

    @staticmethod
    def _extract_rounds(text: str) -> Optional[int]:
        matches = _ROUNDS_PATTERN.findall(text)
        values = set()
        for groups in matches:
            for g in groups:
                if g:
                    values.add(int(g))
        if len(values) != 1:
            return None
        return values.pop()

    @staticmethod
    def _extract_rest_sec(text: str) -> Optional[int]:
        match = _REST_PATTERN.search(text)
        if not match:
            return None
        low = int(match.group(1))
        high = int(match.group(2)) if match.group(2) else low
        unit = match.group(3).lower()
        avg = (low + high) / 2
        if unit.startswith("min"):
            return int(avg * 60)
        return int(avg)

    @staticmethod
    def _block_has_per_side_language(block: Dict) -> bool:
        """Return True if this block's own text contains per-side language.

        Block text is the concatenation of the block label (if any), all
        exercise names, and all exercise notes — both top-level exercises and
        those nested inside supersets.
        """
        parts: List[str] = []
        if block.get("label"):
            parts.append(block["label"])
        for exercise in block.get("exercises", []):
            if exercise.get("name"):
                parts.append(exercise["name"])
            if exercise.get("notes"):
                parts.append(exercise["notes"])
        for superset in block.get("supersets", []):
            for exercise in superset.get("exercises", []):
                if exercise.get("name"):
                    parts.append(exercise["name"])
                if exercise.get("notes"):
                    parts.append(exercise["notes"])
        block_text = " ".join(parts)
        return bool(_PER_SIDE_PATTERN.search(block_text))

    @staticmethod
    def _apply_per_side(block: Dict) -> None:
        for exercise in block.get("exercises", []):
            notes = exercise.get("notes") or ""
            if "(per side)" not in notes:
                exercise["notes"] = (notes + " (per side)").strip()
        for superset in block.get("supersets", []):
            for exercise in superset.get("exercises", []):
                notes = exercise.get("notes") or ""
                if "(per side)" not in notes:
                    exercise["notes"] = (notes + " (per side)").strip()
