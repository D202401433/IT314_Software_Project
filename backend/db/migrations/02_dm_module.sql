-- =====================================================================
-- DRCH - Migration 02: Disaster Management module support
--
-- Forward-only and idempotent: safe to run on a database that already
-- holds 01_schema.sql and seed data. Adds only; never drops, rewrites or
-- deletes existing objects or rows.
--
-- Apply to an existing local database:
--   docker exec -i drch_postgres sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < backend/db/migrations/02_dm_module.sql
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Permissions inside the Disaster Management role
--    (SRS s.1, DM-NFR-05, s.15.5 PUT /admin/users/:id/permissions).
--    These are not roles: they only take effect for DISASTER_MGMT users.
-- ---------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dm_permission') THEN
        CREATE TYPE dm_permission AS ENUM ('PUBLISHER', 'MODERATOR', 'CLOSURE', 'DISPATCH', 'SUPERVISOR');
    END IF;
END
$$;

CREATE TABLE IF NOT EXISTS staff_permissions (
    user_id     UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    permission  dm_permission NOT NULL,
    granted_by  UUID REFERENCES users(user_id) ON DELETE SET NULL,
    granted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, permission)
);

-- ---------------------------------------------------------------------
-- 2. Safety content attribution and approval (DM-FR-17, s.7.9, DM-NFR-15).
--    Approved = DRAFT with approved_at set; Superseded = ARCHIVED.
-- ---------------------------------------------------------------------
ALTER TABLE safety_content ADD COLUMN IF NOT EXISTS source       TEXT;
ALTER TABLE safety_content ADD COLUMN IF NOT EXISTS author_id    UUID REFERENCES users(user_id) ON DELETE SET NULL;
ALTER TABLE safety_content ADD COLUMN IF NOT EXISTS approved_by  UUID REFERENCES users(user_id) ON DELETE SET NULL;
ALTER TABLE safety_content ADD COLUMN IF NOT EXISTS approved_at  TIMESTAMPTZ;
ALTER TABLE safety_content ADD COLUMN IF NOT EXISTS published_by UUID REFERENCES users(user_id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------
-- 3. Public update authorship (DM-FR-11, DM-NFR-15).
-- ---------------------------------------------------------------------
ALTER TABLE public_updates ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(user_id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------
-- 4. Human-readable dispatch references, e.g. DISP-2026-000001.
-- ---------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS dispatch_ref_seq;

COMMIT;
