# Test Runner Skill

## Command
`/test-runner [suite] [--platform <platform>]`

## Description
Execute AmakaFlow test suites autonomously across web and mobile platforms. Reads declarative scenario files and Maestro flows, executing them using Browser tool (web) and Exec + Maestro (mobile).

## Arguments

| Argument | Required | Default | Description |
|----------|----------|---------|-------------|
| suite | No | smoke | Test suite: `smoke`, `health`, `golden`, `api`, `ios`, `android`, `mobile`, `full` |
| --platform | No | all | Target platform: `web`, `ios`, `android`, `watchos`, `wearos`, `mobile`, `all` |

## Suites

| Suite | Web | iOS | Android | watchOS | Wear OS | Description |
|-------|-----|-----|---------|---------|---------|-------------|
| `smoke` | ✓ | ✓ | ✓ | - | - | Quick validation (<3 min) |
| `health` | ✓ | - | - | - | - | API health endpoints only |
| `golden` | ✓ | ✓ | ✓ | ✓ | ✓ | Full UI golden paths |
| `api` | ✓ | - | - | - | - | API contract validation |
| `ios` | - | ✓ | - | ✓ | - | iOS + watchOS only |
| `android` | - | - | ✓ | - | ✓ | Android + Wear OS only |
| `mobile` | - | ✓ | ✓ | ✓ | ✓ | All mobile platforms |
| `full` | ✓ | ✓ | ✓ | ✓ | ✓ | Everything |

## Execution Protocol

### 1. Initialize
```
Create timestamp: YYYYMMDD-HHMMSS
Create run directory: artifacts/runs/{timestamp}/
Initialize log file: artifacts/logs/run-{timestamp}.log
```

### 2. Pre-flight Checks

**For all runs:**
- Verify artifacts directory is writable
- Log: "Starting {suite} suite at {timestamp}"

**For web:**
- Verify Browser tool is available

**For mobile:**
- Verify Maestro is installed: `maestro --version`
- For iOS: Verify simulator is booted: `xcrun simctl list | grep Booted`
- For Android: Verify emulator is running: `adb devices`
- Verify app is installed on target device

### 3. Load Scenarios and Flows

Based on suite and platform arguments:

| Suite | Scenarios | Flows |
|-------|-----------|-------|
| smoke (web) | scenarios/web/smoke-suite.md | - |
| smoke (ios) | scenarios/mobile/ios/smoke.md | flows/ios/smoke.yaml |
| smoke (android) | scenarios/mobile/android/smoke.md | flows/android/smoke.yaml |
| golden (ios) | scenarios/mobile/ios/golden-paths.md | flows/ios/golden-paths.yaml |
| golden (watchos) | scenarios/mobile/ios/watch/golden-paths.md | flows/ios/watch/golden-paths.yaml |
| golden (android) | scenarios/mobile/android/golden-paths.md | flows/android/golden-paths.yaml |
| golden (wearos) | scenarios/mobile/android/wear/golden-paths.md | flows/android/wear/golden-paths.yaml |

### 4. Execute Tests

**Web Tests (Browser Tool):**
1. Read scenario markdown
2. Execute each step using Browser tool
3. Capture screenshots after each action
4. Validate expected conditions

**Mobile Tests (Maestro via Exec):**
1. Run Maestro flow: `maestro test flows/{platform}/{flow}.yaml`
2. Maestro handles screenshots (saved to artifacts/)
3. Parse Maestro output for pass/fail
4. Capture device logs on failure

### 5. Generate Report

Create `artifacts/reports/report-{timestamp}.json`:
```json
{
  "suite": "smoke",
  "platform": "all",
  "timestamp": "2024-01-15T10:30:00Z",
  "duration_ms": 180000,
  "results": {
    "web": { "passed": 4, "failed": 0 },
    "ios": { "passed": 3, "failed": 0 },
    "android": { "passed": 3, "failed": 1 },
    "watchos": { "skipped": true, "reason": "Not in smoke suite" },
    "wearos": { "skipped": true, "reason": "Not in smoke suite" }
  },
  "failures": [
    {
      "platform": "android",
      "scenario": "Bottom Navigation",
      "step": "Navigate to History",
      "error": "Element not found: nav_history",
      "artifacts": ["android-smoke-05-history.png", "android-logcat.txt"]
    }
  ]
}
```

### 6. Exit
- Print summary to console
- Exit 0 if all passed
- Exit 1 if any failed

## Examples

### Run smoke tests on all platforms
```
/test-runner smoke
```

### Run golden paths on iOS only
```
/test-runner golden --platform ios
```

### Run full mobile suite
```
/test-runner golden --platform mobile
```

### Run everything
```
/test-runner full
```

## Platform-Specific Commands

### iOS Simulator
```bash
# Boot simulator
xcrun simctl boot "iPhone 15 Pro"

# Check booted simulators
xcrun simctl list | grep Booted

# Install app
xcrun simctl install booted /path/to/AmakaFlow.app

# Launch app
xcrun simctl launch booted com.amakaflow.app

# Take screenshot
xcrun simctl io booted screenshot screenshot.png
```

### Android Emulator
```bash
# List emulators
emulator -list-avds

# Start emulator
emulator -avd Pixel_7_API_34 &

# Check running devices
adb devices

# Install app
adb install /path/to/amakaflow.apk

# Launch app
adb shell am start -n com.amakaflow.companion/.MainActivity

# Take screenshot
adb exec-out screencap -p > screenshot.png
```

### Maestro
```bash
# Run a flow
maestro test flows/ios/smoke.yaml

# Run with specific device
maestro test --device "iPhone 15 Pro" flows/ios/smoke.yaml

# Run all flows in directory
maestro test flows/ios/

# Debug mode (interactive)
maestro studio  # NOT for CI
```

## Artifact Naming

| Platform | Pattern |
|----------|---------|
| Web | `web-{scenario}-{step}-{timestamp}.png` |
| iOS | `ios-{scenario}-{step}-{timestamp}.png` |
| Android | `android-{scenario}-{step}-{timestamp}.png` |
| watchOS | `watchos-{scenario}-{step}-{timestamp}.png` |
| Wear OS | `wearos-{scenario}-{step}-{timestamp}.png` |
| Logs | `{platform}-{suite}-{timestamp}.log` |
| Reports | `report-{timestamp}.json` |
