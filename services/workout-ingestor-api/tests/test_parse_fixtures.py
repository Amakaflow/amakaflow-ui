"""
Parameterized fixture-based tests for ParserService.

Loads YAML fixture files from tests/fixtures/parse_scenarios/ and runs each
through ParserService.parse_free_text_to_workout(), asserting against the
expected output defined in the fixture.
"""

import yaml
import pytest
from pathlib import Path

from workout_ingestor_api.services.parser_service import ParserService

FIXTURES_DIR = Path(__file__).parent / "fixtures" / "parse_scenarios"


def load_fixtures():
    fixtures = []
    for f in sorted(FIXTURES_DIR.glob("*.yaml")):
        with open(f) as fh:
            data = yaml.safe_load(fh)
            data["_file"] = f.name
            fixtures.append(data)
    return fixtures


def _all_exercises(workout):
    """Get all exercises from a workout, including those inside legacy supersets."""
    exercises = []
    for block in workout.blocks:
        exercises.extend(block.exercises)
        for ss in block.supersets:
            exercises.extend(ss.exercises)
    return exercises


def _block_exercise_count(block):
    """Count exercises in a block, including legacy supersets."""
    count = len(block.exercises)
    for ss in block.supersets:
        count += len(ss.exercises)
    return count


@pytest.mark.parametrize("fixture", load_fixtures(), ids=lambda f: f["_file"])
def test_parse_scenario(fixture):
    workout = ParserService.parse_free_text_to_workout(
        fixture["input"],
        source=fixture.get("source"),
    )
    expected = fixture["expected"]

    # Check total exercise count
    all_exercises = _all_exercises(workout)
    total = len(all_exercises)
    assert total == expected["exercise_count"], (
        f"Expected {expected['exercise_count']} exercises, got {total}. "
        f"Exercises: {[ex.name for ex in all_exercises]}"
    )

    # Check individual exercises
    for i, exp_ex in enumerate(expected.get("exercises", [])):
        actual = all_exercises[i]

        if "name" in exp_ex:
            assert exp_ex["name"].lower() in actual.name.lower(), (
                f"Exercise {i}: expected name containing '{exp_ex['name']}', got '{actual.name}'"
            )
        if "name_contains" in exp_ex:
            assert exp_ex["name_contains"].lower() in actual.name.lower(), (
                f"Exercise {i}: expected name containing '{exp_ex['name_contains']}', got '{actual.name}'"
            )
        if "sets" in exp_ex:
            assert actual.sets == exp_ex["sets"], (
                f"Exercise {i} ({actual.name}): expected sets={exp_ex['sets']}, got {actual.sets}"
            )
        if "reps" in exp_ex:
            assert actual.reps == exp_ex["reps"], (
                f"Exercise {i} ({actual.name}): expected reps={exp_ex['reps']}, got {actual.reps}"
            )
        if "distance" in exp_ex:
            expected_dist = exp_ex["distance"]
            # Handle both int and string distance specs (e.g., 500 or "500m")
            if isinstance(expected_dist, str):
                expected_dist = int(expected_dist.rstrip("m"))
            assert actual.distance_m == expected_dist, (
                f"Exercise {i} ({actual.name}): expected distance_m={expected_dist}, got {actual.distance_m}"
            )

    # Check block structure
    for i, exp_block in enumerate(expected.get("blocks", [])):
        assert i < len(workout.blocks), (
            f"Expected block {i} but workout only has {len(workout.blocks)} blocks"
        )
        actual_block = workout.blocks[i]

        if "exercise_count" in exp_block:
            actual_count = _block_exercise_count(actual_block)
            assert actual_count == exp_block["exercise_count"], (
                f"Block {i}: expected {exp_block['exercise_count']} exercises, got {actual_count}"
            )
        if "structure_contains" in exp_block:
            assert actual_block.structure is not None, (
                f"Block {i}: expected structure containing '{exp_block['structure_contains']}', got None"
            )
            assert exp_block["structure_contains"].lower() in actual_block.structure.lower(), (
                f"Block {i}: expected structure containing '{exp_block['structure_contains']}', "
                f"got '{actual_block.structure}'"
            )
        if "label_contains" in exp_block:
            assert actual_block.label is not None, (
                f"Block {i}: expected label containing '{exp_block['label_contains']}', got None"
            )
            assert exp_block["label_contains"].lower() in actual_block.label.lower(), (
                f"Block {i}: expected label containing '{exp_block['label_contains']}', "
                f"got '{actual_block.label}'"
            )
