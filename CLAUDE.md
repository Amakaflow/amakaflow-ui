# Claude Code Instructions

This is the AmakaFlow E2E test automation framework using Maestro for mobile testing and OpenClaw for web testing.

## Repository Structure

```
amakaflow-automation/
├── flows/                 # Maestro YAML flows (executable tests)
│   ├── ios/              # iOS phone tests
│   ├── ios/watch/        # watchOS tests (⚠️ aspirational - see note below)
│   ├── android/          # Android phone tests
│   ├── android/wear/     # Wear OS tests
│   └── garmin/           # Garmin companion app Maestro flows
│       └── companion/
│           ├── ios/      # iOS companion flows for Garmin
│           └── android/  # Android companion flows for Garmin
├── garmin/               # Garmin Connect IQ test infrastructure
│   ├── unit-tests/       # Connect IQ unit tests (Monkey C)
│   └── simulator-scripts/ # Garmin simulator automation scripts
├── scenarios/            # Human-readable test documentation
│   ├── web/              # Web test scenarios
│   └── mobile/           # Mobile test scenarios
├── scripts/              # Entry point scripts
├── artifacts/            # Test outputs (gitignored)
└── skills/               # OpenClaw skill definitions
```

## Key Commands

```bash
# Run smoke tests (all platforms)
./scripts/run-full-suite.sh smoke

# Run specific platform
./scripts/run-full-suite.sh smoke ios
./scripts/run-full-suite.sh smoke android

# Run golden path tests
./scripts/run-full-suite.sh golden ios

# Run individual Maestro flow
maestro test flows/ios/smoke.yaml

# Debug/inspect app elements
maestro hierarchy
maestro studio
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes | For OpenClaw web tests |
| `TEST_PASSWORD` | For auth | Password for test account |
| `TEST_TIMEOUT` | No | Timeout per test (default: 300s) |
| `JUNIT_OUTPUT` | No | Generate JUnit XML (default: true) |
| `CLEAN_ARTIFACTS` | No | Clean old artifacts before run |

## Maestro Flow Conventions

- All flows use `clearState: true` for test isolation
- Navigation elements are NOT optional (must work)
- Data-dependent elements (e.g., `workout_card_0`) can be optional
- Use `retryTapIfNoChange: true` for tap actions
- All flows have `onFlowError` screenshot capture

### Element ID Naming

| Platform | Convention | Example |
|----------|------------|---------|
| iOS | `{screen}_{element}` | `home_screen`, `workouts_tab` |
| Android | `{screen}_{element}` or `nav_{name}` | `home_screen`, `nav_workouts` |

## Adding New Tests

1. **Create Maestro flow** in `flows/{platform}/`
2. **Add scenario documentation** in `scenarios/mobile/{platform}/`
3. **Update run script** if new suite type needed
4. **Test locally** with `maestro test flows/{platform}/your-flow.yaml`

## Debugging Failed Tests

1. Check error screenshot: `artifacts/screenshots/*-error.png`
2. Review device logs: `artifacts/logs/*-device-*.log`
3. Check JUnit report: `artifacts/reports/*.xml`
4. Use `maestro studio` for interactive debugging

## Related Repos

- `amakaflow-dev-workspace` - Backend services (APIs)
- `amakaflow-ios-app` - iOS app source
- `amakaflow-android-app` - Android app source

## watchOS Flows (Aspirational)

The Maestro flows in `flows/ios/watch/` are **aspirational documentation only**. Maestro does NOT support watchOS simulators. These flows document desired test coverage but cannot be executed. Actual watchOS tests are implemented as XCUITests in the `amakaflow-ios-app` repository under the `AmakaFlowWatch Watch AppUITests` target.

## Garmin Testing

Garmin Connect IQ testing uses a multi-layer approach since there is no single tool that covers all Garmin test needs:

### Test Layers

| Layer | Tool | Location | What It Tests |
|-------|------|----------|---------------|
| Unit tests | Connect IQ SDK test runner | `garmin/unit-tests/` | Monkey C business logic, data models |
| Companion app | Maestro | `flows/garmin/companion/{ios,android}/` | Phone companion app interactions |
| Simulator | Custom scripts | `garmin/simulator-scripts/` | Watch face/widget rendering, sensor simulation |

### Garmin Commands

```bash
# Run Garmin unit tests (requires Connect IQ SDK)
connectiq test garmin/unit-tests/

# Run Garmin companion app Maestro flows (iOS)
maestro test flows/garmin/companion/ios/sync-smoke.yaml

# Run Garmin companion app Maestro flows (Android)
# Not yet implemented
# maestro test flows/garmin/companion/android/sync-smoke.yaml

# Run Garmin simulator scripts
./garmin/simulator-scripts/run-all.sh  # TODO: not yet implemented
```

### Connect IQ SDK Requirements

- Install the [Garmin Connect IQ SDK](https://developer.garmin.com/connect-iq/sdk/)
- Set `CONNECTIQ_HOME` environment variable to SDK install path
- Garmin simulator must be running for simulator script tests

## Git Workflow

**Always create feature branches for changes:**

```bash
git checkout -b feat/add-new-test
# make changes
git push -u origin feat/add-new-test
gh pr create
```
