import sys
from pathlib import Path

# Ensure backend root is on sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from fastapi.testclient import TestClient
from main import app, create_jwt_token

client = TestClient(app)

def test_api_me_valid_token():
    payload = {
        "sub": "USR-001",
        "name": "Dr. Rajesh Sharma",
        "email": "commander@resq.gov.in",
        "role": "Command Officer / Incident Commander",
    }
    token = create_jwt_token(payload, expires_in=3600)
    response = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["user"]["email"] == "commander@resq.gov.in"
    assert "password" not in data["user"]

def test_api_me_expired_token():
    payload = {
        "sub": "USR-001",
        "name": "Dr. Rajesh Sharma",
        "email": "commander@resq.gov.in",
    }
    token = create_jwt_token(payload, expires_in=-10)
    response = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 401
    assert "Token verification failed: JWT token has expired" in response.json()["detail"]

def test_api_me_malformed_token():
    response = client.get("/api/auth/me", headers={"Authorization": "Bearer malformed.token.value"})
    assert response.status_code == 401
    assert "Token verification failed" in response.json()["detail"]

def test_api_me_missing_token():
    response = client.get("/api/auth/me")
    assert response.status_code == 401
    assert "Missing or invalid Bearer authorization header" in response.json()["detail"]

def test_api_me_empty_bearer_token():
    response = client.get("/api/auth/me", headers={"Authorization": "Bearer "})
    assert response.status_code == 401
    assert "Missing Bearer token" in response.json()["detail"]
