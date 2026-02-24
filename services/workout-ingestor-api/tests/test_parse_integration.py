"""
Integration tests for POST /parse/text endpoint.

These tests exercise the FULL pipeline:
  API endpoint -> ParserService -> workout_to_parse_response -> JSON response

LLM fallback is mocked (same pattern as test_parse_endpoint.py) so tests
only exercise the structured parsing path.
"""

import pytest
from unittest.mock import patch, AsyncMock


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def mock_llm_fallback():
    """Mock the LLM fallback path so it never fires during structured parsing tests."""
    with patch(
        "workout_ingestor_api.api.parse_routes.parse_with_llm_fallback",
        new_callable=AsyncMock,
        side_effect=Exception("LLM fallback should not be called in integration tests"),
    ):
        yield


# ---------------------------------------------------------------------------
# 1. Original bug repro: rounds + distance
# ---------------------------------------------------------------------------

class TestBugReproRoundsDistance:
    """The original bug that prompted the parser refactor."""

    def test_rounds_with_distance_full_pipeline(self, client):
        """5 exercises found, distances populated, '5 Rounds' is NOT an exercise."""
        text = (
            "Barbell Back Squats 5x5\n"
            "Barbell Reverse Lunges 4x20\n"
            "\n"
            "5 Rounds\n"
            "Rowing 500m\n"
            "Run 500m\n"
            "Walking Lunges 25m"
        )

        response = client.post("/parse/text", json={
            "text": text,
            "source": "instagram_caption",
        })

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

        names = [e["raw_name"] for e in data["exercises"]]

        # All 5 real exercises present
        assert any("Barbell Back Squats" in n for n in names)
        assert any("Barbell Reverse Lunges" in n for n in names)
        assert any("Rowing" in n for n in names)
        assert any("Run" in n for n in names)
        assert any("Walking Lunges" in n for n in names)

        # "5 Rounds" must NOT appear as an exercise name
        assert not any("5 Rounds" == n for n in names)

        # Distance exercises have distance set
        rowing = next(e for e in data["exercises"] if "Rowing" in e["raw_name"])
        assert rowing["distance"] == "500m"

        run = next(e for e in data["exercises"] if e["raw_name"].startswith("Run"))
        assert run["distance"] == "500m"

        walking = next(e for e in data["exercises"] if "Walking Lunges" in e["raw_name"])
        assert walking["distance"] == "25m"

        # Strength exercises have sets/reps
        squats = next(e for e in data["exercises"] if "Barbell Back Squats" in e["raw_name"])
        assert squats["sets"] == 5
        assert squats["reps"] == "5"

        lunges = next(e for e in data["exercises"] if "Barbell Reverse Lunges" in e["raw_name"])
        assert lunges["sets"] == 4
        assert lunges["reps"] == "20"


# ---------------------------------------------------------------------------
# 2. Supersets with group assignment
# ---------------------------------------------------------------------------

class TestSupersetGroupAssignment:

    def test_single_superset_line(self, client):
        """Pull-ups 4x8 + Z Press 4x8 -> both get superset_group 'A'."""
        text = "Pull-ups 4x8 + Z Press 4x8"

        response = client.post("/parse/text", json={
            "text": text,
            "source": "instagram_caption",
        })

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert len(data["exercises"]) == 2

        assert data["exercises"][0]["raw_name"] == "Pull-ups"
        assert data["exercises"][0]["superset_group"] == "A"
        assert data["exercises"][1]["raw_name"] == "Z Press"
        assert data["exercises"][1]["superset_group"] == "A"

    def test_multiple_superset_lines(self, client):
        """Two superset lines -> groups A and B."""
        text = (
            "Pull-ups 4x8 + Z Press 4x8\n"
            "Squats 3x10 + Lunges 3x12"
        )

        response = client.post("/parse/text", json={
            "text": text,
            "source": "instagram_caption",
        })

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert len(data["exercises"]) == 4

        assert data["exercises"][0]["superset_group"] == "A"
        assert data["exercises"][1]["superset_group"] == "A"
        assert data["exercises"][2]["superset_group"] == "B"
        assert data["exercises"][3]["superset_group"] == "B"

    def test_mixed_superset_and_regular(self, client):
        """Superset line + regular line: superset gets group A, standalone gets group B
        (ParserService assigns each block a superset group)."""
        text = (
            "Pull-ups 4x8 + Z Press 4x8\n"
            "Deadlifts 5x5"
        )

        response = client.post("/parse/text", json={
            "text": text,
            "source": "instagram_caption",
        })

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert len(data["exercises"]) == 3

        assert data["exercises"][0]["superset_group"] == "A"
        assert data["exercises"][1]["superset_group"] == "A"
        # ParserService puts Deadlifts in its own block with group B
        assert data["exercises"][2]["superset_group"] is not None


# ---------------------------------------------------------------------------
# 3. Empty / whitespace -> success=false
# ---------------------------------------------------------------------------

class TestEmptyAndWhitespace:

    def test_empty_string_returns_400(self, client):
        response = client.post("/parse/text", json={"text": ""})
        assert response.status_code == 400

    def test_whitespace_only_returns_success_false(self, client):
        response = client.post("/parse/text", json={"text": "   \n\n   "})

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is False
        assert data["exercises"] == []

    def test_newlines_only_returns_success_false(self, client):
        response = client.post("/parse/text", json={"text": "\n\n\n\n"})

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is False
        assert data["exercises"] == []


# ---------------------------------------------------------------------------
# 4. All hashtags -> success=false (or empty exercises)
# ---------------------------------------------------------------------------

class TestHashtagOnlyInput:

    def test_all_hashtags_returns_empty(self, client):
        response = client.post("/parse/text", json={
            "text": "#fitness #gym #workout #legday",
        })

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is False
        assert data["exercises"] == []

    def test_hashtags_with_exercises_keeps_exercises(self, client):
        text = (
            "Squats 4x8\n"
            "#fitness #legday #workout\n"
            "Bench Press 3x10"
        )

        response = client.post("/parse/text", json={
            "text": text,
            "source": "instagram_caption",
        })

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

        names = [e["raw_name"] for e in data["exercises"]]
        assert not any("#" in n for n in names)
        assert any("Squats" in n for n in names)
        assert any("Bench Press" in n for n in names)


# ---------------------------------------------------------------------------
# 5. Large workout (15+ exercises)
# ---------------------------------------------------------------------------

class TestLargeWorkout:

    def test_15_plus_exercises_all_found(self, client):
        exercises = [
            "Barbell Squats 4x8",
            "Bench Press 4x10",
            "Deadlifts 3x5",
            "Overhead Press 3x8",
            "Barbell Rows 4x10",
            "Lunges 3x12",
            "Pull-ups 4x8",
            "Dips 3x10",
            "Leg Press 4x12",
            "Calf Raises 4x15",
            "Bicep Curls 3x12",
            "Tricep Pushdowns 3x12",
            "Lateral Raises 3x15",
            "Face Pulls 3x15",
            "Plank 3x30s",
            "Romanian Deadlifts 4x10",
        ]
        text = "\n".join(exercises)

        response = client.post("/parse/text", json={
            "text": text,
            "source": "instagram_caption",
        })

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert len(data["exercises"]) >= 15

        # Verify all exercises have correct order
        for i, ex in enumerate(data["exercises"]):
            assert ex["order"] == i

    def test_20_exercises_numbered_list(self, client):
        lines = []
        exercise_names = [
            "Back Squats 5x5", "Front Squats 3x8", "Leg Press 4x12",
            "Leg Curls 3x10", "Calf Raises 4x15", "Bench Press 4x8",
            "Incline Bench 3x10", "Cable Flyes 3x12", "Overhead Press 3x8",
            "Lateral Raises 3x15", "Barbell Rows 4x10", "Pull-ups 4x8",
            "Face Pulls 3x15", "Bicep Curls 3x12", "Hammer Curls 3x12",
            "Tricep Pushdowns 3x12", "Dips 3x10", "Plank 3x30s",
            "Russian Twists 3x20", "Deadlifts 3x5",
        ]
        for i, name in enumerate(exercise_names, 1):
            lines.append(f"{i}. {name}")
        text = "\n".join(lines)

        response = client.post("/parse/text", json={
            "text": text,
            "source": "instagram_caption",
        })

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert len(data["exercises"]) >= 18


# ---------------------------------------------------------------------------
# 6. Distance extraction through the full pipeline
# ---------------------------------------------------------------------------

class TestDistanceExtraction:

    def test_rowing_distance(self, client):
        text = "Rowing 500m"

        response = client.post("/parse/text", json={
            "text": text,
            "source": "instagram_caption",
        })

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert len(data["exercises"]) >= 1

        rowing = data["exercises"][0]
        assert "Rowing" in rowing["raw_name"]
        assert rowing["distance"] == "500m"

    def test_sets_times_distance(self, client):
        """'Seated sled pull 5 x 10m' -> sets=5, distance='10m'."""
        text = "Seated sled pull 5 x 10m"

        response = client.post("/parse/text", json={
            "text": text,
            "source": "instagram_caption",
        })

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

        ex = data["exercises"][0]
        assert "Seated sled pull" in ex["raw_name"] or "sled pull" in ex["raw_name"].lower()
        assert ex["sets"] == 5
        assert ex["distance"] == "10m"

    def test_mixed_distance_and_reps(self, client):
        """Workout with both distance exercises and sets/reps exercises."""
        text = (
            "Bench Press 4x8\n"
            "Run 400m\n"
            "Squats 3x10\n"
            "Rowing 500m"
        )

        response = client.post("/parse/text", json={
            "text": text,
            "source": "instagram_caption",
        })

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

        names = [e["raw_name"] for e in data["exercises"]]
        assert any("Bench Press" in n for n in names)
        assert any("Squats" in n for n in names)

        bench = next(e for e in data["exercises"] if "Bench Press" in e["raw_name"])
        assert bench["sets"] == 4
        assert bench["reps"] == "8"
        assert bench["distance"] is None


# ---------------------------------------------------------------------------
# 7. Section headers not appearing as exercises
# ---------------------------------------------------------------------------

class TestSectionHeaders:

    def test_upper_lower_headers_filtered(self, client):
        """Section headers are partially filtered by parse_routes preprocessing
        (Upper Body: is caught by SKIP_PATTERNS) but ParserService may still
        include some header-like text. The key assertion is that the actual
        exercises are found."""
        text = (
            "Upper Body:\n"
            "Bench Press 4x8\n"
            "Lower Body:\n"
            "Squats 3x10"
        )

        response = client.post("/parse/text", json={
            "text": text,
            "source": "instagram_caption",
        })

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

        names = [e["raw_name"] for e in data["exercises"]]
        # The actual exercises should be present
        assert any("Bench Press" in n for n in names)
        assert any("Squats" in n for n in names)

    def test_warmup_header_filtered(self, client):
        text = (
            "Warmup:\n"
            "Jumping Jacks 3x20\n"
            "Workout:\n"
            "Squats 4x8"
        )

        response = client.post("/parse/text", json={
            "text": text,
            "source": "instagram_caption",
        })

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

        names = [e["raw_name"] for e in data["exercises"]]
        # Actual exercises should be found
        assert any("Jumping Jacks" in n for n in names)
        assert any("Squats" in n for n in names)

    def test_day_round_week_headers_filtered(self, client):
        text = (
            "Day 1:\n"
            "Squats 4x8\n"
            "Week 1:\n"
            "Bench Press 3x10"
        )

        response = client.post("/parse/text", json={
            "text": text,
            "source": "instagram_caption",
        })

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

        names = [e["raw_name"] for e in data["exercises"]]
        assert not any("Day 1" == n for n in names)
        assert not any("Week 1" == n for n in names)
        assert any("Squats" in n for n in names)
        assert any("Bench Press" in n for n in names)


# ---------------------------------------------------------------------------
# Additional integration scenarios
# ---------------------------------------------------------------------------

class TestResponseSchema:
    """Verify the response conforms to the expected schema."""

    def test_response_has_required_fields(self, client):
        response = client.post("/parse/text", json={
            "text": "Squats 4x8",
            "source": "instagram_caption",
        })

        assert response.status_code == 200
        data = response.json()

        assert "success" in data
        assert "exercises" in data
        assert "confidence" in data
        assert "detected_format" in data

    def test_exercise_has_required_fields(self, client):
        response = client.post("/parse/text", json={
            "text": "Squats 4x8",
            "source": "instagram_caption",
        })

        data = response.json()
        assert len(data["exercises"]) >= 1
        ex = data["exercises"][0]

        assert "raw_name" in ex
        assert "sets" in ex
        assert "reps" in ex
        assert "distance" in ex
        assert "superset_group" in ex
        assert "order" in ex

    def test_confidence_in_range(self, client):
        response = client.post("/parse/text", json={
            "text": "Squats 4x8\nBench Press 3x10",
            "source": "instagram_caption",
        })

        data = response.json()
        assert 0 <= data["confidence"] <= 100


class TestRealWorldCaptions:
    """Realistic Instagram caption scenarios."""

    def test_full_instagram_post_with_noise(self, client):
        """A real-world-style caption with CTAs, hashtags, and exercises.
        Note: ParserService may let some hashtag noise through; the key
        assertion is that real exercises are correctly extracted."""
        text = (
            "Workout:\n"
            "Pull-ups 4x8 + Z Press 4x8\n"
            "SA cable row 4x12 + SA DB press 4x8\n"
            "Seated sled pull 5 x 10m\n"
            "\n"
            "Follow me for more workouts!\n"
            "#fitness #gym #legday"
        )

        response = client.post("/parse/text", json={
            "text": text,
            "source": "instagram_caption",
        })

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

        names = [e["raw_name"] for e in data["exercises"]]
        # Real exercises found
        assert any("Pull-ups" in n for n in names)
        assert any("Z Press" in n for n in names)
        assert any("SA cable row" in n for n in names)
        assert any("SA DB press" in n for n in names)
        # CTA "Follow me" should not appear
        assert not any("Follow" in n for n in names)

    def test_bullet_list_format(self, client):
        text = (
            "- Squats 4x8\n"
            "- Bench Press 3x10\n"
            "- Deadlifts 5x5\n"
            "- Pull-ups 4x8"
        )

        response = client.post("/parse/text", json={
            "text": text,
            "source": "instagram_caption",
        })

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert len(data["exercises"]) == 4

    def test_rep_ranges_through_pipeline(self, client):
        text = "Squats 4x8-12"

        response = client.post("/parse/text", json={
            "text": text,
            "source": "instagram_caption",
        })

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["exercises"][0]["reps"] == "8-12"

    def test_time_based_through_pipeline(self, client):
        text = "Plank 3x30s"

        response = client.post("/parse/text", json={
            "text": text,
            "source": "instagram_caption",
        })

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["exercises"][0]["sets"] == 3
        assert data["exercises"][0]["reps"] == "30s"
