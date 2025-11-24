# Junk Value Filtering and Review System

## Overview
The OCR processing now includes enhanced junk detection and a review system that allows users to see what was filtered and restore items if needed.

## Enhanced Junk Detection

### New Junk Words Detected
The system now filters out common OCR artifacts including:
- `age`, `ago`, `are`, `ate`, `ave` - Common OCR misreads
- Single words with quotes: `"age"`, `'age'`
- Short junk words without exercise context

### Detection Rules
1. **Short junk words**: Words like "age" that are 1-4 characters and match known junk patterns
2. **Quoted junk**: Words wrapped in quotes that match junk patterns
3. **No exercise context**: Lines without exercise indicators (reps, sets, exercise names, etc.)
4. **Corrupted text**: Patterns like `\ a. b` that indicate OCR corruption

## API Response Format

### Standard Response (return_filtered=false)
```json
{
  "title": "Workout Title",
  "blocks": [...],
  "source": "..."
}
```

### With Filtered Items (return_filtered=true)
```json
{
  "title": "Workout Title",
  "blocks": [...],
  "source": "...",
  "_filtered_items": [
    {
      "text": "age",
      "original_line": "age\"",
      "reason": "junk_detection",
      "block": "Block 1",
      "line_number": null
    }
  ]
}
```

## API Endpoints

### 1. Text Ingestion with Filtered Items
```bash
POST /ingest/text
Content-Type: application/x-www-form-urlencoded

text=<workout_text>&return_filtered=true
```

### 2. Image Ingestion with Filtered Items
```bash
POST /ingest/image
Content-Type: multipart/form-data

file=<image_file>&return_filtered=true
```

### 3. Instagram Ingestion (Always Returns Filtered Items)
```bash
POST /ingest/instagram
Content-Type: application/json

{
  "url": "https://www.instagram.com/p/...",
  "return_filtered": true  # Optional, defaults to true
}
```

## Filtered Item Structure

Each filtered item contains:
- `text`: The filtered text (cleaned version)
- `original_line`: The original line from OCR
- `reason`: Why it was filtered (`junk_detection`, `corrupted_text`)
- `block`: Which block it would have been in
- `line_number`: Line number (if available)

## UI Integration

### Display Filtered Items
Show a section after workout parsing:
```
⚠️ Filtered Items (3)
The following items were removed as junk. Review and restore if needed:

1. "age" - Block 1 (junk_detection)
   [Restore] [Keep Filtered]

2. "block 1" - Unknown (junk_detection)
   [Restore] [Keep Filtered]

3. "\ a. b" - Block 2 (corrupted_text)
   [Restore] [Keep Filtered]
```

### Restore Functionality
When user clicks "Restore":
1. Add the item back to the workout structure
2. Place it in the appropriate block
3. Remove from filtered items list
4. Re-parse if needed to ensure proper structure

## Implementation Details

### Parser Service Changes
- `parse_free_text_to_workout()` now accepts `return_filtered` parameter
- Returns tuple `(Workout, List[dict])` when `return_filtered=True`
- Tracks all filtered items with context

### Enhanced `_is_junk()` Method
- Added detection for common junk words like "age"
- Better handling of quoted junk text
- Improved pattern matching for OCR artifacts

## Example Usage

### Python
```python
from app.services.parser_service import ParserService

# Get filtered items
workout, filtered_items = ParserService.parse_free_text_to_workout(
    text, 
    source="test",
    return_filtered=True
)

# Review filtered items
for item in filtered_items:
    print(f"Filtered: {item['text']} - {item['reason']}")
    # User can choose to restore
```

### API Call
```python
import requests

response = requests.post(
    "http://localhost:8004/ingest/image",
    files={"file": open("workout.jpg", "rb")},
    data={"return_filtered": "true"}
)

data = response.json()
workout = data  # Contains blocks, title, etc.
filtered_items = data.get("_filtered_items", [])

# Display filtered items to user
for item in filtered_items:
    print(f"Removed: {item['text']}")
```

## Benefits

1. **Transparency**: Users can see what was filtered
2. **Control**: Users can restore items that were incorrectly filtered
3. **Quality**: Better junk detection reduces false positives
4. **Debugging**: Easier to identify OCR issues

## Future Enhancements

1. **Machine Learning**: Train model to better identify junk vs valid exercises
2. **User Feedback**: Learn from user restorations to improve filtering
3. **Confidence Scores**: Show confidence level for filtered items
4. **Batch Restore**: Allow restoring multiple items at once
5. **Custom Junk Lists**: Allow users to define custom junk patterns



