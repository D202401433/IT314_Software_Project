#!/usr/bin/env python3
"""Database seed reset utility.

Applies all seed SQL files in backend/db/seeds/ in ascending version order.
"""

import os
import sys
from pathlib import Path
from urllib.parse import urlsplit

import psycopg
from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parents[1]
SEEDS_DIR = ROOT / "backend" / "db" / "seeds"


def get_db_url() -> str:
    url = os.getenv("TEST_DATABASE_URL") or os.getenv("DATABASE_URL")
    if not url:
        env_path = ROOT / ".env"
        if env_path.exists():
            url = dotenv_values(env_path).get("DATABASE_URL")
    if not url:
        sys.exit("ERROR: Neither DATABASE_URL nor TEST_DATABASE_URL is set.")
    return url


def reset_seeds():
    db_url = get_db_url()
    sanitized_host = urlsplit(db_url).netloc.split("@")[-1]
    print(f"[SEED RESET] Connecting to database on host: {sanitized_host}...")

    with psycopg.connect(db_url, autocommit=True) as conn:
        seed_files = sorted(SEEDS_DIR.glob("*.sql"), key=lambda p: p.name)
        if not seed_files:
            print("[SEED RESET] No seed files found in backend/db/seeds/.")
            return

        for seed_file in seed_files:
            print(f"[SEED RESET] Applying seeds from {seed_file.name}...")
            conn.execute(seed_file.read_text(encoding="utf-8"))

    print("[+] [SEED RESET] Database seed data restored successfully.")


if __name__ == "__main__":
    reset_seeds()
