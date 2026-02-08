# Garmin Simulator Scripts

Placeholder for Connect IQ simulator automation scripts.

## Status

Not yet implemented. This directory will contain scripts that programmatically
drive the Connect IQ simulator for integration testing.

## Planned Approach

The Connect IQ simulator exposes a debug interface that can be scripted to:
- Launch the watch app in the simulator
- Simulate button presses and touch input
- Send companion messages (mimicking the phone app)
- Capture simulator screenshots for visual regression
- Validate UI state via the debug output

## Prerequisites

- Connect IQ SDK installed with simulator
- Target device profiles configured
- App compiled for simulator target

## Example Usage (planned)

```bash
# Launch simulator with app
connectiq &
monkeydo bin/AmakaFlow.prg venu3

# Run scripted test scenario
./run-scenario.sh smoke
```

## Related

- `garmin/unit-tests/` - Fast unit tests (no simulator needed)
- `flows/garmin/companion/` - Phone-side Maestro tests
