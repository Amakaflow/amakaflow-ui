"""Parser service for converting free text into structured workout data."""
import re
from typing import List, Optional
from app.models import Workout, Block, Exercise, Superset
from app.utils import to_int

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
RE_HEADER = re.compile(r"(primer|strength|power|finisher|metabolic|conditioning|amrap|circuit|muscular\s+endurance|tabata|warm.?up)", re.I)
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
        # Skip very short or mostly punctuation / OCR gunk
        if len(ln) < 4:
            return True
        
        # Skip Instagram UI elements - but only if the line doesn't contain exercise content
        instagram_words = ['like', 'dislike', 'share', 'comment', 'follow', 'followers', 'following']
        ln_lower = ln.lower()
        # Check if line contains Instagram words AND no exercise indicators
        exercise_indicators = ['x', ':', 'kg', 'kb', 'db', 'rep', 'set', 'round', 'meter', 'm', 
                              'squat', 'press', 'push', 'pull', 'carry', 'sled', 'swing', 'burpee', 'jump']
        has_exercise_content = any(indicator in ln_lower for indicator in exercise_indicators) or re.search(r'[A-E]\d*:', ln)
        
        if any(instagram_word in ln_lower for instagram_word in instagram_words) and not has_exercise_content:
            return True
        
        # Skip lines that are just numbers (like Instagram like counts: "4", "0")
        if re.match(r'^\d+$', ln.strip()) and len(ln.strip()) <= 3:
            return True
        
        # Skip lines that look like "block 1", "block 2", etc. (OCR artifacts)
        if re.match(r'^block\s+\d+$', ln.lower()):
            return True
        
        # Skip lines that are just single letters or weird patterns like "q:Ry"
        if re.match(r'^[a-z]:[A-Z][a-z]+$', ln):
            return True
        
        # Count letters and common punctuation
        letters = re.sub(r"[^A-Za-z]", "", ln)
        if len(letters) <= 2:
            return True
        
        # Skip lines with excessive backslashes or weird characters (OCR artifacts)
        if ln.count('\\') > 2 or ln.count('|') > 2:
            return True
        
        # Skip lines that look like corrupted text
        if re.match(r'^\\\s*[a-z]\.\s*[a-z]', ln.lower()):
            return True
        
        # Skip lines with too many single characters separated by spaces/punctuation
        single_chars = re.findall(r'\b[a-z]\b', ln.lower())
        if len(single_chars) > len(ln.split()) * 0.5:  # More than 50% single characters
            return True
        
        # Skip lines that don't contain any recognizable exercise-related words
        exercise_words = ['press', 'squat', 'deadlift', 'row', 'pull', 'push', 'curl', 'extension', 
                         'flexion', 'raise', 'lift', 'hold', 'plank', 'burpee', 'jump', 'run', 
                         'walk', 'bike', 'swim', 'ski', 'erg', 'meter', 'rep', 'set', 'round',
                         'goodmorning', 'sled', 'drag', 'carry', 'farmer', 'hand', 'release',
                         'kb', 'db', 'dual', 'alternating', 'broad', 'swing', 'skier']
        ln_lower = ln.lower()
        has_exercise_word = any(word in ln_lower for word in exercise_words)
        
        # If it's a short line without exercise words and has weird characters, skip it
        if len(ln) < 20 and not has_exercise_word and re.search(r'[\\|\.]{2,}', ln):
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
            cleaned_lines.append(ln)
            prev_line = ln
        return cleaned_lines
    
    @staticmethod
    def parse_free_text_to_workout(text: str, source: Optional[str] = None) -> Workout:
        """
        Parse free text into a structured Workout object.
        
        Args:
            text: Raw text to parse
            source: Optional source identifier
            
        Returns:
            Parsed Workout object
        """
        lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
        
        # Clean up OCR artifacts before processing
        cleaned_lines = ParserService._clean_ocr_artifacts(lines)
        
        blocks: List[Block] = []
        current = Block(label="Block 1")
        wk_title = None
        current_superset: List[Exercise] = []
        superset_letter = None

        for ln in cleaned_lines:
            if ParserService._is_junk(ln):
                continue

            # Title capture
            if not wk_title:
                m_week = RE_WEEK.match(ln)
                if m_week:
                    wk_title = m_week.group(1).title()
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

            # Section headers
            if RE_HEADER.search(ln) or ParserService._looks_like_header(ln):
                # Finish current superset if any
                if current_superset:
                    current.supersets.append(Superset(exercises=current_superset.copy()))
                    current_superset.clear()
                
                if current.exercises or current.supersets:
                    blocks.append(current)
                # Normalize a few known variants to nicer labels
                lbl = ln.title()
                if re.search(r"muscular\s+endurance", ln, re.I):
                    lbl = "Muscular Endurance"
                if re.search(r"metabolic|conditioning", ln, re.I):
                    lbl = "Metabolic Conditioning"
                current = Block(label=lbl)
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

            # Inherit reps_range from header if none on line
            if not reps and not reps_range and not distance_m and not distance_range and current.default_reps_range:
                reps_range = current.default_reps_range

            # Classify exercise type
            if time_work_sec or rest_sec:
                ex_type = "interval"
            else:
                ex_type = "strength" if (reps or reps_range or distance_m or distance_range) else "interval"

            # Clean and validate exercise name
            exercise_name = full_line_for_name.strip(" .")
            exercise_name = re.sub(r'\s+(Dislike|Share|Like|Comment|Follow|Followers|Following)$', '', exercise_name, flags=re.I)
            exercise_name = re.sub(r'\s+([a-z])$', '', exercise_name)
            exercise_name = exercise_name.strip()
            
            if ParserService._is_junk(exercise_name):
                continue
            
            if re.search(r'^\\\s*[a-z]\.\s*[a-z]', exercise_name.lower()):
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
                    if not current_superset:
                        current_superset = [exercise]
                        superset_letter = exercise_letter
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

        return Workout(title=(wk_title or "Imported Workout"), source=source, blocks=blocks)

