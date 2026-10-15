"""Unit tests that need no database."""

import uuid

import pyotp

from app import security
from app.services.ai_provider import UnavailableProvider, apply_guardrails


def test_root_and_health(client):
    assert client.get("/").status_code == 200
    assert client.get("/health").json() == {"status": "healthy", "service": "drch-backend"}


def test_password_hashing_is_argon2id_and_verifies():
    h = security.hash_password("a long passphrase")
    assert h.startswith("$argon2id$")
    assert security.verify_password(h, "a long passphrase")
    assert not security.verify_password(h, "wrong")


def test_malformed_hash_is_a_failed_login_not_a_crash():
    # The seeded admin carries a placeholder, not a real Argon2 hash.
    assert not security.verify_password("$argon2id$v=19$m=65536,t=3,p=4$drch_bootstrap_admin_hash", "x")
    assert not security.verify_password(None, "x")


def test_token_purpose_is_enforced():
    uid = uuid.uuid4()
    mfa_token = security.issue_token(uid, 1, security.MFA, 5)
    assert security.decode_token(mfa_token, security.ACCESS) is None
    assert security.decode_token(mfa_token, security.MFA)["sub"] == str(uid)
    assert security.decode_token("not-a-token", security.ACCESS) is None


def test_mfa_secret_round_trip_and_totp():
    secret = security.new_totp_secret()
    assert security.decrypt_mfa_secret(security.encrypt_mfa_secret(secret)) == secret
    assert security.verify_totp(secret, pyotp.TOTP(secret).now())
    assert not security.verify_totp(secret, "000000x")


def test_ai_unavailable_never_invents_a_result():
    outcome = UnavailableProvider().triage({})
    assert outcome.status == "UNAVAILABLE"
    assert outcome.suggested_scenario is None and outcome.suggested_priority is None


def test_ai_guardrails_accept_valid_output():
    out = apply_guardrails(
        {"model": "m1", "scenario": "urban_flooding", "priority": "high", "confidence": 0.9,
         "factors": [{"name": "stranded people", "weight": 0.7}]}
    )
    assert out.status == "GENERATED"
    assert out.suggested_scenario == "URBAN_FLOODING" and out.suggested_priority == "HIGH"


def test_ai_guardrails_low_confidence():
    out = apply_guardrails({"model": "m1", "scenario": "cyclone", "priority": "LOW", "confidence": 0.2})
    assert out.status == "LOW_CONFIDENCE"


def test_ai_guardrails_flag_out_of_scope():
    out = apply_guardrails({"model": "m1", "scenario": "earthquake", "priority": "HIGH", "confidence": 0.95})
    assert out.suggested_scenario is None
    assert out.factors["out_of_scope"] is True
    assert out.status == "LOW_CONFIDENCE"


def test_ai_guardrails_discard_malformed_output():
    for raw in (None, "text", {"scenario": "cyclone"}, {"model": "m", "scenario": "cyclone",
                                                         "priority": "URGENT", "confidence": 0.9},
                {"model": "m", "scenario": "cyclone", "priority": "HIGH", "confidence": 7}):
        out = apply_guardrails(raw)
        assert out.status == "UNSAFE_OUTPUT"
        assert out.suggested_priority is None and out.suggested_scenario is None
