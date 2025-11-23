"""Parser service for converting free text into structured workout data."""
import re
from typing import List, Optional, Union, Tuple
from app.models import Workout, Block, Exercise, Superset
from app.utils import to_int

# Try to import feedback service (optional - won't fail if not available)
try:
    from app.services.feedback_service import FeedbackService
    FEEDBACK_AVAILABLE = True
except ImportError:
    FEEDBACK_AVAILABLE = False

# Constants
SKI_DEFAULT_WORK = 60
SKI_DEFAULT_REST = 90

# Regular expression patterns
RE_DISTANCE = re.compile(r"(?P<d1>\d+)(?:[\-–](?P<d2>\d+))?\s*(m|meter|meters|km|mi|mile|miles)\b", re.I)
RE_REPS_RANGE = re.compile(r"(?P<rmin>\d+)\s*[\-–]\s*(?P<rmax>\d+)\s*reps?", re.I)
RE_REPS_AFTER_X = re.compile(r"[x×]\s*(?P<rmin>\d+)\s*[\-–]\s*(?P<rmax>\d+)\b", re.I)
RE_REPS_PLAIN_X = re.compile(r"[x×]\s*(?P<reps>\d+)\b", re.I)
RE_LABELED = re.compile(r"^[A-E](?:[0-9A-Za-z]+)?[:\-]?\s*(.*)", re.I)
RE_LETTER_START = re.compile(r"^['\"]?[A-E]", re.I)
RE_HEADER = re.compile(r"(primer|strength\s*/\s*power|strength|power|finisher|metabolic\s*conditioning|metabolic|conditioning|amrap|circuit|muscular\s+endurance|tabata|warm.?up)", re.I)
RE_WEEK = re.compile(r"^(week\s*\d+\s*of\s*\d+)", re.I)
RE_TITLE_HINT = re.compile(r"^(upper|lower|full)\s+body|workout|dumbbell", re.I)
RE_ROUNDS_SETS = re.compile(r"(?:(?P<n>\d+)\s*(?P<kind>rounds?|sets?))", re.I)
RE_REST_BETWEEN = re.compile(r"(?P<rest>\d+)\s*(s|sec|secs|seconds)\s*(rest|between)", re.I)
RE_TABATA_CFG = re.compile(
    r"""^[:\s]* (?P<work>\d+)\s*(s|sec|secs|seconds)? \s*
        (?:work|on)? \s* [/:]\s*
        (?P<rest>\d+)\s*(s|sec|secs|seconds)? \s* (?:rest|off)?
        (?:\s*(?:x|X)\s*(?P<rounds>\d+)|\s*(?P<rounds2>\d+)\s*[xX])? \s*$""",
    re.I | re.X
)
RE_SKI = re.compile(r"\b(ski\s*erg|skierg|skier)\b", re.I)
RE_TIME_CAP = re.compile(r"time\s*cap\s*:?\s*(?P<minutes>\d+)\s*min", re.I)
RE_RUN = re.compile(r"\b(run|running|jog)\b", re.I)


class ParserService:
    """Service for parsing free text into structured workout data."""
    
    @staticmethod
    def _looks_like_header(ln: str) -> bool:
        """Check if a line looks like a section header."""
        # Short, mostly letters, uppercase → treat as a section label
        # But NOT if it starts with a labeled exercise pattern (A1:, B2:, etc.)
        if re.match(r"^[A-E](?:[0-9A-Za-z]+)?[:\-]?\s*", ln):
            return False  # This is a labeled exercise, not a header
        
        # Don't treat instruction lines as headers (they contain numbers and specific words)
        if re.search(r"\d+\s*(rounds?|sets?|mins?|secs?|rest)", ln.lower()):
            return False
        
        if len(ln) <= 28 and ln.replace("/", " ").isupper() and re.search(r"[A-Z]{3}", ln):
            return True
        return False
    
    @staticmethod
    def _is_junk(ln: str) -> bool:
        """Check if a line is junk/irrelevant text."""
        ln_stripped = ln.strip()
        ln_lower = ln_stripped.lower()
        
        # Check against learned patterns from user feedback
        if FEEDBACK_AVAILABLE:
            try:
                if FeedbackService.is_likely_not_workout(ln_stripped):
                    return True
            except Exception:
                pass  # Don't fail if feedback service has issues
        
        # Skip very short or mostly punctuation / OCR gunk
        if len(ln_stripped) < 4:
            return True
        
        # Skip common OCR junk words/phrases that appear frequently
        junk_words = [
            'age', 'ago', 'are', 'ate', 'ave', 'ave.', 'ave,',  # Common OCR misreads
            'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all',  # Common words without context
            'like', 'share', 'comment', 'follow', 'followers', 'following',  # Social media UI
            'save', 'more', 'less', 'view', 'show', 'hide',  # UI elements
            'block', 'page', 'next', 'prev', 'previous',  # Navigation
        ]
        
        # If line is just a junk word (with optional punctuation/quotes), skip it
        ln_clean = re.sub(r'^["\']+|["\']+$', '', ln_lower).strip()
        if ln_clean in junk_words:
            return True
        
        # Skip lines that are just a junk word followed by punctuation/quotes
        if re.match(r'^["\']?' + '|'.join(junk_words) + r'["\']?$', ln_lower):
            return True
        
        # Skip Instagram UI elements - but only if the line doesn't contain exercise content
        instagram_words = ['like', 'dislike', 'share', 'comment', 'follow', 'followers', 'following']
        # Check if line contains Instagram words AND no exercise indicators
        exercise_indicators = ['x', ':', 'kg', 'kb', 'db', 'rep', 'set', 'round', 'meter', 'm', 
                              'squat', 'press', 'push', 'pull', 'carry', 'sled', 'swing', 'burpee', 'jump']
        has_exercise_content = any(indicator in ln_lower for indicator in exercise_indicators) or re.search(r'[A-E]\d*:', ln)
        
        if any(instagram_word in ln_lower for instagram_word in instagram_words) and not has_exercise_content:
            return True
        
        # Skip lines that are just numbers (like Instagram like counts: "4", "0")
        if re.match(r'^\d+$', ln_stripped) and len(ln_stripped) <= 3:
            return True
        
        # Skip lines that are just numbers with units (like "368 MINS", "500 REPS") without exercise name
        # These are often OCR artifacts where numbers get misread
        if re.match(r'^\d+\s+(MINS?|MINUTES?|REPS?|SECS?|SECONDS?|KG|LB|LBS?|KM|M|METERS?|MILES?)$', ln_stripped, re.I):
            return True
        
        # Skip lines that are very large numbers with units (unrealistic for exercises)
        # e.g., "368 MINS", "500 REPS" - these are likely OCR errors
        large_number_with_unit = re.match(r'^(?P<num>\d+)\s+(MINS?|MINUTES?|REPS?|SECS?|SECONDS?)$', ln_stripped, re.I)
        if large_number_with_unit:
            num = int(large_number_with_unit.group('num'))
            # If number is > 100 for MINS or > 500 for REPS, it's likely junk
            unit = large_number_with_unit.group(2).upper()
            if 'MIN' in unit and num > 100:
                return True
            if 'REP' in unit and num > 500:
                return True
            if 'SEC' in unit and num > 3600:  # More than 1 hour in seconds
                return True
        
        # Skip lines that look like "block 1", "block 2", etc. (OCR artifacts)
        if re.match(r'^block\s+\d+$', ln_lower):
            return True
        
        # Skip lines that are just single letters or weird patterns like "q:Ry" or "age"
        if re.match(r'^[a-z]{1,4}["\']?$', ln_lower) and ln_lower in junk_words:
            return True
        
        # Skip lines that are just a word followed by quotes (common OCR artifact)
        if re.match(r'^["\']?[a-z]{1,6}["\']?$', ln_lower) and not has_exercise_content:
            return True
        
        # Count letters and common punctuation
        letters = re.sub(r"[^A-Za-z]", "", ln_stripped)
        if len(letters) <= 2:
            return True
        
        # Skip lines with excessive backslashes or weird characters (OCR artifacts)
        if ln_stripped.count('\\') > 2 or ln_stripped.count('|') > 2:
            return True
        
        # Skip lines that look like corrupted text
        if re.match(r'^\\\s*[a-z]\.\s*[a-z]', ln_lower):
            return True
        
        # Skip lines with too many single characters separated by spaces/punctuation
        single_chars = re.findall(r'\b[a-z]\b', ln_lower)
        if len(single_chars) > len(ln_stripped.split()) * 0.5:  # More than 50% single characters
            return True
        
        # Skip lines that don't contain any recognizable exercise-related words
        exercise_words = ['press', 'squat', 'deadlift', 'row', 'pull', 'push', 'curl', 'extension', 
                         'flexion', 'raise', 'lift', 'hold', 'plank', 'burpee', 'jump', 'run', 
                         'walk', 'bike', 'swim', 'ski', 'erg', 'meter', 'rep', 'set', 'round',
                         'goodmorning', 'sled', 'drag', 'carry', 'farmer', 'hand', 'release',
                         'kb', 'db', 'dual', 'alternating', 'broad', 'swing', 'skier']
        has_exercise_word = any(word in ln_lower for word in exercise_words)
        
        # If it's a short line without exercise words and has weird characters, skip it
        if len(ln_stripped) < 20 and not has_exercise_word and re.search(r'[\\|\.]{2,}', ln_stripped):
            return True
        
        return False
    
    @staticmethod
    def _clean_ocr_artifacts(lines: List[str]) -> List[str]:
        """Clean up OCR artifacts from lines."""
        cleaned_lines = []
        prev_line = ""
        for ln in lines:
            # Clean up common OCR artifacts
            ln = ln.replace("'", "").replace("'", "").replace("'", "")
            # Strip noisy leading punctuation/emoji remnants
            ln = re.sub(r"^[^0-9A-Za-z]+", "", ln)
            # Fix specific OCR misreadings for exercise labels
            if re.match(r'^82[:\-]', ln):
                # Context-aware: if previous line was B1, this is likely B2
                if re.match(r'^B1[:\-]', prev_line):
                    ln = re.sub(r'^82([:\-])', r'B2\1', ln)
                else:
                    # Could be B2, C2, D2 - check if previous line gives context
                    if re.match(r'^B\d+[:\-]', prev_line):
                        ln = re.sub(r'^82([:\-])', r'B2\1', ln)
                    elif re.match(r'^C\d+[:\-]', prev_line):
                        ln = re.sub(r'^82([:\-])', r'C2\1', ln)
                    elif re.match(r'^D\d+[:\-]', prev_line):
                        ln = re.sub(r'^82([:\-])', r'D2\1', ln)
                    else:
                        # Default to B2 as it's most common
                        ln = re.sub(r'^82([:\-])', r'B2\1', ln)
            # Fix other similar misreadings
            ln = re.sub(r"^81([:\-])", "B1\1", ln)
            ln = re.sub(r"^83([:\-])", "B3\1", ln)
            ln = re.sub(r"^72([:\-])", "A2\1", ln)
            ln = re.sub(r"^71([:\-])", "A1\1", ln)
            ln = re.sub(r"^73([:\-])", "A3\1", ln)
            # Fix specific OCR issues
            ln = re.sub(r"^Ax:", "A1:", ln)
            ln = re.sub(r"^Az:", "A2:", ln)
            # Then apply general patterns
            ln = re.sub(r"^([A-E])[a-z]+:", r"\1:", ln)
            ln = re.sub(r"oS OFF", "90S OFF", ln)
            # Handle any remaining quote issues
            ln = re.sub(r"^'([A-E])", r"\1", ln)

            # Normalize short letter prefixes before digits (e.g., "pE 20" -> "20")
            ln = re.sub(r"^[A-Za-z]{1,2}\s+(?=\d)", "", ln)

            # If line is mostly uppercase letters, collapse stray characters and spacing
            letters_only = re.findall(r"[A-Za-z]", ln)
            if letters_only:
                upper_count = sum(1 for ch in letters_only if ch.isupper())
                lower_count = len(letters_only) - upper_count
                if upper_count >= max(4, int(0.8 * len(letters_only))) and lower_count <= 2:
                    upper_normalized = re.sub(r"[^A-Z0-9\s]", "", ln.upper())
                    upper_normalized = re.sub(r"\s{2,}", " ", upper_normalized).strip()
                    if upper_normalized:
                        ln = upper_normalized

            # Remove leftover leading hyphen/dash artifacts after normalization
            ln = re.sub(r"^[\-–—]+\s*", "", ln)

            cleaned_lines.append(ln)
            prev_line = ln
        return cleaned_lines
    
    @staticmethod
    def _extract_relevant_number(text: str) -> Optional[int]:
        """Return the most relevant numeric value from OCR text."""
        nums = [int(n) for n in re.findall(r"\d+", text)]
        if not nums:
            return None
        return max(nums)

    @staticmethod
    def _parse_hyrox_engine_builder(lines: List[str], source: Optional[str]) -> Optional[Workout]:
        """Special-case parser for HYROX Engine Builder cards."""

        if not lines:
            return None

        normalized_lines = []
        for ln in lines:
            stripped = re.sub(r"\s+", " ", ln).strip()
            if stripped:
                normalized_lines.append(stripped)

        if not normalized_lines:
            return None

        joined_upper = " ".join(normalized_lines).upper()
        compact = re.sub(r"\s+", "", joined_upper)
        if "HYROX" not in compact:
            return None
        if "ENGINEBUILDER" not in compact:
            return None
        # Don't use Engine Builder parser if it looks like a structured workout program
        # (e.g., "WEEK X OF Y", "PRIMER", "STRENGTH", etc.)
        if re.search(r"WEEK\s*\d+\s*OF\s*\d+", joined_upper):
            return None
        if "PRIMER" in joined_upper or "STRENGTH" in joined_upper or "MUSCULAR" in joined_upper or "METABOLIC" in joined_upper:
            return None

        exercises: List[Exercise] = []

        skip_tokens = {
            "HY ROX CPEC",
            "HYROX CPEC",
            "HYROX CF",
            "FITNESS",
            "S ENGINE BUILDER",
            "ENGINE BUILDER",
            "ENGINEBUILDER",
        }

        for raw in normalized_lines:
            up = re.sub(r"[^A-Z0-9 ]", " ", raw.upper())
            up = re.sub(r"\s+", " ", up).strip()
            if not up or up in skip_tokens:
                continue

            number = ParserService._extract_relevant_number(up)
            if not number:
                continue

            if "RUN" in up:
                exercises.append(Exercise(name="Run", distance_m=number, type="HIIT"))
                continue

            if "ROW" in up:
                exercises.append(Exercise(name="Row", distance_m=number, type="HIIT"))
                continue

            if "WALL" in up and "BALL" in up:
                exercises.append(Exercise(name="Wall Balls", reps=number, type="strength"))
                continue

            if "BURPEE" in up:
                exercises.append(Exercise(name="Burpee Broad Jump", reps=number, type="HIIT"))
                continue

            if "LUNGE" in up:
                exercises.append(Exercise(name="Walking Lunges", distance_m=number, type="strength"))
                continue

            if "SLED" in up and "PUSH" in up:
                exercises.append(Exercise(name="Sled Push", distance_m=number, type="strength"))
                continue

            if "FARMERS" in up and "CARRY" in up:
                exercises.append(Exercise(name="Farmers Carry", distance_m=number, type="strength"))
                continue

        if not exercises:
            return None

        block = Block(
            label="Engine Builder",
            structure="Complete sequence in order",
            time_work_sec=None,
            supersets=[Superset(exercises=exercises)],
        )

        workout = Workout(
            title="Hyrox Engine Builder",
            source=source,
            blocks=[block],
        )

        return workout

    @staticmethod
    def parse_free_text_to_workout(text: str, source: Optional[str] = None, return_filtered: bool = False) -> Union[Workout, Tuple[Workout, List[dict]]]:
        """
        Parse free text into a structured Workout object.
        
        Args:
            text: Raw text to parse
            source: Optional source identifier
            return_filtered: If True, return tuple of (Workout, filtered_items)
            
        Returns:
            Parsed Workout object, or tuple of (Workout, filtered_items) if return_filtered=True
        """
        lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
        
        # Clean up OCR artifacts before processing
        cleaned_lines = ParserService._clean_ocr_artifacts(lines)
        
        # Track filtered junk items for review
        filtered_items = []
        
        # Special-case HYROX Engine Builder style cards
        # BUT: Skip if it looks like a structured workout program (has section headers)
        has_structured_sections = any(
            re.search(r"(primer|strength\s*/\s*power|muscular\s+endurance|metabolic\s*conditioning)", ln, re.I)
            for ln in cleaned_lines
        )
        has_week_format = any(
            re.search(r"week\s*\d+\s*of\s*\d+", ln, re.I)
            for ln in cleaned_lines
        )
        
        # Only use Engine Builder parser if it's clearly an Engine Builder card
        # (has HYROX + ENGINEBUILDER but NOT structured sections)
        if not has_structured_sections and not has_week_format:
            hyrox_workout = ParserService._parse_hyrox_engine_builder(cleaned_lines, source)
            if hyrox_workout:
                if return_filtered:
                    return hyrox_workout, filtered_items
                return hyrox_workout

        # Detect time cap and Hyrox-style workouts (running + exercises)
        time_cap_minutes = None
        has_running = False
        for ln in cleaned_lines:
            time_cap_match = RE_TIME_CAP.search(ln)
            if time_cap_match:
                time_cap_minutes = to_int(time_cap_match.group("minutes"))
            # Check for running - look for "Run" or "m Run" pattern
            if RE_RUN.search(ln) and RE_DISTANCE.search(ln):
                has_running = True
            # Also check for "m Run" pattern (common in Hyrox workouts)
            if re.search(r'\d+\s*m\s+run', ln, re.I):
                has_running = True
        
        blocks: List[Block] = []
        current = Block(label="Block 1")
        wk_title = None
        current_superset: List[Exercise] = []
        superset_letter = None
        
        # If time cap detected, set it on the first block
        if time_cap_minutes:
            current.time_work_sec = time_cap_minutes * 60
            current.structure = f"for time (cap: {time_cap_minutes} min)"

        for ln in cleaned_lines:
            if ParserService._is_junk(ln):
                if return_filtered:
                    filtered_items.append({
                        "text": ln,
                        "original_line": ln,
                        "reason": "junk_detection",
                        "block": "Unknown",
                        "line_number": None
                    })
                continue
            
            # Skip time cap line (already processed)
            if RE_TIME_CAP.search(ln):
                continue

            # Title capture
            if not wk_title:
                m_week = RE_WEEK.match(ln)
                if m_week:
                    wk_title = m_week.group(1).title()
                    continue
                # Check for "JOUR" or workout day patterns (Hyrox style)
                if re.match(r'^JOUR\s*\d+', ln, re.I):
                    # Look for next line as title (e.g., "HYROX")
                    wk_title = ln.title()
                    continue
                # Check if line looks like a workout type title (HYROX, all caps short words)
                if len(ln.split()) <= 2 and ln.isupper() and len(ln) <= 15:
                    wk_title = ln.title()
                    continue
                if RE_TITLE_HINT.search(ln) and len(ln.split()) <= 6:
                    wk_title = ln.title()
                    continue

            # Tabata/time config (never an exercise)
            m_tab = RE_TABATA_CFG.match(ln)
            if m_tab:
                work = to_int(m_tab.group("work")) or 20
                rest = to_int(m_tab.group("rest")) or 10
                rounds = to_int(m_tab.group("rounds")) or to_int(m_tab.group("rounds2")) or 8
                current.time_work_sec = work
                current.rest_between_sec = rest
                current.structure = f"{rounds} rounds"
                if not current.label or current.label.lower() == "block 1":
                    current.label = "Tabata"
                continue

            # Section headers - check for common workout section patterns
            # Also check for all-caps section headers (common in OCR)
            is_section_header = False
            ln_upper = ln.upper().strip()
            
            # Check regex patterns
            if RE_HEADER.search(ln) or ParserService._looks_like_header(ln):
                is_section_header = True
            # Also check if line is all caps and matches section header keywords
            elif ln_upper in ["PRIMER", "STRENGTH", "POWER", "STRENGTH / POWER", "MUSCULAR ENDURANCE", "METABOLIC CONDITIONING", "CONDITIONING"]:
                is_section_header = True
            # Check for section headers with common OCR variations
            elif re.match(r'^(PRIMER|STRENGTH|POWER|MUSCULAR|ENDURANCE|METABOLIC|CONDITIONING)', ln_upper):
                is_section_header = True
            # Check for "STRENGTH / POWER" pattern
            elif re.search(r'STRENGTH\s*[/\\]\s*POWER', ln_upper):
                is_section_header = True
            
            if is_section_header:
                # Finish current superset if any
                if current_superset:
                    current.supersets.append(Superset(exercises=current_superset.copy()))
                    current_superset.clear()
                
                if current.exercises or current.supersets:
                    blocks.append(current)
                # Normalize a few known variants to nicer labels
                lbl = ln.title()
                if re.search(r"primer", ln, re.I):
                    lbl = "Primer"
                if re.search(r"strength\s*/\s*power", ln, re.I):
                    lbl = "Strength / Power"
                elif re.search(r"strength", ln, re.I) and not re.search(r"endurance", ln, re.I):
                    lbl = "Strength"
                if re.search(r"muscular\s+endurance", ln, re.I):
                    lbl = "Muscular Endurance"
                if re.search(r"metabolic\s*conditioning", ln, re.I):
                    lbl = "Metabolic Conditioning"
                elif re.search(r"metabolic", ln, re.I) or (re.search(r"conditioning", ln, re.I) and not re.search(r"muscular", ln, re.I)):
                    lbl = "Metabolic Conditioning"
                current = Block(label=lbl)
                # Preserve time cap if it was set
                if time_cap_minutes:
                    current.time_work_sec = time_cap_minutes * 60
                    current.structure = f"for time (cap: {time_cap_minutes} min)"
                superset_letter = None
                # Inline structure / default reps in header
                m_struct = RE_ROUNDS_SETS.search(ln)
                if m_struct:
                    current.structure = f"{m_struct.group('n')} {m_struct.group('kind').lower()}"
                    current.default_sets = to_int(m_struct.group("n"))
                m_range = RE_REPS_RANGE.search(ln)
                if m_range:
                    current.default_reps_range = f"{m_range.group('rmin')}-{m_range.group('rmax')}"
                continue

            # Standalone structure/rest/reps-range lines
            m_s = RE_ROUNDS_SETS.search(ln)
            m_r = RE_REST_BETWEEN.search(ln)
            m_range_only = RE_REPS_RANGE.search(ln)
            if m_s or m_r or m_range_only:
                if m_s:
                    current.structure = f"{m_s.group('n')} {m_s.group('kind').lower()}"
                    current.default_sets = to_int(m_s.group("n"))
                if m_r:
                    current.rest_between_sec = to_int(m_r.group("rest"))
                if m_range_only:
                    current.default_reps_range = f"{m_range_only.group('rmin')}-{m_range_only.group('rmax')}"
                continue

            # Ski Erg special
            if RE_SKI.search(ln) and not RE_LETTER_START.match(ln):
                current.label = "Ski Erg"
                current.time_work_sec = current.time_work_sec or SKI_DEFAULT_WORK
                current.rest_between_sec = current.rest_between_sec or SKI_DEFAULT_REST
                m_dist_inline = RE_DISTANCE.search(ln)
                if m_dist_inline:
                    d1, d2 = m_dist_inline.group("d1"), m_dist_inline.group("d2")
                    if d2:
                        dist_range = f"{d1}-{d2}m"
                        current.exercises.append(Exercise(name=ln, distance_range=dist_range, type="strength"))
                    else:
                        current.exercises.append(Exercise(name=ln, distance_m=to_int(d1), type="strength"))
                else:
                    if not current.exercises:
                        current.exercises.append(Exercise(name="Ski Erg", type="interval"))
                continue

            # Exercises
            full_line_for_name = ln
            
            # Check if line starts with A-E
            letter_match = RE_LETTER_START.match(ln)
            exercise_letter = None
            if letter_match:
                letter_part = letter_match.group(0)
                exercise_letter = letter_part[-1].upper()
                m_lab = RE_LABELED.match(ln)
                if m_lab:
                    ln = m_lab.group(1)
                else:
                    ln = re.sub(r"^[A-E][:\-]?\s*", "", ln)

            # Check for interval/timed exercise pattern
            interval_pattern = re.compile(r'(?P<work>\d+)S?\s+ON\s+(?P<rest>\d+)S?\s+OFF(?:\s+X(?P<sets>\d+))?', re.I)
            m_interval = interval_pattern.search(ln)
            
            time_work_sec = None
            rest_sec = None
            sets = None
            
            if m_interval:
                time_work_sec = to_int(m_interval.group("work"))
                rest_sec = to_int(m_interval.group("rest"))
                sets = to_int(m_interval.group("sets"))
                if current.label and "Metabolic Conditioning" in current.label:
                    current.time_work_sec = current.time_work_sec or time_work_sec
                    current.rest_between_sec = current.rest_between_sec or rest_sec
            
            # Distance
            distance_m = None
            distance_range = None
            m_dist = RE_DISTANCE.search(ln)
            if m_dist:
                d1, d2 = m_dist.group("d1"), m_dist.group("d2")
                if d2:
                    distance_range = f"{d1}-{d2}m"
                else:
                    distance_m = to_int(d1)
            
            # Reps-range
            reps_range = None
            reps = None
            
            if not m_interval and not m_dist:
                m_rr = RE_REPS_RANGE.search(ln) or RE_REPS_AFTER_X.search(ln)
                if m_rr:
                    reps_range = f"{m_rr.group('rmin')}-{m_rr.group('rmax')}"
                else:
                    m_rx = RE_REPS_PLAIN_X.search(ln)
                    if m_rx:
                        reps = to_int(m_rx.group("reps"))
                    else:
                        # Check for number at start of line (e.g., "80 Walking Lunges", "15 WALL BALLS")
                        # This handles Hyrox-style workouts where reps come before exercise name
                        # First check if it's a distance pattern (e.g., "1000M RUN" should be distance, not reps)
                        is_distance_pattern = bool(re.search(r'\d+\s*(m|meter|meters|km|mi|mile|miles)\b', ln, re.I))
                        if not is_distance_pattern:
                            # Simple pattern: number at start, followed by space, NOT followed by kg/mg
                            reps_at_start = re.match(r'^(?P<reps>\d+)\s+(?![km]g\b)', ln)
                            if reps_at_start and not RE_RUN.search(ln):
                                reps = to_int(reps_at_start.group("reps"))

            # Inherit reps_range from header if none on line
            if not reps and not reps_range and not distance_m and not distance_range and current.default_reps_range:
                reps_range = current.default_reps_range

            # Classify exercise type
            # For Hyrox-style workouts (time cap + running), all exercises should be HIIT
            if time_cap_minutes and has_running:
                ex_type = "HIIT"
            # For running exercises, always set type to HIIT
            elif RE_RUN.search(ln) and (distance_m or distance_range):
                ex_type = "HIIT"
            elif time_work_sec or rest_sec:
                ex_type = "interval"
            else:
                ex_type = "strength" if (reps or reps_range or distance_m or distance_range) else "interval"

            # Clean and validate exercise name
            exercise_name = full_line_for_name.strip(" .")
            
            # If we haven't extracted reps yet, try extracting from exercise name
            # This handles cases like "15 WALL BALLS" where the number is at the start
            if not reps and not m_interval and not m_dist and not distance_m and not distance_range:
                # Check if exercise name starts with a number (e.g., "15 WALL BALLS")
                # First verify it's NOT a distance pattern
                is_distance_in_name = bool(re.search(r'\d+\s*(m|meter|meters|km|mi|mile|miles)\b', exercise_name, re.I))
                if not is_distance_in_name:
                    # Simple pattern: number at start, followed by space, NOT followed by kg/mg
                    reps_at_start = re.match(r'^(?P<reps>\d+)\s+(?![km]g\b)', exercise_name)
                    if reps_at_start and not RE_RUN.search(exercise_name):
                        reps = to_int(reps_at_start.group("reps"))
                        # Remove the number from exercise name for cleaner display
                        exercise_name = re.sub(r'^\d+\s+', '', exercise_name)
            
            # If we already extracted reps, make sure to remove the number from exercise name if it's still there
            elif reps and not m_interval and not m_dist:
                # Check if exercise name starts with the same number we extracted as reps
                reps_at_start_match = re.match(r'^(?P<reps_num>\d+)\s+', exercise_name)
                if reps_at_start_match and int(reps_at_start_match.group('reps_num')) == reps:
                    # Remove the number and following space from exercise name for cleaner display
                    exercise_name = re.sub(r'^\d+\s+', '', exercise_name)
            
            exercise_name = re.sub(r'\s+(Dislike|Share|Like|Comment|Follow|Followers|Following)$', '', exercise_name, flags=re.I)
            exercise_name = re.sub(r'\s+([a-z])$', '', exercise_name)
            exercise_name = exercise_name.strip()
            
            # Additional validation: Check if exercise name is just a number with unit (like "368 MINS")
            # This catches cases where OCR misreads exercise names as numbers
            if re.match(r'^\d+\s+(MINS?|MINUTES?|REPS?|SECS?|SECONDS?)$', exercise_name, re.I):
                if return_filtered:
                    filtered_items.append({
                        "text": exercise_name,
                        "original_line": full_line_for_name,
                        "reason": "numeric_unit_only",
                        "block": current.label or "Unknown",
                        "line_number": None
                    })
                continue
            
            # Check for unrealistic numbers (very large durations/reps that are likely OCR errors)
            large_num_match = re.match(r'^(?P<num>\d+)\s+(MINS?|MINUTES?|REPS?|SECS?|SECONDS?)$', exercise_name, re.I)
            if large_num_match:
                num = int(large_num_match.group('num'))
                unit = large_num_match.group(2).upper()
                is_junk = False
                if 'MIN' in unit and num > 100:  # More than 100 minutes is unrealistic
                    is_junk = True
                elif 'REP' in unit and num > 500:  # More than 500 reps is unrealistic
                    is_junk = True
                elif 'SEC' in unit and num > 3600:  # More than 1 hour in seconds
                    is_junk = True
                
                if is_junk:
                    if return_filtered:
                        filtered_items.append({
                            "text": exercise_name,
                            "original_line": full_line_for_name,
                            "reason": "unrealistic_value",
                            "block": current.label or "Unknown",
                            "line_number": None
                        })
                    continue
            
            if ParserService._is_junk(exercise_name):
                # Track filtered item for review
                if return_filtered:
                    filtered_items.append({
                        "text": exercise_name,
                        "original_line": full_line_for_name,
                        "reason": "junk_detection",
                        "block": current.label or "Unknown",
                        "line_number": None  # Could track line number if needed
                    })
                continue
            
            if re.search(r'^\\\s*[a-z]\.\s*[a-z]', exercise_name.lower()):
                if return_filtered:
                    filtered_items.append({
                        "text": exercise_name,
                        "original_line": full_line_for_name,
                        "reason": "corrupted_text",
                        "block": current.label or "Unknown",
                        "line_number": None
                    })
                continue
            
            # Use default_sets from block if sets not already set
            exercise_sets = sets if sets is not None else current.default_sets
            
            exercise = Exercise(
                name=exercise_name,
                sets=exercise_sets,
                reps=reps if not m_interval else None,
                reps_range=reps_range,
                duration_sec=time_work_sec,
                rest_sec=rest_sec,
                distance_m=distance_m,
                distance_range=distance_range,
                type=ex_type
            )
            
            # Handle supersets vs individual exercises
            if exercise_letter:
                # Special case: METABOLIC CONDITIONING E exercises should be individual
                if current.label and "Metabolic Conditioning" in current.label and exercise_letter == "E":
                    if current_superset:
                        current.supersets.append(Superset(exercises=current_superset.copy()))
                        current_superset.clear()
                        superset_letter = None
                    current.exercises.append(exercise)
                # Exception: MUSCULAR ENDURANCE has multiple supersets
                elif current.label and "Muscular Endurance" in current.label:
                    if superset_letter != exercise_letter:
                        if current_superset:
                            current.supersets.append(Superset(exercises=current_superset.copy()))
                        current_superset = [exercise]
                        superset_letter = exercise_letter
                    else:
                        current_superset.append(exercise)
                else:
                    # For all other blocks, group all exercises into one superset
                    # For Hyrox-style workouts (time cap + running), group all exercises into one superset
                    if time_cap_minutes and has_running:
                        if not current_superset:
                            current_superset = [exercise]
                            superset_letter = exercise_letter
                        else:
                            current_superset.append(exercise)
                    elif not current_superset:
                        current_superset = [exercise]
                        superset_letter = exercise_letter
                    else:
                        current_superset.append(exercise)
            else:
                # For Hyrox-style workouts (time cap + running), add unlabeled exercises to superset too
                if time_cap_minutes and has_running:
                    if not current_superset:
                        current_superset = [exercise]
                    else:
                        current_superset.append(exercise)
                else:
                    # Finish current superset if any (unlabeled exercise starts)
                    if current_superset:
                        current.supersets.append(Superset(exercises=current_superset.copy()))
                        current_superset.clear()
                        superset_letter = None
                    current.exercises.append(exercise)

        # Finish any remaining superset
        if current_superset:
            current.supersets.append(Superset(exercises=current_superset.copy()))
        
        if current.exercises or current.supersets:
            blocks.append(current)

        workout = Workout(title=(wk_title or "Imported Workout"), source=source, blocks=blocks)
        if return_filtered:
            return workout, filtered_items
        return workout
    
    @staticmethod
    def parse_ai_workout(text: str, source: Optional[str] = None) -> Workout:
        """
        Parse AI/ChatGPT-generated workout text into a structured Workout object.
        
        Handles formatted workouts with:
        - Numbered sections (1. Section Title)
        - Narrative exercise descriptions
        - Equipment notes in parentheses
        - Superset clusters with rest times
        - Special formatting characters
        - Cycling/Zwift workouts (FTP-based, time intervals)
        
        Args:
            text: Raw AI-generated workout text
            source: Optional source identifier
            
        Returns:
            Parsed Workout object
        """
        # Check if this is a cycling/Zwift workout (has FTP, cadence, time intervals)
        is_cycling_workout = (
            re.search(r'\bFTP\b', text, re.I) or
            re.search(r'\bcadence\b', text, re.I) or
            re.search(r'\d+:\d+[–\-]\d+:\d+', text) or  # Time intervals like "0:00–3:00"
            re.search(r'% FTP', text, re.I) or
            re.search(r'zwift', text, re.I)
        )
        
        if is_cycling_workout:
            return ParserService._parse_cycling_workout(text, source)
        
        # Extract title if present (look for title-like lines at the start)
        # Match titles with emoji or without, must contain "Workout" or be a workout-like description
        title_patterns = [
            r'^([🔥🏋️💥🧊]*\s*[A-Z][^.\n]{5,80}Workout[^\n]*)',  # With emoji and "Workout"
            r'^([🔥🏋️💥🧊]*\s*[A-Z][^.\n]{10,80}(?:Strength|Endurance|Cardio|Upper|Lower|Full)[^\n]*)',  # With exercise type
            r'^([A-Z][^.\n]{5,60}Workout[^\n]*)',  # Without emoji
        ]
        
        blocks: List[Block] = []
        lines = text.split('\n')
        
        workout_title = "AI Generated Workout"
        title_line_index = -1
        for pattern in title_patterns:
            title_match = re.search(pattern, text, re.MULTILINE | re.IGNORECASE)
            if title_match:
                workout_title = title_match.group(1).strip()
                # Remove emoji from title for cleaner display
                workout_title = re.sub(r'^[🔥🏋️💥🧊]+\s*', '', workout_title)
                # Find which line contains the title so we can skip it
                title_text = title_match.group(0).strip()
                for idx, line in enumerate(lines):
                    if title_text in line or workout_title in line:
                        title_line_index = idx
                        break
                break
        
        current_block: Optional[Block] = None
        pending_exercises: List[Exercise] = []  # Exercises collected before superset marker
        
        i = 0
        while i < len(lines):
            line = lines[i].strip()
            
            # Skip the title line (we already extracted it)
            if i == title_line_index:
                i += 1
                continue
            
            # Skip empty lines and separator lines (⸻)
            if not line or line == '⸻':
                i += 1
                continue
            
            # Check for numbered section header (e.g., "1. Big Lifts (Single Sets)")
            # Only match if it looks like a section title (short, no exercise indicators like "sets", "reps", "x")
            numbered_section_match = re.match(r'^\d+\.\s+(.+?)(?:\s*\([^)]+\))?$', line)
            is_numbered_section = False
            if numbered_section_match:
                # Section headers are usually short (< 50 chars) and don't contain exercise indicators
                section_text = numbered_section_match.group(1).lower()
                has_exercise_indicators = any(indicator in section_text for indicator in ['sets', 'reps', ' x ', '–', '-'])
                is_numbered_section = len(line) < 60 and not has_exercise_indicators
            
            # Check for emoji/formatted section headers (e.g., "🔥 Warm-Up (10 min):", "🏋️ Strength Block (30 min):")
            # Match one or more emojis followed by text (may or may not end with colon)
            emoji_section_match = re.match(r'^[🔥🏋️💥🧊🧘🎯]+(?:\s+)?(.+?)(?:\s*\([^)]+\))?:?$', line)
            
            # Check for plain text section headers ending with colon (e.g., "Warm-Up (10 min):")
            # Must be relatively short and not contain exercise indicators
            colon_section_match = None
            if len(line) < 80 and ':' in line:
                match = re.match(r'^([A-Z][A-Za-z\s&/+-]+?)(?:\s*\([^)]+\))?:?$', line)
                if match:
                    section_text = match.group(1).lower()
                    has_exercise_indicators = any(indicator in section_text for indicator in ['sets', 'reps', ' x ', '–', '-'])
                    if not has_exercise_indicators:
                        colon_section_match = match
            
            section_match = None
            if is_numbered_section:
                section_match = numbered_section_match
            elif emoji_section_match:
                section_match = emoji_section_match
            elif colon_section_match:
                section_match = colon_section_match
            
            if section_match:
                # Save previous block if exists
                if current_block:
                    # Add any pending exercises as individual exercises
                    if pending_exercises:
                        current_block.exercises.extend(pending_exercises)
                        pending_exercises.clear()
                    if current_block.exercises or current_block.supersets:
                        blocks.append(current_block)
                
                section_title = section_match.group(1).strip()
                # Remove emoji if present
                section_title = re.sub(r'^[🔥🏋️💥🧊]+\s*', '', section_title)
                # Extract category from parentheses if present (e.g., "(10 min)", "(30 min)")
                category_match = re.search(r'\(([^)]+)\)', line)
                category = category_match.group(1) if category_match else None
                
                block_label = section_title
                if category:
                    block_label = f"{section_title} ({category})"
                
                current_block = Block(label=block_label)
                # Extract time from category if it's a duration (e.g., "10 min", "30 min")
                if category and 'min' in category.lower():
                    time_match = re.search(r'(\d+)\s*min', category.lower())
                    if time_match:
                        current_block.time_work_sec = to_int(time_match.group(1)) * 60
                        current_block.structure = category
                pending_exercises.clear()
                i += 1
                continue
            
            # Check for superset cluster marker on its own line (comes AFTER exercises)
            # Handle rest time ranges like "60–75s" by extracting the first number
            superset_match = re.search(r'\(superset\s*x\s*(?P<sets>\d+)(?:,\s*(?P<rest>\d+)[\s–\-]?\d*\s*s?\s*rest)?\)', line, re.I)
            if superset_match:
                if current_block and pending_exercises:
                    sets_count = to_int(superset_match.group("sets"))
                    rest_str = superset_match.group("rest")
                    # Extract first number from rest (handles "60–75s" -> 60)
                    rest_sec = to_int(rest_str.split('–')[0].split('-')[0].strip() if rest_str else None)
                    # Apply sets to all exercises in superset (superset sets override individual)
                    for ex in pending_exercises:
                        ex.sets = sets_count
                    # Create superset from pending exercises
                    current_block.supersets.append(Superset(
                        exercises=pending_exercises.copy(),
                        rest_between_sec=rest_sec
                    ))
                    current_block.default_sets = sets_count
                    current_block.structure = f"{sets_count} sets"
                    pending_exercises.clear()
                i += 1
                continue
            
            # Skip standalone description lines that are clearly not exercises
            # Skip metadata lines (Location, Duration, Frequency, Goal, etc.)
            metadata_patterns = [
                r'^(Location|Duration|Frequency|Goal|Equipment|Notes?|Instructions?):',
                r'^\d+\s*(minutes?|mins?|hours?|hrs?)(\s+per|/)?',
                r'^Frequency:',
                r'^Goal:',
            ]
            is_metadata = any(re.match(pattern, line, re.I) for pattern in metadata_patterns)
            if is_metadata:
                i += 1
                continue
            
            # Look for exercise lines (usually start with • or numbered list items or are indented)
            # Check for numbered exercise list items (e.g., "1. Exercise Name – 4 sets x 5–8 reps")
            is_numbered_exercise = re.match(r'^\d+\.\s+.+?[\s–\-](?:sets|reps|x)', line, re.I)
            
            # Exercise lines should contain exercise-related keywords or patterns
            has_exercise_indicators = (
                re.search(r'\b(sets|reps|x|minutes?|sec|kg|lb|lbs?|weight|carry|press|row|pull|push|squat|deadlift|lunge|curl|raise|fly|extension|dip|pull.?up)\b', line, re.I) or
                is_numbered_exercise or
                line.startswith('•')
            )
            
            if (line.startswith('•') or is_numbered_exercise) or (has_exercise_indicators and line and len(line) > 10 and not line.startswith('(')):
                # Remove bullet point, number prefix, and leading whitespace
                exercise_line = re.sub(r'^(?:•|\d+\.)\s+', '', line)
                exercise_line = exercise_line.strip()
                
                # Skip if line is too short after cleaning
                if len(exercise_line) < 3:
                    i += 1
                    continue
                
                # Collect multi-line exercise description
                # Check if next lines are part of this exercise (descriptions, not new exercises)
                full_exercise_text = exercise_line
                j = i + 1
                blank_lines_seen = 0
                while j < len(lines):
                    next_line = lines[j].strip()
                    # Stop if we hit a new exercise bullet, section, superset marker, or separator
                    # Also check for emoji headers (new block headers)
                    is_next_section_header = (
                        re.match(r'^[🔥🏋️💥🧊🧘🎯]+', next_line) or  # Emoji header
                        re.match(r'^\d+\.\s+(.+?)(?:\s*\([^)]+\))?$', next_line) and len(next_line) < 60  # Numbered section
                    )
                    if (next_line == '⸻' or
                        next_line.startswith('•') or
                        (next_line.startswith('(') and 'superset' in next_line.lower()) or
                        re.match(r'^\d+\.', next_line) or
                        is_next_section_header):
                        break
                    # Continue collecting description lines
                    if next_line:
                        blank_lines_seen = 0
                        # Check if it's likely a description vs new exercise
                        is_description = (
                            re.match(r'^\d+\s+(heavy|working|set)', next_line, re.I) or  # "1 heavy working set"
                            (re.match(r'^\d+', next_line) and any(word in next_line.lower() for word in ['set', 'reps', 'heavy', 'working'])) or
                            next_line[0].islower() or  # Starts with lowercase
                            (len(next_line) < 50 and not next_line[0].isupper())  # Short lowercase lines are descriptions
                        )
                        if is_description and not next_line.startswith('('):
                            full_exercise_text += ' ' + next_line
                            j += 1
                        else:
                            # If it looks like a new exercise (starts with capital and is long), stop
                            if next_line[0].isupper() and len(next_line) > 20:
                                break
                            # Otherwise, might still be part of description
                            j += 1
                    else:
                        # Blank line - allow one blank line between exercise and description
                        blank_lines_seen += 1
                        if blank_lines_seen > 1:
                            break
                        j += 1
                
                # Extract exercise name and details
                exercise = ParserService._parse_ai_exercise_line(full_exercise_text)
                if exercise and current_block:
                    pending_exercises.append(exercise)
                
                # Skip the lines we already processed
                i = j
                continue
            
            i += 1
        
        # Finish last block
        if current_block:
            # Check if there's a superset marker after the last exercise (might be at end of text)
            # Look ahead for any remaining superset markers
            if pending_exercises:
                # Check if there's a superset marker in remaining lines
                for k in range(i, len(lines)):
                    remaining_line = lines[k].strip()
                    superset_match = re.search(r'\(superset\s*x\s*(?P<sets>\d+)(?:,\s*(?P<rest>\d+)[\s–\-]?\d*\s*s?\s*rest)?\)', remaining_line, re.I)
                    if superset_match:
                        sets_count = to_int(superset_match.group("sets"))
                        rest_str = superset_match.group("rest")
                        # Extract first number from rest (handles "60–75s" -> 60)
                        rest_sec = to_int(rest_str.split('–')[0].split('-')[0].strip() if rest_str else None)
                        # Apply sets to all exercises in superset
                        for ex in pending_exercises:
                            ex.sets = sets_count
                        # Create superset from pending exercises
                        current_block.supersets.append(Superset(
                            exercises=pending_exercises.copy(),
                            rest_between_sec=rest_sec
                        ))
                        current_block.default_sets = sets_count
                        current_block.structure = f"{sets_count} sets"
                        pending_exercises.clear()
                        break
                
                # If no superset marker found, add as individual exercises
                if pending_exercises:
                    current_block.exercises.extend(pending_exercises)
            
            if current_block.exercises or current_block.supersets:
                blocks.append(current_block)
        
        return Workout(title=workout_title, source=source or "ai_generated", blocks=blocks)
    
    @staticmethod
    def _parse_ai_exercise_line(line: str) -> Optional[Exercise]:
        """
        Parse a single exercise line from AI-generated workout.
        
        Examples:
        - "Marrs Bar Squat (SquatMax-MD + Voltras)\n1 heavy working set (6–8 reps, ~80–85% effort)."
        - "Dumbbell RDLs – 8–10 reps"
        - "Band-Resisted Push-Ups – AMRAP (8–12 target)"
        
        Args:
            line: Exercise description line
            
        Returns:
            Exercise object or None if parsing fails
        """
        # Clean up the line
        line = line.strip()
        if not line or len(line) < 3:
            return None
        
        # Filter out metadata and non-exercise content
        metadata_keywords = [
            r'^(Location|Duration|Frequency|Goal|Equipment|Notes?|Instructions?):',
            r'^\d+\s*(minutes?|mins?|hours?|hrs?)$',
            r'^\d+x/week',
            r'^Build\s+',
            r'^Location:',
            r'^Duration:',
            r'^Frequency:',
            r'^Goal:',
        ]
        if any(re.match(pattern, line, re.I) for pattern in metadata_keywords):
            return None
        
        # Must contain exercise-related keywords or patterns
        exercise_keywords = [
            r'\b(sets|reps|x|minutes?|sec|kg|lb|lbs?|weight|carry|press|row|pull|push|squat|deadlift|lunge|curl|raise|fly|extension|dip|pull.?up|pullup|bike|row|run|jump|burpee|thruster|swing|snatch|clean|jerk|wall.?ball|farmer|sled|push.?up|pushup|inchworm|circle|band|stretch|warm.?up)\b',
            r'–|x\s*\d+',  # Contains dash or "x" followed by number
        ]
        has_exercise_content = any(re.search(pattern, line, re.I) for pattern in exercise_keywords)
        if not has_exercise_content and len(line) < 20:
            return None
        
        # Split by newline if present (sometimes equipment is on separate line)
        parts = [p.strip() for p in line.split('\n') if p.strip()]
        if not parts:
            return None
        
        # Combine all parts for full text analysis
        full_text = ' '.join(parts)
        
        # Extract exercise name - look for the actual exercise name
        # Exercise name is usually before descriptions like "1 heavy working set" or rep ranges
        # Try to find the base exercise name (before set/rep descriptions)
        if 'heavy working set' in full_text.lower():
            # Pattern: "Exercise Name 1 heavy working set..."
            # Split on "1 heavy" or "heavy working set"
            exercise_name_match = re.search(r'^(.+?)\s+(?:\d+\s+)?heavy\s+working\s+set', full_text, re.I)
            if exercise_name_match:
                exercise_part = exercise_name_match.group(1).strip()
            else:
                # Fallback: take first part before any description starting with number
                exercise_part = parts[0].strip()
                # Remove trailing dashes
                exercise_part = re.sub(r'[\s–\-]+$', '', exercise_part)
        else:
            # For exercises with inline reps like "Exercise – 8–10 reps" or "Exercise x 20"
            # Take everything up to the dash or "x" followed by numbers
            # First try pattern with "x NUMBER" (don't cut off at x)
            x_number_match = re.search(r'^(.+?)\s+[x×]\s+(\d+)', full_text, re.I)
            if x_number_match:
                # Don't include "x NUMBER" in the exercise name, it will be extracted as reps
                exercise_part = x_number_match.group(1).strip()
                # Remove trailing dashes
                exercise_part = re.sub(r'[\s–\-]+$', '', exercise_part)
            else:
                # Try pattern with dash followed by numbers or rep indicators
                exercise_name_match = re.match(r'^(.+?)(?:[\s–\-]\s*(?:\d+|/side|AMRAP|reps?)|$)', full_text, re.I)
                if exercise_name_match:
                    exercise_part = exercise_name_match.group(1).strip()
                    # Remove trailing dashes
                    exercise_part = re.sub(r'[\s–\-]+$', '', exercise_part)
                else:
                    exercise_part = parts[0].strip()
        
        # Extract equipment notes - look for parentheses that contain equipment keywords
        equipment_keywords = ['using', 'or', 'dumbbell', 'barbell', 'bar', 'bench', 'band', 'jammer', 'arms', 'slot']
        equipment = None
        equipment_matches = list(re.finditer(r'\(([^)]+)\)', exercise_part))
        for match in equipment_matches:
            content = match.group(1).lower()
            # If parentheses contain equipment keywords, treat as equipment
            if any(keyword in content for keyword in equipment_keywords):
                equipment = match.group(1)
                # Remove equipment from exercise name
                exercise_part = exercise_part[:match.start()].strip() + ' ' + exercise_part[match.end():].strip()
                break
        
        # Clean up exercise name
        exercise_name = re.sub(r'\s+', ' ', exercise_part).strip()
        # Remove trailing dashes and any "– X sets" or "– X reps" patterns
        exercise_name = re.sub(r'[\s–\-]+\d+\s*(sets?|reps?)(?:\s|$)', '', exercise_name, flags=re.I)
        exercise_name = re.sub(r'[\s–\-]+$', '', exercise_name).strip()
        
        # Add equipment back if we found it
        if equipment:
            exercise_name = f"{exercise_name} ({equipment})"
        
        # Look for sets and reps in remaining parts or in the line
        full_text = ' '.join(parts)
        
        sets = None
        reps = None
        reps_range = None
        
        # Pattern: "1 heavy working set (6–8 reps, ~80–85% effort)"
        heavy_set_match = re.search(r'(\d+)\s+heavy\s+working\s+set\s*\(([^)]+)\)', full_text, re.I)
        if heavy_set_match:
            sets = to_int(heavy_set_match.group(1))
            details = heavy_set_match.group(2)
            # Extract reps from details
            reps_match = re.search(r'(\d+)[\s–\-](\d+)\s*reps?', details)
            if reps_match:
                reps_range = f"{reps_match.group(1)}-{reps_match.group(2)}"
            else:
                reps_match = re.search(r'(\d+)\s*reps?', details)
                if reps_match:
                    reps = to_int(reps_match.group(1))
        
        # Pattern: "X sets" - prioritize explicit "sets" keyword
        if not sets:
            sets_match = re.search(r'(\d+)\s*sets?', full_text, re.I)
            if sets_match:
                sets = to_int(sets_match.group(1))
        
        # IMPORTANT: Check rep ranges BEFORE single "x NUMBER" patterns
        # This prevents "x 5" from "4 sets x 5–8 reps" from being set as reps=5
        # Pattern: "6–8 reps" or "8-10 reps" or "4 sets x 5–8 reps" (rep ranges)
        if not reps and not reps_range:
            # Priority 1: Look for "X sets x Y–Z" or "X sets x Y–Z reps" pattern (most specific)
            sets_x_range_match = re.search(r'sets?\s*[x×]\s*(\d+)[\s–\-]+(\d+)(?:\s*reps?)?', full_text, re.I)
            if sets_x_range_match:
                reps_range = f"{sets_x_range_match.group(1)}-{sets_x_range_match.group(2)}"
            else:
                # Priority 2: Look for "Y–Z reps" pattern (with explicit "reps" keyword)
                reps_range_match = re.search(r'(\d+)[\s–\-]+(\d+)\s*reps?', full_text, re.I)
                if reps_range_match:
                    reps_range = f"{reps_range_match.group(1)}-{reps_range_match.group(2)}"
        
        # Pattern: "x 20" or "x20" (single number after x) - determine if it's sets or reps
        # Only check if we haven't already found reps/rep_range from patterns above
        if not reps and not reps_range:
            x_number_match = re.search(r'[x×]\s*(\d+)(?:\s*reps?)?(?:\s|$|[^0-9])', full_text, re.I)
            if x_number_match:
                x_number = to_int(x_number_match.group(1))
                # If we already found sets via "X sets" pattern, then "x NUMBER" is reps
                if sets:
                    reps = x_number
                else:
                    # Check context - if it's after exercise name (not at start), it's likely reps
                    # Pattern like "Exercise Name x 20" -> reps
                    # Pattern like "3x Exercise" -> sets
                    x_pos = x_number_match.start()
                    before_x = full_text[:x_pos].strip()
                    # If there's text before "x NUMBER" (exercise name), it's reps
                    if len(before_x) > 5:  # Has exercise name before it
                        reps = x_number
                    else:
                        # At start, might be sets
                        sets = x_number
        
        # Fallback: Single reps if no range or "x NUMBER" pattern found
        if not reps and not reps_range:
            reps_match = re.search(r'(\d+)\s*reps?', full_text, re.I)
            if reps_match:
                reps = to_int(reps_match.group(1))
        
        # Pattern: "AMRAP (8–12 target)" - use target as rep range
        amrap_match = re.search(r'AMRAP\s*\((\d+)[\s–\-](\d+)\s*target\)', full_text, re.I)
        if amrap_match:
            reps_range = f"{amrap_match.group(1)}-{amrap_match.group(2)}"
        
        # Pattern: "/side" or "/side" - indicates unilateral exercise
        if '/side' in full_text.lower() or 'per side' in full_text.lower():
            # Keep reps as is, but note it's per side in the name
            if not '/side' in exercise_name.lower():
                exercise_name += " (per side)"
        
        # Pattern: "20–30s hold" - time-based exercise
        duration_sec = None
        time_match = re.search(r'(\d+)[\s–\-]?(\d+)?\s*s\s*hold', full_text, re.I)
        if time_match:
            duration_sec = to_int(time_match.group(1))
            if time_match.group(2):
                # Use upper bound if range provided
                duration_sec = to_int(time_match.group(2))
        
        # Default to 1 set if no sets specified but reps found (only for exercises with explicit reps)
        # Don't default sets for exercises that might not need it (like warm-up exercises)
        if not sets and (reps or reps_range):
            # Only default to 1 set if there's an explicit rep count/range
            # Skip default for time-based exercises (duration_sec is set)
            if not duration_sec:
                sets = 1
        
        # Determine exercise type
        ex_type = "strength"
        if duration_sec or 'hold' in full_text.lower():
            ex_type = "interval"
        
        return Exercise(
            name=exercise_name,
            sets=sets,
            reps=reps,
            reps_range=reps_range,
            duration_sec=duration_sec,
            type=ex_type
        )
    
    @staticmethod
    def _parse_cycling_workout(text: str, source: Optional[str] = None) -> Workout:
        """
        Parse cycling/Zwift workout text into a structured Workout object.
        
        Handles:
        - Time-based intervals (0:00–3:00 → 50% FTP)
        - Repeat instructions (Repeat 3×)
        - FTP percentages
        - Cadence notes
        - Recovery periods
        
        Args:
            text: Raw cycling workout text
            source: Optional source identifier
            
        Returns:
            Parsed Workout object
        """
        # Extract title
        title_match = re.search(r'^([^\n]+Workout[^\n]*)', text, re.MULTILINE | re.IGNORECASE)
        workout_title = title_match.group(1).strip() if title_match else "Cycling Workout"
        
        # Extract goal if present
        goal_match = re.search(r'Goal:\s*(.+?)(?:\n|⸻)', text, re.I | re.DOTALL)
        goal = goal_match.group(1).strip() if goal_match else None
        
        blocks: List[Block] = []
        lines = text.split('\n')
        
        current_block: Optional[Block] = None
        current_exercises: List[Exercise] = []
        
        i = 0
        while i < len(lines):
            line = lines[i].strip()
            
            # Skip empty lines and separators
            if not line or line == '⸻':
                i += 1
                continue
            
            # Skip goal line (already extracted)
            if line.startswith('Goal:'):
                i += 1
                continue
            
            # Skip cadence notes section (can add as block metadata later)
            if 'Cadence' in line and 'Notes' in line:
                i += 1
                continue
            
            # Check for section headers (e.g., "Warm-Up – 10:00", "Set 1 — Threshold + Tempo (15:00)")
            # Handle both en dash (–) and em dash (—) and regular dash
            # Section header formats:
            # 1. "Warm-Up – 10:00" (name - duration)
            # 2. "Set 1 — Threshold + Tempo (15:00)" (name — description (duration))
            # Don't match if it looks like a time interval (starts with time range like "0:00–3:00")
            if not re.match(r'^\s*[\s•\t]*\d+:\d+[–\-]', line):
                # Pattern 1: Simple format "Name - Duration" or "Name — Duration"
                section_match = re.match(r'^([A-Za-z0-9][A-Za-z0-9\s\-]+?)\s*[–—\-]\s*([\d:]+)(?:\s*\(([^)]+)\))?$', line)
                
                # Pattern 2: Format with description "Set 1 — Description (Duration)"
                if not section_match:
                    section_match = re.match(r'^([A-Za-z0-9][A-Za-z0-9\s]+?)\s*[—]\s*(.+?)\s*\(([\d:]+)\)$', line)
                    if section_match:
                        # Reorder groups: name, duration, description
                        section_name = section_match.group(1).strip()
                        section_desc = section_match.group(2).strip()
                        section_duration = section_match.group(3).strip()
                        # Reconstruct as if it matched pattern 1: (name + desc, duration, None)
                        from types import SimpleNamespace
                        section_match = SimpleNamespace()
                        section_match.group = lambda n: (f"{section_name} — {section_desc}", section_duration, None)[n-1] if n <= 3 else None
                
                # Pattern 3: Simpler em/en dash pattern
                if not section_match:
                    section_match = re.match(r'^([A-Za-z0-9][^–—]*?)\s*[–—]\s*([\d:]+)(?:\s*\(([^)]+)\))?$', line)
            else:
                section_match = None
            
            if section_match:
                # Save previous block
                if current_block:
                    if current_exercises:
                        current_block.exercises.extend(current_exercises)
                    if current_block.exercises:
                        blocks.append(current_block)
                
                section_name = section_match.group(1).strip()
                section_duration = section_match.group(2).strip()
                section_note = section_match.group(3) if section_match.group(3) else None
                
                # Parse duration (e.g., "10:00" -> 600 seconds)
                duration_sec = ParserService._parse_duration_to_seconds(section_duration)
                
                block_label = section_name
                if section_note:
                    block_label = f"{section_name} ({section_note})"
                
                current_block = Block(label=block_label)
                if duration_sec:
                    current_block.time_work_sec = duration_sec
                
                # Clear exercises and reset defaults for new section
                current_exercises.clear()
                current_block.default_sets = None
                current_block.structure = None
                i += 1
                continue
            
            # Check for "Repeat N×" instruction
            # This applies to the NEXT exercises in the current block
            repeat_match = re.search(r'Repeat\s+(\d+)\s*[x×]', line, re.I)
            if repeat_match:
                if current_block:
                    repeat_count = to_int(repeat_match.group(1))
                    # Store the repeat count for the current block - applies to exercises added after this
                    current_block.default_sets = repeat_count
                    current_block.structure = f"{repeat_count} rounds"
                i += 1
                continue
            
            # Check for time intervals (e.g., "0:00–3:00 → 50% FTP" or "•	0:00–3:00 → 50% FTP")
            # Handle tabs, bullets, and different arrow formats
            time_interval_match = re.match(r'^[\s•\t]*(\d+:\d+)[–\-](\d+:\d+)\s*[→-]\s*(.+?)$', line)
            if time_interval_match:
                start_time = time_interval_match.group(1)
                end_time = time_interval_match.group(2)
                instruction = time_interval_match.group(3).strip()
                
                # Calculate duration
                start_sec = ParserService._parse_duration_to_seconds(start_time)
                end_sec = ParserService._parse_duration_to_seconds(end_time)
                if start_sec is not None and end_sec is not None:
                    duration = end_sec - start_sec
                else:
                    duration = None
                
                # Extract FTP percentage if present
                ftp_match = re.search(r'(\d+)%\s*FTP', instruction, re.I)
                ftp_percent = ftp_match.group(1) if ftp_match else None
                
                # Extract additional instructions
                additional = re.sub(r'\d+%\s*FTP', '', instruction, flags=re.I).strip()
                additional = re.sub(r'\s+', ' ', additional).strip()  # Clean up whitespace
                
                exercise_name = f"{start_time}–{end_time}"
                if ftp_percent:
                    exercise_name += f" @ {ftp_percent}% FTP"
                if additional:
                    exercise_name += f" ({additional})"
                
                exercise = Exercise(
                    name=exercise_name,
                    duration_sec=duration,
                    type="interval"
                )
                # Apply repeat count if set for current block
                if current_block and current_block.default_sets:
                    exercise.sets = current_block.default_sets
                current_exercises.append(exercise)
                i += 1
                continue
            
            # Check for simple interval lines with @ notation (e.g., "3:00 @ 103% FTP")
            time_at_ftp_match = re.match(r'^\s*[•\t]*\s*(\d+:\d+)\s*@\s*(\d+)%\s*FTP\s*(?:\((.+?)\))?', line, re.I)
            if time_at_ftp_match:
                duration_str = time_at_ftp_match.group(1)
                ftp_percent = time_at_ftp_match.group(2)
                note = time_at_ftp_match.group(3) if time_at_ftp_match.group(3) else None
                
                duration_sec = ParserService._parse_duration_to_seconds(duration_str)
                
                exercise_name = f"{duration_str} @ {ftp_percent}% FTP"
                if note:
                    exercise_name += f" ({note})"
                
                exercise = Exercise(
                    name=exercise_name,
                    duration_sec=duration_sec,
                    type="interval"
                )
                # Apply repeat count if set for current block
                if current_block and current_block.default_sets:
                    exercise.sets = current_block.default_sets
                current_exercises.append(exercise)
                i += 1
                continue
            
            # Check for simple interval lines (e.g., "60% FTP easy spin")
            if ('FTP' in line.upper() or 'tempo' in line.lower() or 'threshold' in line.lower()) and '•' in line:
                # Extract percentage and instruction
                ftp_match = re.search(r'(\d+)%\s*FTP', line, re.I)
                ftp_percent = ftp_match.group(1) if ftp_match else None
                
                # Clean up the line
                exercise_name = line.replace('•', '').replace('\t', ' ').strip()
                exercise_name = re.sub(r'\s+', ' ', exercise_name)  # Normalize whitespace
                
                if not ftp_percent:
                    # If no FTP found, use the whole line as name
                    pass
                
                exercise = Exercise(
                    name=exercise_name,
                    type="interval"
                )
                # Apply repeat count if set for current block
                if current_block and current_block.default_sets:
                    exercise.sets = current_block.default_sets
                current_exercises.append(exercise)
                i += 1
                continue
            
            i += 1
        
        # Finish last block
        if current_block:
            if current_exercises:
                current_block.exercises.extend(current_exercises)
            if current_block.exercises:
                blocks.append(current_block)
        
        # Add goal as block if provided
        if goal and blocks:
            goal_block = Block(label="Goal")
            goal_block.exercises.append(Exercise(name=goal, type="interval"))
            blocks.insert(0, goal_block)
        
        return Workout(title=workout_title, source=source or "ai_generated", blocks=blocks)
    
    @staticmethod
    def _parse_duration_to_seconds(duration_str: str) -> Optional[int]:
        """
        Parse duration string to seconds.
        
        Examples:
        - "10:00" -> 600
        - "3:00" -> 180
        - "15" -> 15 (assumes seconds)
        
        Args:
            duration_str: Duration string (MM:SS or seconds)
            
        Returns:
            Duration in seconds or None
        """
        if ':' in duration_str:
            parts = duration_str.split(':')
            if len(parts) == 2:
                minutes = to_int(parts[0])
                seconds = to_int(parts[1])
                if minutes is not None and seconds is not None:
                    return minutes * 60 + seconds
        else:
            # Try to parse as seconds
            return to_int(duration_str)
        return None

