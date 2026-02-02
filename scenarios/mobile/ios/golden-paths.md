# iOS Golden Path Scenarios

Critical user journeys through the AmakaFlow iOS app.

## Prerequisites

- iOS Simulator booted (iPhone 15 Pro)
- AmakaFlow app installed with test account
- Backend services running (for API calls)
- Maestro installed

---

## Scenario: View Workouts List

### Step 1: Launch app
- **Tool**: Maestro
- **Flow**: `flows/ios/app-launch.yaml`
- **Expected**: App opens to home screen
- **Screenshot**: ios-golden-launch.png

### Step 2: Navigate to workouts
- **Tool**: Maestro
- **Flow**: `flows/ios/nav-workouts.yaml`
- **Expected**: Workouts list displays
- **Screenshot**: ios-golden-workouts-list.png

### Step 3: Verify workout cards
- **Tool**: Maestro
- **Flow**: `flows/ios/verify-workout-cards.yaml`
- **Expected**: Workout cards show title, date, and summary
- **Screenshot**: ios-golden-workout-cards.png

---

## Scenario: Voice Workout Recording Flow

### Step 1: Open voice workout
- **Tool**: Maestro
- **Flow**: `flows/ios/open-voice-workout.yaml`
- **Expected**: Voice workout screen displays
- **Screenshot**: ios-golden-voice-start.png

### Step 2: Start recording (simulated)
- **Tool**: Maestro
- **Flow**: `flows/ios/start-voice-recording.yaml`
- **Expected**: Recording indicator shows, timer starts
- **Screenshot**: ios-golden-voice-recording.png

### Step 3: Stop recording
- **Tool**: Maestro
- **Flow**: `flows/ios/stop-voice-recording.yaml`
- **Expected**: Recording stops, review screen appears
- **Screenshot**: ios-golden-voice-stopped.png

### Step 4: Review transcription
- **Tool**: Maestro
- **Flow**: `flows/ios/review-transcription.yaml`
- **Expected**: Transcription text is visible and editable
- **Screenshot**: ios-golden-voice-review.png

---

## Scenario: Workout Completion Detail

### Step 1: Navigate to history
- **Tool**: Maestro
- **Flow**: `flows/ios/nav-history.yaml`
- **Expected**: History/Activity screen displays
- **Screenshot**: ios-golden-history.png

### Step 2: Select a completed workout
- **Tool**: Maestro
- **Flow**: `flows/ios/select-completion.yaml`
- **Expected**: Completion detail screen opens
- **Screenshot**: ios-golden-completion-detail.png

### Step 3: Verify metrics display
- **Tool**: Maestro
- **Flow**: `flows/ios/verify-completion-metrics.yaml`
- **Expected**: Duration, calories, heart rate zones visible
- **Screenshot**: ios-golden-completion-metrics.png

### Step 4: View heart rate chart
- **Tool**: Maestro
- **Flow**: `flows/ios/view-hr-chart.yaml`
- **Expected**: Heart rate chart renders correctly
- **Screenshot**: ios-golden-hr-chart.png

---

## Scenario: Watch Pairing Flow

### Step 1: Open settings
- **Tool**: Maestro
- **Flow**: `flows/ios/nav-settings.yaml`
- **Expected**: Settings screen displays
- **Screenshot**: ios-golden-settings.png

### Step 2: Navigate to watch pairing
- **Tool**: Maestro
- **Flow**: `flows/ios/open-pairing.yaml`
- **Expected**: Pairing screen shows watch status
- **Screenshot**: ios-golden-pairing.png

### Step 3: Verify pairing UI
- **Tool**: Maestro
- **Flow**: `flows/ios/verify-pairing-ui.yaml`
- **Expected**: QR code or pairing instructions visible
- **Screenshot**: ios-golden-pairing-ui.png

---

## Scenario: Settings Configuration

### Step 1: Open settings
- **Tool**: Maestro
- **Flow**: `flows/ios/nav-settings.yaml`
- **Expected**: Settings screen displays
- **Screenshot**: ios-golden-settings-open.png

### Step 2: Open voice transcription settings
- **Tool**: Maestro
- **Flow**: `flows/ios/open-voice-settings.yaml`
- **Expected**: Voice settings screen displays
- **Screenshot**: ios-golden-voice-settings.png

### Step 3: Toggle a setting
- **Tool**: Maestro
- **Flow**: `flows/ios/toggle-setting.yaml`
- **Expected**: Setting toggles and persists
- **Screenshot**: ios-golden-setting-toggled.png

---

## Pass Criteria

- All navigation flows complete without errors
- Voice recording UI is fully functional
- Workout completion details display correctly
- Heart rate chart renders
- Settings can be viewed and modified
