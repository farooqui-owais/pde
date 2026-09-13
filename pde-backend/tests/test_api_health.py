"""Smoke tests for the /api/health endpoint."""


def test_health_returns_ok(client):
    """Health endpoint should return 200 with status ok."""
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "dakhalnama-api"


def test_health_is_get_only(client):
    """Health endpoint should not accept POST."""
    response = client.post("/api/health")
    assert response.status_code == 405
