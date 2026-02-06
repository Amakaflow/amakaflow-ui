# AmakaFlow Test Fixtures

Shared JSON fixture files for deterministic E2E testing across iOS and Android.

## Structure

```
fixtures/
├── workouts/           # Workout fixtures (one per file)
│   ├── amrap_10min.json
│   ├── emom_strength.json
│   ├── for_time_conditioning.json
│   ├── strength_block_w1.json
│   ├── running_long.json
│   └── hiit_follow_along.json
├── profiles/           # User profile fixtures
│   └── test_user.json
└── README.md
```

## Usage

Maestro flows control which fixtures load via env vars:

| Env Var | Example | Effect |
|---------|---------|--------|
| `UITEST_USE_FIXTURES` | `true` | Load from JSON files instead of calling API |
| `UITEST_FIXTURES` | `amrap_10min,emom_strength` | Comma-separated fixture filenames (without .json) |
| `UITEST_FIXTURE_STATE` | `empty` | Special states: `empty` (no workouts), `error` (simulate failure) |

### Examples

```yaml
# Load specific fixtures
- launchApp:
    env:
      UITEST_USE_FIXTURES: "true"
      UITEST_FIXTURES: "amrap_10min,emom_strength"

# Load all fixtures
- launchApp:
    env:
      UITEST_USE_FIXTURES: "true"

# Test empty state
- launchApp:
    env:
      UITEST_USE_FIXTURES: "true"
      UITEST_FIXTURE_STATE: "empty"
```

## Adding a New Fixture

1. Create `fixtures/workouts/new_workout.json`
2. Run `scripts/sync-fixtures.sh`
3. Reference in Maestro: `UITEST_FIXTURES: "new_workout"`

## JSON Format

Fixtures use snake_case keys matching the API response format. The apps deserialize through their production JSON parsers (`convertFromSnakeCase` on iOS, `kotlinx.serialization` on Android).

Each workout file contains a single Workout object with a stable ID (e.g., `fixture-amrap-001`).
