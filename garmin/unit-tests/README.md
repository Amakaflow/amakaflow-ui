# Garmin Connect IQ Unit Tests

Unit tests for the AmakaFlow Garmin watch app written in Monkey C.

## Status

Scaffold only. Requires the Connect IQ SDK to be installed before tests can run.

## Prerequisites

1. Install the [Connect IQ SDK](https://developer.garmin.com/connect-iq/sdk/)
2. Configure SDK path: `export CONNECTIQ_HOME=/path/to/connectiq-sdk`
3. Install target device profiles via SDK Manager

## Running Tests

```bash
# Build and run tests
monkeyc -t -f monkey.jungle

# Or via the Connect IQ VS Code extension:
# 1. Open this directory in VS Code
# 2. Run "Monkey C: Run Tests" from command palette
```

## Structure

```
unit-tests/
  source/
    TestSuite.mc        # Test entry point and test cases
  monkey.jungle          # Build/project configuration
  README.md              # This file
```

## Writing Tests

Connect IQ tests use the `Toybox.Test` module:

```monkeyc
using Toybox.Test;

(:test)
function testWorkoutParsing(logger as Logger) as Boolean {
    var data = parseWorkout(samplePayload);
    logger.debug("Parsed workout: " + data.toString());
    return data != null && data.exerciseCount() == 3;
}
```

Test functions must:
- Be annotated with `(:test)`
- Accept a `Logger` parameter
- Return `true` for pass, `false` for fail
