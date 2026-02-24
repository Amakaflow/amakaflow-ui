"""
Regression tests for workout endpoints before/after migration cleanup.

Verifies all workout endpoints are routed (not "route not found") regardless of
whether they are served by the legacy backend/app.py or the new api/routers/workouts.py.

Part of AMA-584: Remove duplicate workout endpoints from app.py.
"""

import pytest
from fastapi.testclient import TestClient


def _is_route_found(resp) -> bool:
    """Return True if the endpoint is registered (even if handler returns 404 for business reasons).

    FastAPI returns ``{"detail": "Not Found"}`` for unregistered routes, while
    business-logic 404s include a specific detail message (e.g.
    "Workout not found", "No pending sync found for this workout").

    We also accept 405 Method Not Allowed, which means the route exists but with
    a different HTTP method.
    """
    if resp.status_code != 404:
        return True
    # 404 from a handler has a more specific detail than the generic "Not Found"
    try:
        detail = resp.json().get("detail", "")
    except Exception:
        return False
    return detail != "Not Found"


@pytest.mark.integration
class TestWorkoutEndpointsExist:
    """Verify all workout endpoints are routed before and after migration cleanup."""

    # ---- Workout CRUD ----

    def test_save_workout(self, api_client: TestClient):
        resp = api_client.post(
            "/workouts/save",
            json={
                "workout_data": {"blocks": [], "title": "test"},
                "sources": [],
                "device": "web",
            },
        )
        assert _is_route_found(resp), f"POST /workouts/save not routed (got {resp.status_code})"

    def test_list_workouts(self, api_client: TestClient):
        resp = api_client.get("/workouts")
        assert _is_route_found(resp), f"GET /workouts not routed (got {resp.status_code})"

    def test_get_workout(self, api_client: TestClient):
        resp = api_client.get("/workouts/test-id-123")
        assert _is_route_found(resp), f"GET /workouts/{{id}} not routed (got {resp.status_code})"

    def test_delete_workout(self, api_client: TestClient):
        resp = api_client.delete("/workouts/test-id-123")
        assert _is_route_found(resp), f"DELETE /workouts/{{id}} not routed (got {resp.status_code})"

    def test_export_status(self, api_client: TestClient):
        resp = api_client.put(
            "/workouts/test-id-123/export-status",
            json={"is_exported": True},
        )
        assert _is_route_found(resp), f"PUT /workouts/{{id}}/export-status not routed (got {resp.status_code})"

    def test_favorite_workout(self, api_client: TestClient):
        resp = api_client.patch(
            "/workouts/test-id-123/favorite",
            json={"profile_id": "test-user-123", "is_favorite": True},
        )
        assert _is_route_found(resp), f"PATCH /workouts/{{id}}/favorite not routed (got {resp.status_code})"

    def test_used_workout(self, api_client: TestClient):
        resp = api_client.patch(
            "/workouts/test-id-123/used",
            json={"profile_id": "test-user-123"},
        )
        assert _is_route_found(resp), f"PATCH /workouts/{{id}}/used not routed (got {resp.status_code})"

    def test_tags_workout(self, api_client: TestClient):
        resp = api_client.patch(
            "/workouts/test-id-123/tags",
            json={"profile_id": "test-user-123", "tags": ["strength"]},
        )
        assert _is_route_found(resp), f"PATCH /workouts/{{id}}/tags not routed (got {resp.status_code})"

    def test_incoming_workouts(self, api_client: TestClient):
        resp = api_client.get("/workouts/incoming")
        assert _is_route_found(resp), f"GET /workouts/incoming not routed (got {resp.status_code})"

    # ---- Sync Queue (NOT in workouts router yet -- should remain in app.py) ----

    def test_sync_pending(self, api_client: TestClient):
        resp = api_client.get("/sync/pending?device_type=ios")
        assert _is_route_found(resp), f"GET /sync/pending not routed (got {resp.status_code})"

    def test_sync_confirm(self, api_client: TestClient):
        resp = api_client.post(
            "/sync/confirm",
            json={"workout_id": "test-id-123", "device_type": "ios"},
        )
        assert _is_route_found(resp), f"POST /sync/confirm not routed (got {resp.status_code})"

    def test_sync_failed(self, api_client: TestClient):
        resp = api_client.post(
            "/sync/failed",
            json={"workout_id": "test-id-123", "device_type": "ios", "error": "test"},
        )
        assert _is_route_found(resp), f"POST /sync/failed not routed (got {resp.status_code})"

    def test_workout_sync_status(self, api_client: TestClient):
        resp = api_client.get("/workouts/test-id-123/sync-status")
        assert _is_route_found(resp), f"GET /workouts/{{id}}/sync-status not routed (got {resp.status_code})"

    def test_queue_workout_sync(self, api_client: TestClient):
        resp = api_client.post(
            "/workouts/test-id-123/sync",
            json={"device_type": "ios"},
        )
        assert _is_route_found(resp), f"POST /workouts/{{id}}/sync not routed (got {resp.status_code})"

    # ---- Push endpoints (NOT in workouts router yet -- should remain in app.py) ----

    def test_push_ios_companion(self, api_client: TestClient):
        resp = api_client.post(
            "/workouts/test-id-123/push/ios-companion",
            json={},
        )
        assert _is_route_found(resp), f"POST /workouts/{{id}}/push/ios-companion not routed (got {resp.status_code})"

    def test_push_android_companion(self, api_client: TestClient):
        resp = api_client.post(
            "/workouts/test-id-123/push/android-companion",
            json={},
        )
        assert _is_route_found(resp), f"POST /workouts/{{id}}/push/android-companion not routed (got {resp.status_code})"

    def test_ios_companion_pending(self, api_client: TestClient):
        resp = api_client.get("/ios-companion/pending")
        assert _is_route_found(resp), f"GET /ios-companion/pending not routed (got {resp.status_code})"

    def test_android_companion_pending(self, api_client: TestClient):
        resp = api_client.get("/android-companion/pending")
        assert _is_route_found(resp), f"GET /android-companion/pending not routed (got {resp.status_code})"
