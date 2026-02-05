---
name: test-writer
description: Generate or fix Maestro test flows when tests fail or new tests are needed. Triggered by test failures, new test requests, or code changes breaking tests.
---

# Test Writer Skill

**Model:** coding (MiniMax M2)

## Purpose

Generate or fix Maestro test flows when tests fail or new tests are needed.

## Triggers

- Test failure with fixable issue (element ID changed, timing issue)
- Request for new test scenario
- Code change that breaks existing tests

## Inputs

- `platform`: ios | android | watchos | wearos
- `scenario`: Description of what to test
- `existing_flow`: (optional) Current flow that needs fixing
- `error`: (optional) Error message from failed test

## Conventions

### Element ID Naming
- iOS: `{screen}_{element}` (e.g., `home_screen`, `workouts_tab`)
- Android: `{screen}_{element}` or `nav_{name}` (e.g., `home_screen`, `nav_workouts`)

### Optional vs Required
- **Navigation elements are NOT optional** - they must work
- **Data-dependent elements can be optional** (e.g., `workout_card_0`)

### Platform Paths
- iOS phone: `flows/ios/`
- iOS watch: `flows/ios/watch/`
- Android phone: `flows/android/`
- Android wear: `flows/android/wear/`

### Screenshot Naming
`artifacts/screenshots/{platform}-{flow-name}-{step}-{description}`

## Process

1. Analyze the request/error
2. Read existing flows for patterns: `flows/{platform}/*.yaml`
3. Generate/fix Maestro YAML following conventions:
   - Use `clearState: true` and `stopApp: true` for isolation
   - Include `onFlowError` screenshot capture
   - Use accessibility IDs from app conventions
   - Add `retryTapIfNoChange: true` for taps
   - Navigation elements are NOT optional
4. Write to `flows/{platform}/{name}.yaml`
5. Validate with `maestro validate flows/{platform}/{name}.yaml`

## Output

- New or updated Maestro flow file
- Validation result

## Example

**Input:**
```json
{
  "platform": "ios",
  "scenario": "Test workout completion flow",
  "error": null
}
```

**Output:**
```yaml
# iOS Workout Completion Flow
# Tests workout completion flow
#
# Run: maestro test flows/ios/workout-completion.yaml

appId: com.amakaflow.app

onFlowError:
  - takeScreenshot: artifacts/screenshots/ios-workout-completion-error

---

- launchApp:
    clearState: true
    stopApp: true

- extendedWaitUntil:
    visible:
      id: "home_screen"
    timeout: 15000

- tapOn:
    id: "workouts_tab"
    retryTapIfNoChange: true

- assertVisible:
    id: "workouts_list"

- takeScreenshot: artifacts/screenshots/ios-workout-completion-01

- tapOn:
    id: "workout_card_0"
    optional: true
    retryTapIfNoChange: true

- takeScreenshot: artifacts/screenshots/ios-workout-completion-02
```
