-- =====================================================================
-- DRCH - Migration 03: Core Extensions & Gujarat Ingestion Support
--
-- Adds:
--   1. Extensions to incidents table (source, source_ref, is_simulated, district)
--   2. Ingestion tables: external_alerts, ingest_runs, source_signals
--   3. Field team tables: field_team_members, dispatch_progress, team_requests
--   4. Payment gateway columns on donations (gateway_order_id, gateway_payment_id, verified_at)
--   5. FIELD_TEAM role registration & Ingestion System User
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. INCIDENTS EXTENSIONS
-- ---------------------------------------------------------------------
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS source VARCHAR(50) NOT NULL DEFAULT 'CITIZEN';
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS source_ref VARCHAR(100);
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS is_simulated BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS district VARCHAR(100);
ALTER TABLE resources ADD COLUMN IF NOT EXISTS capability_tags JSONB DEFAULT '{}'::jsonb;


CREATE INDEX IF NOT EXISTS idx_incidents_district ON incidents(district);
CREATE INDEX IF NOT EXISTS idx_incidents_is_simulated ON incidents(is_simulated);
CREATE INDEX IF NOT EXISTS idx_incidents_public_verified 
    ON incidents(status, verified_by, canonical_incident_id) 
    WHERE status IN ('VERIFIED', 'DISPATCHED', 'RESOLVED') AND verified_by IS NOT NULL;

-- ---------------------------------------------------------------------
-- 2. EXTERNAL ALERTS & INGESTION RUNS
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS external_alerts (
    alert_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source         VARCHAR(50) NOT NULL,              -- USGS, SACHET, IMD, GDACS
    source_uid     VARCHAR(255) NOT NULL,
    event_type     VARCHAR(100) NOT NULL,             -- FLOOD, CYCLONE, INDUSTRIAL_FIRE
    severity       VARCHAR(50) NOT NULL,              -- CRITICAL, HIGH, MEDIUM, LOW
    area_text      TEXT,
    latitude       NUMERIC(9,6) CHECK (latitude BETWEEN -90 AND 90),
    longitude      NUMERIC(9,6) CHECK (longitude BETWEEN -180 AND 180),
    geom           GEOGRAPHY(Geometry, 4326),
    is_fallback    BOOLEAN NOT NULL DEFAULT FALSE,
    effective_at   TIMESTAMPTZ,
    expires_at     TIMESTAMPTZ,
    raw_payload    JSONB,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (source, source_uid)
);
CREATE INDEX IF NOT EXISTS idx_external_alerts_active ON external_alerts(expires_at, is_fallback);

CREATE TABLE IF NOT EXISTS ingest_runs (
    run_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source         VARCHAR(50) NOT NULL,
    started_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at    TIMESTAMPTZ,
    status         VARCHAR(30) NOT NULL DEFAULT 'RUNNING',  -- RUNNING, SUCCESS, FAILED
    items_fetched  INT NOT NULL DEFAULT 0,
    items_stored   INT NOT NULL DEFAULT 0,
    error_message  TEXT
);
CREATE INDEX IF NOT EXISTS idx_ingest_runs_source ON ingest_runs(source, started_at DESC);

-- ---------------------------------------------------------------------
-- 3. SOURCE SIGNALS (Citizen & Social Ingested Feeds for Promotion)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS source_signals (
    signal_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source               VARCHAR(50) NOT NULL,          -- BLUESKY, MASTODON, USGS, REPLAY
    source_uid           VARCHAR(255) NOT NULL,
    content_text         TEXT NOT NULL,
    language             VARCHAR(10) DEFAULT 'en',
    location_text        TEXT,
    latitude             NUMERIC(9,6) CHECK (latitude BETWEEN -90 AND 90),
    longitude            NUMERIC(9,6) CHECK (longitude BETWEEN -180 AND 180),
    geom                 GEOGRAPHY(Point, 4326),
    ai_label             VARCHAR(60),
    ai_confidence        NUMERIC(4,3),
    status               VARCHAR(30) NOT NULL DEFAULT 'PENDING',  -- PENDING, PROMOTED, DISMISSED
    is_simulated         BOOLEAN NOT NULL DEFAULT FALSE,
    dismiss_rationale    TEXT,
    promoted_incident_id UUID REFERENCES incidents(incident_id) ON DELETE SET NULL,
    raw_payload          JSONB,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (source, source_uid)
);
CREATE INDEX IF NOT EXISTS idx_source_signals_status ON source_signals(status, created_at DESC);

-- ---------------------------------------------------------------------
-- 4. FIELD TEAM COLLABORATION & DISPATCH PROGRESS
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS field_team_members (
    member_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    resource_id   UUID NOT NULL REFERENCES resources(resource_id) ON DELETE CASCADE,
    callsign      VARCHAR(100),
    is_leader     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, resource_id)
);
CREATE INDEX IF NOT EXISTS idx_field_team_user ON field_team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_field_team_res  ON field_team_members(resource_id);

CREATE TABLE IF NOT EXISTS dispatch_progress (
    progress_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dispatch_id   UUID NOT NULL REFERENCES dispatch_orders(dispatch_id) ON DELETE CASCADE,
    status        VARCHAR(40) NOT NULL,             -- ACKNOWLEDGED, EN_ROUTE, ON_SCENE, COMPLETED, DELAYED
    note          TEXT,
    recorded_by   UUID REFERENCES users(user_id) ON DELETE SET NULL,
    recorded_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dispatch_progress_disp ON dispatch_progress(dispatch_id, recorded_at);

CREATE TABLE IF NOT EXISTS team_requests (
    request_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dispatch_id         UUID NOT NULL REFERENCES dispatch_orders(dispatch_id) ON DELETE CASCADE,
    requested_by        UUID REFERENCES users(user_id) ON DELETE SET NULL,
    required_capability VARCHAR(100) NOT NULL,
    note                TEXT,
    status              VARCHAR(30) NOT NULL DEFAULT 'OPEN',     -- OPEN, APPROVED, DECLINED
    decision_rationale  TEXT,
    decided_by          UUID REFERENCES users(user_id) ON DELETE SET NULL,
    decided_at          TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_team_requests_status ON team_requests(status, created_at DESC);

-- ---------------------------------------------------------------------
-- 5. PAYMENT GATEWAY EXTENSIONS ON DONATIONS
-- ---------------------------------------------------------------------
ALTER TABLE donations ADD COLUMN IF NOT EXISTS gateway_order_id   VARCHAR(100);
ALTER TABLE donations ADD COLUMN IF NOT EXISTS gateway_payment_id VARCHAR(100);
ALTER TABLE donations ADD COLUMN IF NOT EXISTS verified_at        TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_donations_order_id ON donations(gateway_order_id);

-- ---------------------------------------------------------------------
-- 6. FIELD_TEAM ROLE REGISTRATION & INGESTION SYSTEM USER
-- ---------------------------------------------------------------------
INSERT INTO roles (code, description) VALUES
 ('FIELD_TEAM', 'Field Team Responder: receive assignments, acknowledge, report progress, request backup, complete missions')
ON CONFLICT (code) DO NOTHING;

-- Ingestion system user for attributing automated/ingested incidents
INSERT INTO users (user_id, role_id, email, phone, full_name, status)
SELECT 'a0000000-0000-0000-0000-000000000002'::uuid,
       r.role_id,
       'ingest-system@drch.gov.in',
       '+910000000000',
       'Automated Ingestion System',
       'ACTIVE'
FROM roles r WHERE r.code = 'APP_MGMT'
ON CONFLICT (email) DO NOTHING;

INSERT INTO user_auth (user_id, password_hash, mfa_enabled)
SELECT u.user_id,
       '$argon2id$v=19$m=65536,t=3,p=4$drch_ingest_system_placeholder',
       FALSE
FROM users u WHERE u.email = 'ingest-system@drch.gov.in'
ON CONFLICT (user_id) DO NOTHING;

COMMIT;
