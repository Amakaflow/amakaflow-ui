# Mapper Conversion Guide for HIIT Workouts

This guide shows how to convert from a structured mapper format to the Garmin Planner YAML format for HIIT workouts.

## Input Format (From Mapper)

Your mapper provides this structure:
```json
{
  "workout": {
    "name": "Jour 193",
    "sport": "hiit",
    "steps": [
      {
        "type": "repeatUntilTime",
        "duration": 2100,
        "steps": [
          {
            "type": "exercise",
            "exerciseName": "Run Indoor [category: RUN_INDOOR]",
            "duration": "lap",
            "notes": "1200m"
          },
          {
            "type": "exercise",
            "exerciseName": "Farmer's Carry [category: CARRY]",
            "duration": "lap",
            "notes": "100 m KB Farmers (32/24kg)"
          }
        ]
      }
    ]
  }
}
```

## Output Format (For Garmin Planner)

Convert to this YAML format:
```yaml
workouts:
  "Jour 193":
    sport: hiit
    steps:
      - repeatUntilTime(35min):
        - run: lap | 1200m
        - "Farmer's Carry [category: CARRY]": "lap | 100 m KB Farmers (32/24kg)"
```

## Conversion Rules

### 1. Repeat Until Time
**Mapper Format:**
```json
{
  "type": "repeatUntilTime",
  "duration": 2100  // in seconds
}
```

**Garmin Planner Format:**
```yaml
- repeatUntilTime(35min):  # Convert seconds to minutes: 2100/60 = 35
  # OR
- repeatUntilTime(2100):   # Keep as seconds
```

**Conversion Logic:**
- If duration < 3600 (1 hour), convert to minutes: `repeatUntilTime(Xmin)` where X = duration/60
- Otherwise, keep as seconds: `repeatUntilTime(X)`

### 2. Run Indoor Steps
**Mapper Format:**
```json
{
  "type": "exercise",
  "exerciseName": "Run Indoor [category: RUN_INDOOR]",
  "duration": "lap",
  "notes": "1200m"
}
```

**Garmin Planner Format:**
```yaml
- run: lap | 1200m
```

**Conversion Rules:**
- Remove `[category: RUN_INDOOR]` from exerciseName (it's redundant - `run: lap` automatically creates RUN_INDOOR)
- Combine duration and notes: `"lap | {notes}"`
- Use `run: lap | {notes}` format

### 3. Exercise Steps
**Mapper Format:**
```json
{
  "type": "exercise",
  "exerciseName": "Farmer's Carry [category: CARRY]",
  "duration": "lap",
  "notes": "100 m KB Farmers (32/24kg)"
}
```

**Garmin Planner Format:**
```yaml
- "Farmer's Carry [category: CARRY]": "lap | 100 m KB Farmers (32/24kg)"
```

**Conversion Rules:**
- Keep exerciseName with category: `"Exercise Name [category: CATEGORY]"`
- Combine duration and notes: `"lap | {notes}"`
- Use quoted string format: `"Exercise Name [category: CATEGORY]": "lap | notes"`

### 4. Repetition Value
**Mapper Format:**
```json
{
  "type": "exercise",
  "exerciseName": "Walking Lunge [category: LUNGE]",
  "repetitionValue": 80,
  "notes": "80 Walking Lunges (30/20kg)"
}
```

**Garmin Planner Format:**
```yaml
- "Walking Lunge [category: LUNGE]": "lap | 80 Walking Lunges (30/20kg)"
```

**Conversion Rules:**
- **Do NOT** use `repetitionValue` directly as end condition
- Always use `duration: "lap"` for HIIT exercises
- Include repetition info in notes: `"lap | {repetitionValue} {notes}"`

### 5. Time Duration (seconds)
**Mapper Format:**
```json
{
  "type": "exercise",
  "exerciseName": "Ski Moguls [category: CARDIO]",
  "repetitionValue": 60,  // This is actually seconds
  "notes": "60 cals Row / Skireg"
}
```

**Garmin Planner Format:**
```yaml
- "Ski Moguls [category: CARDIO]": "lap | 60 cals Row / Skireg"
```

**Conversion Rules:**
- **Do NOT** use `repetitionValue` or `duration: "60s"` as end condition
- Always use `duration: "lap"` for HIIT exercises
- Include time info in notes: `"lap | {notes}"`

## Complete Conversion Example

**Mapper Input:**
```json
{
  "workout": {
    "name": "Jour 193",
    "sport": "hiit",
    "steps": [
      {
        "type": "repeatUntilTime",
        "duration": 2100,
        "steps": [
          {
            "type": "exercise",
            "exerciseName": "Run Indoor [category: RUN_INDOOR]",
            "duration": "lap",
            "notes": "1200m"
          },
          {
            "type": "exercise",
            "exerciseName": "Farmer's Carry [category: CARRY]",
            "duration": "lap",
            "notes": "100 m KB Farmers (32/24kg)"
          },
          {
            "type": "exercise",
            "exerciseName": "Walking Lunge [category: LUNGE]",
            "repetitionValue": 80,
            "notes": "80 Walking Lunges (30/20kg)"
          },
          {
            "type": "exercise",
            "exerciseName": "Ski Moguls [category: CARDIO]",
            "repetitionValue": 60,
            "notes": "60 cals Row / Skireg"
          }
        ]
      }
    ]
  }
}
```

**Garmin Planner Output:**
```yaml
settings:
  deleteSameNameWorkout: true

workouts:
  "Jour 193":
    sport: hiit
    steps:
      - repeatUntilTime(35min):
        - run: lap | 1200m
        - "Farmer's Carry [category: CARRY]": "lap | 100 m KB Farmers (32/24kg)"
        - "Walking Lunge [category: LUNGE]": "lap | 80 Walking Lunges (30/20kg)"
        - "Ski Moguls [category: CARDIO]": "lap | 60 cals Row / Skireg"

schedulePlan:
  start_from: 2025-11-05
  workouts:
    - "Jour 193"
```

## Conversion Pseudocode

```python
def convert_mapper_to_garmin_planner(mapper_data):
    workout = mapper_data["workout"]
    name = workout["name"]
    sport = workout["sport"]
    
    garmin_steps = []
    
    for step in workout["steps"]:
        if step["type"] == "repeatUntilTime":
            duration_sec = step["duration"]
            duration_min = duration_sec / 60
            
            # Convert to minutes if < 1 hour, otherwise keep as seconds
            if duration_min < 60:
                repeat_key = f"repeatUntilTime({int(duration_min)}min)"
            else:
                repeat_key = f"repeatUntilTime({duration_sec})"
            
            nested_steps = []
            for nested_step in step["steps"]:
                if nested_step["type"] == "exercise":
                    exercise_name = nested_step["exerciseName"]
                    notes = nested_step.get("notes", "")
                    
                    # Handle Run Indoor - remove category, use "run: lap"
                    if "Run Indoor" in exercise_name or "[category: RUN_INDOOR]" in exercise_name:
                        nested_steps.append(f"run: lap | {notes}".strip())
                    else:
                        # Keep exercise name with category
                        nested_steps.append(f'"{exercise_name}": "lap | {notes}"'.strip())
            
            garmin_steps.append({repeat_key: nested_steps})
    
    return {
        "workouts": {
            name: {
                "sport": sport,
                "steps": garmin_steps
            }
        }
    }
```

## Key Rules Summary

1. ✅ **Always use `lap` button** for all exercises in HIIT workouts
2. ✅ **Never use `repetitionValue` or time duration** as end condition
3. ✅ **Combine duration and notes**: `"lap | {notes}"`
4. ✅ **Run Indoor steps**: Use `run: lap | {notes}` (remove category from exerciseName)
5. ✅ **Other exercises**: Use `"Exercise Name [category: CATEGORY]": "lap | {notes}"`
6. ✅ **Time-based repeats**: Convert seconds to minutes when < 1 hour: `repeatUntilTime(35min)`

## Common Mistakes to Avoid

❌ **Wrong:**
```yaml
- "Run Indoor [category: RUN_INDOOR]": lap  # Don't include category
- "Burpee": 20 reps                         # Don't use reps directly
- "Ski Moguls": 60s                         # Don't use time directly
- repeatUntilTime(2100):                    # Prefer minutes for readability
```

✅ **Correct:**
```yaml
- run: lap | 1200m                          # Run Indoor without category
- "Burpee [category: TOTAL_BODY]": "lap | 20 reps"  # Reps in description
- "Ski Moguls [category: CARDIO]": "lap | 60s"      # Time in description
- repeatUntilTime(35min):                   # Use minutes when < 1 hour
```

