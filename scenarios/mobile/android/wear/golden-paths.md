# Wear OS Golden Path Scenarios

Critical user journeys on the AmakaFlow Wear OS app.

## Prerequisites

- Wear OS Emulator running
- Paired with Android phone emulator
- AmakaFlow Wear app installed
- Maestro installed

---

## Scenario: App Launches on Watch

### Step 1: Launch wear app
- **Tool**: Maestro
- **Flow**: `flows/android/wear/app-launch.yaml`
- **Expected**: Wear app launches to main screen
- **Screenshot**: watch-android-launch.png

### Step 2: Verify main UI
- **Tool**: Maestro
- **Flow**: `flows/android/wear/verify-main.yaml`
- **Expected**: Start workout button visible
- **Screenshot**: watch-android-main.png

---

## Scenario: Start Workout Session

### Step 1: Tap start workout
- **Tool**: Maestro
- **Flow**: `flows/android/wear/start-workout.yaml`
- **Expected**: Workout session begins
- **Screenshot**: watch-android-workout-start.png

### Step 2: Verify workout in progress
- **Tool**: Maestro
- **Flow**: `flows/android/wear/verify-workout-active.yaml`
- **Expected**: Timer and controls visible
- **Screenshot**: watch-android-workout-active.png

### Step 3: View current exercise
- **Tool**: Maestro
- **Flow**: `flows/android/wear/view-exercise.yaml`
- **Expected**: Current exercise details shown
- **Screenshot**: watch-android-exercise.png

---

## Scenario: Quick Log During Workout

### Step 1: Open quick log
- **Tool**: Maestro
- **Flow**: `flows/android/wear/open-quick-log.yaml`
- **Expected**: Quick log interface appears
- **Screenshot**: watch-android-quick-log.png

### Step 2: Log a set
- **Tool**: Maestro
- **Flow**: `flows/android/wear/log-set.yaml`
- **Expected**: Set logged, confirmation shown
- **Screenshot**: watch-android-set-logged.png

---

## Scenario: End Workout

### Step 1: End workout session
- **Tool**: Maestro
- **Flow**: `flows/android/wear/end-workout.yaml`
- **Expected**: Workout ends, summary shown
- **Screenshot**: watch-android-workout-end.png

### Step 2: Verify summary
- **Tool**: Maestro
- **Flow**: `flows/android/wear/verify-summary.yaml`
- **Expected**: Duration and workout summary
- **Screenshot**: watch-android-summary.png

---

## Pass Criteria

- Wear app launches successfully
- Workout session can be started and ended
- Quick log functionality works
- Summary displays correct information
- Phone-watch sync works (if paired)
