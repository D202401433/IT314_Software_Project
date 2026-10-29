#!/usr/bin/env python3
"""Database seed reset utility.

Safely resets dynamic tables and applies baseline seed SQL files.
Includes environment safety guards to prevent accidental execution on cloud/production.
"""

import argparse
import os
import sys
from pathlib import Path
from urllib.parse import urlsplit

import psycopg
from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parents[1]
SEEDS_DIR = ROOT / "backend" / "db" / "seeds"

SAFE_HOSTS = {
    "localhost",
    "127.0.0.1",
    "::1",
    "0.0.0.0",
    "postgres",
    "postgres-postgis",
    "db",
    "drch_postgres",
    "drch_prod_postgres",
    "backend",
    "ai-workers",
}

BOOTSTRAP_USER_IDS = (
    "a0000000-0000-0000-0000-000000000001",
    "a0000000-0000-0000-0000-000000000002",
    "a0000000-0000-0000-0000-000000000003",
)

OPERATIONAL_TABLES = [
    "dispatch_order_resources",
    "dispatch_orders",
    "agency_messages",
    "incident_status_history",
    "evidence_files",
    "incident_dependencies",
    "ai_triage_recommendations",
    "aid_allocations",
    "aid_contributions",
    "aid_needs",
    "notifications",
    "donations",
    "donation_campaigns",
    "content_posts",
    "incidents",
    "resources",
    "field_team_members",
]


def check_safety_guard(db_url: str, force: bool = False) -> tuple[bool, str]:
    """Verify target database safety. Refuses cloud/production unless force=True."""
    if force:
        return True, "FORCE=1 override active"

    parts = urlsplit(db_url)
    hostname = (parts.hostname or "").lower()
    dbname = parts.path.lstrip("/").split("?")[0].lower()

    if hostname in SAFE_HOSTS:
        return True, f"Allowed host: '{hostname}'"

    if dbname.endswith("_test"):
        return True, f"Allowed test database name: '{dbname}' (*_test)"

    if "dev" in dbname:
        return True, f"Allowed development database name: '{dbname}' (*dev*)"

    return False, (
        f"Database target host '{hostname}' and database '{dbname}' do not match safety criteria:\n"
        f"  - Host must be localhost, 127.0.0.1, or a docker-compose service (e.g. postgres-postgis)\n"
        f"  - OR database name must end with '_test' or contain 'dev'\n"
        f"Refusing execution to protect cloud/production databases (e.g. Neon, Render).\n"
        f"To override, set FORCE=1 (e.g., FORCE=1 make seed-reset)."
    )


def get_db_url() -> str:
    url = os.getenv("TEST_DATABASE_URL") or os.getenv("DATABASE_URL")
    if not url:
        env_path = ROOT / ".env"
        if env_path.exists():
            url = dotenv_values(env_path).get("DATABASE_URL")
    if not url:
        sys.exit("ERROR: Neither DATABASE_URL nor TEST_DATABASE_URL is set.")
    return url


def resolve_seed_files(custom_spec: str | None = None) -> list[Path]:
    spec = custom_spec or os.getenv("SEED_FILES")
    if spec:
        files = []
        for token in spec.replace(",", " ").split():
            p = Path(token)
            if not p.is_absolute():
                p = ROOT / p
            if p.is_file():
                files.append(p)
            else:
                sys.exit(f"ERROR: Specified seed file not found: {p}")
        return files

    return sorted(SEEDS_DIR.glob("*.sql"), key=lambda p: p.name)


def clear_dynamic_data(conn):
    """Truncate operational tables and purge non-bootstrap users."""
    existing = []
    for tbl in OPERATIONAL_TABLES:
        row = conn.execute("SELECT to_regclass(%s)", (f"public.{tbl}",)).fetchone()
        val = row[0] if isinstance(row, tuple) else (row and next(iter(row.values()), None))
        if val:
            existing.append(tbl)

    if existing:
        conn.execute(f"TRUNCATE TABLE {', '.join(existing)} CASCADE;")

    row = conn.execute("SELECT to_regclass('public.users')").fetchone()
    has_users = row[0] if isinstance(row, tuple) else (row and next(iter(row.values()), None))
    if has_users:
        uids_sql = ", ".join(f"'{u}'::uuid" for u in BOOTSTRAP_USER_IDS)
        conn.execute(f"DELETE FROM staff_permissions WHERE user_id NOT IN ({uids_sql})")
        conn.execute(f"DELETE FROM user_auth WHERE user_id NOT IN ({uids_sql})")
        conn.execute(f"DELETE FROM users WHERE user_id NOT IN ({uids_sql})")


def fetch_row_counts(conn) -> dict[str, int]:
    """Query row counts for the primary tracked tables."""
    counts = {}
    for tbl in ("users", "incidents", "resources", "donation_campaigns"):
        row = conn.execute("SELECT to_regclass(%s)", (f"public.{tbl}",)).fetchone()
        has_tbl = row[0] if isinstance(row, tuple) else (row and next(iter(row.values()), None))
        if has_tbl:
            cnt_row = conn.execute(f"SELECT COUNT(*) FROM {tbl}").fetchone()
            counts[tbl] = cnt_row[0] if isinstance(cnt_row, tuple) else next(iter(cnt_row.values()))
        else:
            counts[tbl] = 0
    return counts


def reset_seeds(custom_seed_files: str | None = None, force: bool = False) -> dict[str, int]:
    db_url = get_db_url()
    force_active = force or os.getenv("FORCE") in ("1", "true", "TRUE", "yes")

    is_safe, msg = check_safety_guard(db_url, force=force_active)
    if not is_safe:
        sys.exit(f"\n[FATAL GUARD ERROR] {msg}\n")

    sanitized_host = urlsplit(db_url).netloc.split("@")[-1]
    print(f"[SEED RESET] Connecting to database ({sanitized_host}) [{msg}]...")

    seed_files = resolve_seed_files(custom_seed_files)
    if not seed_files:
        print("[SEED RESET] No seed files specified or found.")
        return {}

    with psycopg.connect(db_url, autocommit=True) as conn:
        print("[SEED RESET] Clearing dynamic operational tables...")
        clear_dynamic_data(conn)

        for seed_file in seed_files:
            print(f"[SEED RESET] Applying seeds from {seed_file.name}...")
            conn.execute(seed_file.read_text(encoding="utf-8"))

        counts = fetch_row_counts(conn)

    print("\n[+] [SEED RESET] Database seed data restored successfully.")
    print("Post-reset row counts:")
    for tbl, cnt in counts.items():
        print(f"  - {tbl:<20}: {cnt}")

    return counts


def main():
    parser = argparse.ArgumentParser(description="Safely reset DRCH database seeds.")
    parser.add_argument("--seed-files", help="Custom seed SQL files (space or comma separated)")
    parser.add_argument("--force", action="store_true", help="Override safety guard for external/cloud DBs")
    args = parser.parse_args()

    reset_seeds(custom_seed_files=args.seed_files, force=args.force)


if __name__ == "__main__":
    main()
