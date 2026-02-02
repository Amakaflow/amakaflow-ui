# Tool Permissions and Limits

## Allowed Tools

### Browser (Web Testing)
**Purpose**: UI testing via Playwright-backed browser automation

**Allowed Operations**:
- Navigate to localhost URLs (ports 3000, 5173, 8001-8005)
- Click, type, and interact with page elements
- Take screenshots
- Read console logs
- Wait for network idle or element presence

**Restrictions**:
- No navigation to external URLs (except for OAuth mock flows)
- No file downloads
- No browser extensions
- No localStorage/cookie manipulation outside test setup

### Exec (Shell Commands)
**Purpose**: API testing, Maestro execution, and artifact management

**Allowed Commands**:
- `curl` - HTTP requests to localhost services
- `jq` - JSON parsing
- `maestro test` - Run Maestro test flows
- `maestro hierarchy` - Inspect app element hierarchy
- `xcrun simctl` - iOS simulator control (screenshot, launch, terminate)
- `adb` - Android device/emulator control (screenshot, shell, install)
- `mkdir`, `cp`, `mv` - Artifact management within artifacts/
- `cat`, `echo` - Log file operations
- `date` - Timestamps

**Restrictions**:
- No `rm -rf` outside artifacts/
- No `sudo` commands
- No package installation at runtime
- No system configuration changes
- No network commands to external hosts
- No `maestro studio` (interactive mode)

### Read
**Purpose**: Read scenario files, Maestro flows, and configuration

**Allowed Paths**:
- `scenarios/**/*.md`
- `flows/**/*.yaml`
- `skills/**/*.md`
- `*.md`, `*.json` in project root
- `artifacts/**/*` (read own artifacts)

### Write
**Purpose**: Write test artifacts and reports

**Allowed Paths**:
- `artifacts/screenshots/*.png`
- `artifacts/logs/*.log`
- `artifacts/reports/*.json`

**Restrictions**:
- Cannot modify scenario files
- Cannot modify Maestro flows
- Cannot modify configuration files
- Cannot write outside artifacts/

## Maestro-Specific Permissions

### Allowed Maestro Commands
```bash
# Run a test flow
maestro test flows/ios/smoke.yaml

# Run with specific device
maestro test --device "iPhone 15 Pro" flows/ios/smoke.yaml

# Get element hierarchy (for debugging selectors)
maestro hierarchy

# Run multiple flows
maestro test flows/ios/*.yaml
```

### Maestro Flow Restrictions
- Flows must target localhost APIs only
- No network mocking that bypasses real services
- No file system access outside app sandbox
- Screenshots saved to artifacts/ directory

## Resource Limits

| Resource | Limit |
|----------|-------|
| Max screenshots per run | 200 |
| Max log file size | 10MB |
| Max execution time | 60 minutes |
| Max concurrent browser tabs | 1 |
| Max concurrent simulators | 2 |
| Max retries per action | 3 |

## Network Access

**Allowed Hosts (Web)**:
- `localhost:3000` - UI
- `localhost:5173` - UI (dev server)
- `localhost:8001` - Mapper API
- `localhost:8003` - Calendar API
- `localhost:8004` - Workout Ingestor API
- `localhost:8005` - Chat API

**Allowed Hosts (Mobile via Emulator)**:
- `10.0.2.2:*` - Android emulator localhost
- `localhost:*` - iOS simulator (direct access)

**Blocked**:
- All external hosts
- All non-HTTP protocols (except for app deep links)

## Platform-Specific Limits

### iOS/watchOS
- Simulator must be pre-booted
- App must be pre-installed
- No Xcode build commands
- No provisioning profile operations

### Android/Wear OS
- Emulator must be pre-started
- App must be pre-installed
- No Gradle build commands
- No signing operations

## Error Escalation

If a tool operation fails:
1. Log the error with full context
2. Capture current state (screenshot if possible)
3. Continue to next test step
4. Mark test as failed in final report

Critical failures that abort the suite:
- All health checks fail
- Browser/Maestro fails to launch
- Simulator/emulator not available
- Artifacts directory not writable
- App not installed on device
