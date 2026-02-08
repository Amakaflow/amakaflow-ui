# Garmin Test Flows

Maestro flows for testing Garmin Connect IQ integration in the AmakaFlow companion apps.

## Approach

Maestro runs on the phone and can only interact with phone-side UI. It **cannot** drive
the Garmin watch directly. These flows test the companion app's Garmin integration screens
(sync status, connect/disconnect, data source configuration).

For testing the watch app itself, see the `garmin/` top-level directory which covers
Connect IQ unit tests, simulator scripting, and on-device testing.

## Directory Structure

```
flows/garmin/
  companion/
    ios/
      sync-smoke.yaml      # Phone-side Garmin sync UI smoke test
    android/
      README.md             # Placeholder (not yet implemented)
```

## Running

```bash
# Run Garmin companion smoke test (iOS)
maestro test flows/garmin/companion/ios/sync-smoke.yaml
```

## Limitations

- Maestro cannot interact with the Garmin watch or Connect IQ simulator
- Flows only validate that the phone app's Garmin integration UI renders correctly
- Actual sync behavior requires a paired Garmin device or simulator
- Garmin Connect OAuth flows cannot be fully automated via Maestro

## What These Flows Test

| Flow | What It Tests |
|------|---------------|
| `sync-smoke.yaml` | App launch, navigate to Data Sources, verify Garmin Connect entry, check sync UI elements |

## What These Flows Do NOT Test

- Watch-side app behavior (use Connect IQ unit tests)
- BLE communication between phone and watch
- Garmin Connect OAuth authentication
- Actual data sync payloads
