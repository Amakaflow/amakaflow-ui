# Test Execution Protocol

## Agent: Test Runner

The test runner agent executes test scenarios across web and mobile platforms using Browser tool (web), Exec tool (APIs), and Maestro (mobile).

### Platform Support

| Platform | Tool | Device Target |
|----------|------|---------------|
| Web | Browser (Playwright) | Chrome 1280x720 |
| iOS | Maestro | iPhone 15 Pro Simulator |
| watchOS | Maestro | Apple Watch Series 9 Simulator |
| Android | Maestro | Pixel 7 Emulator |
| Wear OS | Maestro | Wear OS Emulator |

### Execution Flow

1. **Pre-flight Checks**
   - Verify ANTHROPIC_API_KEY is set
   - Verify artifacts directory exists and is writable
   - For mobile: verify Maestro is installed (`maestro --version`)
   - For mobile: verify simulator/emulator is running
   - Record start timestamp

2. **Service/App Health Verification**
   - Web: Run API health checks
   - Mobile: Verify app is installed and can launch
   - If critical failure, abort with clear error

3. **Suite Execution**
   - Read the requested scenario file(s)
   - Execute each step using appropriate tool
   - Capture artifacts after each action
   - Record pass/fail for each step

4. **Artifact Collection**
   - Screenshots: `artifacts/screenshots/{platform}-{scenario}-{step}-{timestamp}.png`
   - Logs: `artifacts/logs/{platform}-{suite}-{timestamp}.log`
   - Reports: `artifacts/reports/{platform}-{suite}-{timestamp}.json`

5. **Reporting**
   - Generate summary report per platform
   - Generate combined report for full suite
   - List all failures with links to artifacts
   - Exit with code 0 (all pass) or 1 (any failure)

### Tool Usage

#### Browser Tool (Web)
Used for web UI interactions:
- `open <url>` - Navigate to URL
- `click <selector>` - Click element (prefer data-testid selectors)
- `type <selector> <text>` - Enter text
- `screenshot <filename>` - Capture current state
- `console` - Get console logs
- `wait <condition>` - Wait for network/element

#### Exec Tool (APIs + Maestro)
Used for API checks and mobile test execution:
- `curl` commands for health checks
- `jq` for JSON parsing
- `maestro test <flow.yaml>` - Run Maestro flow
- `maestro studio` - Interactive debugging (not for CI)
- File operations for artifacts

#### Maestro (Mobile)
Declarative YAML flows executed via Exec:
```yaml
appId: com.amakaflow.app
---
- launchApp
- tapOn:
    id: "home_workouts_button"
- assertVisible: "Today's Workout"
- takeScreenshot: ios-home-workouts
```

### Suite Mapping

| Suite | Web | iOS | Android | watchOS | Wear OS |
|-------|-----|-----|---------|---------|---------|
| `smoke` | ✓ | ✓ | ✓ | - | - |
| `health` | ✓ | - | - | - | - |
| `golden` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `api` | ✓ | - | - | - | - |
| `ios` | - | ✓ | - | ✓ | - |
| `android` | - | - | ✓ | - | ✓ |
| `mobile` | - | ✓ | ✓ | ✓ | ✓ |
| `full` | ✓ | ✓ | ✓ | ✓ | ✓ |

### Parallel vs Sequential

- Health checks: Run in parallel (faster feedback)
- Web UI tests: Run sequentially (state dependencies)
- Mobile tests per platform: Run sequentially
- Cross-platform: Can run iOS and Android in parallel if both are available

### Retry Policy

- Health checks: Retry 3 times with 2s delay
- Browser actions: No retry (capture failure state)
- Maestro flows: Retry once on flaky failure
- API calls: Retry once on 5xx errors

### Timeout Policy

| Operation | Timeout |
|-----------|---------|
| Health check | 5s |
| Web page load | 30s |
| Element wait | 10s |
| API response | 10s |
| Maestro flow step | 10s |
| App launch | 30s |
| Screenshot | 5s |

### Mobile Prerequisites

Before running mobile tests:

1. **iOS/watchOS**:
   ```bash
   # Boot simulator
   xcrun simctl boot "iPhone 15 Pro"
   # Install app
   xcrun simctl install booted /path/to/AmakaFlow.app
   ```

2. **Android/Wear OS**:
   ```bash
   # Start emulator
   emulator -avd Pixel_7_API_34 &
   # Install app
   adb install /path/to/amakaflow.apk
   ```

3. **Maestro**:
   ```bash
   # Verify installation
   maestro --version
   # Should be >= 1.36.0
   ```
