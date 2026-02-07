# Garmin Connect IQ Testing

Multi-layer testing strategy for the AmakaFlow Garmin watch app.

## Testing Layers

Garmin testing requires multiple complementary approaches because no single tool
can cover the full stack. The layers build on each other from fast/isolated to
slow/integrated:

### Layer 1: Connect IQ Unit Tests (fastest, most isolated)

**Directory:** `garmin/unit-tests/`

Unit tests for the Monkey C watch app code using the Connect IQ SDK test framework.
These run without a device or simulator and validate business logic, data parsing,
and state management.

```bash
# Run unit tests (requires Connect IQ SDK)
cd garmin/unit-tests
monkeyc -t -f monkey.jungle
```

**What it covers:**
- Workout data model parsing
- Timer/counter logic
- BLE message serialization/deserialization
- UI state machine transitions

### Layer 2: Companion App Maestro Tests (phone-side only)

**Directory:** `flows/garmin/companion/`

Maestro flows that test the phone-side integration UI in the AmakaFlow iOS/Android app.
Maestro drives the phone simulator/emulator and validates that Garmin Connect screens
render correctly.

```bash
# Run companion smoke test
maestro test flows/garmin/companion/ios/sync-smoke.yaml
```

**What it covers:**
- Garmin Connect data source UI on the phone
- Sync status display
- Connect/disconnect button behavior
- Settings navigation to Garmin section

**What it cannot cover:**
- Actual watch behavior
- BLE communication
- Garmin Connect OAuth (requires real credentials)

### Layer 3: Simulator Scripting (planned)

**Directory:** `garmin/simulator-scripts/`

Scripts that automate the Connect IQ simulator for integration testing.
The simulator can run the watch app without physical hardware and supports
programmatic interaction via its debug interface.

**What it will cover:**
- Watch app UI rendering in the simulator
- Simulated workout sessions
- Communication protocol testing (phone <-> watch)

### Layer 4: On-Device Testing (manual, highest fidelity)

Physical Garmin device testing for scenarios that cannot be simulated:
- Real BLE pairing and communication latency
- Sensor data (heart rate, GPS, accelerometer)
- Battery and performance profiling
- Multi-device compatibility

## Target Devices

| Device | Connect IQ Version | Display | Notes |
|--------|-------------------|---------|-------|
| Venu 3 | 4.2+ | AMOLED 390x390 | Primary target |
| Forerunner 265 | 4.2+ | AMOLED 416x416 | Fitness-focused |
| Forerunner 965 | 4.2+ | AMOLED 454x454 | Premium fitness |

## Prerequisites

- [Connect IQ SDK](https://developer.garmin.com/connect-iq/sdk/) installed
- SDK Manager configured with target device profiles
- For simulator tests: Connect IQ simulator running
- For companion tests: Maestro installed, iOS/Android simulator booted

## Directory Structure

```
garmin/
  README.md                  # This file
  unit-tests/
    source/
      TestSuite.mc           # Test entry point
    monkey.jungle             # Build configuration
    README.md
  simulator-scripts/
    README.md                # Placeholder - simulator scripting docs
```
