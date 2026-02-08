# Garmin Companion Golden Path Scenarios

Critical user journeys for Garmin Connect IQ integration in the AmakaFlow companion app.

## Prerequisites

- iOS Simulator booted (iPhone 15 Pro)
- AmakaFlow app installed with Garmin Connect IQ integration
- Maestro installed
- For full integration: Garmin Connect IQ simulator running

---

## Scenario: View Garmin Data Source

### Step 1: Launch app
- **Tool**: Maestro
- **Flow**: `flows/garmin/companion/ios/sync-smoke.yaml` (setup portion)
- **Expected**: App opens to home screen
- **Screenshot**: garmin-golden-launch.png

### Step 2: Navigate to Data Sources
- **Tool**: Maestro
- **Expected**: Settings screen displays, Data Sources section visible
- **Screenshot**: garmin-golden-data-sources.png

### Step 3: Open Garmin Connect settings
- **Tool**: Maestro
- **Expected**: Garmin Connect screen displays with sync status
- **Screenshot**: garmin-golden-garmin-connect.png

---

## Scenario: Garmin Sync Status Check

### Step 1: Open Garmin Connect screen
- **Tool**: Maestro
- **Expected**: Garmin Connect settings screen displays
- **Screenshot**: garmin-golden-sync-status.png

### Step 2: Verify sync status indicator
- **Tool**: Maestro
- **Expected**: Sync status shows "Connected", "Not Connected", or "Last Synced" timestamp
- **Screenshot**: garmin-golden-sync-indicator.png

### Step 3: Verify connect/disconnect button
- **Tool**: Maestro
- **Expected**: Button to connect or disconnect Garmin is visible
- **Screenshot**: garmin-golden-connect-button.png

---

## Scenario: Garmin Workout Sync (Phone-Side)

### Step 1: Navigate to workout history
- **Tool**: Maestro
- **Expected**: History screen displays
- **Screenshot**: garmin-golden-history.png

### Step 2: Verify Garmin-sourced workouts
- **Tool**: Maestro
- **Expected**: Workouts synced from Garmin show source indicator
- **Screenshot**: garmin-golden-garmin-workouts.png

### Step 3: Open Garmin-sourced workout detail
- **Tool**: Maestro
- **Expected**: Workout detail shows Garmin-specific metrics (steps, GPS, HR zones)
- **Screenshot**: garmin-golden-garmin-workout-detail.png

---

## Scenario: Connect IQ Watch App Communication (Simulated)

> NOTE: This scenario requires the Connect IQ simulator and cannot be
> fully automated via Maestro alone. Document for manual/scripted testing.

### Step 1: Launch watch app in simulator
- **Tool**: Connect IQ Simulator
- **Expected**: Watch app launches to main workout screen
- **Screenshot**: garmin-golden-watch-launch.png

### Step 2: Start workout on watch
- **Tool**: Connect IQ Simulator
- **Expected**: Workout timer starts, exercise display shown
- **Screenshot**: garmin-golden-watch-workout.png

### Step 3: Verify companion message received
- **Tool**: Connect IQ Simulator + Maestro (phone side)
- **Expected**: Phone app reflects active workout from watch
- **Screenshot**: garmin-golden-watch-companion-sync.png

### Step 4: End workout and verify sync
- **Tool**: Connect IQ Simulator
- **Expected**: Workout summary on watch, data synced to phone
- **Screenshot**: garmin-golden-watch-workout-end.png

---

## Pass Criteria

- Data Sources screen lists Garmin Connect as an available source
- Garmin Connect settings screen renders without errors
- Sync status indicator displays correctly
- Connect/disconnect button is functional
- Garmin-sourced workouts display in history (when available)
- No error views or crash dialogs appear

## Automation Coverage

| Scenario | Automatable via Maestro | Requires Simulator | Manual Only |
|----------|------------------------|--------------------|-------------|
| View Garmin Data Source | Yes | No | No |
| Sync Status Check | Yes | No | No |
| Workout Sync (phone-side) | Partial | No | No |
| Watch App Communication | No | Yes | Partial |
