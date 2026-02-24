# Hybrid Parser Architecture

This document describes the hybrid parser architecture for the workout-ingestor-api. The system uses a combination of deterministic pattern matching and LLM-based extraction to handle diverse workout file formats with high accuracy.

## Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           BULK IMPORT FLOW                                   │
│                                                                             │
│   Upload        Detect        Map          Match         Preview    Execute │
│   ───────►  ───────────►  ─────────►  ───────────►  ──────────►  ─────────► │
│   File/URL    FileParser   Column       Exercise      Validation   FIT Gen  │
│               Factory      Mapping      Matching      & Review     & Export │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Architecture Components

### 1. File Parser Factory

**Location:** `src/workout_ingestor_api/parsers/__init__.py`

The factory pattern selects the appropriate parser based on file type:

```python
class FileParserFactory:
    _parsers = [
        ExcelParser(),    # .xlsx, .xls
        CSVParser(),      # .csv (Strong App, Hevy, FitNotes, JEFIT, MFP)
        JSONParser(),     # .json
        TextParser(),     # .txt (with LLM fallback)
    ]
```

**Usage:**
```python
from parsers import FileParserFactory, FileInfo

file_info = FileInfo(filename="workout.csv", extension=".csv", size_bytes=1024)
parser = FileParserFactory.get_parser(file_info)
result = await parser.parse(content, file_info)
```

### 2. Base Parser

**Location:** `src/workout_ingestor_api/parsers/base.py`

Abstract base class defining the parser interface and common functionality:

- **Pattern Detection:** Superset notation (5a, 5b), complex movements (3+1), duration exercises (60s)
- **Value Parsing:** Reps, weight with unit detection, RPE extraction
- **Ambiguous Value Resolution:** AMRAP, bodyweight (BW+25), failure, drop sets

**Key Patterns:**
```python
SUPERSET_PATTERN = r'^(\d+)([a-z])$'           # "5a", "5b"
COMPLEX_REP_PATTERN = r'^(\d+)\s*[+x]\s*(\d+)$' # "3+1", "4x4"
DURATION_PATTERN = r'^(\d+)\s*(s|sec|m|min)$'   # "60s", "2min"
PERCENTAGE_PATTERN = r'^(\d+(?:\.\d+)?)\s*%$'   # "70%", "85.5%"
BODYWEIGHT_PATTERN = r'^(BW|bodyweight)(\s*[+-]\s*\d+)?$'  # "BW", "BW+25"
AMRAP_PATTERN = r'^(AMRAP|as\s*many\s*as\s*possible)$'
```

### 3. CSV Parser

**Location:** `src/workout_ingestor_api/parsers/csv_parser.py`

Handles CSV files with multi-format support:

#### Known Schemas

| Format | Headers | Min Score |
|--------|---------|-----------|
| **Strong App** | Date, Workout Name, Exercise Name, Set Order, Weight, Reps | 4 |
| **Hevy** | Date, Workout Name, Exercise Name, Weight (kg), Reps | 4 |
| **FitNotes** | Date, Exercise, Category, Weight, Reps | 3 |
| **JEFIT** | Date, Exercise, Weight, Reps, Sets, Body Part | 3 |
| **MyFitnessPal** | Date, Exercise Name, Sets, Reps/Set, Weight Per Set | 3 |

#### Fuzzy Header Matching

Uses SequenceMatcher (similar to Levenshtein distance) for flexible header detection:

```python
FUZZY_MATCH_THRESHOLD = 0.85  # 85% similarity required

# Example: "Excercise Name" matches "Exercise Name" at 92% similarity
similarity = SequenceMatcher(None, "excercise name", "exercise name").ratio()
# Returns: 0.923
```

#### LLM Fallback Trigger

When parsing confidence falls below threshold:

```python
LLM_FALLBACK_THRESHOLD = 70  # Trigger LLM if confidence < 70%

if result.confidence < LLM_FALLBACK_THRESHOLD:
    result.needs_llm_review = True
```

### 4. Excel Parser

**Location:** `src/workout_ingestor_api/parsers/excel_parser.py`

Handles multi-sheet Excel files (training program exports):

- **Multi-sheet detection:** Each sheet = week/phase
- **Header row auto-detection:** Scans first 20 rows for column headers
- **1RM extraction:** Detects "1RM", "Max" blocks and extracts values
- **Day boundaries:** Parses "Day 1", "Day 2" patterns to split workouts

### 5. Text Parser

**Location:** `src/workout_ingestor_api/parsers/text_parser.py`

Two-stage parsing for unstructured text:

1. **Pattern matching:** Try structured patterns first (e.g., "Squat: 3x5 @ 100kg")
2. **LLM fallback:** Route to LLM service for conversational/unstructured content

```python
# Confidence thresholds
if result.confidence >= 60:
    return result  # Use pattern-matched result
else:
    return await self._try_llm_parse(text)  # Fallback to LLM
```

### 6. Image Parser

**Location:** `src/workout_ingestor_api/parsers/image_parser.py`

Vision AI extraction for workout images:

- **Supported formats:** PNG, JPG, JPEG, WebP, HEIC, GIF
- **Extraction modes:**
  - `vision`: Vision AI (OpenAI GPT-4o, Anthropic Claude) - higher accuracy
  - `ocr`: OCR only - faster, lower cost
  - `auto`: Try vision first, fallback to OCR

**Confidence scoring:**
```python
# Base scoring (0-100)
+40  # Has exercises
+10  # Has title
+30  # Exercises have reps/sets (proportional)
+20  # Exercise names are valid (proportional)
```

### 7. URL Parser

**Location:** `src/workout_ingestor_api/parsers/url_parser.py`

Platform-specific URL handlers:

| Platform | Extraction Method |
|----------|-------------------|
| **YouTube** | ASR transcript + vision |
| **Instagram** | oEmbed API + vision |
| **TikTok** | Video download + vision |
| **Pinterest** | oEmbed API + vision (GPT-4o fallback) |

## Data Models

### ParseResult

```python
class ParseResult(BaseModel):
    success: bool
    workouts: List[ParsedWorkout]
    patterns: DetectedPatterns
    columns: List[ColumnInfo]
    confidence: float  # 0-100
    detected_format: Optional[str]
    needs_llm_review: bool  # True if confidence < 70%
    errors: List[str]
    warnings: List[str]
```

### ParsedWorkout

```python
class ParsedWorkout(BaseModel):
    name: str
    date: Optional[str]
    week: Optional[str]
    day: Optional[str]
    exercises: List[ParsedExercise]
    source_sheet: Optional[str]  # For Excel
```

### ParsedExercise

```python
class ParsedExercise(BaseModel):
    raw_name: str
    order: str  # "1", "5a", "5b"
    sets: int
    reps: str  # Preserves "3+1", "60s", "AMRAP"
    weight: Optional[str]
    weight_unit: Optional[Literal["kg", "lbs"]]
    rpe: Optional[float]
    superset_group: Optional[str]
    flags: List[ExerciseFlag]
```

### ExerciseFlag

```python
class ExerciseFlag(str, Enum):
    COMPLEX = "complex"       # "3+1", "4+4"
    DURATION = "duration"     # "60s", "2min"
    PERCENTAGE = "percentage" # "70%"
    WARMUP = "warmup"
    BODYWEIGHT = "bodyweight" # "BW", "BW+25"
    AMRAP = "amrap"
    MAX = "max"
    FAILURE = "failure"
    DROPSET = "dropset"
```

## Confidence Scoring

### CSV Parser Confidence

```
Base:                35 points
Known format boost:  +25-30 (scaled by match quality)
Exercise column:     +15
Reps column:         +5
Weight column:       +5
Date column:         +5
Sets column:         +3
Notes column:        +2
Exercise count >= 5: +5

Penalty: (0.95 - match_quality) * 10
```

### Excel Parser Confidence

```
Base:              50 points
Header detected:   +10
Exercise column:   +15
Sets column:       +5
Reps column:       +5
Weight column:     +5
1RMs found:        +5
Multi-sheet:       +5
```

### Image Parser Confidence

```
Has exercises:           +40
Has title:               +10
Exercises with details:  +30 (proportional)
Valid exercise names:    +20 (proportional)

OCR mode: confidence * 0.8 (20% reduction)
```

## LLM Service

**Location:** `src/workout_ingestor_api/services/llm_service.py`

Structures unstructured workout text into canonical JSON:

```python
LLMService.structure_workout(
    text="Coach notes...",
    provider="openai",  # or "anthropic"
    model="gpt-4o-mini"
)
```

**Supported providers:**
- OpenAI (GPT-4o, GPT-4o-mini)
- Anthropic (Claude 3.5 Sonnet)

## Performance Guidelines

### Target Metrics

| Scenario | Target |
|----------|--------|
| Known format (Strong, Hevy, FitNotes) | < 100ms |
| Unknown CSV with header detection | < 500ms |
| Excel multi-sheet | < 2s |
| Image (Vision AI) | < 10s |
| Text (LLM fallback) | < 5s |

### Cost Optimization

1. **Use deterministic parsing first** - Free and fast
2. **LLM only for confidence < 70%** - Reduces API costs
3. **Vision model selection:**
   - GPT-4o-mini: Default, lower cost
   - GPT-4o: Fallback for Pinterest/complex infographics

## Extension Points

### Adding New CSV Schemas

```python
# In csv_parser.py
NEW_APP_COLUMNS = {
    'date': 'Date',
    'exercise': 'Exercise Name',
    'sets': 'Sets',
    'reps': 'Reps',
    'weight': 'Weight',
}

KNOWN_SCHEMAS['new_app'] = {
    'columns': NEW_APP_COLUMNS,
    'min_score': 3,
    'confidence_boost': 25,
}
```

### Adding New Patterns

```python
# In base.py
NEW_PATTERN = re.compile(r'your_pattern_here', re.IGNORECASE)

def parse_new_value(self, value: str) -> Tuple[str, List[ExerciseFlag]]:
    if self.NEW_PATTERN.match(value):
        return value, [ExerciseFlag.NEW_FLAG]
    return value, []
```

## Related Documentation

- [Instagram Ingestion](./INSTAGRAM_INGESTION_IMPROVEMENTS.md)
- [YouTube Pipeline](./YOUTUBE_PIPELINE.md)
- [TikTok Ingestion](./TIKTOK_INGESTION.md)
- [Vision Model Pricing](./VISION_MODEL_PRICING.md)
- [OCR Optimization](./OCR_OPTIMIZATION.md)
