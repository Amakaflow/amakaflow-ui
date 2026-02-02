# iOS Smoke Test Scenarios

Quick validation of critical iOS app functionality. Run in under 2 minutes.

## Prerequisites

- iOS Simulator booted (iPhone 15 Pro)
- AmakaFlow app installed
- Maestro installed (`maestro --version`)

## Execution

```bash
# Run via script
./scripts/run-full-suite.sh smoke ios

# Or directly via Maestro
maestro test flows/ios/smoke.yaml
```

---

## Flow: `flows/ios/smoke.yaml`

This consolidated flow validates:

### 1. App Launch
- Launches app with `clearState: true` for isolation
- Waits for `home_screen` element (15s timeout)
- Asserts `home_screen` is visible
- Takes screenshot: `ios-smoke-01-launch.png`

### 2. Home Screen Verification
- Asserts no `error_view` is present
- Takes screenshot: `ios-smoke-02-home.png`

### 3. Navigate to Workouts
- Taps `workouts_tab` (NOT optional - must work)
- Waits for `workouts_screen` (5s timeout)
- Asserts `workouts_screen` is visible
- Takes screenshot: `ios-smoke-03-workouts.png`

### 4. Navigate to Settings
- Taps `settings_tab` (NOT optional)
- Waits for `settings_screen` (5s timeout)
- Asserts `settings_screen` is visible
- Takes screenshot: `ios-smoke-04-settings.png`

### 5. Return to Home
- Taps `home_tab` (NOT optional)
- Waits for `home_screen` (5s timeout)
- Takes screenshot: `ios-smoke-05-complete.png`

### 6. Final Assertions
- `home_tab` is visible
- `workouts_tab` is visible
- `settings_tab` is visible
- No `error_view` or `crash_dialog` present

---

## Pass Criteria

For the smoke test to PASS:
1. App launches without crash
2. All tab navigation works (home, workouts, settings)
3. No error views or crash dialogs appear
4. All screenshots captured successfully

## Timing Budget

| Step | Max Duration |
|------|--------------|
| App Launch | 15s |
| Navigation (x3) | 15s |
| Screenshots | 5s |
| **Total** | **< 2 minutes** |

## Required Accessibility IDs

Your iOS app must have these accessibility identifiers set:

| Element | Accessibility ID |
|---------|------------------|
| Home screen container | `home_screen` |
| Workouts screen | `workouts_screen` |
| Settings screen | `settings_screen` |
| Home tab | `home_tab` |
| Workouts tab | `workouts_tab` |
| Settings tab | `settings_tab` |
| Error view (if shown) | `error_view` |

## Troubleshooting

If tests fail:
1. Check `artifacts/screenshots/ios-smoke-error.png` for failure state
2. Review device logs in `artifacts/logs/ios-device-*.log`
3. Verify accessibility IDs match using `maestro hierarchy`
