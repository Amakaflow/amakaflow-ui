"""Tests for InstagramReelService._sanitize_workout_data().

Covers every edge case where the LLM might produce malformed superset/exercise
output and the sanitizer must fix it before the data reaches the frontend.

AMA-564: superset detection from paired exercises on same line.
"""

import copy
import pytest
from workout_ingestor_api.services.instagram_reel_service import InstagramReelService
from workout_ingestor_api.services.workout_sanitizer import sanitize_workout_data


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


EXERCISE_A = {"name": "Squats", "sets": 5, "reps": 5, "type": "strength"}
EXERCISE_B = {"name": "Box Jumps", "sets": 5, "reps": 5, "type": "plyometric"}
EXERCISE_C = {"name": "Hip Thrusts", "sets": 5, "reps": 8, "type": "strength"}
EXERCISE_D = {"name": "Seated Jumps", "sets": 5, "reps": 5, "type": "plyometric"}


def _make_workout(blocks):
    """Build a minimal workout dict wrapping the given blocks."""
    return {"title": "Test Workout", "blocks": blocks}


# ---------------------------------------------------------------------------
# 1. Block with non-empty supersets and exercises -> exercises cleared
# ---------------------------------------------------------------------------


class TestSupersetBlockClearsExercises:
    """When a block has supersets[], exercises[] must be emptied."""

    def test_superset_block_with_duplicate_exercises_cleared(self):
        """LLM puts same exercises in both arrays -- sanitizer clears exercises[]."""
        block = {
            "label": "Strength Supersets",
            "structure": "superset",
            "exercises": [EXERCISE_A, EXERCISE_B],
            "supersets": [{"exercises": [EXERCISE_A, EXERCISE_B]}],
        }
        result = InstagramReelService._sanitize_workout_data(_make_workout([block]))
        assert result["blocks"][0]["exercises"] == []
        assert len(result["blocks"][0]["supersets"]) == 1

    def test_superset_block_with_different_exercises_cleared(self):
        """LLM puts unrelated exercises in exercises[] alongside supersets[]."""
        block = {
            "label": "Mixed",
            "structure": "superset",
            "exercises": [EXERCISE_C],
            "supersets": [{"exercises": [EXERCISE_A, EXERCISE_B]}],
        }
        result = InstagramReelService._sanitize_workout_data(_make_workout([block]))
        assert result["blocks"][0]["exercises"] == []

    def test_superset_block_with_correct_output_unchanged(self):
        """LLM produces correct output (exercises=[], supersets non-empty) -- no-op."""
        block = {
            "label": "Supersets",
            "structure": "superset",
            "exercises": [],
            "supersets": [
                {"exercises": [EXERCISE_A, EXERCISE_B]},
                {"exercises": [EXERCISE_C, EXERCISE_D]},
            ],
        }
        original = copy.deepcopy(block)
        result = InstagramReelService._sanitize_workout_data(_make_workout([block]))
        assert result["blocks"][0] == original


# ---------------------------------------------------------------------------
# 2. Block with supersets + wrong structure -> structure fixed to "superset"
# ---------------------------------------------------------------------------


class TestStructureFixedToSuperset:
    """When supersets[] is non-empty, structure must become 'superset'."""

    def test_null_structure_fixed_when_supersets_present(self):
        block = {
            "label": "Main",
            "structure": None,
            "exercises": [EXERCISE_A],
            "supersets": [{"exercises": [EXERCISE_A, EXERCISE_B]}],
        }
        result = InstagramReelService._sanitize_workout_data(_make_workout([block]))
        assert result["blocks"][0]["structure"] == "superset"
        assert result["blocks"][0]["exercises"] == []

    def test_circuit_structure_preserved_when_supersets_present(self):
        """Circuit blocks keep their structure — supersets are cleared instead."""
        block = {
            "label": "Circuit",
            "structure": "circuit",
            "exercises": [EXERCISE_A],
            "supersets": [{"exercises": [EXERCISE_A, EXERCISE_B]}],
        }
        result = InstagramReelService._sanitize_workout_data(_make_workout([block]))
        assert result["blocks"][0]["structure"] == "circuit"
        assert result["blocks"][0]["supersets"] == []
        assert result["blocks"][0]["exercises"] == [EXERCISE_A]

    def test_regular_structure_overridden_when_supersets_present(self):
        block = {
            "label": "Block 1",
            "structure": "regular",
            "exercises": [],
            "supersets": [{"exercises": [EXERCISE_C, EXERCISE_D]}],
        }
        result = InstagramReelService._sanitize_workout_data(_make_workout([block]))
        assert result["blocks"][0]["structure"] == "superset"

    def test_missing_structure_key_fixed_when_supersets_present(self):
        """Block dict has no 'structure' key at all."""
        block = {
            "label": "No Structure Key",
            "exercises": [EXERCISE_A],
            "supersets": [{"exercises": [EXERCISE_A, EXERCISE_B]}],
        }
        result = InstagramReelService._sanitize_workout_data(_make_workout([block]))
        assert result["blocks"][0]["structure"] == "superset"
        assert result["blocks"][0]["exercises"] == []


# ---------------------------------------------------------------------------
# 3. Block with no supersets -> untouched
# ---------------------------------------------------------------------------


class TestNoSupersetsUntouched:
    """Blocks without supersets should pass through unmodified."""

    def test_regular_block_untouched(self):
        block = {
            "label": "Warm-up",
            "structure": "regular",
            "exercises": [EXERCISE_A, EXERCISE_C],
            "supersets": [],
        }
        original = copy.deepcopy(block)
        result = InstagramReelService._sanitize_workout_data(_make_workout([block]))
        assert result["blocks"][0] == original

    def test_block_without_supersets_key_untouched(self):
        """Block dict has no 'supersets' key at all -- exercises preserved."""
        block = {
            "label": "Main",
            "structure": "regular",
            "exercises": [EXERCISE_A],
        }
        result = InstagramReelService._sanitize_workout_data(_make_workout([block]))
        # Exercises should be preserved (no supersets means no clearing)
        assert result["blocks"][0]["exercises"] == [EXERCISE_A]
        assert result["blocks"][0]["structure"] == "regular"

    def test_circuit_block_untouched(self):
        block = {
            "label": "Circuit",
            "structure": "circuit",
            "exercises": [EXERCISE_A, EXERCISE_B, EXERCISE_C],
            "supersets": [],
        }
        result = InstagramReelService._sanitize_workout_data(_make_workout([block]))
        assert result["blocks"][0]["structure"] == "circuit"
        assert len(result["blocks"][0]["exercises"]) == 3

    def test_amrap_block_preserved(self):
        """AMRAP structure is preserved and supersets cleared."""
        block = {
            "label": "AMRAP 20",
            "structure": "amrap",
            "exercises": [EXERCISE_A, EXERCISE_B, EXERCISE_C],
            "supersets": [{"exercises": [EXERCISE_A, EXERCISE_B]}],
        }
        result = InstagramReelService._sanitize_workout_data(_make_workout([block]))
        assert result["blocks"][0]["structure"] == "amrap"
        assert result["blocks"][0]["supersets"] == []
        assert len(result["blocks"][0]["exercises"]) == 3

    def test_emom_block_preserved(self):
        """EMOM structure is preserved."""
        block = {
            "label": "EMOM 10",
            "structure": "emom",
            "exercises": [EXERCISE_A, EXERCISE_B],
            "supersets": [],
        }
        result = InstagramReelService._sanitize_workout_data(_make_workout([block]))
        assert result["blocks"][0]["structure"] == "emom"
        assert len(result["blocks"][0]["exercises"]) == 2

    def test_for_time_block_preserved(self):
        """For-time structure is preserved and supersets cleared."""
        block = {
            "label": "For Time",
            "structure": "for-time",
            "exercises": [EXERCISE_A, EXERCISE_B, EXERCISE_C, EXERCISE_D],
            "supersets": [{"exercises": [EXERCISE_A, EXERCISE_B]}],
        }
        result = InstagramReelService._sanitize_workout_data(_make_workout([block]))
        assert result["blocks"][0]["structure"] == "for-time"
        assert result["blocks"][0]["supersets"] == []
        assert len(result["blocks"][0]["exercises"]) == 4

    def test_rounds_block_preserved(self):
        """Rounds structure is preserved."""
        block = {
            "label": "5 Rounds",
            "structure": "rounds",
            "rounds": 5,
            "exercises": [EXERCISE_A, EXERCISE_B, EXERCISE_C],
            "supersets": [],
        }
        result = InstagramReelService._sanitize_workout_data(_make_workout([block]))
        assert result["blocks"][0]["structure"] == "rounds"
        assert result["blocks"][0]["rounds"] == 5


# ---------------------------------------------------------------------------
# 4. Block with empty supersets [] -> untouched
# ---------------------------------------------------------------------------


class TestEmptySupersets:
    """Empty supersets array should not trigger any correction."""

    def test_empty_supersets_preserves_exercises(self):
        block = {
            "label": "Strength",
            "structure": "regular",
            "exercises": [EXERCISE_A, EXERCISE_B],
            "supersets": [],
        }
        result = InstagramReelService._sanitize_workout_data(_make_workout([block]))
        assert len(result["blocks"][0]["exercises"]) == 2
        assert result["blocks"][0]["structure"] == "regular"

    def test_empty_supersets_with_null_structure(self):
        block = {
            "label": "Block",
            "structure": None,
            "exercises": [EXERCISE_A],
            "supersets": [],
        }
        result = InstagramReelService._sanitize_workout_data(_make_workout([block]))
        assert result["blocks"][0]["structure"] is None
        assert len(result["blocks"][0]["exercises"]) == 1


# ---------------------------------------------------------------------------
# 5. Multiple blocks: some with supersets, some without
# ---------------------------------------------------------------------------


class TestMixedBlocks:
    """Workout with mixed block types should sanitize only superset blocks."""

    def test_warmup_then_superset_then_cooldown(self):
        blocks = [
            {
                "label": "Warm-up",
                "structure": "regular",
                "exercises": [EXERCISE_A],
                "supersets": [],
            },
            {
                "label": "Supersets",
                "structure": None,  # Wrong -- should be "superset"
                "exercises": [EXERCISE_A, EXERCISE_B],  # Wrong -- should be []
                "supersets": [
                    {"exercises": [EXERCISE_A, EXERCISE_B]},
                    {"exercises": [EXERCISE_C, EXERCISE_D]},
                ],
            },
            {
                "label": "Cool-down",
                "structure": "regular",
                "exercises": [EXERCISE_C],
                "supersets": [],
            },
        ]
        result = InstagramReelService._sanitize_workout_data(_make_workout(blocks))

        # Warm-up: untouched
        assert result["blocks"][0]["structure"] == "regular"
        assert len(result["blocks"][0]["exercises"]) == 1

        # Superset block: fixed
        assert result["blocks"][1]["structure"] == "superset"
        assert result["blocks"][1]["exercises"] == []
        assert len(result["blocks"][1]["supersets"]) == 2

        # Cool-down: untouched
        assert result["blocks"][2]["structure"] == "regular"
        assert len(result["blocks"][2]["exercises"]) == 1

    def test_circuit_then_superset_blocks(self):
        """Mixed workout: circuit block followed by superset block — both handled correctly."""
        blocks = [
            {
                "label": "HYROX Circuit",
                "structure": "circuit",
                "rounds": 3,
                "exercises": [EXERCISE_A, EXERCISE_B, EXERCISE_C],
                "supersets": [{"exercises": [EXERCISE_A, EXERCISE_B]}],  # LLM mistake
            },
            {
                "label": "Finisher Supersets",
                "structure": "superset",
                "exercises": [],
                "supersets": [{"exercises": [EXERCISE_C, EXERCISE_D]}],
            },
        ]
        result = InstagramReelService._sanitize_workout_data(_make_workout(blocks))

        # Circuit block: structure preserved, supersets cleared
        assert result["blocks"][0]["structure"] == "circuit"
        assert result["blocks"][0]["supersets"] == []
        assert len(result["blocks"][0]["exercises"]) == 3

        # Superset block: unchanged
        assert result["blocks"][1]["structure"] == "superset"
        assert result["blocks"][1]["exercises"] == []
        assert len(result["blocks"][1]["supersets"]) == 1

    def test_two_superset_blocks(self):
        blocks = [
            {
                "label": "Upper Body Supersets",
                "structure": "superset",
                "exercises": [EXERCISE_A],
                "supersets": [{"exercises": [EXERCISE_A, EXERCISE_B]}],
            },
            {
                "label": "Lower Body Supersets",
                "structure": "regular",  # Wrong — should be "superset"
                "exercises": [],
                "supersets": [{"exercises": [EXERCISE_C, EXERCISE_D]}],
            },
        ]
        result = InstagramReelService._sanitize_workout_data(_make_workout(blocks))

        assert result["blocks"][0]["structure"] == "superset"
        assert result["blocks"][0]["exercises"] == []
        assert result["blocks"][1]["structure"] == "superset"
        assert result["blocks"][1]["exercises"] == []


# ---------------------------------------------------------------------------
# 6. Edge cases
# ---------------------------------------------------------------------------


class TestEdgeCases:
    """Edge cases and boundary conditions."""

    def test_empty_blocks_array(self):
        result = InstagramReelService._sanitize_workout_data({"title": "Empty", "blocks": []})
        assert result["blocks"] == []

    def test_missing_blocks_key(self):
        result = InstagramReelService._sanitize_workout_data({"title": "No Blocks"})
        assert "blocks" not in result or result.get("blocks", []) == []

    def test_single_exercise_superset(self):
        """Degenerate case: superset with only one exercise."""
        block = {
            "label": "Degenerate",
            "structure": None,
            "exercises": [EXERCISE_A],
            "supersets": [{"exercises": [EXERCISE_A]}],
        }
        result = InstagramReelService._sanitize_workout_data(_make_workout([block]))
        # Still corrects structure and clears exercises
        assert result["blocks"][0]["structure"] == "superset"
        assert result["blocks"][0]["exercises"] == []

    def test_deeply_nested_supersets_preserved(self):
        """Verify supersets with many pairs are preserved, not truncated."""
        pairs = [
            {"exercises": [{"name": f"Ex{i}A"}, {"name": f"Ex{i}B"}]}
            for i in range(10)
        ]
        block = {
            "label": "Big Superset",
            "structure": "superset",
            "exercises": [],
            "supersets": pairs,
        }
        result = InstagramReelService._sanitize_workout_data(_make_workout([block]))
        assert len(result["blocks"][0]["supersets"]) == 10

    def test_returns_same_dict_reference(self):
        """Sanitizer should mutate in place and return the same dict."""
        workout = _make_workout([
            {
                "label": "Block",
                "structure": None,
                "exercises": [EXERCISE_A],
                "supersets": [{"exercises": [EXERCISE_A, EXERCISE_B]}],
            }
        ])
        result = InstagramReelService._sanitize_workout_data(workout)
        assert result is workout

    def test_hyrox_circuit_not_converted_to_superset(self):
        """Reproduction case from AMA-571: HYROX circuit with 4 exercises should NOT become supersets."""
        block = {
            "label": "HYROX Conditioning",
            "structure": "circuit",
            "rounds": 5,
            "exercises": [
                {"name": "Ski Erg", "distance_m": 500, "type": "cardio"},
                {"name": "Sled Pull", "distance_m": 25, "type": "strength", "notes": "120kg + sled"},
                {"name": "Bike Erg", "distance_m": 2500, "type": "cardio"},
                {"name": "Wall Balls", "reps": 20, "type": "strength", "notes": "9kg ball"},
            ],
            "supersets": [],
        }
        result = InstagramReelService._sanitize_workout_data(_make_workout([block]))
        assert result["blocks"][0]["structure"] == "circuit"
        assert result["blocks"][0]["rounds"] == 5
        assert len(result["blocks"][0]["exercises"]) == 4
        assert result["blocks"][0]["supersets"] == []

    def test_hyrox_circuit_with_llm_superset_mistake(self):
        """If LLM returns circuit structure but also populates supersets, sanitizer clears supersets."""
        block = {
            "label": "HYROX Conditioning",
            "structure": "circuit",
            "rounds": 5,
            "exercises": [
                {"name": "Ski Erg", "distance_m": 500, "type": "cardio"},
                {"name": "Sled Pull", "distance_m": 25, "type": "strength"},
                {"name": "Bike Erg", "distance_m": 2500, "type": "cardio"},
                {"name": "Wall Balls", "reps": 20, "type": "strength"},
            ],
            "supersets": [
                {"exercises": [{"name": "Ski Erg"}, {"name": "Sled Pull"}]},
                {"exercises": [{"name": "Bike Erg"}, {"name": "Wall Balls"}]},
            ],
        }
        result = InstagramReelService._sanitize_workout_data(_make_workout([block]))
        assert result["blocks"][0]["structure"] == "circuit"
        assert result["blocks"][0]["supersets"] == []
        assert len(result["blocks"][0]["exercises"]) == 4

    def test_circuit_label_but_exercises_only_in_supersets(self):
        """Edge case: LLM returns circuit structure but puts exercises in supersets only.

        Sanitizer should fall through to superset path to avoid data loss.
        """
        block = {
            "label": "Circuit Mislabel",
            "structure": "circuit",
            "exercises": [],
            "supersets": [{"exercises": [EXERCISE_A, EXERCISE_B, EXERCISE_C]}],
        }
        result = InstagramReelService._sanitize_workout_data(_make_workout([block]))
        # Should convert to superset to preserve the exercises (data loss prevention)
        assert result["blocks"][0]["structure"] == "superset"
        assert result["blocks"][0]["exercises"] == []
        assert len(result["blocks"][0]["supersets"]) == 1

    def test_extra_block_fields_preserved(self):
        """Sanitizer should not strip unknown fields from blocks."""
        block = {
            "label": "Extras",
            "structure": None,
            "exercises": [EXERCISE_A],
            "supersets": [{"exercises": [EXERCISE_A, EXERCISE_B]}],
            "rounds": 3,
            "time_cap_sec": 600,
            "custom_field": "should survive",
        }
        result = InstagramReelService._sanitize_workout_data(_make_workout([block]))
        assert result["blocks"][0]["rounds"] == 3
        assert result["blocks"][0]["time_cap_sec"] == 600
        assert result["blocks"][0]["custom_field"] == "should survive"


# --- AMA-711: rest alias normalization + exercise type defaulting ---

def test_rest_sec_alias_normalized():
    data = {"blocks": [{"rest_sec": 90, "exercises": [{"name": "Squat", "sets": 3}], "supersets": []}]}
    result = sanitize_workout_data(data)
    block = result["blocks"][0]
    assert block.get("rest_between_rounds_sec") == 90
    assert "rest_sec" not in block

def test_rest_between_sec_alias_normalized():
    data = {"blocks": [{"rest_between_sec": 60, "exercises": [{"name": "Squat", "sets": 3}], "supersets": []}]}
    result = sanitize_workout_data(data)
    block = result["blocks"][0]
    assert block.get("rest_between_rounds_sec") == 60
    assert "rest_between_sec" not in block

def test_existing_rest_between_rounds_sec_not_overwritten():
    data = {"blocks": [{"rest_between_rounds_sec": 120, "rest_sec": 90, "exercises": [{"name": "Squat", "sets": 3}], "supersets": []}]}
    result = sanitize_workout_data(data)
    assert result["blocks"][0]["rest_between_rounds_sec"] == 120

def test_exercise_type_defaulted_to_strength():
    data = {"blocks": [{"exercises": [{"name": "Squat", "sets": 3}], "supersets": []}]}
    result = sanitize_workout_data(data)
    assert result["blocks"][0]["exercises"][0]["type"] == "strength"

def test_superset_exercise_type_defaulted():
    data = {"blocks": [{"exercises": [], "supersets": [{"exercises": [{"name": "Squat"}]}]}]}
    result = sanitize_workout_data(data)
    assert result["blocks"][0]["supersets"][0]["exercises"][0]["type"] == "strength"

def test_existing_exercise_type_not_overwritten():
    data = {"blocks": [{"exercises": [{"name": "Run", "type": "cardio"}], "supersets": []}]}
    result = sanitize_workout_data(data)
    assert result["blocks"][0]["exercises"][0]["type"] == "cardio"
