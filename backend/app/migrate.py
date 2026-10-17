"""Lightweight, idempotent SQL migration runner with version tracking."""

import logging
from pathlib import Path
from app import db

logger = logging.getLogger("drch.migrate")

MIGRATIONS_DIR = Path(__file__).resolve().parents[1] / "db" / "migrations"


def apply_migrations() -> list[str]:
    """
    Applies any pending SQL migrations in ascending numerical order.
    Tracks applied migrations in the `schema_migrations` table so they are
    never re-executed.
    """
    applied = []
    with db.transaction() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version VARCHAR(255) PRIMARY KEY,
                applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
            );
            """
        )

        rows = conn.execute("SELECT version FROM schema_migrations").fetchall()
        applied_versions = {r["version"] for r in rows}

        migration_files = sorted(MIGRATIONS_DIR.glob("*.sql"), key=lambda p: p.name)
        for filepath in migration_files:
            version_name = filepath.name
            if version_name not in applied_versions:
                logger.info("Applying database migration: %s", version_name)
                with open(filepath, "r", encoding="utf-8") as f:
                    sql_content = f.read()
                conn.execute(sql_content)
                conn.execute(
                    "INSERT INTO schema_migrations (version) VALUES (%s)",
                    (version_name,),
                )
                applied.append(version_name)

    if applied:
        logger.info("Successfully applied %d migration(s): %s", len(applied), ", ".join(applied))
    else:
        logger.info("Database schema is up to date (0 pending migrations).")
    return applied


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    apply_migrations()
