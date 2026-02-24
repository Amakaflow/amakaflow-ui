# Tests for Garmin Planner

This directory contains unit tests for the Garmin Planner application.

## Running Tests

### Install dependencies
```bash
pip install pytest pytest-cov
```

### Run all tests
```bash
pytest
```

### Run tests with coverage
```bash
pytest --cov=garmin_planner --cov-report=html
```

### Run specific test file
```bash
pytest tests/test_parser.py
pytest tests/test_main.py
pytest tests/test_constant.py
pytest tests/test_model.py
```

### Run specific test class
```bash
pytest tests/test_parser.py::TestParseBracket
```

### Run specific test method
```bash
pytest tests/test_parser.py::TestParseBracket::test_parse_bracket_with_repeat
```

## Test Files

- `test_constant.py` - Tests for constants (SportType, StepType, ConditionType, etc.)
- `test_parser.py` - Tests for parsing logic (parse_bracket, parse_stepdetail, etc.)
- `test_main.py` - Tests for workout creation and JSON generation
- `test_model.py` - Tests for data models (WorkoutStep, RepeatStep, WorkoutSegment, WorkoutModel)

## Test Coverage

The tests cover:
- ✅ Enum types and their values
- ✅ Parsing of bracket notation (repeat, step names)
- ✅ Parsing of time, distance, and repetitions
- ✅ Parsing of targets (pace, heart rate zones)
- ✅ Workout step creation (warmup, exercise, cardio, rest)
- ✅ Nested workout structures (repeats, warmup with children)
- ✅ Automatic sport type detection
- ✅ JSON serialization
- ✅ Strength workout creation with exercise names and categories

## Continuous Integration

These tests should be run as part of CI/CD to ensure no regressions when making changes.

