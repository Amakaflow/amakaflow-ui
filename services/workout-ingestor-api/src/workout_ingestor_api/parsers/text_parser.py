"""
Text Parser

Parses plain text files by:
- Routing to existing LLM parsing pipeline
- Handling conversational/unstructured programs
- Supporting coach notes, forum copy-paste

This parser acts as a bridge to the existing workout-ingestor-api
or can use basic pattern matching for structured text.
"""

import re
import logging
from typing import List, Dict, Any, Optional
import httpx

from .base import BaseParser
from .models import (
    ParseResult,
    ParsedWorkout,
    ParsedExercise,
    FileInfo,
)

logger = logging.getLogger(__name__)

# Compiled pattern for superset splitting (avoids recompilation per call)
_HAS_SETS_REPS = re.compile(r'\d+\s*[xX×]\s*\d+')

# Workout ingestor API URL (for LLM processing)
INGESTOR_API_URL = "http://workout-ingestor:8004"


class TextParser(BaseParser):
    """Parser for plain text files"""

    # Patterns for structured text parsing
    EXERCISE_LINE_PATTERN = re.compile(
        r'^[\s-]*'  # Optional leading whitespace or dash
        r'([A-Za-z][A-Za-z\s\(\)\-]+?)'  # Exercise name (with hyphens for compound names like "Pull-ups")
        r'[\s:–-]+'  # Separator
        r'(\d+)\s*[xX×]\s*(\d+(?:[-–]\d+)?(?:[+x]\d+)?)'  # Sets x Reps (with optional range like 8-12)
        r'(?:\s*[@at]*\s*RPE\s*(\d+(?:\.\d+)?))?'  # Optional RPE (e.g., @RPE8)
        r'(?:\s*[@at]*\s*(\d+(?:\.\d+)?)\s*(kg|lbs?|%)?)?'  # Optional weight
        r'(?:\s*[-–]\s*(.+))?$',  # Optional notes
        re.IGNORECASE
    )

    # Simpler pattern for "Exercise: SetsxReps" format
    # Also captures optional unit (s, m, sec, seconds, meters) for time/distance
    # And rep ranges like "8-12"
    SIMPLE_EXERCISE_PATTERN = re.compile(
        r'^([A-Za-z][A-Za-z\s\-]+?)'  # Exercise name (with hyphens for compound names)
        r'[\s:]+(\d+)\s*[xX×]\s*(\d+(?:[-–]\d+)?(?:\.?\d+)?)'  # Sets x Reps (with optional range like 8-12)
        r'(?:\s*([a-zA-Z]+)?)?',  # Optional unit (s, sec, m, etc.)
        re.IGNORECASE
    )

    # Day/Week headers
    DAY_HEADER_PATTERN = re.compile(r'^(Day\s*\d+|Week\s*\d+|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)', re.IGNORECASE)

    def can_parse(self, file_info: FileInfo) -> bool:
        """Check if this parser can handle the file"""
        return file_info.extension.lower() in ['.txt', '.text', '']

    async def parse(self, content: bytes, file_info: FileInfo) -> ParseResult:
        """Parse text file and return normalized workout data"""
        self.errors = []
        self.warnings = []

        try:
            # Decode text
            text = self._decode_content(content)

            # First, try structured parsing
            result = await self.try_structured_parse(text)

            if result.workouts and result.confidence >= 60:
                # Structured parsing worked well
                return result

            # Fall back to LLM parsing if available
            llm_result = await self._try_llm_parse(text)

            if llm_result and llm_result.workouts:
                return llm_result

            # Return structured result even if low confidence
            if result.workouts:
                return result

            # No workouts found
            return ParseResult(
                success=False,
                errors=["Could not extract workout from text"],
                warnings=self.warnings,
                confidence=0,
                detected_format="text_unstructured"
            )

        except Exception as e:
            logger.exception(f"Failed to parse text file: {e}")
            return ParseResult(
                success=False,
                errors=[f"Failed to parse text file: {str(e)}"],
                confidence=0
            )

    def _decode_content(self, content: bytes) -> str:
        """Decode bytes to string"""
        encodings = ['utf-8', 'utf-8-sig', 'latin-1', 'cp1252']

        for encoding in encodings:
            try:
                return content.decode(encoding)
            except UnicodeDecodeError:
                continue

        return content.decode('utf-8', errors='replace')

    async def try_structured_parse(self, text: str) -> ParseResult:
        """Try to parse text using structured patterns"""
        lines = text.strip().split('\n')
        workouts = []
        current_workout = None
        exercise_order = 1
        superset_group = None
        superset_counter = 0

        for line in lines:
            line = line.strip()

            if not line:
                continue

            # Check for day/week header
            header_match = self.DAY_HEADER_PATTERN.match(line)
            if header_match:
                # Save current workout and start new one
                if current_workout and current_workout.exercises:
                    workouts.append(current_workout)

                current_workout = ParsedWorkout(
                    name=header_match.group(1),
                    metadata={'raw_header': line}
                )
                exercise_order = 1
                superset_group = None
                continue

            # Check for Instagram-style superset notation (e.g., "Pull-ups 4x8 + Z Press 4x8")
            # Split on + only if all parts have set/rep notation
            parts = self._split_superset_line(line)
            
            if len(parts) > 1:
                # This is a superset - assign group letter
                superset_counter += 1
                superset_group = chr(64 + superset_counter)  # A, B, C, ...
                
                for part in parts:
                    exercise = self._parse_exercise_line(part.strip(), exercise_order)
                    if exercise:
                        exercise.superset_group = superset_group
                        if not current_workout:
                            current_workout = ParsedWorkout(
                                name="Workout",
                                metadata={'source': 'text'}
                            )
                        current_workout.exercises.append(exercise)
                        exercise_order += 1
            else:
                # Single exercise line
                exercise = self._parse_exercise_line(line, exercise_order)

                if exercise:
                    if not current_workout:
                        current_workout = ParsedWorkout(
                            name="Workout",
                            metadata={'source': 'text'}
                        )

                    current_workout.exercises.append(exercise)
                    exercise_order += 1

        # Add final workout
        if current_workout and current_workout.exercises:
            workouts.append(current_workout)

        # Calculate confidence
        total_exercises = sum(len(w.exercises) for w in workouts)
        total_lines = len([line for line in lines if line.strip()])

        if total_exercises == 0:
            confidence = 0
        elif total_exercises >= total_lines * 0.5:
            confidence = 80
        elif total_exercises >= total_lines * 0.3:
            confidence = 60
        else:
            confidence = 40

        result = ParseResult(
            success=len(workouts) > 0,
            workouts=workouts,
            confidence=confidence,
            detected_format="text_structured",
            total_rows=total_lines,
            errors=self.errors,
            warnings=self.warnings
        )

        # Detect patterns
        result.patterns = self.detect_patterns(workouts)

        return result

    def _split_superset_line(self, line: str) -> List[str]:
        """
        Split line on '+' only if all parts have set/rep notation.
        
        Examples:
        - "Pull-ups 4x8 + Z Press 4x8" -> ["Pull-ups 4x8", "Z Press 4x8"]
        - "Chin-up + Negative Hold" -> ["Chin-up + Negative Hold"] (kept together)
        
        Returns list of exercise parts.
        """
        # Check if line contains '+' 
        if '+' not in line:
            return [line]
        
        # Split on '+'
        parts = re.split(r'\s*\+\s*', line)
        
        if len(parts) <= 1:
            return [line]
        
        # Only split if ALL parts have set/rep notation (digit + x + digit)
        all_have_sets_reps = all(_HAS_SETS_REPS.search(part) for part in parts)
        
        if all_have_sets_reps:
            return [p.strip() for p in parts]
        
        # If not all have sets/reps, keep original line unsplit
        return [line]

    def _parse_exercise_line(self, line: str, order: int) -> Optional[ParsedExercise]:
        """Try to parse a single line as an exercise"""
        # Try detailed pattern first
        match = self.EXERCISE_LINE_PATTERN.match(line)

        if match:
            name = match.group(1).strip()
            sets = int(match.group(2))
            reps = match.group(3)
            rpe = match.group(4)  # Moved earlier in pattern
            weight = match.group(5)
            weight_unit = match.group(6)
            notes = match.group(7)

            reps_str, reps_flags = self.parse_reps(reps)
            weight_str, detected_unit, weight_flags = self.parse_weight(str(weight) if weight else '')

            unit = None
            if weight_unit:
                unit = 'kg' if weight_unit.lower().startswith('k') else 'lbs' if weight_unit.lower().startswith('l') else None
            elif detected_unit:
                unit = detected_unit

            return ParsedExercise(
                raw_name=self.normalize_exercise_name(name),
                order=str(order),
                sets=sets,
                reps=reps_str,
                weight=weight_str,
                weight_unit=unit,
                rpe=float(rpe) if rpe else None,
                notes=notes.strip() if notes else None,
                flags=list(set(reps_flags + weight_flags))
            )

        # Try simpler pattern
        simple_match = self.SIMPLE_EXERCISE_PATTERN.match(line)

        if simple_match:
            name = simple_match.group(1).strip()
            sets = int(simple_match.group(2))
            reps = simple_match.group(3)
            unit = simple_match.group(4)  # Optional unit (s, m, sec, etc.)

            flags: list = []
            # Handle reps with units (e.g., "30s", "10m")
            if unit:
                reps_str = f"{reps}{unit}"
            else:
                reps_str, reps_flags = self.parse_reps(reps)
                flags = reps_flags

            return ParsedExercise(
                raw_name=self.normalize_exercise_name(name),
                order=str(order),
                sets=sets,
                reps=reps_str,
                flags=flags
            )

        return None

    async def _try_llm_parse(self, text: str) -> Optional[ParseResult]:
        """Try to parse text using LLM via workout-ingestor-api"""
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{INGESTOR_API_URL}/ingest/text",
                    json={"text": text}
                )

                if response.status_code != 200:
                    self.add_warning(f"LLM parsing unavailable: {response.status_code}")
                    return None

                data = response.json()

                if not data.get('success'):
                    self.add_warning("LLM parsing returned no results")
                    return None

                # Convert LLM response to ParseResult
                workouts = self._convert_llm_response(data)

                return ParseResult(
                    success=True,
                    workouts=workouts,
                    confidence=data.get('confidence', 70),
                    detected_format="text_llm",
                    metadata={'llm_model': data.get('model')}
                )

        except httpx.ConnectError:
            self.add_warning("LLM service not available")
            return None
        except Exception as e:
            self.add_warning(f"LLM parsing failed: {str(e)}")
            return None

    def _convert_llm_response(self, data: Dict[str, Any]) -> List[ParsedWorkout]:
        """Convert LLM response to ParsedWorkout objects"""
        workouts = []

        # Handle various response formats from workout-ingestor
        workout_data = data.get('workout', data.get('workouts', data))

        if isinstance(workout_data, list):
            for item in workout_data:
                workout = self._convert_single_workout(item)
                if workout:
                    workouts.append(workout)
        elif isinstance(workout_data, dict):
            workout = self._convert_single_workout(workout_data)
            if workout:
                workouts.append(workout)

        return workouts

    def _convert_single_workout(self, data: Dict[str, Any]) -> Optional[ParsedWorkout]:
        """Convert single workout from LLM response"""
        title = data.get('title', data.get('name', 'Parsed Workout'))
        blocks = data.get('blocks', [])

        exercises = []
        order = 1

        for block in blocks:
            block_exercises = block.get('exercises', [])
            for ex in block_exercises:
                name = ex.get('name', '')
                if not name:
                    continue

                reps_str, reps_flags = self.parse_reps(str(ex.get('reps', '1')))

                exercise = ParsedExercise(
                    raw_name=name,
                    order=str(order),
                    sets=ex.get('sets', 1),
                    reps=reps_str,
                    weight=str(ex.get('weight')) if ex.get('weight') else None,
                    notes=ex.get('notes'),
                    rest_seconds=ex.get('rest'),
                    flags=reps_flags
                )
                exercises.append(exercise)
                order += 1

        if not exercises:
            return None

        return ParsedWorkout(
            name=title,
            description=data.get('description'),
            exercises=exercises,
            metadata={'source': 'llm'}
        )
