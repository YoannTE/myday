"""Tests de l'endpoint /health (ping BDD reel + presence du schema)."""


def test_health_ok(client):
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["status"] == "ok"
    assert data["db"] is True
    # Le schema est migre dans l'environnement de test.
    assert data["schema"] is True


def test_health_shape(client):
    """La reponse respecte le format {"data": {...}}."""
    body = client.get("/health").json()
    assert "data" in body
    assert set(body["data"].keys()) == {"status", "db", "schema"}
