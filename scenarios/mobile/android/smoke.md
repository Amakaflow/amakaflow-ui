# Android Smoke Test Scenarios

Quick validation of critical Android app functionality. Run in under 2 minutes.

## Prerequisites

- Android Emulator running (Pixel 7 API 34)
- AmakaFlow app installed
- Maestro installed (`maestro --version`)

## Execution

```bash
# Run via script
./scripts/run-full-suite.sh smoke android

# Or directly via Maestro
maestro test flows/android/smoke.yaml
```

---

## Flow: `flows/android/smoke.yaml`

This consolidated flow validates:

### 1. App Launch
- Launches app with `clearState: true` for isolation
- Waits for `home_screen` element (15s timeout)
- Asserts `home_screen` is visible
- Asserts `bottom_navigation` is visible
- Takes screenshot: `android-smoke-01-launch.png`

### 2. Home Screen Verification
- Asserts no `error_view` is present
- Takes screenshot: `android-smoke-02-home.png`

### 3. Navigate to Workouts
- Taps `nav_workouts` (NOT optional)
- Waits for `workouts_screen` (5s timeout)
- Asserts `workouts_screen` is visible
- Takes screenshot: `android-smoke-03-workouts.png`

### 4. Navigate to Calendar
- Taps `nav_calendar` (NOT optional)
- Waits for `calendar_screen` (5s timeout)
- Asserts `calendar_screen` is visible
- Takes screenshot: `android-smoke-04-calendar.png`

### 5. Navigate to History
- Taps `nav_history` (NOT optional)
- Waits for `history_screen` (5s timeout)
- Asserts `history_screen` is visible
- Takes screenshot: `android-smoke-05-history.png`

### 6. Navigate to More
- Taps `nav_more` (NOT optional)
- Waits for `more_screen` (5s timeout)
- Asserts `more_screen` is visible
- Takes screenshot: `android-smoke-06-more.png`

### 7. Return to Home
- Taps `nav_home` (NOT optional)
- Waits for `home_screen` (5s timeout)
- Takes screenshot: `android-smoke-07-complete.png`

### 8. Final Assertions
- `home_screen` is visible
- `bottom_navigation` is visible
- All nav items visible: `nav_home`, `nav_workouts`, `nav_calendar`, `nav_history`, `nav_more`
- No `error_view` or `crash_dialog` present

---

## Pass Criteria

For the smoke test to PASS:
1. App launches without crash
2. All bottom navigation tabs work
3. No error views or crash dialogs appear
4. All screenshots captured successfully

## Timing Budget

| Step | Max Duration |
|------|--------------|
| App Launch | 15s |
| Navigation (x5) | 25s |
| Screenshots | 5s |
| **Total** | **< 2 minutes** |

## Required Resource IDs

Your Android app must have these resource IDs (test tags):

| Element | Resource ID |
|---------|-------------|
| Home screen container | `home_screen` |
| Workouts screen | `workouts_screen` |
| Calendar screen | `calendar_screen` |
| History screen | `history_screen` |
| More screen | `more_screen` |
| Bottom navigation | `bottom_navigation` |
| Nav - Home | `nav_home` |
| Nav - Workouts | `nav_workouts` |
| Nav - Calendar | `nav_calendar` |
| Nav - History | `nav_history` |
| Nav - More | `nav_more` |
| Error view (if shown) | `error_view` |

## Troubleshooting

If tests fail:
1. Check `artifacts/screenshots/android-smoke-error.png` for failure state
2. Review device logs in `artifacts/logs/android-logcat-*.log`
3. Verify resource IDs match using `maestro hierarchy`
