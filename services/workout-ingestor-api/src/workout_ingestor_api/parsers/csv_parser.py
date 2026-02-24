"""
CSV Parser

Parses CSV files with support for:
- Strong App exports
- Hevy exports
- FitNotes exports
- JEFIT exports
- MyFitnessPal exports
- Generic auto-detection

Features:
- Delimiter detection (comma, semicolon, tab)
- Known schema templates with fuzzy header matching
- Levenshtein distance for header similarity scoring
- Auto-detect columns by header names
- LLM fallback for low-confidence parsing
"""

import io
import csv
import logging
from difflib import SequenceMatcher
from typing import List, Dict, Any, Optional, Tuple
from collections import defaultdict

from .base import BaseParser
from .models import (
    ParseResult,
    ParsedWorkout,
    ParsedExercise,
    ColumnInfo,
    FileInfo,
    ExerciseFlag,
)

logger = logging.getLogger(__name__)


# Known CSV schemas
STRONG_APP_COLUMNS = {
    'date': 'Date',
    'workout_name': 'Workout Name',
    'exercise': 'Exercise Name',
    'set_order': 'Set Order',
    'weight': 'Weight',
    'weight_unit': 'Weight Unit',
    'reps': 'Reps',
    'rpe': 'RPE',
    'distance': 'Distance',
    'distance_unit': 'Distance Unit',
    'seconds': 'Seconds',
    'notes': 'Notes',
    'workout_notes': 'Workout Notes',
}

HEVY_COLUMNS = {
    'date': 'Date',
    'workout_name': 'Workout Name',
    'exercise': 'Exercise Name',
    'set_order': 'Set Order',
    'weight': 'Weight (kg)',
    'reps': 'Reps',
    'rpe': 'RPE',
    'notes': 'Notes',
}

FITNOTES_COLUMNS = {
    'date': 'Date',
    'exercise': 'Exercise',
    'category': 'Category',
    'weight': 'Weight',
    'weight_unit': 'Weight Unit',
    'reps': 'Reps',
    'notes': 'Comment',
}

# JEFIT export format
JEFIT_COLUMNS = {
    'date': 'Date',
    'exercise': 'Exercise',
    'weight': 'Weight',
    'reps': 'Reps',
    'sets': 'Sets',
    'notes': 'Notes',
    'body_part': 'Body Part',
}

# MyFitnessPal export format (strength training entries)
MYFITNESSPAL_COLUMNS = {
    'date': 'Date',
    'exercise': 'Exercise Name',
    'sets': 'Sets',
    'reps': 'Reps/Set',
    'weight': 'Weight Per Set',
}

# All known schemas for detection
KNOWN_SCHEMAS = {
    'strong_app': {
        'columns': STRONG_APP_COLUMNS,
        'min_score': 4,
        'confidence_boost': 30,
    },
    'hevy': {
        'columns': HEVY_COLUMNS,
        'min_score': 4,
        'confidence_boost': 30,
    },
    'fitnotes': {
        'columns': FITNOTES_COLUMNS,
        'min_score': 3,
        'confidence_boost': 30,
    },
    'jefit': {
        'columns': JEFIT_COLUMNS,
        'min_score': 3,
        'confidence_boost': 25,
    },
    'myfitnesspal': {
        'columns': MYFITNESSPAL_COLUMNS,
        'min_score': 3,
        'confidence_boost': 25,
    },
}

# Fuzzy matching thresholds
FUZZY_MATCH_THRESHOLD = 0.85  # 85% similarity for header matching
EXACT_MATCH_BOOST = 1.0  # Score multiplier for exact matches
FUZZY_MATCH_BOOST = 0.9  # Score multiplier for fuzzy matches

# LLM fallback threshold
LLM_FALLBACK_THRESHOLD = 70  # Trigger LLM if confidence < 70%


class CSVParser(BaseParser):
    """Parser for CSV files"""

    def can_parse(self, file_info: FileInfo) -> bool:
        """Check if this parser can handle the file"""
        return file_info.extension.lower() == '.csv'

    async def parse(self, content: bytes, file_info: FileInfo) -> ParseResult:
        """Parse CSV file and return normalized workout data"""
        self.errors = []
        self.warnings = []

        try:
            # Decode content
            text = self._decode_content(content)

            # Detect delimiter
            delimiter = self._detect_delimiter(text)

            # Parse CSV
            reader = csv.DictReader(io.StringIO(text), delimiter=delimiter)
            headers = reader.fieldnames or []

            if not headers:
                return ParseResult(
                    success=False,
                    errors=["No headers found in CSV file"],
                    confidence=0
                )

            # Detect format with fuzzy matching
            detected_format, column_mapping, match_quality = self._detect_format(headers)

            result = ParseResult(
                detected_format=detected_format,
                columns=self._create_column_info(headers, column_mapping, match_quality),
            )

            # Store match quality in metadata for debugging
            result.metadata = result.metadata or {}
            result.metadata['match_quality'] = match_quality
            result.metadata['format_detected'] = detected_format

            # Parse rows
            rows = list(reader)
            result.total_rows = len(rows)

            if detected_format in KNOWN_SCHEMAS:
                workouts = self._parse_known_format(rows, column_mapping, detected_format)
            else:
                workouts = self._parse_generic_format(rows, column_mapping, headers)

            result.workouts = workouts

            # Detect patterns
            result.patterns = self.detect_patterns(workouts)

            # Calculate confidence (now factors in match quality)
            result.confidence = self._calculate_confidence(result, detected_format, match_quality)

            # Check if LLM fallback is needed
            if result.confidence < LLM_FALLBACK_THRESHOLD:
                result.needs_llm_review = True
                self.add_warning(f"Low confidence ({result.confidence:.0f}%) - LLM review recommended")

            result.errors = self.errors
            result.warnings = self.warnings
            result.success = len(self.errors) == 0

            return result

        except Exception as e:
            logger.exception(f"Failed to parse CSV file: {e}")
            return ParseResult(
                success=False,
                errors=[f"Failed to parse CSV file: {str(e)}"],
                confidence=0
            )

    def _decode_content(self, content: bytes) -> str:
        """Decode bytes to string, trying multiple encodings"""
        encodings = ['utf-8', 'utf-8-sig', 'latin-1', 'cp1252']

        for encoding in encodings:
            try:
                return content.decode(encoding)
            except UnicodeDecodeError:
                continue

        # Fallback with error replacement
        return content.decode('utf-8', errors='replace')

    def _detect_delimiter(self, text: str) -> str:
        """Detect CSV delimiter"""
        # Get first few lines
        lines = text.split('\n')[:5]
        sample = '\n'.join(lines)

        # Count occurrences of common delimiters
        delimiters = {
            ',': sample.count(','),
            ';': sample.count(';'),
            '\t': sample.count('\t'),
        }

        # Return the most common one
        return max(delimiters, key=delimiters.get)

    def _fuzzy_match_header(self, header: str, target: str) -> Tuple[bool, float]:
        """
        Check if header matches target using fuzzy matching.

        Returns:
            Tuple of (is_match, similarity_score)
        """
        header_lower = header.lower().strip()
        target_lower = target.lower().strip()

        # Exact match
        if header_lower == target_lower:
            return True, 1.0

        # Fuzzy match using SequenceMatcher (similar to Levenshtein ratio)
        similarity = SequenceMatcher(None, header_lower, target_lower).ratio()

        if similarity >= FUZZY_MATCH_THRESHOLD:
            return True, similarity

        return False, similarity

    def _find_best_header_match(self, headers: List[str], target: str) -> Tuple[Optional[str], float]:
        """
        Find the best matching header for a target column name.

        Returns:
            Tuple of (matched_header, similarity_score) or (None, 0) if no match
        """
        best_match = None
        best_score = 0.0

        for header in headers:
            is_match, score = self._fuzzy_match_header(header, target)
            if is_match and score > best_score:
                best_match = header
                best_score = score

        return best_match, best_score

    def _detect_format(self, headers: List[str]) -> Tuple[str, Dict[str, str], float]:
        """
        Detect CSV format based on headers using fuzzy matching.

        Returns:
            Tuple of (format_name, column_mapping, match_quality_score)
        """
        best_format = None
        best_score = 0.0
        best_mapping = {}
        best_quality = 0.0

        # Try each known schema
        for format_name, schema_info in KNOWN_SCHEMAS.items():
            columns = schema_info['columns']
            min_score = schema_info['min_score']

            score = 0.0
            mapping = {}
            match_qualities = []

            for field_key, column_name in columns.items():
                matched_header, quality = self._find_best_header_match(headers, column_name)

                if matched_header:
                    # Exact match gets full point, fuzzy match gets partial
                    if quality == 1.0:
                        score += EXACT_MATCH_BOOST
                    else:
                        score += FUZZY_MATCH_BOOST

                    mapping[field_key] = matched_header
                    match_qualities.append(quality)

            # Calculate average match quality
            avg_quality = sum(match_qualities) / len(match_qualities) if match_qualities else 0.0

            # Check if this schema meets minimum requirements
            if score >= min_score and score > best_score:
                best_format = format_name
                best_score = score
                best_mapping = mapping
                best_quality = avg_quality

        # If we found a known format, enhance mapping with generic aliases for unmapped columns
        if best_format:
            logger.info(f"Detected format: {best_format} (score: {best_score:.1f}, quality: {best_quality:.2f})")
            # Enhance with generic aliases for any columns not yet mapped
            enhanced_mapping, _ = self._auto_map_columns_fuzzy(headers)
            for field_key, header in enhanced_mapping.items():
                if field_key not in best_mapping:
                    best_mapping[field_key] = header
            return best_format, best_mapping, best_quality

        # Fallback to generic auto-mapping
        mapping, quality = self._auto_map_columns_fuzzy(headers)
        return 'generic', mapping, quality

    def _auto_map_columns_fuzzy(self, headers: List[str]) -> Tuple[Dict[str, str], float]:
        """
        Auto-map columns for generic CSV using fuzzy matching.

        Returns:
            Tuple of (column_mapping, average_match_quality)
        """
        # Define field aliases with priority order (first = highest priority)
        FIELD_ALIASES = {
            'exercise': ['exercise', 'exercise name', 'exercise_or_action', 'movement', 'lift', 'name', 'action'],
            'date': ['date', 'datetime', 'workout date', 'training date'],
            'workout_name': ['workout', 'workout name', 'workout_name', 'workout_id', 'routine', 'session'],
            'sets': ['sets', 'set', 'set order', 'set number', 'set_order'],
            'reps': ['reps', 'rep', 'repetitions', 'reps performed', 'reps/set'],
            'weight': ['weight', 'load', 'weight (kg)', 'weight (lbs)', 'kg', 'lbs', 'weight per set'],
            'weight_unit': ['weight unit', 'unit', 'units', 'weight_unit'],
            'notes': ['notes', 'note', 'comments', 'comment', 'memo', 'description'],
            'rpe': ['rpe', 'rir', 'intensity', 'effort'],
            'step_type': ['step_type', 'type', 'phase', 'block_type'],
            'order': ['step_num', 'step_number', 'order', 'exercise_order'],
            'duration_type': ['duration_type', 'duration_mode'],
            'duration_value': ['duration_value', 'duration', 'time', 'distance'],
            'duration_unit': ['duration_unit', 'time_unit', 'distance_unit'],
            'rest': ['rest_seconds', 'rest', 'rest_time', 'rest_sec'],
            'target_type': ['target_type', 'intensity_type'],
            'target_low': ['target_low', 'target_min', 'zone_low'],
            'target_high': ['target_high', 'target_max', 'zone_high'],
            'equipment': ['equipment', 'gear', 'tools'],
            'body_part': ['body part', 'muscle group', 'muscle', 'category'],
        }

        mapping = {}
        match_qualities = []

        for field_key, aliases in FIELD_ALIASES.items():
            best_match = None
            best_score = 0.0

            # Try each alias
            for alias in aliases:
                matched_header, score = self._find_best_header_match(headers, alias)

                if matched_header and score > best_score:
                    best_match = matched_header
                    best_score = score

            if best_match:
                mapping[field_key] = best_match
                match_qualities.append(best_score)

        avg_quality = sum(match_qualities) / len(match_qualities) if match_qualities else 0.0
        return mapping, avg_quality

    def _auto_map_columns(self, headers: List[str]) -> Dict[str, str]:
        """Auto-map columns for generic CSV (legacy method for compatibility)"""
        mapping, _ = self._auto_map_columns_fuzzy(headers)
        return mapping

    def _auto_map_columns_exact(self, headers: List[str]) -> Dict[str, str]:
        """Auto-map columns using exact matching only (legacy)"""
        mapping = {}
        headers_lower = {h.lower(): h for h in headers}

        # Exercise column
        for name in ['exercise', 'exercise name', 'exercise_or_action', 'movement', 'lift', 'name', 'action']:
            if name in headers_lower:
                mapping['exercise'] = headers_lower[name]
                break

        # Date column
        for name in ['date', 'datetime', 'workout date']:
            if name in headers_lower:
                mapping['date'] = headers_lower[name]
                break

        # Workout name
        for name in ['workout', 'workout name', 'workout_name', 'workout_id', 'routine', 'session']:
            if name in headers_lower:
                mapping['workout_name'] = headers_lower[name]
                break

        # Sets
        for name in ['sets', 'set', 'set order', 'set number']:
            if name in headers_lower:
                mapping['sets'] = headers_lower[name]
                break

        # Reps
        for name in ['reps', 'rep', 'repetitions', 'reps performed']:
            if name in headers_lower:
                mapping['reps'] = headers_lower[name]
                break

        # Weight
        for name in ['weight', 'load', 'weight (kg)', 'weight (lbs)', 'kg', 'lbs']:
            if name in headers_lower:
                mapping['weight'] = headers_lower[name]
                break

        # Weight unit
        for name in ['weight unit', 'unit', 'units']:
            if name in headers_lower:
                mapping['weight_unit'] = headers_lower[name]
                break

        # Notes
        for name in ['notes', 'note', 'comments', 'comment']:
            if name in headers_lower:
                mapping['notes'] = headers_lower[name]
                break

        # RPE
        for name in ['rpe', 'rir']:
            if name in headers_lower:
                mapping['rpe'] = headers_lower[name]
                break

        # Step type (warmup, work, rest, cooldown)
        for name in ['step_type', 'type', 'phase', 'block_type']:
            if name in headers_lower:
                mapping['step_type'] = headers_lower[name]
                break

        # Step/exercise order
        for name in ['step_num', 'step_number', 'order', 'exercise_order']:
            if name in headers_lower:
                mapping['order'] = headers_lower[name]
                break

        # Duration fields
        for name in ['duration_type', 'duration_mode']:
            if name in headers_lower:
                mapping['duration_type'] = headers_lower[name]
                break

        for name in ['duration_value', 'duration', 'time', 'distance']:
            if name in headers_lower:
                mapping['duration_value'] = headers_lower[name]
                break

        for name in ['duration_unit', 'time_unit', 'distance_unit']:
            if name in headers_lower:
                mapping['duration_unit'] = headers_lower[name]
                break

        # Rest
        for name in ['rest_seconds', 'rest', 'rest_time', 'rest_sec']:
            if name in headers_lower:
                mapping['rest'] = headers_lower[name]
                break

        # Target/intensity
        for name in ['target_type', 'intensity_type']:
            if name in headers_lower:
                mapping['target_type'] = headers_lower[name]
                break

        for name in ['target_low', 'target_min', 'zone_low']:
            if name in headers_lower:
                mapping['target_low'] = headers_lower[name]
                break

        for name in ['target_high', 'target_max', 'zone_high']:
            if name in headers_lower:
                mapping['target_high'] = headers_lower[name]
                break

        # Equipment
        for name in ['equipment', 'gear', 'tools']:
            if name in headers_lower:
                mapping['equipment'] = headers_lower[name]
                break

        return mapping

    def _create_column_info(
        self,
        headers: List[str],
        mapping: Dict[str, str],
        match_quality: float = 1.0
    ) -> List[ColumnInfo]:
        """Create column info objects with match quality scores"""
        reverse_mapping = {v: k for k, v in mapping.items()}

        columns = []
        for idx, header in enumerate(headers):
            if header in reverse_mapping:
                # Scale confidence by match quality (exact=100%, fuzzy=85-99%)
                base_confidence = 80
                quality_bonus = match_quality * 20  # Up to 20 extra points for perfect match
                col_confidence = min(100, base_confidence + quality_bonus)
            else:
                col_confidence = 0

            col = ColumnInfo(
                index=idx,
                name=header,
                detected_type=reverse_mapping.get(header),
                confidence=col_confidence,
            )
            columns.append(col)

        return columns

    def _parse_known_format(
        self,
        rows: List[Dict[str, str]],
        mapping: Dict[str, str],
        format_type: str
    ) -> List[ParsedWorkout]:
        """Parse rows using a known format schema"""
        workouts_dict: Dict[str, ParsedWorkout] = {}

        for row in rows:
            # Get workout identifier
            date = row.get(mapping.get('date', ''), '').strip()
            workout_name = row.get(mapping.get('workout_name', ''), '').strip()

            if workout_name and date:
                workout_key = f"{date}_{workout_name}"
            elif workout_name:
                workout_key = workout_name
            elif date:
                workout_key = date
            else:
                # No date or workout_name - use default
                workout_key = "Imported Workout"

            # Get or create workout
            if workout_key not in workouts_dict:
                workouts_dict[workout_key] = ParsedWorkout(
                    name=workout_name or (f"Workout on {date}" if date else "Imported Workout"),
                    date=date if date else None,
                    metadata={'format': format_type}
                )

            workout = workouts_dict[workout_key]

            # Parse exercise
            exercise_name = row.get(mapping.get('exercise', ''), '').strip()
            if not exercise_name:
                continue

            # Get values
            reps_val = row.get(mapping.get('reps', ''), '').strip()
            weight_val = row.get(mapping.get('weight', ''), '').strip()
            weight_unit_val = row.get(mapping.get('weight_unit', ''), '').strip()
            rpe_val = row.get(mapping.get('rpe', ''), '').strip()
            notes_val = row.get(mapping.get('notes', ''), '').strip()
            set_order = row.get(mapping.get('set_order', ''), '').strip()

            # Parse reps and flags
            reps_str, reps_flags = self.parse_reps(reps_val or "1")

            # Parse weight
            weight_str, detected_unit, weight_flags = self.parse_weight(weight_val)

            # Determine unit
            unit = None
            if weight_unit_val:
                unit = 'kg' if 'kg' in weight_unit_val.lower() else 'lbs'
            elif detected_unit:
                unit = detected_unit

            # Parse RPE
            rpe = None
            if rpe_val:
                try:
                    rpe = float(rpe_val)
                except ValueError:
                    pass

            # Combine flags
            flags = list(set(reps_flags + weight_flags))

            # For Strong App format, each row is a set, so we group by exercise
            # Check if exercise already exists in workout
            existing_exercise = next(
                (e for e in workout.exercises if e.raw_name == exercise_name),
                None
            )

            if existing_exercise and format_type == 'strong_app':
                # Increment sets count
                existing_exercise.sets += 1
                # Keep the latest reps (or could average them)
                existing_exercise.reps = reps_str
                if weight_str:
                    existing_exercise.weight = weight_str
                if unit:
                    existing_exercise.weight_unit = unit
            else:
                exercise = ParsedExercise(
                    raw_name=exercise_name,
                    order=str(len(workout.exercises) + 1),
                    sets=1,
                    reps=reps_str,
                    weight=weight_str,
                    weight_unit=unit,
                    rpe=rpe,
                    notes=notes_val if notes_val else None,
                    flags=flags,
                )
                workout.exercises.append(exercise)

        return list(workouts_dict.values())

    def _parse_generic_format(
        self,
        rows: List[Dict[str, str]],
        mapping: Dict[str, str],
        headers: List[str]
    ) -> List[ParsedWorkout]:
        """Parse rows using generic column detection"""
        if 'exercise' not in mapping:
            self.add_warning("Could not detect exercise column")
            return []

        workouts_dict: Dict[str, ParsedWorkout] = {}

        for row in rows:
            # Get workout identifier
            date = row.get(mapping.get('date', ''), '').strip()
            workout_name = row.get(mapping.get('workout_name', ''), 'Workout').strip()

            workout_key = f"{date}_{workout_name}" if date else workout_name

            # Get or create workout
            if workout_key not in workouts_dict:
                workouts_dict[workout_key] = ParsedWorkout(
                    name=workout_name,
                    date=date if date else None,
                    metadata={'format': 'generic'}
                )

            workout = workouts_dict[workout_key]

            # Parse exercise
            exercise_name = row.get(mapping['exercise'], '').strip()
            if not exercise_name:
                continue

            exercise_name = self.normalize_exercise_name(exercise_name)

            # Get values with defaults
            sets_val = row.get(mapping.get('sets', ''), '1').strip() or '1'
            reps_val = row.get(mapping.get('reps', ''), '1').strip() or '1'
            weight_val = row.get(mapping.get('weight', ''), '').strip()
            notes_val = row.get(mapping.get('notes', ''), '').strip()
            rpe_val = row.get(mapping.get('rpe', ''), '').strip()

            # Parse values
            reps_str, reps_flags = self.parse_reps(reps_val)
            weight_str, weight_unit, weight_flags = self.parse_weight(weight_val)

            # Parse RPE
            rpe = None
            if rpe_val:
                try:
                    rpe = float(rpe_val)
                except ValueError:
                    pass

            flags = list(set(reps_flags + weight_flags))

            # Parse sets
            try:
                sets = int(sets_val)
            except ValueError:
                sets = 1

            exercise = ParsedExercise(
                raw_name=exercise_name,
                order=str(len(workout.exercises) + 1),
                sets=sets,
                reps=reps_str,
                weight=weight_str,
                weight_unit=weight_unit,
                rpe=rpe,
                notes=notes_val if notes_val else None,
                flags=flags,
            )
            workout.exercises.append(exercise)

        return list(workouts_dict.values())

    def _calculate_confidence(
        self,
        result: ParseResult,
        detected_format: str,
        match_quality: float = 1.0
    ) -> float:
        """
        Calculate parsing confidence factoring in match quality.

        Args:
            result: The parse result so far
            detected_format: The detected format name
            match_quality: Average header match quality (0.0-1.0)

        Returns:
            Confidence score 0-100
        """
        if not result.workouts:
            return 0

        confidence = 35  # Slightly lower base to account for quality scaling

        # Bonus for known format (use schema-defined boost)
        if detected_format in KNOWN_SCHEMAS:
            schema_boost = KNOWN_SCHEMAS[detected_format]['confidence_boost']
            # Scale boost by match quality (fuzzy matches get reduced boost)
            confidence += schema_boost * match_quality
        else:
            # Generic format with some matches
            confidence += 10 * match_quality

        # Bonus for finding exercise column (essential)
        if any(c.detected_type == 'exercise' for c in result.columns):
            confidence += 15

        # Bonus for other mapped columns
        mapped_types = [c.detected_type for c in result.columns if c.detected_type]
        if 'reps' in mapped_types:
            confidence += 5
        if 'weight' in mapped_types:
            confidence += 5
        if 'date' in mapped_types:
            confidence += 5
        if 'sets' in mapped_types:
            confidence += 3
        if 'notes' in mapped_types:
            confidence += 2

        # Penalty for low match quality on fuzzy matches
        if match_quality < 0.95:
            penalty = (0.95 - match_quality) * 10  # Up to 10 point penalty
            confidence -= penalty

        # Bonus for having actual exercises parsed
        total_exercises = sum(len(w.exercises) for w in result.workouts)
        if total_exercises >= 5:
            confidence += 5
        elif total_exercises >= 1:
            confidence += 2

        return max(0, min(confidence, 100))
