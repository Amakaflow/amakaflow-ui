"""Tests for workout detection endpoint.

Tests for AMA-688: Auto-detection endpoint for matching
wearable-detected exercises against scheduled AmakaFlow workouts.

Usage:
    pytest tests/test_detection.py -v
"""

import pytest
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from unittest.mock import MagicMock, AsyncMock

from backend.main import create_app
from backend.settings import Settings
from backend.auth import get_current_user as backend_get_current_user
from api.deps import (
    get_current_user as deps_get_current_user,
    get_auth_context,
    AuthContext,
)
from api.schemas.detection import DetectionRequest, DetectionMatch
from application.use_cases.match_workout import (
    match_workout,
    ScheduledWorkout,
    ScheduledWorkoutRepository,
    calculate_schedule_proximity,
    calculate_exercise_overlap,
    calculate_sport_match,
    calculate_match_score,
)


TEST_USER_ID = "test-user-123"


# =============================================================================
# Fixtures
# =============================================================================


@pytest.fixture
def test_settings():
    """Test settings with minimal configuration."""
    return Settings(
        environment="test",
        supabase_url="https://test.supabase.co",
        supabase_service_role_key="test-key",
        _env_file=None,
    )


@pytest.fixture
def app(test_settings):
    """Create test application instance."""
    return create_app(settings=test_settings)


@pytest.fixture
def mock_auth():
    """Mock authentication returning test user."""
    async def _mock_auth():
        return TEST_USER_ID
    return _mock_auth


@pytest.fixture
def mock_auth_context():
    """Mock auth context."""
    async def _mock_auth_context():
        return AuthContext(user_id=TEST_USER_ID, auth_token="Bearer test-token")
    return _mock_auth_context


@pytest.fixture
def client(app, mock_auth, mock_auth_context):
    """Test client with auth mocked."""
    app.dependency_overrides[backend_get_current_user] = mock_auth
    app.dependency_overrides[deps_get_current_user] = mock_auth
    app.dependency_overrides[get_auth_context] = mock_auth_context
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def repo():
    """Create a fresh repository for each test."""
    return ScheduledWorkoutRepository()


# =============================================================================
# Test: Score Calculation Functions
# =============================================================================


class TestScoreCalculation:
    """Unit tests for scoring functions."""

    def test_schedule_proximity_within_1h(self):
        """Schedule proximity is 1.0 when within 1 hour."""
        detected = datetime(2026, 2, 21, 10, 0, 0)
        scheduled = datetime(2026, 2, 21, 10, 30, 0)
        
        result = calculate_schedule_proximity(detected, scheduled)
        
        assert result == 1.0

    def test_schedule_proximity_at_2h(self):
        """Schedule proximity decays linearly at 2 hours."""
        detected = datetime(2026, 2, 21, 10, 0, 0)
        scheduled = datetime(2026, 2, 21, 12, 0, 0)
        
        result = calculate_schedule_proximity(detected, scheduled)
        
        # At 2h (midpoint between 1h and 3h), should be 0.5
        assert result == 0.5

    def test_schedule_proximity_at_3h(self):
        """Schedule proximity is 0.0 at 3 hours or more."""
        detected = datetime(2026, 2, 21, 10, 0, 0)
        scheduled = datetime(2026, 2, 21, 13, 0, 0)
        
        result = calculate_schedule_proximity(detected, scheduled)
        
        assert result == 0.0

    def test_exercise_overlap_perfect_match(self):
        """Exercise overlap is 1.0 when exercises are identical."""
        detected = ["squat", "deadlift", "bench"]
        program = ["squat", "deadlift", "bench"]
        
        result = calculate_exercise_overlap(detected, program)
        
        assert result == 1.0

    def test_exercise_overlap_partial_match(self):
        """Exercise overlap is correct for partial matches."""
        detected = ["squat", "deadlift"]
        program = ["squat", "deadlift", "bench"]
        
        result = calculate_exercise_overlap(detected, program)
        
        # Jaccard: 2 / 3 = 0.667
        assert abs(result - 0.667) < 0.01

    def test_exercise_overlap_no_match(self):
        """Exercise overlap is 0.0 when no exercises match."""
        detected = ["squat"]
        program = ["bench", "curl"]
        
        result = calculate_exercise_overlap(detected, program)
        
        assert result == 0.0

    def test_sport_match_same(self):
        """Sport match is 1.0 when sports are the same."""
        result = calculate_sport_match("strength", "strength")
        
        assert result == 1.0

    def test_sport_match_different(self):
        """Sport match is 0.0 when sports are different."""
        result = calculate_sport_match("strength", "running")
        
        assert result == 0.0

    def test_calculate_match_score_high_confidence(self):
        """Match score > 0.85 with good proximity, exercise overlap, and sport match."""
        score = calculate_match_score(
            detected_time=datetime(2026, 2, 21, 10, 0, 0),
            scheduled_time=datetime(2026, 2, 21, 10, 30, 0),  # 0.5h proximity = 1.0
            detected_exercises=["squat", "deadlift", "bench"],
            program_exercises=["squat", "deadlift", "bench"],  # Perfect overlap = 1.0
            detected_sport="strength",
            workout_sport="strength"  # 1.0 sport match
        )
        
        # 1.0 * 0.35 + 1.0 * 0.45 + 1.0 * 0.20 = 1.0
        assert score > 0.85

    def test_calculate_match_score_low_confidence(self):
        """Match score <= 0.85 with poor exercise overlap."""
        score = calculate_match_score(
            detected_time=datetime(2026, 2, 21, 10, 0, 0),
            scheduled_time=datetime(2026, 2, 21, 14, 0, 0),  # 4h proximity = 0.0
            detected_exercises=["squat"],
            program_exercises=["bench", "curl"],  # 0.0 overlap
            detected_sport="strength",
            workout_sport="running"  # 0.0 sport match
        )
        
        # 0.0 * 0.35 + 0.0 * 0.45 + 0.0 * 0.20 = 0.0
        assert score <= 0.85


# =============================================================================
# Test: Match Workout Use Case
# =============================================================================


class TestMatchWorkout:
    """Tests for match_workout use case function."""

    @pytest.mark.asyncio
    async def test_matched_workout_within_1h_sport_and_exercises(self, repo):
        """Matched when workout within 1h, sport matches, and exercise overlap high."""
        # Add a scheduled workout with perfect exercise overlap
        workout = ScheduledWorkout(
            id="w-123",
            name="Leg Day",
            sport="strength",
            scheduled_time=datetime(2026, 2, 21, 10, 30, 0),
            exercises=["squat", "deadlift"]  # Perfect overlap with detected
        )
        repo.add_workout(workout)
        
        request = DetectionRequest(
            user_id=TEST_USER_ID,
            device="apple_watch",
            timestamp=datetime(2026, 2, 21, 10, 0, 0),
            sport="strength",
            detected_exercises=["squat", "deadlift"]
        )
        
        result = await match_workout(request, repo)
        
        assert result.matched is True
        assert result.workout_id == "w-123"
        assert result.workout_name == "Leg Day"
        assert result.confidence is not None
        assert result.confidence > 0.85

    @pytest.mark.asyncio
    async def test_no_match_no_scheduled_workout(self, repo):
        """Returns no_scheduled_workout when no workouts in window."""
        request = DetectionRequest(
            user_id=TEST_USER_ID,
            device="apple_watch",
            timestamp=datetime(2026, 2, 21, 10, 0, 0),
            sport="strength",
            detected_exercises=["squat", "deadlift"]
        )
        
        result = await match_workout(request, repo)
        
        assert result.matched is False
        assert result.reason == "no_scheduled_workout"

    @pytest.mark.asyncio
    async def test_no_match_sport_mismatch(self, repo):
        """Returns sport_mismatch when sport doesn't match."""
        workout = ScheduledWorkout(
            id="w-456",
            name="Cardio Session",
            sport="cardio",
            scheduled_time=datetime(2026, 2, 21, 10, 30, 0),
            exercises=["running", "jumping_jacks"]
        )
        repo.add_workout(workout)
        
        request = DetectionRequest(
            user_id=TEST_USER_ID,
            device="apple_watch",
            timestamp=datetime(2026, 2, 21, 10, 0, 0),
            sport="strength",
            detected_exercises=["squat", "deadlift"]
        )
        
        result = await match_workout(request, repo)
        
        assert result.matched is False
        assert result.reason == "sport_mismatch"

    @pytest.mark.asyncio
    async def test_no_match_low_confidence(self, repo):
        """Returns low_confidence when workouts found but score <= 0.85."""
        # Add a workout with low exercise overlap
        workout = ScheduledWorkout(
            id="w-789",
            name="Upper Body",
            sport="strength",
            scheduled_time=datetime(2026, 2, 21, 10, 30, 0),
            exercises=["bench", "curl"]  # No overlap with squat, deadlift
        )
        repo.add_workout(workout)
        
        request = DetectionRequest(
            user_id=TEST_USER_ID,
            device="apple_watch",
            timestamp=datetime(2026, 2, 21, 10, 0, 0),
            sport="strength",
            detected_exercises=["squat", "deadlift"]
        )
        
        result = await match_workout(request, repo)
        
        assert result.matched is False
        assert result.reason == "low_confidence"
        assert result.confidence is not None
        assert result.confidence <= 0.85


# =============================================================================
# Test: Detection Endpoint
# =============================================================================


class TestDetectionEndpoint:
    """Integration tests for POST /api/workouts/detect endpoint."""

    def test_detection_endpoint_requires_auth(self, app):
        """Unauthenticated request returns 401."""
        client = TestClient(app)
        
        response = client.post(
            "/api/workouts/detect",
            json={
                "user_id": TEST_USER_ID,
                "device": "apple_watch",
                "timestamp": "2026-02-21T10:00:00",
                "sport": "strength",
                "detected_exercises": ["squat", "deadlift"]
            }
        )
        
        assert response.status_code == 401

    def test_detection_endpoint_returns_match(self, client, repo):
        """Returns matched:true with workout details when score > 0.85."""
        # Override the repo dependency
        from application.use_cases import match_workout
        original_repo = match_workout._workout_repo
        match_workout._workout_repo = repo
        
        try:
            # Add a matching workout with perfect exercise overlap
            workout = ScheduledWorkout(
                id="w-123",
                name="Leg Day",
                sport="strength",
                scheduled_time=datetime(2026, 2, 21, 10, 30, 0),
                exercises=["squat", "deadlift"]  # Perfect overlap
            )
            repo.add_workout(workout)
            
            response = client.post(
                "/api/workouts/detect",
                json={
                    "user_id": TEST_USER_ID,
                    "device": "apple_watch",
                    "timestamp": "2026-02-21T10:00:00",
                    "sport": "strength",
                    "detected_exercises": ["squat", "deadlift"]
                }
            )
            
            assert response.status_code == 200
            data = response.json()
            assert data["matched"] is True
            assert data["workout_id"] == "w-123"
            assert data["workout_name"] == "Leg Day"
            assert data["confidence"] > 0.85
        finally:
            match_workout._workout_repo = original_repo

    def test_detection_endpoint_returns_no_scheduled_workout(self, client, repo):
        """Returns matched:false with reason:no_scheduled_workout when no workouts."""
        from application.use_cases import match_workout
        original_repo = match_workout._workout_repo
        match_workout._workout_repo = repo
        
        try:
            response = client.post(
                "/api/workouts/detect",
                json={
                    "user_id": TEST_USER_ID,
                    "device": "apple_watch",
                    "timestamp": "2026-02-21T10:00:00",
                    "sport": "strength",
                    "detected_exercises": ["squat", "deadlift"]
                }
            )
            
            assert response.status_code == 200
            data = response.json()
            assert data["matched"] is False
            assert data["reason"] == "no_scheduled_workout"
        finally:
            match_workout._workout_repo = original_repo

    def test_detection_endpoint_returns_sport_mismatch(self, client, repo):
        """Returns matched:false with reason:sport_mismatch when sport doesn't match."""
        from application.use_cases import match_workout
        original_repo = match_workout._workout_repo
        match_workout._workout_repo = repo
        
        try:
            # Add a cardio workout
            workout = ScheduledWorkout(
                id="w-456",
                name="Cardio",
                sport="cardio",
                scheduled_time=datetime(2026, 2, 21, 10, 30, 0),
                exercises=["running"]
            )
            repo.add_workout(workout)
            
            response = client.post(
                "/api/workouts/detect",
                json={
                    "user_id": TEST_USER_ID,
                    "device": "apple_watch",
                    "timestamp": "2026-02-21T10:00:00",
                    "sport": "strength",
                    "detected_exercises": ["squat"]
                }
            )
            
            assert response.status_code == 200
            data = response.json()
            assert data["matched"] is False
            assert data["reason"] == "sport_mismatch"
        finally:
            match_workout._workout_repo = original_repo

    def test_detection_endpoint_returns_low_confidence(self, client, repo):
        """Returns matched:false with reason:low_confidence when score <= 0.85."""
        from application.use_cases import match_workout
        original_repo = match_workout._workout_repo
        match_workout._workout_repo = repo
        
        try:
            # Add a workout with no exercise overlap but matching sport
            workout = ScheduledWorkout(
                id="w-789",
                name="Upper Body",
                sport="strength",
                scheduled_time=datetime(2026, 2, 21, 10, 30, 0),
                exercises=["bench", "curl"]
            )
            repo.add_workout(workout)
            
            response = client.post(
                "/api/workouts/detect",
                json={
                    "user_id": TEST_USER_ID,
                    "device": "apple_watch",
                    "timestamp": "2026-02-21T10:00:00",
                    "sport": "strength",
                    "detected_exercises": ["squat", "deadlift"]
                }
            )
            
            assert response.status_code == 200
            data = response.json()
            assert data["matched"] is False
            assert data["reason"] == "low_confidence"
            assert data["confidence"] <= 0.85
        finally:
            match_workout._workout_repo = original_repo


# =============================================================================
# Test: Validation
# =============================================================================


class TestDetectionRequestValidation:
    """Tests for request validation."""

    def test_valid_request(self, client, mock_auth, mock_auth_context, app):
        """Valid request is accepted."""
        app.dependency_overrides[backend_get_current_user] = mock_auth
        app.dependency_overrides[deps_get_current_user] = mock_auth
        app.dependency_overrides[get_auth_context] = mock_auth_context
        
        response = client.post(
            "/api/workouts/detect",
            json={
                "user_id": TEST_USER_ID,
                "device": "apple_watch",
                "timestamp": "2026-02-21T10:00:00",
                "sport": "strength",
                "detected_exercises": ["squat"]
            }
        )
        
        # Should not return 422 (validation error)
        assert response.status_code != 422
        app.dependency_overrides.clear()

    def test_missing_required_fields(self, client, mock_auth, mock_auth_context, app):
        """Missing required fields returns 422."""
        app.dependency_overrides[backend_get_current_user] = mock_auth
        app.dependency_overrides[deps_get_current_user] = mock_auth
        app.dependency_overrides[get_auth_context] = mock_auth_context
        
        response = client.post(
            "/api/workouts/detect",
            json={}
        )
        
        assert response.status_code == 422
        app.dependency_overrides.clear()
