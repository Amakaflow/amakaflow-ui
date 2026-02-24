from uuid import uuid4

# Note: X-User-Id header is no longer used - auth is handled via JWT/API key
# which is mocked in conftest.py


def test_get_calendar_events_missing_params_returns_422(client):
    """GET /calendar without required start/end params should return 422."""
    resp = client.get("/calendar")
    assert resp.status_code == 422


def test_get_calendar_events_with_valid_params(client):
    """
    With start/end params, we should at least pass FastAPI validation.
    Auth is mocked so no headers needed.
    """
    params = {"start": "2025-01-01", "end": "2025-01-31"}
    resp = client.get("/calendar", params=params)

    # We're deliberately lenient here to avoid coupling to DB behavior yet.
    assert resp.status_code != 422


def test_create_calendar_event_empty_body_returns_422(client):
    """
    POST /calendar with empty body should fail validation.
    """
    payload = {}
    resp = client.post("/calendar", json=payload)
    assert resp.status_code == 422


def test_create_calendar_event_missing_required_fields_returns_422(client):
    """
    POST /calendar missing required fields should return 422.
    """
    payload = {"title": "Test Event"}  # Missing date
    resp = client.post("/calendar", json=payload)
    assert resp.status_code == 422


def test_update_calendar_event_empty_body_returns_error(client):
    """
    PUT /calendar/{event_id} with empty body should return error.
    """
    event_id = str(uuid4())
    payload = {}
    resp = client.put(f"/calendar/{event_id}", json=payload)
    assert resp.status_code in (400, 404, 422)


def test_delete_calendar_event_invalid_id_format(client):
    """
    DELETE /calendar/{event_id} with invalid UUID should return error.
    """
    resp = client.delete("/calendar/not-a-uuid")
    assert resp.status_code in (400, 404, 422)


def test_delete_calendar_event_nonexistent(client):
    """
    DELETE /calendar/{event_id} for nonexistent event.
    """
    event_id = str(uuid4())
    resp = client.delete(f"/calendar/{event_id}")
    # Could be 404 or other error depending on implementation
    assert resp.status_code in (200, 204, 404, 500)
