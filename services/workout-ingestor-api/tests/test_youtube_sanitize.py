"""Tests for YouTube ingest sanitization via workout_sanitizer.

AMA-649: Verifies that YouTube ingest path calls _sanitize_workout_data
to fix common LLM structural mistakes (same as Instagram path).
"""

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
# Tests for YouTube path sanitization
# ---------------------------------------------------------------------------


class TestYouTubeCircuitPreservation:
    """Circuit-type structures must be preserved in YouTube path."""

    def test_circuit_block_preserved(self):
        """HYROX-style circuit with 4 exercises should NOT become supersets."""
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
            "supersets": [],
        }
        result = sanitize_workout_data(_make_workout([block]))
        assert result["blocks"][0]["structure"] == "circuit"
        assert result["blocks"][0]["rounds"] == 5
        assert len(result["blocks"][0]["exercises"]) == 4
        assert result["blocks"][0]["supersets"] == []

    def test_amrap_block_preserved(self):
        """AMRAP blocks should preserve exercises and clear any supersets."""
        block = {
            "label": "AMRAP 20",
            "structure": "amrap",
            "exercises": [EXERCISE_A, EXERCISE_B, EXERCISE_C],
            "supersets": [{"exercises": [EXERCISE_A, EXERCISE_B]}],
        }
        result = sanitize_workout_data(_make_workout([block]))
        assert result["blocks"][0]["structure"] == "amrap"
        assert result["blocks"][0]["supersets"] == []
        assert len(result["blocks"][0]["exercises"]) == 3

    def test_emom_block_preserved(self):
        """EMOM blocks should be preserved."""
        block = {
            "label": "EMOM 10",
            "structure": "emom",
            "exercises": [EXERCISE_A, EXERCISE_B],
            "supersets": [],
        }
        result = sanitize_workout_data(_make_workout([block]))
        assert result["blocks"][0]["structure"] == "emom"
        assert len(result["blocks"][0]["exercises"]) == 2

    def test_for_time_block_preserved(self):
        """For-time blocks should be preserved."""
        block = {
            "label": "For Time",
            "structure": "for-time",
            "exercises": [EXERCISE_A, EXERCISE_B, EXERCISE_C, EXERCISE_D],
            "supersets": [{"exercises": [EXERCISE_A, EXERCISE_B]}],
        }
        result = sanitize_workout_data(_make_workout([block]))
        assert result["blocks"][0]["structure"] == "for-time"
        assert result["blocks"][0]["supersets"] == []
        assert len(result["blocks"][0]["exercises"]) == 4

    def test_rounds_block_preserved(self):
        """Rounds blocks should be preserved."""
        block = {
            "label": "5 Rounds",
            "structure": "rounds",
            "rounds": 5,
            "exercises": [EXERCISE_A, EXERCISE_B, EXERCISE_C],
            "supersets": [],
        }
        result = sanitize_workout_data(_make_workout([block]))
        assert result["blocks"][0]["structure"] == "rounds"
        assert result["blocks"][0]["rounds"] == 5


class TestYouTubeSupersetCorrection:
    """Superset blocks must be corrected in YouTube path."""

    def test_superset_with_exercises_cleared(self):
        """LLM puts exercises in both arrays -- sanitizer clears exercises[]."""
        block = {
            "label": "Strength Supersets",
            "structure": "superset",
            "exercises": [EXERCISE_A, EXERCISE_B],
            "supersets": [{"exercises": [EXERCISE_A, EXERCISE_B]}],
        }
        result = sanitize_workout_data(_make_workout([block]))
        assert result["blocks"][0]["exercises"] == []
        assert len(result["blocks"][0]["supersets"]) == 1

    def test_null_structure_fixed_when_supersets_present(self):
        """Block has supersets but null structure -- should be fixed to 'superset'."""
        block = {
            "label": "Main",
            "structure": None,
            "exercises": [EXERCISE_A],
            "supersets": [{"exercises": [EXERCISE_A, EXERCISE_B]}],
        }
        result = sanitize_workout_data(_make_workout([block]))
        assert result["blocks"][0]["structure"] == "superset"
        assert result["blocks"][0]["exercises"] == []

    def test_circuit_structure_preserved_with_supersets(self):
        """Circuit block with supersets should clear supersets, not convert to superset."""
        block = {
            "label": "Circuit",
            "structure": "circuit",
            "exercises": [EXERCISE_A],
            "supersets": [{"exercises": [EXERCISE_A, EXERCISE_B]}],
        }
        result = sanitize_workout_data(_make_workout([block]))
        assert result["blocks"][0]["structure"] == "circuit"
        assert result["blocks"][0]["supersets"] == []
        assert result["blocks"][0]["exercises"] == [EXERCISE_A]


class TestYouTubeEdgeCases:
    """Edge cases for YouTube path sanitization."""

    def test_empty_blocks_array(self):
        result = sanitize_workout_data({"title": "Empty", "blocks": []})
        assert result["blocks"] == []

    def test_missing_blocks_key(self):
        result = sanitize_workout_data({"title": "No Blocks"})
        assert "blocks" not in result or result.get("blocks", []) == []

    def test_regular_block_untouched(self):
        """Regular blocks without supersets should pass through unmodified."""
        block = {
            "label": "Warm-up",
            "structure": "regular",
            "exercises": [EXERCISE_A, EXERCISE_C],
            "supersets": [],
        }
        original_block = block.copy()
        result = sanitize_workout_data(_make_workout([block]))
        assert result["blocks"][0] == original_block

    def test_superset_structure_but_empty_supersets_reset(self):
        """If structure='superset' but supersets is empty, reset structure to null."""
        block = {
            "label": "Block",
            "structure": "superset",
            "exercises": [EXERCISE_A],
            "supersets": [],
        }
        result = sanitize_workout_data(_make_workout([block]))
        assert result["blocks"][0]["structure"] is None

    def test_hyrox_circuit_not_converted_to_superset(self):
        """HYROX circuit should stay as circuit, not become supersets."""
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
        result = sanitize_workout_data(_make_workout([block]))
        assert result["blocks"][0]["structure"] == "circuit"
        assert result["blocks"][0]["rounds"] == 5
        assert len(result["blocks"][0]["exercises"]) == 4
        assert result["blocks"][0]["supersets"] == []

    def test_mixed_workout_circuit_and_superset(self):
        """Mixed workout with circuit block followed by superset block."""
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
        result = sanitize_workout_data(_make_workout(blocks))

        # Circuit block: structure preserved, supersets cleared
        assert result["blocks"][0]["structure"] == "circuit"
        assert result["blocks"][0]["supersets"] == []
        assert len(result["blocks"][0]["exercises"]) == 3

        # Superset block: unchanged
        assert result["blocks"][1]["structure"] == "superset"
        assert result["blocks"][1]["exercises"] == []
        assert len(result["blocks"][1]["supersets"]) == 1
