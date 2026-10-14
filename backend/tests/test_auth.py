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
from main import (
    app,
    create_jwt_token,
    hash_password,
    validate_jwt_secret,
    verify_password,
)

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

def test_password_hashing_and_verification():
    pwd = "secret_password_123"
    hashed = hash_password(pwd)
    assert hashed != pwd
    assert len(hashed) == 64  # sha256 hex is 64 chars
    assert verify_password(pwd, hashed) is True
    assert verify_password("wrong_password", hashed) is False
    assert verify_password("", hashed) is False
    assert verify_password(pwd, "") is False

def test_api_login_valid_credentials():
    res = client.post(
        "/api/auth/login",
        json={"identifier": "commander@resq.gov.in", "password": "admin123password"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert "token" in data
    assert "password" not in data["user"]
    assert "password_hash" not in data["user"]

def test_api_login_invalid_password():
    res = client.post(
        "/api/auth/login",
        json={"identifier": "commander@resq.gov.in", "password": "wrongpassword123"},
    )
    assert res.status_code == 401
    assert "Incorrect password" in res.json()["detail"]

def test_api_signup_and_login_flow():
    signup_email = "volunteer_test_99@resq.gov.in"
    signup_res = client.post(
        "/api/auth/signup",
        json={
            "name": "Volunteer Test",
            "email": signup_email,
            "password": "volunteer_secure_password_123",
            "role": "Public / Citizen",
            "agency": "Independent Volunteer",
        },
    )
    assert signup_res.status_code == 200
    signup_data = signup_res.json()
    assert signup_data["success"] is True
    assert "password" not in signup_data["user"]
    assert "password_hash" not in signup_data["user"]

    # Login with newly registered credentials
    login_res = client.post(
        "/api/auth/login",
        json={
            "identifier": signup_email,
            "password": "volunteer_secure_password_123",
        },
    )
    assert login_res.status_code == 200
    assert login_res.json()["success"] is True

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
    assert "password_hash" not in data["user"]

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
