def test_health(client):
    resp = client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    if isinstance(data, dict) and "status" in data:
        assert data["status"] == "ok"
