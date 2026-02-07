# Garmin Companion Smoke Test Scenarios

Quick validation of Garmin Connect IQ companion integration on the phone. Run in under 2 minutes.

## Prerequisites

- iOS Simulator booted (iPhone 15 Pro)
- AmakaFlow app installed with Garmin Connect IQ integration
- Maestro installed (`maestro --version`)

## Execution

```bash
# Run via Maestro
maestro test flows/garmin/companion/ios/sync-smoke.yaml
```

---

## Flow: `flows/garmin/companion/ios/sync-smoke.yaml`

This flow validates the phone-side Garmin integration UI. Maestro **cannot** test
the Garmin watch itself -- only the companion app screens.

### 1. App Launch
- Launches app with `clearState: true` for isolation
- Waits for `home_screen` element (15s timeout)
- Asserts no `error_view` is present
- Takes screenshot: `garmin-sync-smoke-01-launch.png`

### 2. Navigate to Settings
- Taps `settings_tab` (NOT optional)
- Waits for `settings_screen` (10s timeout)
- Takes screenshot: `garmin-sync-smoke-02-settings.png`

### 3. Find Data Sources
- Scrolls to find "Data Sources" text
- Taps into Data Sources screen
- Waits for `data_sources_screen` (10s timeout)
- Takes screenshot: `garmin-sync-smoke-03-data-sources.png`
- Takes screenshot: `garmin-sync-smoke-04-sources-list.png`

### 4. Verify Garmin Connect Entry
- Scrolls to find "Garmin Connect" text
- Asserts "Garmin Connect" is visible
- Taps into Garmin Connect settings
- Waits for `garmin_connect_screen` (10s timeout)
- Takes screenshot: `garmin-sync-smoke-05-garmin-visible.png`
- Takes screenshot: `garmin-sync-smoke-06-garmin-connect.png`

### 5. Verify Sync UI Elements
- Asserts `garmin_sync_status` is visible (optional -- may show "Not Connected")
- Asserts `garmin_connect_button` is visible (optional)
- Takes screenshot: `garmin-sync-smoke-07-sync-ui.png`

### 6. Return to Home
- Taps `home_tab` (NOT optional)
- Waits for `home_screen` (10s timeout)
- Takes screenshot: `garmin-sync-smoke-08-complete.png`

### 7. Final Assertions
- `home_screen` is visible
- No `error_view` or `crash_dialog` present

---

## Pass Criteria

For the smoke test to PASS:
1. App launches without crash
2. Settings navigation works
3. Data Sources screen is accessible
4. Garmin Connect entry is listed in Data Sources
5. Garmin Connect settings screen renders
6. No error views or crash dialogs appear
7. All screenshots captured successfully

## Timing Budget

| Step | Max Duration |
|------|--------------|
| App Launch | 15s |
| Navigation to Settings | 10s |
| Scroll to Data Sources | 10s |
| Scroll to Garmin Connect | 10s |
| Verify sync UI | 5s |
| Return to home | 10s |
| **Total** | **< 2 minutes** |

## Required Accessibility IDs

Your iOS app must have these accessibility identifiers set:

| Element | Accessibility ID |
|---------|------------------|
| Home screen container | `home_screen` |
| Settings screen | `settings_screen` |
| Settings tab | `settings_tab` |
| Home tab | `home_tab` |
| Data Sources screen | `data_sources_screen` |
| Garmin Connect screen | `garmin_connect_screen` |
| Garmin sync status | `garmin_sync_status` |
| Garmin connect button | `garmin_connect_button` |
| Error view (if shown) | `error_view` |

## Limitations

- Maestro can only test the phone-side companion UI
- Actual Garmin watch behavior is not testable via Maestro
- OAuth flows (Garmin Connect login) cannot be fully automated
- BLE pairing and data sync require a physical Garmin device

## Troubleshooting

If tests fail:
1. Check `artifacts/screenshots/garmin-sync-smoke-error.png` for failure state
2. Verify the app has Garmin Connect IQ integration enabled
3. Verify accessibility IDs match using `maestro hierarchy`
4. Ensure the Data Sources / Garmin Connect screens exist in the app
