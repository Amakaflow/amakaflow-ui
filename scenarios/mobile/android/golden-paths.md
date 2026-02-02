# Android Golden Path Scenarios

Critical user journeys through the AmakaFlow Android app.

## Prerequisites

- Android Emulator running (Pixel 7 API 34)
- AmakaFlow app installed with test account
- Backend services running (for API calls)
- Maestro installed

---

## Scenario: View Workouts List

### Step 1: Launch app
- **Tool**: Maestro
- **Flow**: `flows/android/app-launch.yaml`
- **Expected**: App opens to home screen
- **Screenshot**: android-golden-launch.png

### Step 2: Navigate to workouts
- **Tool**: Maestro
- **Flow**: `flows/android/nav-workouts.yaml`
- **Expected**: Workouts list displays
- **Screenshot**: android-golden-workouts-list.png

### Step 3: Open workout detail
- **Tool**: Maestro
- **Flow**: `flows/android/open-workout-detail.yaml`
- **Expected**: Workout detail screen displays
- **Screenshot**: android-golden-workout-detail.png

### Step 4: Verify workout information
- **Tool**: Maestro
- **Flow**: `flows/android/verify-workout-info.yaml`
- **Expected**: Exercises, sets, and reps are visible
- **Screenshot**: android-golden-workout-info.png

---

## Scenario: Voice Workout Recording Flow

### Step 1: Open voice workout
- **Tool**: Maestro
- **Flow**: `flows/android/open-voice-workout.yaml`
- **Expected**: Voice workout screen displays
- **Screenshot**: android-golden-voice-start.png

### Step 2: Start recording (simulated)
- **Tool**: Maestro
- **Flow**: `flows/android/start-voice-recording.yaml`
- **Expected**: Recording indicator shows
- **Screenshot**: android-golden-voice-recording.png

### Step 3: Stop recording
- **Tool**: Maestro
- **Flow**: `flows/android/stop-voice-recording.yaml`
- **Expected**: Recording stops, processing begins
- **Screenshot**: android-golden-voice-stopped.png

---

## Scenario: Calendar View

### Step 1: Navigate to calendar
- **Tool**: Maestro
- **Flow**: `flows/android/nav-calendar.yaml`
- **Expected**: Calendar view displays
- **Screenshot**: android-golden-calendar.png

### Step 2: Select a date with workouts
- **Tool**: Maestro
- **Flow**: `flows/android/select-calendar-date.yaml`
- **Expected**: Workouts for that date appear
- **Screenshot**: android-golden-calendar-date.png

### Step 3: Verify workout list for date
- **Tool**: Maestro
- **Flow**: `flows/android/verify-calendar-workouts.yaml`
- **Expected**: Scheduled workouts are listed
- **Screenshot**: android-golden-calendar-workouts.png

---

## Scenario: Workout History and Completion

### Step 1: Navigate to history
- **Tool**: Maestro
- **Flow**: `flows/android/nav-history.yaml`
- **Expected**: History screen displays
- **Screenshot**: android-golden-history.png

### Step 2: Select a completed workout
- **Tool**: Maestro
- **Flow**: `flows/android/select-completion.yaml`
- **Expected**: Completion detail screen opens
- **Screenshot**: android-golden-completion-detail.png

### Step 3: Verify metrics display
- **Tool**: Maestro
- **Flow**: `flows/android/verify-completion-metrics.yaml`
- **Expected**: Duration, calories, metrics visible
- **Screenshot**: android-golden-completion-metrics.png

---

## Scenario: Settings and Configuration

### Step 1: Open More menu
- **Tool**: Maestro
- **Flow**: `flows/android/nav-more.yaml`
- **Expected**: More screen displays
- **Screenshot**: android-golden-more.png

### Step 2: Open settings
- **Tool**: Maestro
- **Flow**: `flows/android/open-settings.yaml`
- **Expected**: Settings screen displays
- **Screenshot**: android-golden-settings.png

### Step 3: Open transcription settings
- **Tool**: Maestro
- **Flow**: `flows/android/open-transcription-settings.yaml`
- **Expected**: Transcription settings display
- **Screenshot**: android-golden-transcription-settings.png

---

## Scenario: Watch Pairing

### Step 1: Open pairing screen
- **Tool**: Maestro
- **Flow**: `flows/android/open-pairing.yaml`
- **Expected**: Pairing screen displays
- **Screenshot**: android-golden-pairing.png

### Step 2: Verify pairing UI
- **Tool**: Maestro
- **Flow**: `flows/android/verify-pairing-ui.yaml`
- **Expected**: Pairing instructions or status visible
- **Screenshot**: android-golden-pairing-ui.png

---

## Pass Criteria

- All navigation flows complete without errors
- Workout list and details display correctly
- Voice recording UI is functional
- Calendar displays scheduled workouts
- History shows completed workouts
- Settings can be accessed and modified
