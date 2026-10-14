import os
import sys
from pathlib import Path
import pytest

# Ensure backend root is on sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

# Ensure high-entropy JWT_SECRET exists in environment prior to app import
if not os.getenv("JWT_SECRET") or len(os.getenv("JWT_SECRET", "")) < 32:
    os.environ["JWT_SECRET"] = "test_jwt_secret_key_minimum_32_characters_for_unit_tests"

from fastapi.testclient import TestClient
from main import app, create_jwt_token, validate_jwt_secret

client = TestClient(app)

def test_jwt_secret_validation_rejects_missing_or_short():
    with pytest.raises(RuntimeError, match=">=32 chars"):
        validate_jwt_secret(None)

    with pytest.raises(RuntimeError, match=">=32 chars"):
        validate_jwt_secret("")

    with pytest.raises(RuntimeError, match=">=32 chars"):
        validate_jwt_secret("short_key_under_32_chars")

def test_jwt_secret_validation_accepts_valid_length():
    valid_key = "a" * 32
    assert validate_jwt_secret(valid_key) == valid_key

    longer_key = "secure_random_production_secret_key_64_characters_long_entropy_ok"
    assert validate_jwt_secret(longer_key) == longer_key

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
