"""Test setup for the Disaster Management API.

Integration tests run against an isolated database whose name must end in
"_test" (default: drch_test on the DATABASE_URL server). The suite never
touches the application database and never deletes rows: each test creates
its own uniquely named data. When no database is reachable, DB-backed tests
are skipped and only the unit tests run (e.g. in CI without Postgres).
"""

import os
import uuid
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

import psycopg
import pytest
from cryptography.fernet import Fernet
from dotenv import dotenv_values
from psycopg import sql as pgsql

ROOT = Path(__file__).resolve().parents[2]
SQL_DIR = ROOT / "backend" / "db"


def _test_database_url() -> str | None:
    url = os.getenv("TEST_DATABASE_URL")
    if not url:
        base = os.getenv("DATABASE_URL") or dotenv_values(ROOT / ".env").get("DATABASE_URL")
        if not base:
            return None
        parts = urlsplit(base)
        url = urlunsplit(parts._replace(path="/drch_test"))
    if not urlsplit(url).path.rstrip("/").endswith("_test"):
        raise RuntimeError("Refusing to run tests: the test database name must end with '_test'")
    return url


TEST_DB_URL = _test_database_url()

# Test-only secrets, set before the app reads its settings.
os.environ["DATABASE_URL"] = TEST_DB_URL or ""
os.environ["JWT_SECRET"] = "test-only-secret-" + "x" * 32
os.environ["MFA_ENCRYPTION_KEY"] = Fernet.generate_key().decode()
os.environ["DISPATCH_ACK_TIMEOUT_MINUTES"] = "15"
os.environ.pop("AI_TRIAGE_URL", None)


def _db_available() -> bool:
    if not TEST_DB_URL:
        return False
    try:
        with psycopg.connect(TEST_DB_URL, connect_timeout=3):
            return True
    except psycopg.OperationalError:
        return False


DB_AVAILABLE = _db_available()


def _ensure_schema() -> None:
    with psycopg.connect(TEST_DB_URL, autocommit=True) as conn:
        has_core = conn.execute("SELECT to_regclass('public.incidents')").fetchone()[0]
        if not has_core:
            conn.execute((SQL_DIR / "migrations" / "01_schema.sql").read_text(encoding="utf-8"))
            conn.execute((SQL_DIR / "seeds" / "seed_data.sql").read_text(encoding="utf-8"))
        # Forward-only and idempotent.
        conn.execute((SQL_DIR / "migrations" / "02_dm_module.sql").read_text(encoding="utf-8"))


def pytest_collection_modifyitems(config, items):
    if DB_AVAILABLE:
        _ensure_schema()
        return
    skip = pytest.mark.skip(reason="test database not reachable (set TEST_DATABASE_URL)")
    for item in items:
        if "db" in item.keywords:
            item.add_marker(skip)


def pytest_configure(config):
    config.addinivalue_line("markers", "db: needs the PostgreSQL test database")


# ----------------------------------------------------------------------- fixtures


@pytest.fixture(scope="session")
def client():
    from fastapi.testclient import TestClient

    from main import app

    # No context manager: the background escalation loop is exercised directly in tests.
    return TestClient(app)


@pytest.fixture
def sql():
    """Direct database access for arranging and asserting state."""
    from psycopg.rows import dict_row

    with psycopg.connect(TEST_DB_URL, autocommit=True, row_factory=dict_row) as conn:
        yield conn


def unique(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:12]}"


class Factory:
    def __init__(self, conn):
        self.conn = conn

    def user(self, role: str = "DISASTER_MGMT", permissions=(), password="correct-horse-battery", mfa=True):
        from app import security

        email = f"{unique('user')}@test.drch"
        user_id = self.conn.execute(
            """
            INSERT INTO users (role_id, email, full_name, phone, status)
            SELECT role_id, %s, %s, '+910000000000', 'ACTIVE' FROM roles WHERE code = %s
            RETURNING user_id
            """,
            (email, f"Test {role.title()}", role),
        ).fetchone()["user_id"]
        secret = security.new_totp_secret()
        self.conn.execute(
            "INSERT INTO user_auth (user_id, password_hash, mfa_enabled, mfa_secret) VALUES (%s, %s, %s, %s)",
            (user_id, security.hash_password(password), mfa, security.encrypt_mfa_secret(secret) if mfa else None),
        )
        for perm in permissions:
            self.conn.execute(
                "INSERT INTO staff_permissions (user_id, permission) VALUES (%s, %s)", (user_id, perm)
            )
        return {"user_id": user_id, "email": email, "password": password, "totp_secret": secret}

    def token(self, user: dict, mfa: bool = True) -> dict:
        from app import security

        tv = self.conn.execute(
            "SELECT token_version FROM user_auth WHERE user_id = %s", (user["user_id"],)
        ).fetchone()["token_version"]
        token = security.issue_token(user["user_id"], tv, security.ACCESS, 30, mfa=mfa)
        return {"Authorization": f"Bearer {token}"}

    def staff(self, *permissions: str) -> dict:
        user = self.user("DISASTER_MGMT", permissions)
        return {**user, "headers": self.token(user)}

    def incident(self, reporter_id=None, **fields):
        reporter_id = reporter_id or self.user("NORMAL_USER", mfa=False)["user_id"]
        values = {
            "incident_ref": unique("TST")[:30],
            "reporter_id": reporter_id,
            "scenario": "URBAN_FLOODING",
            "description": "Water rising at the junction; people stranded on rooftops.",
            "reported_urgency": "HIGH",
            "people_affected": 12,
            "address_text": unique("Junction"),
            "latitude": 23.0225,
            "longitude": 72.5714,
        }
        values.update(fields)
        query = pgsql.SQL("INSERT INTO incidents ({}) VALUES ({}) RETURNING *").format(
            pgsql.SQL(", ").join(pgsql.Identifier(k) for k in values),
            pgsql.SQL(", ").join(pgsql.Placeholder() for _ in values),
        )
        return self.conn.execute(query, list(values.values())).fetchone()

    def agency(self, active=True):
        return self.conn.execute(
            "INSERT INTO agencies (name, agency_type, contact_phone, is_active) VALUES (%s, 'FIRE', '101', %s) "
            "RETURNING *",
            (unique("Agency"), active),
        ).fetchone()

    def resource(self, quantity=1, type_="TEAM", agency_id=None):
        return self.conn.execute(
            """
            INSERT INTO resources (agency_id, type, name, quantity_total, quantity_available,
                                   current_geom)
            VALUES (%s, %s, %s, %s, %s, ST_SetSRID(ST_MakePoint(72.57, 23.02), 4326)::geography)
            RETURNING *
            """,
            (agency_id, type_, unique("Resource"), quantity, quantity),
        ).fetchone()


@pytest.fixture
def make(sql):
    return Factory(sql)
