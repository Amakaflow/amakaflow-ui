"""
Tests for program event endpoints.

AMA-469: Calendar Integration for Program Workouts

Tests the /program-events endpoints for bulk creating, retrieving,
and deleting program calendar events.
"""

from contextlib import contextmanager
from datetime import date
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.auth import get_current_user


# ---------------------------------------------------------------------------
# Test Configuration
# ---------------------------------------------------------------------------


TEST_USER_ID = "test-user-123"
PROGRAM_ID = str(uuid4())
WORKOUT_ID_1 = str(uuid4())
WORKOUT_ID_2 = str(uuid4())
EVENT_ID_1 = str(uuid4())
EVENT_ID_2 = str(uuid4())


async def mock_get_current_user() -> str:
    """Mock auth dependency that returns a test user."""
    return TEST_USER_ID


# ---------------------------------------------------------------------------
# Mock Database Helpers
# ---------------------------------------------------------------------------


def make_mock_cursor_for_bulk_create(event_ids: list):
    """Create a mock cursor that returns event IDs for bulk create."""
    mock_cursor = MagicMock()
    # Each insert returns the next event ID
    mock_cursor.fetchone.side_effect = [(eid,) for eid in event_ids]
    return mock_cursor


def make_mock_cursor_for_get_events(events: list):
    """Create a mock cursor that returns events for get."""
    mock_cursor = MagicMock()
    mock_cursor.fetchall.return_value = [
        (
            e["id"], e["user_id"], e["title"], e["source"], e["date"],
            e.get("start_time"), e.get("end_time"), e.get("type"),
            e.get("status", "planned"), e.get("is_anchor", False),
            e.get("primary_muscle"), e.get("intensity", 1),
            e.get("connected_calendar_id"), e.get("connected_calendar_type"),
            e.get("external_event_url"), e.get("recurrence_rule"),
            e.get("program_id"), e.get("program_workout_id"),
            e.get("program_week_number"), e.get("json_payload"),
            e.get("created_at"), e.get("updated_at"),
        )
        for e in events
    ]
    mock_cursor.description = [
        ("id",), ("user_id",), ("title",), ("source",), ("date",),
        ("start_time",), ("end_time",), ("type",), ("status",),
        ("is_anchor",), ("primary_muscle",), ("intensity",),
        ("connected_calendar_id",), ("connected_calendar_type",),
        ("external_event_url",), ("recurrence_rule",),
        ("program_id",), ("program_workout_id",), ("program_week_number",),
        ("json_payload",), ("created_at",), ("updated_at",),
    ]
    return mock_cursor


def make_mock_cursor_for_delete(deleted_ids: list):
    """Create a mock cursor that returns deleted IDs."""
    mock_cursor = MagicMock()
    mock_cursor.fetchall.return_value = [(eid,) for eid in deleted_ids]
    return mock_cursor


@contextmanager
def mock_db_with_cursor(mock_cursor):
    """Context manager for mocking DB connection with a custom cursor."""
    mock_conn = MagicMock()
    mock_conn.cursor.return_value.__enter__ = MagicMock(return_value=mock_cursor)
    mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
    yield mock_conn


# ---------------------------------------------------------------------------
# Bulk Create Tests
# ---------------------------------------------------------------------------


class TestBulkCreateProgramEvents:
    """Tests for POST /program-events/bulk-create."""

    def test_bulk_create_success(self):
        """Bulk create returns created event IDs."""
        event_ids = [EVENT_ID_1, EVENT_ID_2]
        mock_cursor = make_mock_cursor_for_bulk_create(event_ids)

        app.dependency_overrides[get_current_user] = mock_get_current_user

        with patch("app.routes.programs.get_db_connection") as mock_db:
            mock_db.return_value = mock_db_with_cursor(mock_cursor)

            client = TestClient(app)
            response = client.post(
                "/program-events/bulk-create",
                json={
                    "program_id": PROGRAM_ID,
                    "events": [
                        {
                            "title": "Workout 1",
                            "date": "2026-02-02",
                            "program_workout_id": WORKOUT_ID_1,
                            "program_week_number": 1,
                        },
                        {
                            "title": "Workout 2",
                            "date": "2026-02-04",
                            "program_workout_id": WORKOUT_ID_2,
                            "program_week_number": 1,
                        },
                    ],
                },
            )

        app.dependency_overrides.clear()

        assert response.status_code == 201
        data = response.json()
        assert data["program_id"] == PROGRAM_ID
        assert data["events_created"] == 2
        assert len(data["event_ids"]) == 2

    def test_bulk_create_empty_events_returns_400(self):
        """Bulk create with empty events list returns 400."""
        app.dependency_overrides[get_current_user] = mock_get_current_user

        client = TestClient(app)
        response = client.post(
            "/program-events/bulk-create",
            json={
                "program_id": PROGRAM_ID,
                "events": [],
            },
        )

        app.dependency_overrides.clear()

        assert response.status_code == 400
        assert "no events" in response.json()["detail"].lower()

    def test_bulk_create_missing_required_fields_returns_422(self):
        """Bulk create with missing required fields returns 422."""
        app.dependency_overrides[get_current_user] = mock_get_current_user

        client = TestClient(app)
        response = client.post(
            "/program-events/bulk-create",
            json={
                "program_id": PROGRAM_ID,
                "events": [
                    {
                        "title": "Workout 1",
                        # Missing date, program_workout_id, program_week_number
                    },
                ],
            },
        )

        app.dependency_overrides.clear()

        assert response.status_code == 422

    def test_bulk_create_with_optional_fields(self):
        """Bulk create includes optional fields."""
        event_ids = [EVENT_ID_1]
        mock_cursor = make_mock_cursor_for_bulk_create(event_ids)

        app.dependency_overrides[get_current_user] = mock_get_current_user

        with patch("app.routes.programs.get_db_connection") as mock_db:
            mock_db.return_value = mock_db_with_cursor(mock_cursor)

            client = TestClient(app)
            response = client.post(
                "/program-events/bulk-create",
                json={
                    "program_id": PROGRAM_ID,
                    "events": [
                        {
                            "title": "Upper Body",
                            "date": "2026-02-02",
                            "program_workout_id": WORKOUT_ID_1,
                            "program_week_number": 1,
                            "type": "strength",
                            "start_time": "09:00:00",
                            "end_time": "10:00:00",
                            "primary_muscle": "upper",
                            "intensity": 2,
                            "json_payload": {"exercises": []},
                        },
                    ],
                },
            )

        app.dependency_overrides.clear()

        assert response.status_code == 201


# ---------------------------------------------------------------------------
# Get Program Events Tests
# ---------------------------------------------------------------------------


class TestGetProgramEvents:
    """Tests for GET /program-events/{program_id}."""

    def test_get_events_success(self):
        """Get events returns events for program."""
        events = [
            {
                "id": EVENT_ID_1,
                "user_id": TEST_USER_ID,
                "title": "Workout 1",
                "source": "training_program",
                "date": date(2026, 2, 2),
                "program_id": PROGRAM_ID,
                "program_workout_id": WORKOUT_ID_1,
                "program_week_number": 1,
            },
            {
                "id": EVENT_ID_2,
                "user_id": TEST_USER_ID,
                "title": "Workout 2",
                "source": "training_program",
                "date": date(2026, 2, 4),
                "program_id": PROGRAM_ID,
                "program_workout_id": WORKOUT_ID_2,
                "program_week_number": 1,
            },
        ]
        mock_cursor = make_mock_cursor_for_get_events(events)

        app.dependency_overrides[get_current_user] = mock_get_current_user

        with patch("app.routes.programs.get_db_connection") as mock_db:
            mock_db.return_value = mock_db_with_cursor(mock_cursor)

            client = TestClient(app)
            response = client.get(f"/program-events/{PROGRAM_ID}")

        app.dependency_overrides.clear()

        assert response.status_code == 200
        data = response.json()
        assert data["program_id"] == PROGRAM_ID
        assert data["total"] == 2
        assert len(data["events"]) == 2

    def test_get_events_empty(self):
        """Get events returns empty list when no events exist."""
        mock_cursor = make_mock_cursor_for_get_events([])

        app.dependency_overrides[get_current_user] = mock_get_current_user

        with patch("app.routes.programs.get_db_connection") as mock_db:
            mock_db.return_value = mock_db_with_cursor(mock_cursor)

            client = TestClient(app)
            response = client.get(f"/program-events/{PROGRAM_ID}")

        app.dependency_overrides.clear()

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 0
        assert data["events"] == []

    def test_get_events_invalid_uuid_returns_422(self):
        """Get events with invalid UUID returns 422."""
        app.dependency_overrides[get_current_user] = mock_get_current_user

        client = TestClient(app)
        response = client.get("/program-events/not-a-uuid")

        app.dependency_overrides.clear()

        assert response.status_code == 422


# ---------------------------------------------------------------------------
# Delete Program Events Tests
# ---------------------------------------------------------------------------


class TestDeleteProgramEvents:
    """Tests for DELETE /program-events/{program_id}."""

    def test_delete_events_success(self):
        """Delete events returns count of deleted events."""
        deleted_ids = [EVENT_ID_1, EVENT_ID_2]
        mock_cursor = make_mock_cursor_for_delete(deleted_ids)

        app.dependency_overrides[get_current_user] = mock_get_current_user

        with patch("app.routes.programs.get_db_connection") as mock_db:
            mock_db.return_value = mock_db_with_cursor(mock_cursor)

            client = TestClient(app)
            response = client.delete(f"/program-events/{PROGRAM_ID}")

        app.dependency_overrides.clear()

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["events_deleted"] == 2

    def test_delete_events_none_to_delete(self):
        """Delete events returns 0 when no events exist."""
        mock_cursor = make_mock_cursor_for_delete([])

        app.dependency_overrides[get_current_user] = mock_get_current_user

        with patch("app.routes.programs.get_db_connection") as mock_db:
            mock_db.return_value = mock_db_with_cursor(mock_cursor)

            client = TestClient(app)
            response = client.delete(f"/program-events/{PROGRAM_ID}")

        app.dependency_overrides.clear()

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["events_deleted"] == 0

    def test_delete_events_invalid_uuid_returns_422(self):
        """Delete events with invalid UUID returns 422."""
        app.dependency_overrides[get_current_user] = mock_get_current_user

        client = TestClient(app)
        response = client.delete("/program-events/not-a-uuid")

        app.dependency_overrides.clear()

        assert response.status_code == 422


# ---------------------------------------------------------------------------
# Schema Validation Tests
# ---------------------------------------------------------------------------


class TestProgramEventSchemas:
    """Tests for program event schema validation."""

    def test_invalid_workout_type_returns_422(self):
        """Invalid workout type in event returns 422."""
        app.dependency_overrides[get_current_user] = mock_get_current_user

        client = TestClient(app)
        response = client.post(
            "/program-events/bulk-create",
            json={
                "program_id": PROGRAM_ID,
                "events": [
                    {
                        "title": "Workout",
                        "date": "2026-02-02",
                        "program_workout_id": WORKOUT_ID_1,
                        "program_week_number": 1,
                        "type": "invalid_type",  # Invalid
                    },
                ],
            },
        )

        app.dependency_overrides.clear()

        assert response.status_code == 422

    def test_invalid_primary_muscle_returns_422(self):
        """Invalid primary muscle in event returns 422."""
        app.dependency_overrides[get_current_user] = mock_get_current_user

        client = TestClient(app)
        response = client.post(
            "/program-events/bulk-create",
            json={
                "program_id": PROGRAM_ID,
                "events": [
                    {
                        "title": "Workout",
                        "date": "2026-02-02",
                        "program_workout_id": WORKOUT_ID_1,
                        "program_week_number": 1,
                        "primary_muscle": "invalid_muscle",  # Invalid
                    },
                ],
            },
        )

        app.dependency_overrides.clear()

        assert response.status_code == 422

    def test_invalid_intensity_returns_422(self):
        """Intensity outside valid range returns 422."""
        app.dependency_overrides[get_current_user] = mock_get_current_user

        client = TestClient(app)
        response = client.post(
            "/program-events/bulk-create",
            json={
                "program_id": PROGRAM_ID,
                "events": [
                    {
                        "title": "Workout",
                        "date": "2026-02-02",
                        "program_workout_id": WORKOUT_ID_1,
                        "program_week_number": 1,
                        "intensity": 5,  # Invalid - max is 3
                    },
                ],
            },
        )

        app.dependency_overrides.clear()

        assert response.status_code == 422

    def test_invalid_week_number_returns_422(self):
        """Week number less than 1 returns 422."""
        app.dependency_overrides[get_current_user] = mock_get_current_user

        client = TestClient(app)
        response = client.post(
            "/program-events/bulk-create",
            json={
                "program_id": PROGRAM_ID,
                "events": [
                    {
                        "title": "Workout",
                        "date": "2026-02-02",
                        "program_workout_id": WORKOUT_ID_1,
                        "program_week_number": 0,  # Invalid - min is 1
                    },
                ],
            },
        )

        app.dependency_overrides.clear()

        assert response.status_code == 422
