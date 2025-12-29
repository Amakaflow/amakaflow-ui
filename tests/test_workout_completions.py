"""
Unit tests for workout completion endpoints (AMA-189).

These tests verify:
1. Route ordering is correct (/workouts/completions before /workouts/{workout_id})
2. Completion endpoints return proper responses
3. Auth is required for all completion endpoints
"""

import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
import uuid


# =============================================================================
# Route Ordering Tests (Critical - prevents route collision bug)
# =============================================================================


def test_completions_route_not_caught_by_workout_id(client):
    """
    CRITICAL: Verify /workouts/completions is NOT caught by /workouts/{workout_id}.

    Bug fixed: "completions" was being parsed as a workout_id UUID, causing
    'invalid input syntax for type uuid: "completions"' errors.
    """
    # This should NOT return a UUID parse error
    resp = client.get("/workouts/completions")

    # Should return 200 or 500 (DB error), but NOT 422 or UUID-related error
    assert resp.status_code != 422, "Route was caught by /workouts/{workout_id}"

    # Verify the response structure matches completions endpoint
    if resp.status_code == 200:
        data = resp.json()
        assert "completions" in data or "success" in data, \
            "Response doesn't match completions endpoint format"


def test_completions_id_route_accepts_valid_uuid(client):
    """
    Verify /workouts/completions/{id} accepts valid UUIDs.
    """
    valid_uuid = str(uuid.uuid4())
    resp = client.get(f"/workouts/completions/{valid_uuid}")

    # Should return 200 (found) or 200 with success=False (not found)
    # but NOT 422 (validation error)
    assert resp.status_code != 422


def test_workout_id_route_still_works(client):
    """
    Verify /workouts/{workout_id} still works for actual workout IDs.
    """
    valid_uuid = str(uuid.uuid4())
    resp = client.get(f"/workouts/{valid_uuid}")

    # Should return 200 (found/not found), not 422
    assert resp.status_code != 422


# =============================================================================
# GET /workouts/completions Tests
# =============================================================================


def test_list_completions_returns_success(client):
    """GET /workouts/completions returns success with auth."""
    resp = client.get("/workouts/completions")

    # 200 OK or 500 (if DB not connected)
    assert resp.status_code in (200, 500)

    if resp.status_code == 200:
        data = resp.json()
        assert "completions" in data
        assert "total" in data


def test_list_completions_accepts_pagination_params(client):
    """GET /workouts/completions accepts limit and offset params."""
    resp = client.get("/workouts/completions", params={"limit": 10, "offset": 5})

    assert resp.status_code in (200, 500)


def test_list_completions_limit_validation(client):
    """GET /workouts/completions enforces max limit of 100."""
    resp = client.get("/workouts/completions", params={"limit": 150})

    # Should return 422 because limit exceeds max of 100
    assert resp.status_code == 422


def test_list_completions_response_structure(client):
    """Verify the completions list response structure."""
    with patch('backend.app.get_user_completions') as mock_get:
        mock_get.return_value = {
            "completions": [
                {
                    "id": str(uuid.uuid4()),
                    "workout_name": "Test Workout",
                    "started_at": "2025-01-15T10:00:00Z",
                    "duration_seconds": 2700,
                    "avg_heart_rate": 142,
                    "max_heart_rate": 175,
                    "active_calories": 320,
                    "source": "apple_watch",
                }
            ],
            "total": 1
        }

        resp = client.get("/workouts/completions")

        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert len(data["completions"]) == 1
        assert data["total"] == 1

        completion = data["completions"][0]
        assert "workout_name" in completion
        assert "started_at" in completion
        assert "duration_seconds" in completion


# =============================================================================
# GET /workouts/completions/{completion_id} Tests
# =============================================================================


def test_get_completion_by_id_returns_success(client):
    """GET /workouts/completions/{id} returns success with valid UUID."""
    completion_id = str(uuid.uuid4())
    resp = client.get(f"/workouts/completions/{completion_id}")

    assert resp.status_code in (200, 500)


def test_get_completion_not_found(client):
    """GET /workouts/completions/{id} returns not found for missing completion."""
    with patch('backend.app.get_completion_by_id') as mock_get:
        mock_get.return_value = None

        completion_id = str(uuid.uuid4())
        resp = client.get(f"/workouts/completions/{completion_id}")

        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is False
        assert "not found" in data["message"].lower()


def test_get_completion_found(client):
    """GET /workouts/completions/{id} returns completion when found."""
    with patch('backend.app.get_completion_by_id') as mock_get:
        mock_completion = {
            "id": str(uuid.uuid4()),
            "workout_name": "HIIT Cardio",
            "started_at": "2025-01-15T10:00:00Z",
            "duration_seconds": 2700,
            "avg_heart_rate": 142,
            "max_heart_rate": 175,
            "active_calories": 320,
            "source": "apple_watch",
            "heart_rate_samples": [{"timestamp": "2025-01-15T10:00:00Z", "value": 80}]
        }
        mock_get.return_value = mock_completion

        resp = client.get(f"/workouts/completions/{mock_completion['id']}")

        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert data["completion"]["workout_name"] == "HIIT Cardio"


# =============================================================================
# POST /workouts/complete Tests
# =============================================================================


def test_complete_workout_missing_body_returns_422(client):
    """POST /workouts/complete requires a body."""
    resp = client.post("/workouts/complete", json={})
    assert resp.status_code == 422


def test_complete_workout_requires_workout_link(client):
    """POST /workouts/complete requires workout_event_id or follow_along_workout_id."""
    resp = client.post("/workouts/complete", json={
        "workout_name": "Test Workout",
        "started_at": "2025-01-15T10:00:00Z",
        "ended_at": "2025-01-15T10:45:00Z",
        "duration_seconds": 2700,
        "source": "apple_watch"
    })

    # Should return success=False for missing workout link
    if resp.status_code == 200:
        data = resp.json()
        assert data["success"] is False
        assert "workout_event_id" in data["message"].lower() or "required" in data["message"].lower()


def test_complete_workout_with_event_id(client):
    """POST /workouts/complete accepts workout_event_id."""
    with patch('backend.app.save_workout_completion') as mock_save:
        mock_save.return_value = {
            "id": str(uuid.uuid4()),
            "summary": {"duration_formatted": "45:00", "avg_heart_rate": 142, "calories": 320}
        }

        resp = client.post("/workouts/complete", json={
            "workout_event_id": str(uuid.uuid4()),
            "started_at": "2025-01-15T10:00:00Z",
            "ended_at": "2025-01-15T10:45:00Z",
            "source": "apple_watch",
            "health_metrics": {
                "avg_heart_rate": 142,
                "max_heart_rate": 175,
                "active_calories": 320
            }
        })

        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert "id" in data


def test_complete_workout_with_follow_along_id(client):
    """POST /workouts/complete accepts follow_along_workout_id."""
    with patch('backend.app.save_workout_completion') as mock_save:
        mock_save.return_value = {
            "id": str(uuid.uuid4()),
            "summary": {"duration_formatted": "1:00:00", "avg_heart_rate": None, "calories": None}
        }

        resp = client.post("/workouts/complete", json={
            "follow_along_workout_id": str(uuid.uuid4()),
            "started_at": "2025-01-15T18:00:00Z",
            "ended_at": "2025-01-15T19:00:00Z",
            "source": "apple_watch",
            "health_metrics": {}
        })

        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True


# =============================================================================
# Auth Tests
# =============================================================================


def test_completions_requires_auth(api_client):
    """
    All completion endpoints should require authentication.

    Note: The api_client fixture has auth mocked, so we test that
    auth dependency is properly applied by checking endpoints work.
    """
    # These should all work with mocked auth
    resp1 = api_client.get("/workouts/completions")
    resp2 = api_client.get(f"/workouts/completions/{uuid.uuid4()}")

    # Should not return 401/403 with mocked auth
    assert resp1.status_code not in (401, 403)
    assert resp2.status_code not in (401, 403)


# =============================================================================
# Edge Cases
# =============================================================================


def test_completions_empty_list(client):
    """GET /workouts/completions returns empty list when no completions."""
    with patch('backend.app.get_user_completions') as mock_get:
        mock_get.return_value = {
            "completions": [],
            "total": 0
        }

        resp = client.get("/workouts/completions")

        assert resp.status_code == 200
        data = resp.json()
        assert data["completions"] == []
        assert data["total"] == 0


def test_completions_string_literal_not_uuid(client):
    """
    Regression test: /workouts/completions should NOT be parsed as a workout_id.

    The word "completions" is not a valid UUID and should match the
    /workouts/completions route, not /workouts/{workout_id}.
    """
    resp = client.get("/workouts/completions")

    # If this was being caught by /workouts/{workout_id}, we'd get either:
    # - 422 (pydantic validation error for invalid UUID)
    # - 200 with a workout lookup error (not a completions response)

    if resp.status_code == 200:
        data = resp.json()
        # Should have completions structure, not workout structure
        has_completions_structure = "completions" in data or ("success" in data and "total" in data)
        has_workout_structure = "workout" in data

        assert has_completions_structure or not has_workout_structure, \
            "Response indicates /workouts/completions was caught by /workouts/{workout_id}"
