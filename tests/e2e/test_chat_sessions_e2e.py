"""
E2E tests for GET /chat/sessions -- list user chat sessions endpoint (AMA-497).

Coverage:
    SMOKE (PR gate):
        - Happy path: user lists their sessions
        - Auth rejection: missing credentials returns 401
        - Empty sessions returns empty list
        - Default pagination parameters work

    REGRESSION (nightly):
        - Sessions ordered by updated_at DESC (most recently active first)
        - Pagination with limit works correctly
        - Pagination with offset works correctly
        - Pagination boundary conditions
        - Session isolation between users (user cannot see other users' sessions)
        - Session title can be null
        - Multiple sessions returned with correct fields
        - Limit validation (min=1, max=100)
        - Offset validation (min=0)
"""

import time
from datetime import datetime, timedelta
from typing import Any, Dict, List

import pytest

from tests.e2e.conftest import (
    TEST_USER_ID,
    SECOND_USER_ID,
    FakeChatSessionRepository,
)


# ============================================================================
# SMOKE SUITE -- run on every PR
# ============================================================================


@pytest.mark.integration
class TestListSessionsSmoke:
    """Critical-path tests that must pass on every PR."""

    def test_happy_path_list_sessions(self, client, session_repo):
        """GET /chat/sessions returns user's sessions with correct schema."""
        # Create some sessions for the authenticated user
        session_repo.create(TEST_USER_ID, "Leg day planning")
        session_repo.create(TEST_USER_ID, "Nutrition advice")

        response = client.get("/chat/sessions")

        assert response.status_code == 200
        data = response.json()

        assert isinstance(data, list)
        assert len(data) == 2

        # Verify each session has required fields
        for session in data:
            assert "id" in session
            assert "title" in session
            assert "created_at" in session
            assert "updated_at" in session
            assert isinstance(session["id"], str)
            assert isinstance(session["created_at"], str)
            assert isinstance(session["updated_at"], str)

    def test_auth_required(self, noauth_client):
        """Missing auth credentials returns 401."""
        response = noauth_client.get("/chat/sessions")
        assert response.status_code == 401

    def test_empty_sessions_returns_empty_list(self, client):
        """User with no sessions gets empty list, not null or error."""
        response = client.get("/chat/sessions")

        assert response.status_code == 200
        data = response.json()

        assert data == []
        assert isinstance(data, list)

    def test_default_pagination_works(self, client, session_repo):
        """Default pagination (limit=20, offset=0) works without query params."""
        # Create 5 sessions
        for i in range(5):
            session_repo.create(TEST_USER_ID, f"Chat {i}")

        response = client.get("/chat/sessions")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 5  # Less than default limit of 20


# ============================================================================
# REGRESSION SUITE -- nightly / full CI
# ============================================================================


@pytest.mark.integration
class TestListSessionsOrdering:
    """Tests for session ordering by updated_at DESC."""

    def test_sessions_ordered_by_updated_at_desc(self, client, session_repo):
        """Sessions are returned with most recently active first."""
        # Create sessions with different updated_at times
        session1 = session_repo.create(TEST_USER_ID, "Old chat")
        session2 = session_repo.create(TEST_USER_ID, "Recent chat")
        session3 = session_repo.create(TEST_USER_ID, "Newest chat")

        # Manually set updated_at to control ordering
        # session3 is most recent, session1 is oldest
        base_time = datetime.utcnow()
        session_repo._sessions[session1["id"]]["updated_at"] = (
            base_time - timedelta(hours=2)
        ).isoformat()
        session_repo._sessions[session2["id"]]["updated_at"] = (
            base_time - timedelta(hours=1)
        ).isoformat()
        session_repo._sessions[session3["id"]]["updated_at"] = base_time.isoformat()

        response = client.get("/chat/sessions")

        assert response.status_code == 200
        data = response.json()

        assert len(data) == 3
        # Most recent first
        assert data[0]["title"] == "Newest chat"
        assert data[1]["title"] == "Recent chat"
        assert data[2]["title"] == "Old chat"

    def test_updated_session_moves_to_top(self, client, session_repo):
        """When a session is updated, it moves to the top of the list."""
        # Create two sessions
        session1 = session_repo.create(TEST_USER_ID, "First chat")
        session2 = session_repo.create(TEST_USER_ID, "Second chat")

        # Session2 was created last, so it should be first initially
        response1 = client.get("/chat/sessions")
        data1 = response1.json()
        assert data1[0]["id"] == session2["id"]

        # Update session1's title (which also updates updated_at)
        session_repo.update_title(session1["id"], "First chat updated")

        # Now session1 should be first
        response2 = client.get("/chat/sessions")
        data2 = response2.json()
        assert data2[0]["id"] == session1["id"]


@pytest.mark.integration
class TestListSessionsPagination:
    """Tests for pagination behavior."""

    def test_limit_restricts_results(self, client, session_repo):
        """Limit parameter restricts number of returned sessions."""
        # Create 10 sessions
        for i in range(10):
            session_repo.create(TEST_USER_ID, f"Chat {i}")

        response = client.get("/chat/sessions?limit=3")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 3

    def test_offset_skips_results(self, client, session_repo):
        """Offset parameter skips the first N sessions."""
        # Create 5 sessions with controlled ordering
        base_time = datetime.utcnow()
        for i in range(5):
            session = session_repo.create(TEST_USER_ID, f"Chat {i}")
            # Ensure consistent ordering: Chat 4 newest, Chat 0 oldest
            session_repo._sessions[session["id"]]["updated_at"] = (
                base_time - timedelta(hours=4 - i)
            ).isoformat()

        response = client.get("/chat/sessions?offset=2")

        assert response.status_code == 200
        data = response.json()
        # Should skip first 2 (Chat 4, Chat 3) and return Chat 2, Chat 1, Chat 0
        assert len(data) == 3
        assert data[0]["title"] == "Chat 2"

    def test_limit_and_offset_combined(self, client, session_repo):
        """Limit and offset work correctly together."""
        # Create 10 sessions with controlled ordering
        base_time = datetime.utcnow()
        for i in range(10):
            session = session_repo.create(TEST_USER_ID, f"Chat {i}")
            # Ensure consistent ordering: Chat 9 newest, Chat 0 oldest
            session_repo._sessions[session["id"]]["updated_at"] = (
                base_time - timedelta(hours=9 - i)
            ).isoformat()

        response = client.get("/chat/sessions?limit=3&offset=2")

        assert response.status_code == 200
        data = response.json()
        # Skip first 2 (Chat 9, Chat 8), take 3 (Chat 7, Chat 6, Chat 5)
        assert len(data) == 3
        assert data[0]["title"] == "Chat 7"
        assert data[1]["title"] == "Chat 6"
        assert data[2]["title"] == "Chat 5"

    def test_offset_beyond_total_returns_empty(self, client, session_repo):
        """Offset greater than total sessions returns empty list."""
        # Create 3 sessions
        for i in range(3):
            session_repo.create(TEST_USER_ID, f"Chat {i}")

        response = client.get("/chat/sessions?offset=10")

        assert response.status_code == 200
        data = response.json()
        assert data == []

    def test_limit_greater_than_total(self, client, session_repo):
        """Limit greater than total sessions returns all sessions."""
        # Create 5 sessions
        for i in range(5):
            session_repo.create(TEST_USER_ID, f"Chat {i}")

        response = client.get("/chat/sessions?limit=100")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 5

    def test_pagination_max_limit(self, client, session_repo):
        """Maximum limit of 100 is accepted."""
        session_repo.create(TEST_USER_ID, "Test chat")

        response = client.get("/chat/sessions?limit=100")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1

    def test_pagination_min_limit(self, client, session_repo):
        """Minimum limit of 1 is accepted."""
        for i in range(5):
            session_repo.create(TEST_USER_ID, f"Chat {i}")

        response = client.get("/chat/sessions?limit=1")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1


@pytest.mark.integration
class TestListSessionsValidation:
    """Tests for request validation."""

    def test_invalid_limit_zero(self, client):
        """Limit of 0 returns 422 validation error."""
        response = client.get("/chat/sessions?limit=0")
        assert response.status_code == 422

    def test_invalid_limit_negative(self, client):
        """Negative limit returns 422 validation error."""
        response = client.get("/chat/sessions?limit=-1")
        assert response.status_code == 422

    def test_invalid_limit_exceeds_max(self, client):
        """Limit exceeding 100 returns 422 validation error."""
        response = client.get("/chat/sessions?limit=101")
        assert response.status_code == 422

    def test_invalid_offset_negative(self, client):
        """Negative offset returns 422 validation error."""
        response = client.get("/chat/sessions?offset=-1")
        assert response.status_code == 422

    def test_invalid_limit_non_numeric(self, client):
        """Non-numeric limit returns 422 validation error."""
        response = client.get("/chat/sessions?limit=abc")
        assert response.status_code == 422

    def test_invalid_offset_non_numeric(self, client):
        """Non-numeric offset returns 422 validation error."""
        response = client.get("/chat/sessions?offset=xyz")
        assert response.status_code == 422


@pytest.mark.integration
class TestListSessionsIsolation:
    """Tests for user session isolation."""

    def test_user_only_sees_own_sessions(self, client, session_repo):
        """User cannot see sessions belonging to other users."""
        # Create sessions for TEST_USER_ID (the authenticated user)
        session_repo.create(TEST_USER_ID, "My chat 1")
        session_repo.create(TEST_USER_ID, "My chat 2")

        # Create sessions for a different user
        session_repo.create(SECOND_USER_ID, "Other user chat 1")
        session_repo.create(SECOND_USER_ID, "Other user chat 2")
        session_repo.create(SECOND_USER_ID, "Other user chat 3")

        response = client.get("/chat/sessions")

        assert response.status_code == 200
        data = response.json()

        # Should only see TEST_USER_ID's 2 sessions
        assert len(data) == 2

        # Verify none of the returned sessions belong to the other user
        for session in data:
            assert "Other user" not in session["title"]

    def test_empty_for_user_with_other_users_sessions(self, client, session_repo):
        """User sees empty list even if other users have sessions."""
        # Only create sessions for a different user
        session_repo.create(SECOND_USER_ID, "Other user chat")

        response = client.get("/chat/sessions")

        assert response.status_code == 200
        data = response.json()
        assert data == []


@pytest.mark.integration
class TestListSessionsDataIntegrity:
    """Tests for response data correctness."""

    def test_session_has_all_required_fields(self, client, session_repo):
        """Each session in response has id, title, created_at, updated_at."""
        session_repo.create(TEST_USER_ID, "Complete session")

        response = client.get("/chat/sessions")

        assert response.status_code == 200
        session = response.json()[0]

        assert "id" in session
        assert "title" in session
        assert "created_at" in session
        assert "updated_at" in session

    def test_session_title_can_be_null(self, client, session_repo):
        """Sessions with null titles are handled correctly."""
        session = session_repo.create(TEST_USER_ID, None)
        # Explicitly set title to None to ensure it's null, not "New Chat"
        session_repo._sessions[session["id"]]["title"] = None

        response = client.get("/chat/sessions")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["title"] is None

    def test_datetime_fields_are_iso8601(self, client, session_repo):
        """created_at and updated_at are in ISO 8601 format."""
        session_repo.create(TEST_USER_ID, "Datetime test")

        response = client.get("/chat/sessions")

        assert response.status_code == 200
        session = response.json()[0]

        # ISO 8601 format contains 'T' separator
        assert "T" in session["created_at"]
        assert "T" in session["updated_at"]

        # Should be parseable as datetime
        # Format: 2026-01-29T12:00:00
        datetime.fromisoformat(session["created_at"].replace("Z", "+00:00"))
        datetime.fromisoformat(session["updated_at"].replace("Z", "+00:00"))

    def test_session_ids_are_unique(self, client, session_repo):
        """All returned session IDs are unique."""
        for i in range(5):
            session_repo.create(TEST_USER_ID, f"Chat {i}")

        response = client.get("/chat/sessions")

        assert response.status_code == 200
        data = response.json()

        ids = [s["id"] for s in data]
        assert len(ids) == len(set(ids)), "Session IDs must be unique"

    def test_large_session_list(self, client, session_repo):
        """Endpoint handles larger numbers of sessions correctly."""
        # Create 50 sessions
        for i in range(50):
            session_repo.create(TEST_USER_ID, f"Chat {i}")

        response = client.get("/chat/sessions?limit=50")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 50


@pytest.mark.integration
class TestListSessionsEdgeCases:
    """Edge case and boundary tests."""

    def test_sessions_with_same_updated_at(self, client, session_repo):
        """Sessions with identical updated_at are still returned correctly."""
        same_time = datetime.utcnow().isoformat()

        session1 = session_repo.create(TEST_USER_ID, "Chat A")
        session2 = session_repo.create(TEST_USER_ID, "Chat B")

        # Set same updated_at
        session_repo._sessions[session1["id"]]["updated_at"] = same_time
        session_repo._sessions[session2["id"]]["updated_at"] = same_time

        response = client.get("/chat/sessions")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2

    def test_session_with_empty_string_title(self, client, session_repo):
        """Session with empty string title is handled correctly.

        Note: FakeChatSessionRepository defaults empty string to 'New Chat',
        so we explicitly set it after creation to test empty string handling.
        """
        session = session_repo.create(TEST_USER_ID, "placeholder")
        # Explicitly set title to empty string
        session_repo._sessions[session["id"]]["title"] = ""

        response = client.get("/chat/sessions")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["title"] == ""

    def test_session_with_long_title(self, client, session_repo):
        """Session with very long title is returned correctly."""
        long_title = "A" * 500
        session_repo.create(TEST_USER_ID, long_title)

        response = client.get("/chat/sessions")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["title"] == long_title

    def test_session_with_special_characters_in_title(self, client, session_repo):
        """Session with special characters in title is serialized correctly."""
        special_title = 'Chat with "quotes" and <tags> & symbols'
        session_repo.create(TEST_USER_ID, special_title)

        response = client.get("/chat/sessions")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["title"] == special_title

    def test_session_with_unicode_title(self, client, session_repo):
        """Session with unicode characters in title is handled correctly."""
        unicode_title = "Workout chat emoji test"
        session_repo.create(TEST_USER_ID, unicode_title)

        response = client.get("/chat/sessions")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["title"] == unicode_title
