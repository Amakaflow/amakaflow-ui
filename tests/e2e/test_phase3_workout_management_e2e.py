"""E2E tests for Phase 3 workout management tools.

These tests verify the full SSE streaming flow for workout management functions:
- edit_workout
- export_workout
- duplicate_workout
- log_workout_completion
- get_workout_history
- get_workout_details

Also tests safety boundaries (delete rejection).

Usage:
    pytest tests/e2e/test_phase3_workout_management_e2e.py -v
    pytest -m integration -k phase3 -v
"""

import json

import pytest

from backend.services.ai_client import StreamEvent
from tests.e2e.conftest import (
    parse_sse_events,
    find_events,
)


@pytest.mark.integration
class TestEditWorkoutE2E:
    """Full-stack tests for edit_workout flow."""

    @pytest.mark.smoke
    def test_edit_workout_sse_flow(self, client, ai_client, function_dispatcher):
        """Verify edit_workout triggers function_call and function_result SSE events."""
        ai_client.response_events = [
            StreamEvent(
                event="function_call",
                data={"id": "toolu_edit_1", "name": "edit_workout"},
            ),
            StreamEvent(
                event="content_delta",
                data={
                    "partial_json": json.dumps({
                        "workout_id": "w-123",
                        "operations": [
                            {"op": "replace", "path": "/title", "value": "Morning HIIT"}
                        ]
                    })
                },
            ),
            StreamEvent(
                event="content_delta",
                data={"text": "I've updated the workout title to 'Morning HIIT'."},
            ),
            StreamEvent(
                event="message_end",
                data={
                    "model": "claude-sonnet-4-20250514",
                    "input_tokens": 200,
                    "output_tokens": 100,
                    "latency_ms": 1500,
                },
            ),
        ]

        response = client.post(
            "/chat/stream",
            json={"message": "Rename my workout to Morning HIIT"},
        )

        assert response.status_code == 200
        events = parse_sse_events(response.text)

        # Verify function_call event
        fc_events = find_events(events, "function_call")
        assert len(fc_events) >= 1
        assert fc_events[0]["data"]["name"] == "edit_workout"

        # Verify function_result event
        fr_events = find_events(events, "function_result")
        assert len(fr_events) >= 1
        result = json.loads(fr_events[0]["data"]["result"])
        assert result["success"] is True
        assert result["workout_id"] == "w-123"

    def test_edit_workout_multiple_operations(self, client, ai_client, function_dispatcher):
        """Verify multiple edit operations can be applied."""
        ai_client.response_events = [
            StreamEvent(
                event="function_call",
                data={"id": "toolu_edit_2", "name": "edit_workout"},
            ),
            StreamEvent(
                event="content_delta",
                data={
                    "partial_json": json.dumps({
                        "workout_id": "w-456",
                        "operations": [
                            {"op": "replace", "path": "/title", "value": "Updated Workout"},
                            {"op": "add", "path": "/tags/-", "value": "strength"},
                            {"op": "remove", "path": "/exercises/0"}
                        ]
                    })
                },
            ),
            StreamEvent(
                event="message_end",
                data={
                    "model": "claude-sonnet-4-20250514",
                    "input_tokens": 180,
                    "output_tokens": 90,
                    "latency_ms": 1200,
                },
            ),
        ]

        response = client.post(
            "/chat/stream",
            json={"message": "Update my workout: change title, add strength tag, remove first exercise"},
        )

        assert response.status_code == 200

        # Verify dispatcher received all operations
        last_call = function_dispatcher.last_call
        assert last_call["function_name"] == "edit_workout"
        assert len(last_call["arguments"]["operations"]) == 3


@pytest.mark.integration
class TestExportWorkoutE2E:
    """Full-stack tests for export_workout flow."""

    @pytest.mark.smoke
    def test_export_workout_zwift(self, client, ai_client, function_dispatcher):
        """Verify export_workout to Zwift ZWO format."""
        ai_client.response_events = [
            StreamEvent(
                event="function_call",
                data={"id": "toolu_exp_1", "name": "export_workout"},
            ),
            StreamEvent(
                event="content_delta",
                data={"partial_json": '{"workout_id": "w-123", "format": "zwo"}'},
            ),
            StreamEvent(
                event="content_delta",
                data={"text": "Here's your workout exported for Zwift!"},
            ),
            StreamEvent(
                event="message_end",
                data={
                    "model": "claude-sonnet-4-20250514",
                    "input_tokens": 150,
                    "output_tokens": 80,
                    "latency_ms": 1000,
                },
            ),
        ]

        response = client.post(
            "/chat/stream",
            json={"message": "Export my HIIT workout to Zwift format"},
        )

        assert response.status_code == 200
        events = parse_sse_events(response.text)

        fr_events = find_events(events, "function_result")
        assert len(fr_events) >= 1
        result = json.loads(fr_events[0]["data"]["result"])
        assert result["success"] is True
        assert result["format"] == "zwo"
        assert result["format_name"] == "Zwift ZWO"

    def test_export_workout_yaml_garmin(self, client, ai_client, function_dispatcher):
        """Verify export_workout to Garmin YAML format."""
        ai_client.response_events = [
            StreamEvent(
                event="function_call",
                data={"id": "toolu_exp_2", "name": "export_workout"},
            ),
            StreamEvent(
                event="content_delta",
                data={"partial_json": '{"workout_id": "w-456", "format": "yaml"}'},
            ),
            StreamEvent(
                event="message_end",
                data={
                    "model": "claude-sonnet-4-20250514",
                    "input_tokens": 140,
                    "output_tokens": 70,
                    "latency_ms": 900,
                },
            ),
        ]

        response = client.post(
            "/chat/stream",
            json={"message": "Export for my Garmin watch"},
        )

        assert response.status_code == 200

        last_call = function_dispatcher.last_call
        assert last_call["arguments"]["format"] == "yaml"

    def test_export_workout_workoutkit(self, client, ai_client, function_dispatcher):
        """Verify export_workout to Apple WorkoutKit format."""
        ai_client.response_events = [
            StreamEvent(
                event="function_call",
                data={"id": "toolu_exp_3", "name": "export_workout"},
            ),
            StreamEvent(
                event="content_delta",
                data={"partial_json": '{"workout_id": "w-789", "format": "workoutkit"}'},
            ),
            StreamEvent(
                event="message_end",
                data={
                    "model": "claude-sonnet-4-20250514",
                    "input_tokens": 145,
                    "output_tokens": 75,
                    "latency_ms": 950,
                },
            ),
        ]

        response = client.post(
            "/chat/stream",
            json={"message": "Export for Apple Watch"},
        )

        assert response.status_code == 200

        last_call = function_dispatcher.last_call
        assert last_call["arguments"]["format"] == "workoutkit"


@pytest.mark.integration
class TestDuplicateWorkoutE2E:
    """Full-stack tests for duplicate_workout flow."""

    @pytest.mark.smoke
    def test_duplicate_workout_basic(self, client, ai_client, function_dispatcher):
        """Verify basic workout duplication."""
        ai_client.response_events = [
            StreamEvent(
                event="function_call",
                data={"id": "toolu_dup_1", "name": "duplicate_workout"},
            ),
            StreamEvent(
                event="content_delta",
                data={"partial_json": '{"workout_id": "w-123"}'},
            ),
            StreamEvent(
                event="content_delta",
                data={"text": "I've created a copy of your workout!"},
            ),
            StreamEvent(
                event="message_end",
                data={
                    "model": "claude-sonnet-4-20250514",
                    "input_tokens": 160,
                    "output_tokens": 85,
                    "latency_ms": 1100,
                },
            ),
        ]

        response = client.post(
            "/chat/stream",
            json={"message": "Make a copy of my HIIT workout"},
        )

        assert response.status_code == 200
        events = parse_sse_events(response.text)

        fr_events = find_events(events, "function_result")
        assert len(fr_events) >= 1
        result = json.loads(fr_events[0]["data"]["result"])
        assert result["success"] is True
        assert result["original_id"] == "w-123"
        assert "new_workout" in result

    def test_duplicate_workout_with_new_title(self, client, ai_client, function_dispatcher):
        """Verify duplication with custom title."""
        ai_client.response_events = [
            StreamEvent(
                event="function_call",
                data={"id": "toolu_dup_2", "name": "duplicate_workout"},
            ),
            StreamEvent(
                event="content_delta",
                data={
                    "partial_json": json.dumps({
                        "workout_id": "w-456",
                        "new_title": "Evening Variation"
                    })
                },
            ),
            StreamEvent(
                event="message_end",
                data={
                    "model": "claude-sonnet-4-20250514",
                    "input_tokens": 170,
                    "output_tokens": 80,
                    "latency_ms": 1050,
                },
            ),
        ]

        response = client.post(
            "/chat/stream",
            json={"message": "Duplicate my morning workout and call it Evening Variation"},
        )

        assert response.status_code == 200

        last_call = function_dispatcher.last_call
        assert last_call["arguments"]["new_title"] == "Evening Variation"


@pytest.mark.integration
class TestLogWorkoutCompletionE2E:
    """Full-stack tests for log_workout_completion flow."""

    @pytest.mark.smoke
    def test_log_completion_basic(self, client, ai_client, function_dispatcher):
        """Verify basic workout completion logging."""
        ai_client.response_events = [
            StreamEvent(
                event="function_call",
                data={"id": "toolu_log_1", "name": "log_workout_completion"},
            ),
            StreamEvent(
                event="content_delta",
                data={"partial_json": '{"workout_id": "w-123"}'},
            ),
            StreamEvent(
                event="content_delta",
                data={"text": "Great job! I've logged your workout completion."},
            ),
            StreamEvent(
                event="message_end",
                data={
                    "model": "claude-sonnet-4-20250514",
                    "input_tokens": 140,
                    "output_tokens": 70,
                    "latency_ms": 800,
                },
            ),
        ]

        response = client.post(
            "/chat/stream",
            json={"message": "I just finished my HIIT workout"},
        )

        assert response.status_code == 200
        events = parse_sse_events(response.text)

        fr_events = find_events(events, "function_result")
        assert len(fr_events) >= 1
        result = json.loads(fr_events[0]["data"]["result"])
        assert result["success"] is True
        assert "completion_id" in result

    def test_log_completion_with_metrics(self, client, ai_client, function_dispatcher):
        """Verify completion logging with duration, notes, and rating."""
        ai_client.response_events = [
            StreamEvent(
                event="function_call",
                data={"id": "toolu_log_2", "name": "log_workout_completion"},
            ),
            StreamEvent(
                event="content_delta",
                data={
                    "partial_json": json.dumps({
                        "workout_id": "w-456",
                        "duration_minutes": 45,
                        "notes": "Felt great, increased weights",
                        "rating": 5
                    })
                },
            ),
            StreamEvent(
                event="message_end",
                data={
                    "model": "claude-sonnet-4-20250514",
                    "input_tokens": 180,
                    "output_tokens": 90,
                    "latency_ms": 950,
                },
            ),
        ]

        response = client.post(
            "/chat/stream",
            json={"message": "Log my workout - 45 min, felt great, 5 stars"},
        )

        assert response.status_code == 200

        last_call = function_dispatcher.last_call
        assert last_call["arguments"]["duration_minutes"] == 45
        assert last_call["arguments"]["rating"] == 5
        assert "Felt great" in last_call["arguments"]["notes"]


@pytest.mark.integration
class TestGetWorkoutHistoryE2E:
    """Full-stack tests for get_workout_history flow."""

    @pytest.mark.smoke
    def test_get_history_basic(self, client, ai_client, function_dispatcher):
        """Verify basic workout history retrieval."""
        ai_client.response_events = [
            StreamEvent(
                event="function_call",
                data={"id": "toolu_hist_1", "name": "get_workout_history"},
            ),
            StreamEvent(
                event="content_delta",
                data={"partial_json": "{}"},
            ),
            StreamEvent(
                event="content_delta",
                data={"text": "Here's your recent workout history..."},
            ),
            StreamEvent(
                event="message_end",
                data={
                    "model": "claude-sonnet-4-20250514",
                    "input_tokens": 130,
                    "output_tokens": 120,
                    "latency_ms": 900,
                },
            ),
        ]

        response = client.post(
            "/chat/stream",
            json={"message": "Show me my workout history"},
        )

        assert response.status_code == 200
        events = parse_sse_events(response.text)

        fc_events = find_events(events, "function_call")
        assert len(fc_events) >= 1
        assert fc_events[0]["data"]["name"] == "get_workout_history"

    def test_get_history_with_date_filter(self, client, ai_client, function_dispatcher):
        """Verify workout history with date filtering."""
        ai_client.response_events = [
            StreamEvent(
                event="function_call",
                data={"id": "toolu_hist_2", "name": "get_workout_history"},
            ),
            StreamEvent(
                event="content_delta",
                data={
                    "partial_json": json.dumps({
                        "start_date": "2024-01-01",
                        "end_date": "2024-01-31",
                        "limit": 20
                    })
                },
            ),
            StreamEvent(
                event="message_end",
                data={
                    "model": "claude-sonnet-4-20250514",
                    "input_tokens": 150,
                    "output_tokens": 130,
                    "latency_ms": 1000,
                },
            ),
        ]

        response = client.post(
            "/chat/stream",
            json={"message": "Show my workouts from January 2024"},
        )

        assert response.status_code == 200

        last_call = function_dispatcher.last_call
        assert last_call["arguments"]["start_date"] == "2024-01-01"
        assert last_call["arguments"]["end_date"] == "2024-01-31"


@pytest.mark.integration
class TestGetWorkoutDetailsE2E:
    """Full-stack tests for get_workout_details flow."""

    @pytest.mark.smoke
    def test_get_details_basic(self, client, ai_client, function_dispatcher):
        """Verify workout details retrieval."""
        ai_client.response_events = [
            StreamEvent(
                event="function_call",
                data={"id": "toolu_det_1", "name": "get_workout_details"},
            ),
            StreamEvent(
                event="content_delta",
                data={"partial_json": '{"workout_id": "w-123"}'},
            ),
            StreamEvent(
                event="content_delta",
                data={"text": "Here are the details for your workout..."},
            ),
            StreamEvent(
                event="message_end",
                data={
                    "model": "claude-sonnet-4-20250514",
                    "input_tokens": 140,
                    "output_tokens": 150,
                    "latency_ms": 850,
                },
            ),
        ]

        response = client.post(
            "/chat/stream",
            json={"message": "Show me the details of my HIIT workout"},
        )

        assert response.status_code == 200
        events = parse_sse_events(response.text)

        fr_events = find_events(events, "function_result")
        assert len(fr_events) >= 1
        result = json.loads(fr_events[0]["data"]["result"])
        assert result["success"] is True
        assert "workout" in result
        assert result["workout"]["id"] == "w-123"


@pytest.mark.integration
class TestSafetyBoundariesE2E:
    """Test safety boundaries for workout management."""

    def test_delete_request_rejected_politely(self, client, ai_client, function_dispatcher):
        """Verify delete requests are handled gracefully.

        Note: Since we don't have a delete_workout tool, Claude should not
        attempt to delete. If the user asks to delete, Claude should explain
        that deletion must be done through the app settings.
        """
        # Simulate Claude responding without a delete tool call
        ai_client.response_events = [
            StreamEvent(
                event="content_delta",
                data={
                    "text": (
                        "I can't delete workouts through the chat interface. "
                        "To delete a workout, please go to your workout library in the app "
                        "and use the delete option there. This helps prevent accidental deletions."
                    )
                },
            ),
            StreamEvent(
                event="message_end",
                data={
                    "model": "claude-sonnet-4-20250514",
                    "input_tokens": 120,
                    "output_tokens": 60,
                    "latency_ms": 700,
                },
            ),
        ]

        response = client.post(
            "/chat/stream",
            json={"message": "Delete my old leg day workout"},
        )

        assert response.status_code == 200
        events = parse_sse_events(response.text)

        # No function_call should be made for delete
        fc_events = find_events(events, "function_call")
        assert len(fc_events) == 0

        # Content should include redirect to app
        content_events = find_events(events, "content_delta")
        assert len(content_events) > 0


@pytest.mark.integration
class TestPhase3ErrorHandling:
    """Test error scenarios for Phase 3 functions."""

    def test_workout_not_found_error(self, client, ai_client, function_dispatcher):
        """Verify workout not found error is handled."""
        function_dispatcher.set_error("get_workout_details", "The requested item was not found.")

        ai_client.response_events = [
            StreamEvent(
                event="function_call",
                data={"id": "toolu_err_1", "name": "get_workout_details"},
            ),
            StreamEvent(
                event="content_delta",
                data={"partial_json": '{"workout_id": "w-nonexistent"}'},
            ),
            StreamEvent(
                event="message_end",
                data={
                    "model": "claude-sonnet-4-20250514",
                    "input_tokens": 130,
                    "output_tokens": 50,
                    "latency_ms": 600,
                },
            ),
        ]

        response = client.post(
            "/chat/stream",
            json={"message": "Show me workout w-nonexistent"},
        )

        assert response.status_code == 200
        events = parse_sse_events(response.text)

        fr_events = find_events(events, "function_result")
        assert len(fr_events) >= 1
        assert "not found" in fr_events[0]["data"]["result"]

    def test_invalid_edit_operation_error(self, client, ai_client, function_dispatcher):
        """Verify invalid edit operations return appropriate error."""
        function_dispatcher.set_error("edit_workout", "Invalid operation: delete")

        ai_client.response_events = [
            StreamEvent(
                event="function_call",
                data={"id": "toolu_err_2", "name": "edit_workout"},
            ),
            StreamEvent(
                event="content_delta",
                data={
                    "partial_json": json.dumps({
                        "workout_id": "w-123",
                        "operations": [{"op": "delete", "path": "/exercises/0"}]
                    })
                },
            ),
            StreamEvent(
                event="message_end",
                data={
                    "model": "claude-sonnet-4-20250514",
                    "input_tokens": 140,
                    "output_tokens": 55,
                    "latency_ms": 650,
                },
            ),
        ]

        response = client.post(
            "/chat/stream",
            json={"message": "Remove the first exercise from my workout"},
        )

        assert response.status_code == 200
        events = parse_sse_events(response.text)

        fr_events = find_events(events, "function_result")
        assert len(fr_events) >= 1
        assert "Invalid operation" in fr_events[0]["data"]["result"]

    def test_invalid_export_format_error(self, client, ai_client, function_dispatcher):
        """Verify invalid export format returns appropriate error."""
        function_dispatcher.set_error("export_workout", "Invalid format: pdf")

        ai_client.response_events = [
            StreamEvent(
                event="function_call",
                data={"id": "toolu_err_3", "name": "export_workout"},
            ),
            StreamEvent(
                event="content_delta",
                data={"partial_json": '{"workout_id": "w-123", "format": "pdf"}'},
            ),
            StreamEvent(
                event="message_end",
                data={
                    "model": "claude-sonnet-4-20250514",
                    "input_tokens": 135,
                    "output_tokens": 50,
                    "latency_ms": 620,
                },
            ),
        ]

        response = client.post(
            "/chat/stream",
            json={"message": "Export my workout as a PDF"},
        )

        assert response.status_code == 200
        events = parse_sse_events(response.text)

        fr_events = find_events(events, "function_result")
        assert len(fr_events) >= 1
        assert "Invalid format" in fr_events[0]["data"]["result"]
