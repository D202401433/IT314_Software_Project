"""Tests for scripts/seed_reset.py safety guards, dynamic cleanup, and idempotency."""

import os
import sys
from pathlib import Path

import pytest

# Ensure scripts directory is importable
ROOT = Path(__file__).resolve().parents[2]
if str(ROOT / "scripts") not in sys.path:
    sys.path.insert(0, str(ROOT / "scripts"))

from seed_reset import check_safety_guard, reset_seeds


def test_seed_reset_safety_guard_allowed_targets():
    """Verify safe targets are allowed without FORCE flag."""
    safe_urls = [
        "postgresql://postgres:password@localhost:5432/drch_db",
        "postgresql://postgres:password@127.0.0.1:5432/drch_db",
        "postgresql://postgres:password@postgres-postgis:5432/drch_db",
        "postgresql://postgres:password@drch_postgres:5432/drch_db",
        "postgresql://user:pass@remote-host.internal:5432/drch_test",
        "postgresql://user:pass@remote-host.internal:5432/my_dev_db",
    ]
    for url in safe_urls:
        is_safe, msg = check_safety_guard(url, force=False)
        assert is_safe is True, f"Expected {url} to be safe, got: {msg}"


def test_seed_reset_safety_guard_refuses_cloud_and_production():
    """Verify cloud and production targets are strictly refused by default."""
    unsafe_urls = [
        "postgresql://drch_owner:secret@ep-cool-fog-123456.us-east-2.aws.neon.tech/drch_prod",
        "postgresql://drch_user:secret@dpg-c12345-a.oregon-postgres.render.com/drch_production",
        "postgresql://admin:secret@rds.us-west-2.amazonaws.com:5432/drch",
    ]
    for url in unsafe_urls:
        is_safe, msg = check_safety_guard(url, force=False)
        assert is_safe is False, f"Expected {url} to be refused!"
        assert "Refusing execution" in msg


def test_seed_reset_safety_guard_force_override():
    """Verify FORCE=1 allows explicit override on cloud/production databases."""
    neon_url = "postgresql://drch_owner:secret@ep-cool-fog-123456.us-east-2.aws.neon.tech/drch_prod"
    is_safe, msg = check_safety_guard(neon_url, force=True)
    assert is_safe is True
    assert "FORCE=1 override active" in msg


def test_seed_reset_lifecycle_and_idempotency(sql):
    """Insert a junk incident, run seed_reset, verify removal and exact seed row counts.

    Runs twice to prove idempotency.
    """
    # 1. Insert a junk incident
    sql.execute(
        """
        INSERT INTO incidents (
            incident_id, incident_ref, reporter_id, scenario, description,
            reported_urgency, status, latitude, longitude, address_text, is_simulated
        )
        VALUES (
            'f0000000-0000-0000-0000-000000000999'::uuid,
            'INC-JUNK-9999',
            'a0000000-0000-0000-0000-000000000001'::uuid,
            'URBAN_FLOODING',
            'Temporary junk incident for testing seed reset wipe',
            'LOW', 'SUBMITTED', 23.0, 72.5, 'Junk Street', TRUE
        )
        """
    )
    # Verify junk incident was recorded
    junk_exists = sql.execute(
        "SELECT 1 FROM incidents WHERE incident_ref = 'INC-JUNK-9999'"
    ).fetchone()
    assert junk_exists is not None

    # 2. Run seed reset (first pass)
    counts1 = reset_seeds(force=False)
    assert counts1["incidents"] == 4
    assert counts1["users"] == 3
    assert counts1["resources"] == 5
    assert counts1["donation_campaigns"] == 3

    # Verify junk incident is completely gone
    junk_after = sql.execute(
        "SELECT 1 FROM incidents WHERE incident_ref = 'INC-JUNK-9999'"
    ).fetchone()
    assert junk_after is None, "Junk incident was not wiped by seed reset!"

    # 3. Run seed reset a second time (second pass - idempotency check)
    counts2 = reset_seeds(force=False)
    assert counts2 == counts1, f"Seed reset is not idempotent: {counts2} != {counts1}"
