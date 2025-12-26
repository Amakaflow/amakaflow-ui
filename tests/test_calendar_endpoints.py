from uuid import uuid4

BASE_HEADERS = {"X-User-Id": "test-user"}


def test_get_calendar_events_missing_all_params_returns_422(client):
    resp = client.get("/calendar")
    assert resp.status_code == 422


def test_get_calendar_events_missing_header_returns_422(client):
    params = {"start": "2025-01-01", "end": "2025-01-31"}
    resp = client.get("/calendar", params=params)
    assert resp.status_code == 422


def test_get_calendar_events_with_valid_params_and_header_does_not_return_422(client):
    """
    With start/end and X-User-Id, we should at least pass FastAPI validation.
    Later, once DB is fully wired, tighten this to assert 200 + response shape.
    """
    params = {"start": "2025-01-01", "end": "2025-01-31"}
    resp = client.get("/calendar", params=params, headers=BASE_HEADERS)

    # We're deliberately lenient here to avoid coupling to DB behavior yet.
    assert resp.status_code != 422


def test_create_calendar_event_missing_header_returns_422(client):
    """
    POST /calendar without X-User-Id header should fail validation.
    """
    payload = {}
    resp = client.post("/calendar", json=payload)
    assert resp.status_code == 422


def test_create_calendar_event_with_header_but_invalid_body_returns_422(client):
    """
    POST /calendar with header but invalid body should still fail validation.
    This proves header is accepted and body is being validated.
    """
    payload = {}
    resp = client.post("/calendar", json=payload, headers=BASE_HEADERS)
    assert resp.status_code == 422


def test_update_calendar_event_missing_header_returns_422(client):
    event_id = str(uuid4())
    payload = {}
    resp = client.put(f"/calendar/{event_id}", json=payload)
    assert resp.status_code == 422


def test_update_calendar_event_with_header_but_invalid_body_returns_422(client):
    """
    PUT /calendar/{event_id} with header but bad body should 422.
    """
    event_id = str(uuid4())
    payload = {}
    resp = client.put(f"/calendar/{event_id}", json=payload, headers=BASE_HEADERS)
    assert resp.status_code == 422


def test_delete_calendar_event_missing_header_returns_422(client):
    event_id = str(uuid4())
    resp = client.delete(f"/calendar/{event_id}")
    assert resp.status_code == 422


def test_update_calendar_event_with_header_but_invalid_body_returns_error(client):
    """
    PUT /calendar/{event_id} with header but bad body should return error.
    """
    event_id = str(uuid4())
    payload = {}
    resp = client.put(f"/calendar/{event_id}", json=payload, headers=BASE_HEADERS)
    assert resp.status_code in (400, 404, 422)