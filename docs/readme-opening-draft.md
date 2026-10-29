# Gujarat Disaster Management Platform (DRCH)

Disaster Response Coordination Hub — an operational incident coordination
platform built for the State of Gujarat. The system connects three groups of
users: citizens who report emergencies, disaster management staff who triage
and dispatch resources, and field teams who receive assignments and report
progress in the field.

---

## What is real (verified in code)

The following capabilities are implemented end-to-end and covered by
automated tests in `backend/tests/`.

**Staff authentication with mandatory two-factor login.**
Staff accounts require an Argon2id password followed by a TOTP code
(RFC 6238, 30-second window). The MFA challenge is a short-lived,
purpose-bound JWT. A failed code or expired challenge does not issue an
access token. Login failures are counted; after five consecutive failures
the account is locked and all existing tokens are revoked by incrementing
`token_version`. (`backend/app/routers/auth.py`, `backend/app/security.py`)

**Incident verification workflow.**
A dispatcher can move an incident through the states SUBMITTED,
NEEDS_INFORMATION, VERIFIED, REJECTED, DISPATCHED, RESOLVED, and CLOSED.
Each transition is validated by a strict state machine, recorded in
`incident_status_history`, written to the audit log, and triggers a
notification to the reporting citizen. A VERIFIED decision requires a
priority level (CRITICAL, HIGH, MEDIUM, or LOW) and a rationale.
(`backend/app/routers/dm/incidents.py`)

**Resource dispatch with row-level locking.**
When a dispatcher creates a dispatch order, each requested resource row is
locked with `SELECT … FOR UPDATE` before the available quantity is
decremented. Concurrent requests for the same resource that would
over-allocate are refused with a 409 RESOURCE_CONFLICT response and no
partial state is written. Resources are released automatically when a
dispatch order is rejected or completed.
(`backend/app/services/resources.py`, `backend/app/services/dispatch.py`)

**Append-only, hash-chained audit log.**
Every state change, login event, access denial, and dispatch action writes
a row to `audit_logs`. A PostgreSQL trigger (`fn_audit_log_hash_chain`)
computes a SHA-256 hash of each new row concatenated with the previous
row's hash, storing it in `row_hash`. Database-level triggers also block
UPDATE and DELETE on the table. The CI pipeline verifies the hash chain
on every pull request. (`backend/db/migrations/01_schema.sql`, lines 602-629)

**Gujarat boundary enforcement.**
Incident coordinates are validated against Gujarat state boundaries via
PostGIS spatial queries, with automatic fallback to the Google Maps
Geocoding API (if `GOOGLE_MAPS_API_KEY` is configured) and then to
OpenStreetMap Nominatim (free, no key required). Resolved districts are
cached in the `administrative_boundaries` table.
(`backend/app/geo.py`)

**Advisory AI triage.**
Submitting an incident to the AI triage endpoint returns a suggested
scenario and priority level from an in-process rule-based classifier with
guardrails. The result is advisory only: it is stored separately and never
applied to the incident automatically. A human dispatcher makes the final
verification decision. (`backend/app/services/ai_provider.py`,
`backend/app/routers/dm/ai.py`)

---

## What is simulated

**Demo seed incidents.**
The database seed file inserts four demo incidents across Gujarat with
`is_simulated = TRUE`. These exist only to give reviewers and testers
something to look at on first boot. They are not live reports.
(`backend/db/seeds/seed_data.sql`, section 8)

**Mock payment gateway (SANDBOX).**
The donation campaign data model and API are present, but there is no
live payment gateway integration in the current codebase. Any payment flow
shown in a demo uses simulated sandbox / placeholder responses.

**Fallback fixtures for external alerts.**
No live alert ingestion worker is active (`ai-workers` is an inactive stub).
Alerts shown in demonstrations use fallback database fixtures flagged with
`is_fallback = TRUE`. (`backend/db/migrations/03_core_extensions.sql`)

**Synthetic or replayed social data.**
Social distress signals and external disaster feeds are not ingested live;
any social feed data displayed in the interface is synthetic or replayed.

---

## Staging and cold-start

TODO(Siddh): replace the two lines below with the real Render and Vercel URLs
once services are deployed.

- Backend API: https://TODO-your-render-service.onrender.com
- Frontend: https://TODO-your-vercel-preview.vercel.app

The backend runs on Render's free tier. Free tier services sleep after a
period of inactivity. The first request after an idle period may take 30 to
60 seconds while the container wakes up and connects to the database.
TODO(Siddh): add a cold-start notice to the frontend login page so users
are not confused by the delay.

Health check: `GET /api/v1/health` returns `{"database": "ok"}` when the
database is reachable, or `{"database": "unavailable"}` when it is not.

---
