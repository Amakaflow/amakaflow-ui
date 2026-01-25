"""
Integration tests for generation API.

Part of AMA-461: Create program-api service scaffold

Tests program generation endpoint with mocked AI.
"""

import pytest


# ---------------------------------------------------------------------------
# Generation Endpoint Tests
# ---------------------------------------------------------------------------


@pytest.mark.integration
class TestGenerateProgram:
    """Integration tests for POST /generate."""

    def test_generate_program_stub(self, client, sample_generation_request):
        """Generate returns 501 (stub implementation)."""
        response = client.post("/generate", json=sample_generation_request)

        # Currently a stub - will return 200 when implemented
        assert response.status_code == 501
        assert response.json()["detail"] == "Not implemented"

    def test_generate_program_validation_error(self, client):
        """Invalid payload returns 422."""
        response = client.post(
            "/generate",
            json={"goal": "strength"},  # Missing required fields
        )

        assert response.status_code == 422

    def test_generate_program_all_goals(self, client):
        """All goal types are accepted by validation."""
        goals = ["strength", "hypertrophy", "endurance", "weight_loss", "general_fitness", "sport_specific"]

        for goal in goals:
            response = client.post(
                "/generate",
                json={
                    "goal": goal,
                    "duration_weeks": 8,
                    "sessions_per_week": 4,
                    "experience_level": "intermediate",
                },
            )

            # Stub returns 501, but validation passed (not 422)
            assert response.status_code == 501

    def test_generate_program_all_experience_levels(self, client):
        """All experience levels are accepted by validation."""
        levels = ["beginner", "intermediate", "advanced"]

        for level in levels:
            response = client.post(
                "/generate",
                json={
                    "goal": "strength",
                    "duration_weeks": 8,
                    "sessions_per_week": 4,
                    "experience_level": level,
                },
            )

            # Stub returns 501, but validation passed (not 422)
            assert response.status_code == 501

    def test_generate_program_with_optional_fields(self, client):
        """Optional fields are accepted."""
        response = client.post(
            "/generate",
            json={
                "goal": "hypertrophy",
                "duration_weeks": 12,
                "sessions_per_week": 5,
                "experience_level": "advanced",
                "equipment_available": ["barbell", "dumbbells", "cables"],
                "focus_areas": ["chest", "shoulders"],
                "limitations": ["lower back pain"],
                "preferences": "Prefer high volume training",
            },
        )

        # Stub returns 501, but validation passed
        assert response.status_code == 501


# ---------------------------------------------------------------------------
# Boundary Tests
# ---------------------------------------------------------------------------


@pytest.mark.integration
class TestGenerateProgramBoundaries:
    """Boundary tests for generation parameters."""

    def test_minimum_duration(self, client):
        """Minimum duration (1 week) is accepted."""
        response = client.post(
            "/generate",
            json={
                "goal": "strength",
                "duration_weeks": 1,
                "sessions_per_week": 3,
                "experience_level": "beginner",
            },
        )

        assert response.status_code == 501  # Stub, but validation passed

    def test_maximum_duration(self, client):
        """Maximum duration (52 weeks) is accepted."""
        response = client.post(
            "/generate",
            json={
                "goal": "strength",
                "duration_weeks": 52,
                "sessions_per_week": 3,
                "experience_level": "beginner",
            },
        )

        assert response.status_code == 501  # Stub, but validation passed

    def test_minimum_sessions(self, client):
        """Minimum sessions (1/week) is accepted."""
        response = client.post(
            "/generate",
            json={
                "goal": "strength",
                "duration_weeks": 4,
                "sessions_per_week": 1,
                "experience_level": "beginner",
            },
        )

        assert response.status_code == 501  # Stub, but validation passed

    def test_maximum_sessions(self, client):
        """Maximum sessions (7/week) is accepted."""
        response = client.post(
            "/generate",
            json={
                "goal": "strength",
                "duration_weeks": 4,
                "sessions_per_week": 7,
                "experience_level": "advanced",
            },
        )

        assert response.status_code == 501  # Stub, but validation passed
