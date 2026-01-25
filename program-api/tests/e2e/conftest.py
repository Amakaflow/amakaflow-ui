"""
E2E test fixtures and configuration for program-api.

Part of AMA-460: Training Programs Schema

These fixtures provide:
- Real Supabase client for database verification
- HTTP client for API endpoint testing
- Test user setup/teardown
- Proper cleanup of test data after tests

Run with:
    pytest -m e2e tests/e2e/ -v
    pytest tests/e2e/ --live -v  # With live API
"""

import os
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Generator, List, Optional

import httpx
import pytest
from dotenv import load_dotenv
from supabase import Client, create_client


# Load environment variables from .env file
load_dotenv()


# =============================================================================
# Pytest CLI Options
# =============================================================================


def pytest_addoption(parser):
    """Add custom command line options for E2E tests."""
    parser.addoption(
        "--live",
        action="store_true",
        default=False,
        help="Run tests against live API (requires program-api running on port 8005)",
    )
    parser.addoption(
        "--api-url",
        action="store",
        default="http://localhost:8005",
        help="Base URL for the program-api service",
    )


# =============================================================================
# Mode and URL Fixtures
# =============================================================================


@pytest.fixture(scope="session")
def live_mode(request) -> bool:
    """Check if tests should run against live API."""
    return request.config.getoption("--live")


@pytest.fixture(scope="session")
def api_base_url(request) -> str:
    """Get the API base URL from command line or default."""
    return request.config.getoption("--api-url")


# =============================================================================
# Supabase Client Fixtures
# =============================================================================


@pytest.fixture(scope="session")
def supabase_url() -> str:
    """Get Supabase URL from environment."""
    url = os.getenv("SUPABASE_URL")
    if not url:
        pytest.skip("SUPABASE_URL environment variable not set")
    return url


@pytest.fixture(scope="session")
def supabase_key() -> str:
    """Get Supabase service role key from environment."""
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not key:
        pytest.skip("SUPABASE_SERVICE_ROLE_KEY environment variable not set")
    return key


@pytest.fixture(scope="session")
def supabase_client(supabase_url: str, supabase_key: str) -> Client:
    """
    Create a Supabase client for direct database access.

    Uses service role key to bypass RLS for test data management.
    """
    return create_client(supabase_url, supabase_key)


# =============================================================================
# HTTP Client Fixtures
# =============================================================================


@pytest.fixture(scope="session")
def http_client(api_base_url: str) -> Generator[httpx.Client, None, None]:
    """Create an HTTP client for API requests."""
    with httpx.Client(base_url=api_base_url, timeout=30.0) as client:
        yield client


# =============================================================================
# Test User Fixtures
# =============================================================================


@pytest.fixture(scope="session")
def test_user_id() -> str:
    """
    Generate a unique test user ID for the test session.

    Uses a UUID prefix to ensure test data can be identified and cleaned up.
    Format: e2e-test-user-<uuid>
    """
    return f"e2e-test-user-{uuid.uuid4().hex[:12]}"


@pytest.fixture(scope="session")
def another_test_user_id() -> str:
    """
    Generate a second test user ID for isolation tests.

    Used to verify users cannot access each other's programs.
    """
    return f"e2e-test-user-{uuid.uuid4().hex[:12]}"


@pytest.fixture(scope="session")
def auth_headers(test_user_id: str) -> Dict[str, str]:
    """
    Create authorization headers for the test user.

    Note: The current implementation uses the token as the user_id directly.
    This will be updated when proper Clerk JWT validation is implemented.
    """
    return {"Authorization": f"Bearer {test_user_id}"}


@pytest.fixture(scope="session")
def other_user_auth_headers(another_test_user_id: str) -> Dict[str, str]:
    """Create authorization headers for the second test user."""
    return {"Authorization": f"Bearer {another_test_user_id}"}


# =============================================================================
# Database Cleanup Fixtures
# =============================================================================


@pytest.fixture(scope="session")
def cleanup_test_data(supabase_client: Client, test_user_id: str, another_test_user_id: str):
    """
    Session-scoped fixture that cleans up test data after all tests complete.

    This runs once at the end of the test session.
    """
    # No setup needed - just yield
    yield

    # Cleanup: Delete all programs for test users
    # Due to cascade delete, this will also remove weeks and workouts
    for user_id in [test_user_id, another_test_user_id]:
        try:
            supabase_client.table("training_programs").delete().eq(
                "user_id", user_id
            ).execute()
        except Exception as e:
            # Log but don't fail on cleanup errors
            print(f"Warning: Failed to cleanup test data for {user_id}: {e}")


@pytest.fixture
def cleanup_program(supabase_client: Client):
    """
    Per-test fixture for cleaning up a specific program after test.

    Usage:
        def test_create_program(cleanup_program):
            program_id = create_program()
            cleanup_program(program_id)
            # Test assertions...

    The cleanup happens after the test completes, even on failure.
    """
    program_ids: List[str] = []

    def register_for_cleanup(program_id: str):
        program_ids.append(program_id)

    yield register_for_cleanup

    # Cleanup after test
    for program_id in program_ids:
        try:
            supabase_client.table("training_programs").delete().eq(
                "id", program_id
            ).execute()
        except Exception as e:
            print(f"Warning: Failed to cleanup program {program_id}: {e}")


# =============================================================================
# Test Data Factories
# =============================================================================


@pytest.fixture
def program_factory(test_user_id: str) -> callable:
    """
    Factory fixture to create test program data.

    Usage:
        def test_create_program(program_factory):
            data = program_factory(name="My Program")
    """
    def create_program_data(
        name: str = "E2E Test Program",
        description: str = "Test program for E2E testing",
        goal: str = "strength",
        experience_level: str = "intermediate",
        duration_weeks: int = 4,
        sessions_per_week: int = 3,
        equipment_available: Optional[List[str]] = None,
        status: str = "draft",
    ) -> Dict[str, Any]:
        return {
            "user_id": test_user_id,
            "name": name,
            "description": description,
            "goal": goal,
            "experience_level": experience_level,
            "duration_weeks": duration_weeks,
            "sessions_per_week": sessions_per_week,
            "equipment_available": equipment_available or ["barbell", "dumbbell"],
            "status": status,
        }

    return create_program_data


@pytest.fixture
def week_factory() -> callable:
    """
    Factory fixture to create test week data.

    Usage:
        def test_create_week(week_factory):
            data = week_factory(week_number=1)
    """
    def create_week_data(
        week_number: int = 1,
        name: Optional[str] = None,
        description: str = "Test week",
        deload: bool = False,
    ) -> Dict[str, Any]:
        return {
            "week_number": week_number,
            "name": name or f"Week {week_number}",
            "description": description,
            "deload": deload,
        }

    return create_week_data


@pytest.fixture
def workout_factory() -> callable:
    """
    Factory fixture to create test workout data.

    Usage:
        def test_create_workout(workout_factory):
            data = workout_factory(day_of_week=1, name="Push Day")
    """
    def create_workout_data(
        day_of_week: int = 1,
        name: str = "Test Workout",
        description: str = "Test workout description",
        order_index: int = 0,
        workout_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        data = {
            "day_of_week": day_of_week,
            "name": name,
            "description": description,
            "order_index": order_index,
        }
        if workout_id:
            data["workout_id"] = workout_id
        return data

    return create_workout_data


# =============================================================================
# Direct Database Fixtures for E2E Testing
# =============================================================================


@pytest.fixture
def create_program_in_db(supabase_client: Client, test_user_id: str, cleanup_program):
    """
    Create a program directly in the database for testing.

    Returns a function that creates a program and registers it for cleanup.
    """
    def _create(
        name: str = "E2E Test Program",
        goal: str = "strength",
        experience_level: str = "intermediate",
        duration_weeks: int = 4,
        sessions_per_week: int = 3,
        **kwargs
    ) -> Dict[str, Any]:
        data = {
            "user_id": test_user_id,
            "name": name,
            "goal": goal,
            "experience_level": experience_level,
            "duration_weeks": duration_weeks,
            "sessions_per_week": sessions_per_week,
            "equipment_available": kwargs.get("equipment_available", ["barbell"]),
            "status": kwargs.get("status", "draft"),
            **{k: v for k, v in kwargs.items() if k not in ["equipment_available", "status"]},
        }

        result = supabase_client.table("training_programs").insert(data).execute()
        program = result.data[0]
        cleanup_program(program["id"])
        return program

    return _create


@pytest.fixture
def create_week_in_db(supabase_client: Client):
    """Create a week directly in the database for testing."""
    def _create(
        program_id: str,
        week_number: int = 1,
        name: Optional[str] = None,
        deload: bool = False,
    ) -> Dict[str, Any]:
        data = {
            "program_id": program_id,
            "week_number": week_number,
            "name": name or f"Week {week_number}",
            "deload": deload,
        }
        result = supabase_client.table("program_weeks").insert(data).execute()
        return result.data[0]

    return _create


@pytest.fixture
def create_workout_in_db(supabase_client: Client):
    """Create a workout directly in the database for testing."""
    def _create(
        program_week_id: str,
        day_of_week: int = 1,
        name: str = "Test Workout",
        order_index: int = 0,
    ) -> Dict[str, Any]:
        data = {
            "program_week_id": program_week_id,
            "day_of_week": day_of_week,
            "name": name,
            "order_index": order_index,
        }
        result = supabase_client.table("program_workouts").insert(data).execute()
        return result.data[0]

    return _create


# =============================================================================
# Validation Fixtures
# =============================================================================


@pytest.fixture
def valid_program_goals() -> List[str]:
    """Valid program goal values."""
    return [
        "strength",
        "hypertrophy",
        "endurance",
        "weight_loss",
        "general_fitness",
        "sport_specific",
    ]


@pytest.fixture
def valid_experience_levels() -> List[str]:
    """Valid experience level values."""
    return ["beginner", "intermediate", "advanced"]


@pytest.fixture
def valid_program_statuses() -> List[str]:
    """Valid program status values."""
    return ["draft", "active", "completed", "archived"]
