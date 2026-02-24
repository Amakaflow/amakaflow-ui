# Strength Workout Guide

This guide explains how to create strength workouts for Garmin using the YAML format.

## Overview

The app now supports creating strength workouts in addition to running workouts. Strength workouts use different step types and can include custom exercise names.

## Step Types

### Running Workouts
- `warmup` - Warm-up phase
- `cooldown` - Cool-down phase
- `recovery` - Recovery phase between intervals
- `run` - Running interval (aliased to warmup)

### Strength Workouts
- `exercise` - Exercise step (can also use custom exercise names)
- `rest` - Rest period
- `cardio` - Cardio warmup
- `warmup` - General warmup (also available for strength)
- `repeat(n)` - Repeat a set of steps n times

## Exercise Names

You can specify custom exercise names using quotes in the YAML:

```yaml
- "Goblet Squat": 10 reps
- "Bench Press": 8 reps
- "Deadlift": 5 reps
```

## End Conditions

### Time-based
- `15min` - 15 minutes
- `30sec` - 30 seconds

### Distance-based
- `1000m` - 1000 meters

### Repetition-based
- `10 reps` - 10 repetitions (strength workouts only)

### Lap Button
- `lap` - Press lap button to advance

## Exercise Descriptions

You can add descriptions to exercises using the pipe syntax `|`:

```yaml
- "Exercise Name": "lap | Description text here"
```

For example:
```yaml
- "Goblet Squat": "lap | KB RDL Into Goblet Squat x10"
```

## Example Strength Workouts

### Basic Strength Workout
```yaml
workouts:
  basic_strength:
    - cardio: lap  # Cardio warmup
    - warmup: lap  # General warmup
    - repeat(3):
        - "Goblet Squat": 10 reps  # Exercise name with reps
        - rest: lap  # Rest period
```

### Complex Strength Workout with Multiple Exercises
```yaml
workouts:
  full_body_strength:
    - warmup:
        - cardio: lap
        - warmup: lap
    - repeat(3):
        - "Squats": 12 reps
        - rest: lap
        - "Push-ups": 10 reps
        - rest: lap
        - "Bent-over Rows": 10 reps
        - rest: lap
```

### HYROX-Style Workout with Descriptions
```yaml
workouts:
  hyrox_test:
    - warmup:
        - cardio: lap  # Cardio warmup nested under warmup
    - repeat(3):
        - "30-degree Lat Pull-down": "lap | Straight Arm Pull down x 10"
        - "Goblet Squat": "lap | KB RDL Into Goblet Squat x10"
        - "Kettlebell Floor to Shelf": "lap | KB Bottoms Up Press x8 each side"
        - rest: lap
```

Note: Exercise names with hyphens and special characters are automatically converted to Garmin format (UPPER_CASE with underscores).

### Workout with Explicit Categories
```yaml
workouts:
  custom_categories:
    - warmup:
        - cardio: lap
    - repeat(3):
        - "Burpee [category: TOTAL_BODY]": 10 reps  # Explicit category
        - "Custom Plyo Move [category: PLYO]": 8 reps  # Custom exercise with explicit category
        - rest: lap
```

This is useful when:
- You have a custom exercise name that doesn't match any automatic detection
- You want to ensure a specific category is used
- You're testing new exercise categories

### Workout with Equipment-Based Exercises
```yaml
workouts:
  equipment_workout:
    - warmup:
        - cardio: lap
    - repeat(3):
        - "Sled Push": lap  # Automatically maps to SLED category
        - "Ski Moguls": 60s  # Automatically maps to CARDIO category
        - rest: 90s
```

Equipment-based exercises like sled pushes and ski moguls are automatically categorized correctly when you use the standard exercise name.

## Detection

The app automatically detects if a workout is strength or running based on the step types present:
- If `exercise`, `rest`, or `cardio` steps are found, it's a strength workout
- If custom exercise names with `reps` are found, it's a strength workout
- Otherwise, it defaults to running

## Exercise Categories

### Automatic Detection

The app automatically determines exercise categories based on the exercise name (checked in order of specificity):
- "bulgarian split squat" → LUNGE
- "good morning" → LEG_CURL
- "clean and jerk" → OLYMPIC_LIFT
- "wall ball" or "wallball" → SQUAT
- "medicine ball slam" → PLYO
- "ski moguls" → CARDIO
- "pike push" or "push-up" → PUSH_UP
- "plank" → PLANK
- "burpee" → TOTAL_BODY
- "inverted row" or "row" → ROW
- "squat" → SQUAT
- "push press" → SHOULDER_PRESS
- "press" → BENCH_PRESS
- "deadlift" → DEADLIFT
- "lat" or "pull" → PULL_UP
- "kettlebell floor to shelf" → DEADLIFT
- "kettlebell swing" → HIP_SWING
- "push up" or "pushup" → PUSH_UP
- "sled push" → SLED
- "sled drag" → SLED
- "farmer's carry" → CARRY
- "bar hold" → DEADLIFT (grip strength work)
- "x abs" or "x-abs" → SIT_UP (with exerciseName: X_ABS)
- "ghd back extension" or "back extension" → CORE (core exercises)

### Explicit Categories

You can override automatic detection by explicitly specifying a category in your YAML:

```yaml
- "Custom Exercise [category: PLYO]": 10 reps
- "Burpee [category: TOTAL_BODY]": 10 reps
- "My Special Exercise [category: CARDIO]": lap
```

Supported categories include:
- `PLYO` - Plyometric exercises
- `TOTAL_BODY` - Full body exercises (e.g., Burpee)
- `CARDIO` - Cardio exercises (e.g., Ski Moguls)
- `SQUAT` - Squat variations
- `BENCH_PRESS` - Bench press variations
- `DEADLIFT` - Deadlift variations
- `PULL_UP` - Pull-up and lat exercises
- `PUSH_UP` - Push-up variations
- `LUNGE` - Lunge variations
- `LEG_CURL` - Leg curl variations
- `OLYMPIC_LIFT` - Olympic lifting movements
- `PLANK` - Plank exercises
- `ROW` - Rowing exercises
- `SLED` - Sled exercises with specific exercise names:
  - `exerciseName: PUSH` for sled push
  - `exerciseName: BACKWARD_DRAG` for sled backward drag
- `HIP_SWING` - Hip swing exercises (e.g., Kettlebell Swing)
- `CARRY` - Carry exercises with specific exercise names:
  - `exerciseName: FARMERS_CARRY` for farmer's carry
- `SHOULDER_PRESS` - Shoulder press variations (e.g., Dumbbell Push Press)
- `CORE` - Core exercises (e.g., GHD Back Extensions)
- `SIT_UP` - Sit-up variations with specific exercise names:
  - `exerciseName: X_ABS` for X Abs exercises
- And more...

## Testing

Use the test YAML files to test workout creation:
- `test_strength_workout.yaml` - Basic strength workout
- `test_hyrox_workout.yaml` - HYROX-style workout with descriptions

Run:
```bash
python -m garmin_planner test_strength_workout.yaml
python -m garmin_planner test_hyrox_workout.yaml
```

Ensure your `secrets.yaml` contains valid Garmin Connect credentials.

