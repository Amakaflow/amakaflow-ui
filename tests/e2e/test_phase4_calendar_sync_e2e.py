"""E2E tests for Phase 4 Calendar & Sync functions.

Tests the full request/response cycle for:
- get_calendar_events
- reschedule_workout
- cancel_scheduled_workout
- sync_strava (with rate limiting)
- sync_garmin (with feature flag + rate limiting)
- get_strava_activities

These tests use fake services to isolate from external dependencies
while testing the full integration through the function dispatcher.
"""

import json
import pytest
from unittest.mock import MagicMock, patch

from backend.services.function_dispatcher import FunctionDispatcher, FunctionContext
from tests.conftest import (
    FakeFunctionRateLimitRepository,
    FakeFeatureFlagService,
    TEST_USER_ID,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def fake_rate_limit_repo():
    """Fresh rate limit repository for each test."""
    return FakeFunctionRateLimitRepository()


@pytest.fixture
def fake_feature_flags():
    """Fresh feature flag service for each test."""
    return FakeFeatureFlagService()


@pytest.fixture
def dispatcher(fake_rate_limit_repo, fake_feature_flags):
    """Create function dispatcher with fake services."""
    return FunctionDispatcher(
        mapper_api_url="http://fake-mapper:8001",
        calendar_api_url="http://fake-calendar:8002",
        ingestor_api_url="http://fake-ingestor:8003",
        strava_sync_api_url="http://fake-strava:8004",
        garmin_sync_api_url="http://fake-garmin:8005",
        function_rate_limit_repo=fake_rate_limit_repo,
        feature_flag_service=fake_feature_flags,
        sync_rate_limit_per_hour=3,
    )


@pytest.fixture
def ctx():
    """Standard test context."""
    return FunctionContext(user_id=TEST_USER_ID, auth_token="Bearer test-token")


# ---------------------------------------------------------------------------
# get_calendar_events Tests
# ---------------------------------------------------------------------------


class TestGetCalendarEvents:
    """E2E tests for get_calendar_events function."""

    def test_returns_scheduled_workouts_for_date_range(self, dispatcher, ctx):
        """Given scheduled workouts, when querying date range, then returns events."""
        mock_response = {
            "events": [
                {
                    "id": "event-1",
                    "title": "Morning Run",
                    "scheduled_date": "2026-01-29",
                    "scheduled_time": "07:00",
                },
                {
                    "id": "event-2",
                    "title": "HIIT Session",
                    "scheduled_date": "2026-01-30",
                    "scheduled_time": "18:00",
                },
            ]
        }

        with patch.object(dispatcher, "_call_api", return_value=mock_response):
            result = dispatcher.execute(
                "get_calendar_events",
                {"start_date": "2026-01-29", "end_date": "2026-01-31"},
                ctx,
            )

        assert "Found 2 scheduled workout(s)" in result
        assert "Morning Run" in result
        assert "HIIT Session" in result
        assert "event-1" in result

    def test_returns_empty_message_when_no_events(self, dispatcher, ctx):
        """Given no scheduled workouts, when querying, then returns empty message."""
        with patch.object(dispatcher, "_call_api", return_value={"events": []}):
            result = dispatcher.execute(
                "get_calendar_events",
                {"start_date": "2026-02-01", "end_date": "2026-02-07"},
                ctx,
            )

        assert "No workouts scheduled" in result

    def test_validates_required_fields(self, dispatcher, ctx):
        """Given missing dates, when calling, then returns validation error."""
        result = dispatcher.execute(
            "get_calendar_events",
            {"start_date": "2026-01-29"},  # Missing end_date
            ctx,
        )

        parsed = json.loads(result)
        assert parsed["error"] is True
        assert "start_date and end_date are required" in parsed["message"]


# ---------------------------------------------------------------------------
# reschedule_workout Tests
# ---------------------------------------------------------------------------


class TestRescheduleWorkout:
    """E2E tests for reschedule_workout function."""

    def test_reschedules_to_new_date(self, dispatcher, ctx):
        """Given event_id and new_date, when rescheduling, then updates and confirms."""
        with patch.object(dispatcher, "_call_api", return_value={}):
            result = dispatcher.execute(
                "reschedule_workout",
                {"event_id": "event-123", "new_date": "2026-02-01"},
                ctx,
            )

        parsed = json.loads(result)
        assert parsed["success"] is True
        assert "2026-02-01" in parsed["message"]

    def test_reschedules_to_new_time(self, dispatcher, ctx):
        """Given event_id and new_time, when rescheduling, then updates time."""
        with patch.object(dispatcher, "_call_api", return_value={}):
            result = dispatcher.execute(
                "reschedule_workout",
                {"event_id": "event-123", "new_time": "14:00"},
                ctx,
            )

        parsed = json.loads(result)
        assert parsed["success"] is True
        assert "14:00" in parsed["message"]

    def test_reschedules_to_new_date_and_time(self, dispatcher, ctx):
        """Given both new_date and new_time, when rescheduling, then updates both."""
        with patch.object(dispatcher, "_call_api", return_value={}):
            result = dispatcher.execute(
                "reschedule_workout",
                {"event_id": "event-123", "new_date": "2026-02-01", "new_time": "09:30"},
                ctx,
            )

        parsed = json.loads(result)
        assert parsed["success"] is True
        assert "2026-02-01" in parsed["message"]
        assert "09:30" in parsed["message"]

    def test_requires_event_id(self, dispatcher, ctx):
        """Given missing event_id, when rescheduling, then returns error."""
        result = dispatcher.execute(
            "reschedule_workout",
            {"new_date": "2026-02-01"},
            ctx,
        )

        parsed = json.loads(result)
        assert parsed["error"] is True
        assert "event_id" in parsed["message"]

    def test_requires_date_or_time(self, dispatcher, ctx):
        """Given only event_id (no changes), when rescheduling, then returns error."""
        result = dispatcher.execute(
            "reschedule_workout",
            {"event_id": "event-123"},
            ctx,
        )

        parsed = json.loads(result)
        assert parsed["error"] is True
        assert "new_date or new_time" in parsed["message"]


# ---------------------------------------------------------------------------
# cancel_scheduled_workout Tests
# ---------------------------------------------------------------------------


class TestCancelScheduledWorkout:
    """E2E tests for cancel_scheduled_workout function."""

    def test_cancels_with_confirmation(self, dispatcher, ctx):
        """Given confirm=true, when cancelling, then deletes event."""
        # Mock getting event details first, then delete
        with patch.object(
            dispatcher,
            "_call_api",
            side_effect=[
                {"id": "event-123", "title": "Morning Run"},  # GET event
                {},  # DELETE response
            ],
        ):
            result = dispatcher.execute(
                "cancel_scheduled_workout",
                {"event_id": "event-123", "confirm": True},
                ctx,
            )

        parsed = json.loads(result)
        assert parsed["success"] is True
        assert "Morning Run" in parsed["message"]

    def test_requires_confirmation(self, dispatcher, ctx):
        """Given confirm=false, when cancelling, then returns confirmation error."""
        result = dispatcher.execute(
            "cancel_scheduled_workout",
            {"event_id": "event-123", "confirm": False},
            ctx,
        )

        parsed = json.loads(result)
        assert parsed["error"] is True
        assert "confirm" in parsed["message"].lower()

    def test_requires_event_id(self, dispatcher, ctx):
        """Given missing event_id, when cancelling, then returns error."""
        result = dispatcher.execute(
            "cancel_scheduled_workout",
            {"confirm": True},
            ctx,
        )

        parsed = json.loads(result)
        assert parsed["error"] is True
        assert "event_id" in parsed["message"]


# ---------------------------------------------------------------------------
# sync_strava Tests (with rate limiting)
# ---------------------------------------------------------------------------


class TestSyncStrava:
    """E2E tests for sync_strava function with rate limiting."""

    def test_syncs_activities_successfully(self, dispatcher, ctx):
        """Given connected Strava, when syncing, then returns synced activities."""
        mock_response = {
            "synced_count": 2,
            "activities": [
                {"name": "Morning Run", "type": "Run", "distance_km": 5.2, "duration_minutes": 28},
                {"name": "Evening Cycle", "type": "Ride", "distance_km": 15.0, "duration_minutes": 45},
            ],
        }

        with patch.object(dispatcher, "_call_api", return_value=mock_response):
            result = dispatcher.execute(
                "sync_strava",
                {"days_back": 7},
                ctx,
            )

        assert "Synced 2 activity(ies)" in result
        assert "Morning Run" in result
        assert "Evening Cycle" in result

    def test_returns_message_when_no_activities(self, dispatcher, ctx):
        """Given no new activities, when syncing, then returns empty message."""
        with patch.object(
            dispatcher, "_call_api", return_value={"synced_count": 0, "activities": []}
        ):
            result = dispatcher.execute("sync_strava", {}, ctx)

        assert "No new activities" in result

    def test_rate_limit_allows_first_three_calls(self, dispatcher, ctx, fake_rate_limit_repo):
        """Given fresh window, when syncing 3 times, then all succeed."""
        with patch.object(
            dispatcher, "_call_api", return_value={"synced_count": 1, "activities": []}
        ):
            for i in range(3):
                result = dispatcher.execute("sync_strava", {}, ctx)
                assert "Synced" in result or "No new activities" in result

    def test_rate_limit_blocks_fourth_call(self, dispatcher, ctx, fake_rate_limit_repo):
        """Given 3 calls made, when syncing 4th time, then returns rate limit error."""
        # Simulate 3 successful calls
        fake_rate_limit_repo.set_count(TEST_USER_ID, "sync_strava", 3)

        result = dispatcher.execute("sync_strava", {}, ctx)

        parsed = json.loads(result)
        assert parsed["error"] is True
        assert parsed["code"] == "rate_limit_exceeded"
        assert "3 times per hour" in parsed["message"]

    def test_caps_days_back_at_30(self, dispatcher, ctx):
        """Given days_back > 30, when syncing, then caps at 30."""
        with patch.object(dispatcher, "_call_api") as mock_call:
            mock_call.return_value = {"synced_count": 0, "activities": []}
            dispatcher.execute("sync_strava", {"days_back": 100}, ctx)

            # Verify the API was called with capped value
            call_args = mock_call.call_args
            assert call_args[1]["json"]["days_back"] == 30


# ---------------------------------------------------------------------------
# sync_garmin Tests (with feature flag + rate limiting)
# ---------------------------------------------------------------------------


class TestSyncGarmin:
    """E2E tests for sync_garmin function with feature flag and rate limiting."""

    def test_syncs_workouts_when_enabled(self, dispatcher, ctx, fake_feature_flags):
        """Given garmin_sync enabled, when syncing, then returns success."""
        # Enable garmin_sync for user
        fake_feature_flags.enable_all_for_user(TEST_USER_ID)

        with patch.object(
            dispatcher, "_call_api", return_value={"synced_count": 2}
        ):
            result = dispatcher.execute(
                "sync_garmin",
                {"workout_ids": ["workout-1", "workout-2"]},
                ctx,
            )

        parsed = json.loads(result)
        assert parsed["success"] is True
        assert "Synced 2 workout(s)" in parsed["message"]

    def test_blocks_when_feature_disabled(self, dispatcher, ctx, fake_feature_flags):
        """Given garmin_sync disabled, when syncing, then returns feature error."""
        # Disable garmin_sync for user
        fake_feature_flags.disable_all_for_user(TEST_USER_ID)

        result = dispatcher.execute(
            "sync_garmin",
            {"workout_ids": ["workout-1"]},
            ctx,
        )

        parsed = json.loads(result)
        assert parsed["error"] is True
        assert parsed["code"] == "feature_disabled"
        assert "beta" in parsed["message"].lower()

    def test_rate_limit_applies_when_enabled(
        self, dispatcher, ctx, fake_rate_limit_repo, fake_feature_flags
    ):
        """Given feature enabled but rate limit exceeded, when syncing, then blocks."""
        fake_feature_flags.enable_all_for_user(TEST_USER_ID)
        fake_rate_limit_repo.set_count(TEST_USER_ID, "sync_garmin", 3)

        result = dispatcher.execute(
            "sync_garmin",
            {"workout_ids": ["workout-1"]},
            ctx,
        )

        parsed = json.loads(result)
        assert parsed["error"] is True
        assert parsed["code"] == "rate_limit_exceeded"

    def test_requires_workout_ids(self, dispatcher, ctx, fake_feature_flags):
        """Given no workout_ids, when syncing, then returns validation error."""
        fake_feature_flags.enable_all_for_user(TEST_USER_ID)

        result = dispatcher.execute("sync_garmin", {}, ctx)

        parsed = json.loads(result)
        assert parsed["error"] is True
        assert "workout_ids" in parsed["message"]


# ---------------------------------------------------------------------------
# get_strava_activities Tests
# ---------------------------------------------------------------------------


class TestGetStravaActivities:
    """E2E tests for get_strava_activities function."""

    def test_returns_recent_activities(self, dispatcher, ctx):
        """Given Strava activities, when fetching, then returns formatted list."""
        mock_response = [
            {
                "name": "Morning Run",
                "type": "Run",
                "start_date": "2026-01-29T07:00:00Z",
                "distance": 5200,  # meters
                "elapsed_time": 1680,  # seconds
            },
            {
                "name": "Lunch Walk",
                "type": "Walk",
                "start_date": "2026-01-28T12:00:00Z",
                "distance": 2000,
                "elapsed_time": 1200,
            },
        ]

        with patch.object(dispatcher, "_call_api", return_value=mock_response):
            result = dispatcher.execute(
                "get_strava_activities",
                {"limit": 10},
                ctx,
            )

        assert "Found 2 recent Strava activity(ies)" in result
        assert "Morning Run" in result
        assert "Lunch Walk" in result
        assert "5.2km" in result  # Distance converted from meters

    def test_returns_empty_message_when_no_activities(self, dispatcher, ctx):
        """Given no activities, when fetching, then returns empty message."""
        with patch.object(dispatcher, "_call_api", return_value=[]):
            result = dispatcher.execute("get_strava_activities", {}, ctx)

        assert "No recent Strava activities" in result

    def test_caps_limit_at_30(self, dispatcher, ctx):
        """Given limit > 30, when fetching, then caps at 30."""
        with patch.object(dispatcher, "_call_api") as mock_call:
            mock_call.return_value = []
            dispatcher.execute("get_strava_activities", {"limit": 100}, ctx)

            # Verify the API was called with capped value
            call_args = mock_call.call_args
            assert call_args[1]["params"]["limit"] == 30

    def test_defaults_to_10_activities(self, dispatcher, ctx):
        """Given no limit, when fetching, then defaults to 10."""
        with patch.object(dispatcher, "_call_api") as mock_call:
            mock_call.return_value = []
            dispatcher.execute("get_strava_activities", {}, ctx)

            call_args = mock_call.call_args
            assert call_args[1]["params"]["limit"] == 10


# ---------------------------------------------------------------------------
# Smoke Tests (Critical Path)
# ---------------------------------------------------------------------------


class TestPhase4SmokeTests:
    """Smoke tests covering the critical path for all Phase 4 functions."""

    def test_calendar_query_flow(self, dispatcher, ctx):
        """Smoke: Query calendar -> reschedule -> cancel flow."""
        # 1. Get calendar events
        with patch.object(
            dispatcher,
            "_call_api",
            return_value={
                "events": [{"id": "e1", "title": "Workout", "scheduled_date": "2026-01-29"}]
            },
        ):
            result = dispatcher.execute(
                "get_calendar_events",
                {"start_date": "2026-01-29", "end_date": "2026-01-31"},
                ctx,
            )
            assert "Found 1 scheduled" in result

        # 2. Reschedule the event
        with patch.object(dispatcher, "_call_api", return_value={}):
            result = dispatcher.execute(
                "reschedule_workout",
                {"event_id": "e1", "new_date": "2026-02-01"},
                ctx,
            )
            parsed = json.loads(result)
            assert parsed["success"] is True

        # 3. Cancel the event
        with patch.object(
            dispatcher,
            "_call_api",
            side_effect=[{"title": "Workout"}, {}],
        ):
            result = dispatcher.execute(
                "cancel_scheduled_workout",
                {"event_id": "e1", "confirm": True},
                ctx,
            )
            parsed = json.loads(result)
            assert parsed["success"] is True

    def test_strava_flow(self, dispatcher, ctx):
        """Smoke: Sync Strava -> view activities flow."""
        # 1. Sync from Strava
        with patch.object(
            dispatcher,
            "_call_api",
            return_value={"synced_count": 1, "activities": [{"name": "Run"}]},
        ):
            result = dispatcher.execute("sync_strava", {"days_back": 7}, ctx)
            assert "Synced 1" in result

        # 2. View activities
        with patch.object(
            dispatcher,
            "_call_api",
            return_value=[{"name": "Run", "type": "Run", "distance": 5000, "elapsed_time": 1800}],
        ):
            result = dispatcher.execute("get_strava_activities", {"limit": 5}, ctx)
            assert "Run" in result

    def test_all_phase4_functions_registered(self, dispatcher):
        """Smoke: Verify all Phase 4 functions are registered in dispatcher."""
        phase4_functions = [
            "get_calendar_events",
            "reschedule_workout",
            "cancel_scheduled_workout",
            "sync_strava",
            "sync_garmin",
            "get_strava_activities",
        ]

        for func_name in phase4_functions:
            assert func_name in dispatcher._handlers, f"{func_name} not registered"
