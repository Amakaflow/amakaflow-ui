# AmakaFlow Automation

Autonomous test automation for the AmakaFlow fitness platform using OpenClaw (Claude Code) and Maestro.

Supports: **Web** | **iOS** | **Android** | **watchOS** | **Wear OS** | **Garmin**

## Overview

This repository contains declarative test scenarios that can be executed autonomously:
- **Web tests**: Executed via OpenClaw's Browser tool (Playwright-backed)
- **Mobile tests**: Executed via Maestro (declarative YAML flows)
- **Garmin tests**: Multi-layer approach using Connect IQ unit tests, Maestro companion flows, and simulator scripts

No coding required at runtime - tests are defined in Markdown/YAML and interpreted by the AI agent or Maestro.

## Quick Start

### Prerequisites

```bash
# 1. Install Maestro (for mobile tests)
curl -Ls https://get.maestro.mobile.dev | bash

# 2. Or run the setup script
./scripts/setup-maestro.sh
```

### Running Tests

```bash
# Set API key (for web tests via OpenClaw)
export ANTHROPIC_API_KEY=sk-...

# Run smoke tests (all platforms)
./scripts/run-full-suite.sh smoke

# Run iOS only
./scripts/run-full-suite.sh smoke ios

# Run golden paths on Android
./scripts/run-full-suite.sh golden android

# Run everything
./scripts/run-full-suite.sh full
```

### Running Garmin Tests

```bash
# Run Garmin unit tests (requires Connect IQ SDK)
export CONNECTIQ_HOME=/path/to/connectiq-sdk
connectiq test garmin/unit-tests/

# Run Garmin companion app flows (iOS)
maestro test flows/garmin/companion/ios/sync-smoke.yaml

# Run Garmin companion app flows (Android)
# Not yet implemented
# maestro test flows/garmin/companion/android/sync-smoke.yaml

# Run Garmin simulator scripts
./garmin/simulator-scripts/run-all.sh  # TODO: not yet implemented

# Run full Garmin suite
./scripts/run-full-suite.sh garmin
```

## AI Model Configuration

This automation framework uses a multi-model approach for cost efficiency:

| Task | Model | Provider | Pricing (in/out per 1M tokens) |
|------|-------|----------|------|
| Orchestration | Kimi K2.5 | Moonshot AI | $0.60/$2.50 |
| Code Generation | MiniMax M2 | MiniMax | See pricing page |

### Setup

1. Get API keys:
   - Kimi K2.5: https://platform.moonshot.ai/
   - MiniMax M2: https://www.minimax.io/

2. Configure environment:
```bash
cp .env.example .env
# Edit .env with your API keys
```

3. Run with AI analysis:
```bash
# Run tests with AI-powered failure analysis
./scripts/run-qa-agent.sh ios smoke analyze

# Watch mode - auto-test when app code changes
./scripts/watch-and-test.sh smoke
```

### Model Routing

- **Orchestration (Kimi K2.5)**: Test planning, failure analysis, decision making
- **Coding (MiniMax M2)**: Fix broken tests, generate new Maestro flows

### New Scripts

| Script | Purpose |
|--------|---------|
| `run-qa-agent.sh` | Main entry point with AI analysis |
| `watch-and-test.sh` | Continuous testing while coding |
| `model-router.sh` | Route prompts to appropriate model |

## Test Suites

| Suite | Web | iOS | Android | watchOS | Wear OS | Garmin | Duration |
|-------|-----|-----|---------|---------|---------|--------|----------|
| `smoke` | ✓ | ✓ | ✓ | - | - | - | ~3 min |
| `health` | ✓ | - | - | - | - | - | ~30 sec |
| `golden` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ~15 min |
| `api` | ✓ | - | - | - | - | - | ~5 min |
| `ios` | - | ✓ | - | ✓ | - | - | ~10 min |
| `android` | - | - | ✓ | - | ✓ | - | ~10 min |
| `garmin` | - | - | - | - | - | ✓ | ~8 min |
| `mobile` | - | ✓ | ✓ | ✓ | ✓ | ✓ | ~25 min |
| `full` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ~35 min |

## Platform Requirements

### Web
- Docker (optional, for containerized execution)
- AmakaFlow services running on localhost

### iOS / watchOS
- macOS with Xcode
- iOS Simulator booted (`xcrun simctl boot 'iPhone 15 Pro'`)
- AmakaFlow iOS app installed on simulator
- Maestro installed

### Android / Wear OS
- Android SDK with emulator
- Android Emulator running (`emulator -avd Pixel_7_API_34 &`)
- AmakaFlow Android app installed on emulator
- Maestro installed

### Garmin
- [Garmin Connect IQ SDK](https://developer.garmin.com/connect-iq/sdk/) installed
- `CONNECTIQ_HOME` environment variable set to SDK install path
- Garmin simulator (included in Connect IQ SDK) for simulator script tests
- For companion app tests: iOS simulator or Android emulator with AmakaFlow companion app installed
- Maestro installed (for companion app flows)

## Directory Structure

```
amakaflow-automation/
├── SOUL.md                    # QA persona definition
├── AGENTS.md                  # Test execution protocol
├── TOOLS.md                   # Tool permissions & limits
├── openclaw.json              # OpenClaw configuration
├── skills/
│   └── test-runner/
│       └── SKILL.md           # /test-runner command definition
│   └── test-writer/
│       └── SKILL.md           # Test flow generator (MiniMax)
├── scenarios/
│   ├── web/                   # Web test scenarios
│   │   ├── health-checks.md
│   │   ├── golden-paths.md
│   │   ├── api-contracts.md
│   │   └── smoke-suite.md
│   └── mobile/
│       ├── ios/
│       │   ├── smoke.md
│       │   ├── golden-paths.md
│       │   └── watch/
│       │       └── golden-paths.md
│       └── android/
│           ├── smoke.md
│           ├── golden-paths.md
│           └── wear/
│               └── golden-paths.md
├── flows/                     # Maestro flow files (executable)
│   ├── ios/
│   │   ├── smoke.yaml
│   │   ├── golden-paths.yaml
│   │   └── watch/
│   │       ├── smoke.yaml         # ⚠️ Aspirational - Maestro can't run on watchOS
│   │       └── golden-paths.yaml  # ⚠️ Aspirational - see XCUITests in amakaflow-ios-app
│   ├── android/
│   │   ├── smoke.yaml
│   │   ├── golden-paths.yaml
│   │   └── wear/
│   │       ├── smoke.yaml
│   │       └── golden-paths.yaml
│   └── garmin/
│       └── companion/
│           ├── ios/               # Maestro flows for iOS companion app
│           └── android/           # Maestro flows for Android companion app
├── garmin/                    # Garmin Connect IQ test infrastructure
│   ├── unit-tests/            # Monkey C unit tests
│   └── simulator-scripts/     # Garmin simulator automation
├── artifacts/                 # Test outputs (gitignored)
│   ├── screenshots/
│   ├── logs/
│   └── reports/
├── prompts/
│   └── orchestration-agent.md # Kimi K2.5 system prompt
├── scripts/
│   ├── run-full-suite.sh      # Main entry point
│   ├── run-qa-agent.sh        # AI-powered test runner
│   ├── watch-and-test.sh      # Continuous testing
│   ├── model-router.sh        # Model routing utility
│   └── setup-maestro.sh       # Environment setup
└── docker-compose.yml         # Container config (web only)
```

## How It Works

### Web Tests
1. OpenClaw reads scenario markdown files
2. Executes steps using Browser (Playwright) and Exec (curl) tools
3. Captures screenshots after each action
4. Generates JSON report

### Mobile Tests
1. Maestro reads YAML flow files
2. Executes on connected simulator/emulator
3. Takes screenshots at defined points
4. Reports pass/fail per flow

### Garmin Tests
1. **Unit tests**: Connect IQ SDK test runner executes Monkey C unit tests
2. **Companion flows**: Maestro tests the phone companion app (iOS or Android)
3. **Simulator scripts**: Custom scripts drive the Garmin simulator for watch face/widget testing

### Example Maestro Flow

```yaml
# flows/ios/smoke.yaml
appId: com.amakaflow.app
---
- launchApp:
    clearState: true
- extendedWaitUntil:
    visible: ".*"
    timeout: 10000
- takeScreenshot: ios-smoke-01-launch
- tapOn:
    id: "workouts_tab"
- takeScreenshot: ios-smoke-02-workouts
```

## Services Under Test

| Service | Port | Health Endpoint |
|---------|------|-----------------|
| Web UI | 3000 | http://localhost:3000 |
| Chat API | 8005 | /health, /health/ready |
| Mapper API | 8001 | /health |
| Calendar API | 8003 | /health |
| Workout Ingestor | 8004 | /health |

## Running Individual Flows

```bash
# Run single Maestro flow
maestro test flows/ios/smoke.yaml

# Run with specific device
maestro test --device "iPhone 15 Pro" flows/ios/golden-paths.yaml

# Interactive debugging
maestro studio
```

## Artifacts

After each run, find outputs in:

- `artifacts/screenshots/` - Visual captures of each test step
- `artifacts/logs/` - Execution logs with timestamps
- `artifacts/reports/` - JSON pass/fail summaries

Naming convention:
- `{platform}-{scenario}-{step}-{timestamp}.png`
- Example: `ios-smoke-01-launch-20240115-103000.png`

## CI/CD Integration

```yaml
# GitHub Actions example
jobs:
  test-web:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Start services
        run: docker compose -f ../docker-compose.yml up -d
      - name: Run web tests
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: ./scripts/run-full-suite.sh smoke web

  test-ios:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install Maestro
        run: curl -Ls https://get.maestro.mobile.dev | bash
      - name: Boot Simulator
        run: xcrun simctl boot "iPhone 15 Pro"
      - name: Install App
        run: xcrun simctl install booted path/to/AmakaFlow.app
      - name: Run iOS tests
        run: ./scripts/run-full-suite.sh smoke ios

  test-android:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Android
        uses: android-actions/setup-android@v3
      - name: Install Maestro
        run: curl -Ls https://get.maestro.mobile.dev | bash
      - name: Start Emulator
        run: |
          echo "y" | sdkmanager "system-images;android-34;google_apis;x86_64"
          avdmanager create avd -n test -k "system-images;android-34;google_apis;x86_64"
          emulator -avd test -no-audio -no-window &
          adb wait-for-device
      - name: Install App
        run: adb install path/to/amakaflow.apk
      - name: Run Android tests
        run: ./scripts/run-full-suite.sh smoke android
```

## Troubleshooting

### Maestro can't find elements
- Use `maestro studio` to interactively inspect the app
- Run `maestro hierarchy` to see element tree
- Update accessibility IDs in the app code

### Simulator not booted
```bash
# List available simulators
xcrun simctl list devices

# Boot specific simulator
xcrun simctl boot "iPhone 15 Pro"
```

### Emulator not connected
```bash
# List available AVDs
emulator -list-avds

# Start emulator
emulator -avd Pixel_7_API_34 &

# Verify connection
adb devices
```

## Contributing

1. Add new scenarios to `scenarios/{platform}/` directory
2. Add corresponding Maestro flows to `flows/{platform}/`
3. Follow existing naming conventions
4. Test locally before committing
5. Keep scenarios focused and independent
