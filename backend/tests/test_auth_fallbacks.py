"""Regression tests for security-sensitive database and demo fallbacks."""

from contextlib import contextmanager
import uuid

import pytest
from starlette.requests import Request


def test_database_error_does_not_grant_a_demo_principal(monkeypatch):
    from app import auth
    from app.config import get_settings

    monkeypatch.setenv("DATABASE_URL", "postgresql://unavailable")
    monkeypatch.setenv("JWT_SECRET", "test-secret-" + "x" * 32)
    monkeypatch.delenv("DEMO_MODE", raising=False)
    get_settings.cache_clear()

    @contextmanager
    def unavailable_database():
        raise RuntimeError("database unavailable")
        yield

    monkeypatch.setattr(auth.db, "transaction", unavailable_database)
    try:
        with pytest.raises(RuntimeError, match="database unavailable"):
            auth.load_principal(uuid.uuid4(), 1, mfa=True)
    finally:
        get_settings.cache_clear()


def test_mfa_database_error_does_not_issue_an_access_token(monkeypatch):
    from app import db, security
    from app.config import get_settings
    from app.routers.auth import MfaVerifyRequest, verify_mfa

    monkeypatch.setenv("DATABASE_URL", "postgresql://unavailable")
    monkeypatch.setenv("JWT_SECRET", "test-secret-" + "x" * 32)
    monkeypatch.delenv("DEMO_MODE", raising=False)
    get_settings.cache_clear()

    @contextmanager
    def unavailable_database():
        raise RuntimeError("database unavailable")
        yield

    monkeypatch.setattr(db, "transaction", unavailable_database)
    challenge = security.issue_token(
        uuid.UUID("a0000000-0000-0000-0000-000000000001"),
        1,
        security.MFA,
        5,
    )
    request = Request({"type": "http", "client": ("127.0.0.1", 1234)})
    try:
        with pytest.raises(RuntimeError, match="database unavailable"):
            verify_mfa(MfaVerifyRequest(mfa_token=challenge, code="123456"), request)
    finally:
        get_settings.cache_clear()


def test_staff_creation_database_error_is_not_reported_as_success(monkeypatch):
    from app import db
    from app.config import get_settings
    from app.routers.dm.staff import CreateStaffRequest, create_staff

    monkeypatch.setenv("DATABASE_URL", "postgresql://unavailable")
    monkeypatch.setenv("JWT_SECRET", "test-secret-" + "x" * 32)
    monkeypatch.delenv("DEMO_MODE", raising=False)
    get_settings.cache_clear()

    @contextmanager
    def unavailable_database():
        raise RuntimeError("database unavailable")
        yield

    monkeypatch.setattr(db, "transaction", unavailable_database)
    body = CreateStaffRequest(
        email="new.staff@example.com",
        full_name="New Staff",
        password="long-password-123",
    )
    try:
        with pytest.raises(RuntimeError, match="database unavailable"):
            create_staff(body, principal=None)
    finally:
        get_settings.cache_clear()


def test_default_jwt_secret_is_available_only_in_database_free_demo_mode(monkeypatch):
    from app.config import get_settings

    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.delenv("JWT_SECRET", raising=False)
    monkeypatch.delenv("DEMO_MODE", raising=False)
    get_settings.cache_clear()
    assert get_settings().jwt_secret is None

    monkeypatch.setenv("DEMO_MODE", "true")
    get_settings.cache_clear()
    assert get_settings().jwt_secret

    monkeypatch.setenv("DATABASE_URL", "postgresql://configured")
    get_settings.cache_clear()
    assert get_settings().jwt_secret is None
    get_settings.cache_clear()
