# Disaster Management module

Staff workspace for verifying incidents, AI-assisted triage, resources, dispatch, agency messaging, public updates, safety content, aid and campaign oversight, and analytics. Built against the revised SRS (sections 5, 7, 9, 11 and 15.4).

## Run it locally

```bash
# 1. Infrastructure (Postgres/PostGIS, Redis, RabbitMQ) and the API
docker compose up -d postgres-postgis redis rabbitmq
docker compose up -d --build --no-deps backend          # API on :8000

# 2. One-time, existing databases only: apply the additive migration
#    (fresh volumes run it automatically as 03_dm_module.sql)
docker exec -i drch_postgres sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
  < backend/db/migrations/02_dm_module.sql

# 3. Create a staff account (prompts for a password; prints a TOTP secret once)
docker exec -it drch_backend python -m app.cli create-staff \
  --email you@example.org --name "Your Name" \
  --permissions DISPATCH,CLOSURE,PUBLISHER,MODERATOR,SUPERVISOR

# 4. Frontend
cd frontend && npm ci && npm run dev                     # http://localhost:3000/login
```

Add the printed secret key to an authenticator app (Google Authenticator, Authy, 1Password and so on). Then open the ResQ login (`/login`, or **Sign In / Register** on the portal), choose **Administrator · Command & Dispatch**, enter your email and password, and then the 6-digit code. You land in the workspace at `/dm`.

## How the module fits into the ResQ portal

The ResQ GeoPortal (home map, login, signup, role dashboards; `frontend/src/app/page.tsx`, `components/*`, `context/ResQContext.tsx`) is preserved. It still runs on its own demo data in `localStorage`. The module connects to it at four points only:

| Integration point | Change |
|---|---|
| Login page, **Administrator** tab (`app/login/page.tsx`) and the portal's sign-in modal (`components/AuthModal.tsx`) | That tab renders `app/login/staff-sign-in.tsx`, a real server sign-in (password, then TOTP) in the same card styling. Its demo quick-login buttons are hidden. The Citizen and Service Provider tabs are unchanged. |
| Portal map (`app/page.tsx`, 2 lines) | Mounts `components/dm/LiveOperationsLayer.tsx` on the existing Leaflet map. It loads only for a valid DM session (`GET /api/session`), draws real incidents (blue-outlined pills) and located resources in a separate layer group, and links to the workspace. `/?incident=<id>` flies to an incident. Guests see no change. |
| Workspace (`app/dm/*`) | ResQ header and branding with the navy/sky palette. Colour tokens are scoped to `.dm-theme` in `globals.css`, so other pages are unaffected. |
| Navigation | The workspace's **General Dashboard** link and **Live map** item open the portal; the portal's live panel has **Open DM Workspace**. |

The portal's demo pins (ResQContext) and the live layer share the map. The live layer is labelled "LIVE OPERATIONS" so the two aren't confused.

To run the API outside Docker instead: `cd backend && python -m venv .venv && .venv/Scripts/pip install -r requirements.txt && .venv/Scripts/python -m uvicorn main:app --reload` (it reads the repository `.env`).

## Environment variables

| Name | Used by | Purpose |
|---|---|---|
| `DATABASE_URL` | backend | PostgreSQL connection |
| `JWT_SECRET` | backend | Signs access tokens (32+ characters; replace the example value in production) |
| `MFA_ENCRYPTION_KEY` | backend | Fernet key that encrypts TOTP secrets at rest. Rotating it invalidates enrolled MFA |
| `DISPATCH_ACK_TIMEOUT_MINUTES` | backend | Unacknowledged dispatches escalate after this (default 15) |
| `AI_TRIAGE_URL` | backend | Optional external triage service. Empty means AI is reported unavailable |
| `ACCESS_TOKEN_MINUTES`, `LOGIN_MAX_ATTEMPTS`, `LOGIN_LOCKOUT_MINUTES`, `AI_LOW_CONFIDENCE_THRESHOLD` | backend | Optional tuning (defaults 60, 5, 15, 0.6) |
| `API_URL` | frontend (server only) | Backend base URL for the Next.js server. Never sent to the browser |

## Architecture

- **Backend** (`backend/app`): FastAPI routers under `/api/v1/dm/*`, psycopg 3 with a connection pool, explicit transactions, parameterised SQL only.
  - `auth.py`: role and permissions resolved from the database on every request.
  - `audit.py`: writes to the hash-chained, append-only `audit_logs` inside the same transaction as the action.
  - `services/incidents.py`: the incident state machine.
  - `services/resources.py`: row-locked reservations, so quantities can't go negative.
- **Frontend** (`frontend/src`): backend-for-frontend design. The browser holds only an httpOnly `drch_session` cookie.
  - `app/api/dm/[...path]/route.ts` attaches the bearer token server-side and rejects cross-site writes. No CORS settings are needed on the API.
  - `proxy.ts` only redirects visitors without a cookie. Real authorisation is `/api/v1/me` in `app/dm/layout.tsx` plus the backend.
- **Permissions** inside the single `DISASTER_MGMT` role (SRS s.1, s.15.5): `PUBLISHER`, `MODERATOR`, `CLOSURE`, `DISPATCH`, `SUPERVISOR`, stored in `staff_permissions`.

## API (all require `DISASTER_MGMT` and an MFA-verified token)

| Area | Routes | Extra permission |
|---|---|---|
| Auth | `POST /api/v1/auth/login`, `POST /api/v1/auth/mfa/verify`, `POST /api/v1/auth/logout`, `GET /api/v1/me` | — |
| Dashboard | `GET /dm/dashboard` | — |
| Incidents | `GET /dm/incidents` (filters: `scenario`, `status`, `priority`, `from`, `to`, `q`, `near_lat`/`near_lon`/`radius_km`, `sort`, `page`, `limit`), `GET /dm/incidents/:id` | — |
| Verification | `POST …/verification`, `POST …/information-requests`, `PUT …/priority`, `POST …/resolution` | — |
| Closure | `POST …/closure` (409 `OPEN_DEPENDENCIES` unless override + rationale), `POST …/reopen` | closure |
| Duplicates | `GET …/duplicates`, `POST …/duplicates/:candidateId/decision` (`LINK`/`MERGE`/`DISMISS`) | — |
| AI | `POST …/ai-triage`, `GET …/ai-recommendations`, `POST …/ai-recommendations/:recId/decision` | — |
| Map | `GET /dm/map`, `GET /dm/map/layers` | — |
| Resources | `GET/POST /dm/resources`, `PATCH /dm/resources/:id`, `GET …/assignments`, `POST …/reservations`, `DELETE …/reservations/:id`, `GET /dm/agency-contacts` | — |
| Dispatch | `POST /dm/incidents/:id/dispatches` (`Idempotency-Key`), `GET /dm/dispatches`, `GET /dm/dispatches/:id`, `POST …/acknowledgement`, `…/rejection`, `…/progress`, `…/completion`, `…/failure` | dispatch |
| Escalation | `POST /dm/dispatches/:id/escalation` (also automatic after the timeout) | supervisor |
| Agency messages | `POST /dm/incidents/:id/agency-messages`, `GET /dm/agency-messages[/:id]`, `POST /dm/agency-messages/:id/events` | — |
| Public updates | `GET/POST /dm/public-updates`, `PATCH …/:id` (drafts only); `POST …/publish`, `POST …/archive` | publisher (publish, archive) |
| Safety content | `GET/POST /dm/safety-content`, `PATCH …/:id`, `GET …/versions`; `POST …/approval`, `POST …/publish` | publisher (approve, publish) |
| Moderation | `GET /dm/moderation/queue`, `POST /dm/moderation/:itemId/decision` | moderator |
| Aid & campaigns | `GET /dm/oversight/donations`, `GET /dm/oversight/aid`, `GET /dm/aid-contributions`, `POST …/:id/verification`, `GET/POST /dm/needs`, `PATCH /dm/needs/:id`, `GET/POST /dm/allocations`, `POST /dm/allocations/:id/delivery-events`, `GET/POST /dm/campaigns`, `PATCH /dm/campaigns/:id`, `POST …/closure` | — |
| Analytics | `GET /dm/analytics?scenario&from&to` | — |

Errors always look like `{"error": {"code", "message", "details"}}`, with stable codes such as `VERSION_CONFLICT`, `INVALID_TRANSITION`, `UNSUPPORTED_SCENARIO`, `RESOURCE_CONFLICT`, `DISPATCH_NOT_ACKNOWLEDGED`, `OPEN_DEPENDENCIES`, `PERMISSION_REQUIRED` and `AI_UNAVAILABLE`. API scenario values are lower-case (`cyclone`, `industrial_fire`, `urban_flooding`) per SRS s.15.1.

## Database change: `02_dm_module.sql` (forward-only, idempotent, additive)

- New enum `dm_permission` and table `staff_permissions`.
- `safety_content`: nullable `source`, `author_id`, `approved_by`, `approved_at`, `published_by`. Approved = `DRAFT` with `approved_at` set; Superseded = `ARCHIVED`.
- `public_updates.created_by` (nullable).
- Sequence `dispatch_ref_seq`.

Nothing is dropped or rewritten, and existing rows are untouched. The following are recorded as append-only audit events rather than new columns: dispatch escalation, progress reports, duplicate dismissals and moderation decisions. Evidence moderation reuses `scan_state` (Pending = `PENDING`, Approved = `CLEAN`, Quarantined = `QUARANTINED`, Removed = `REJECTED`).

## Tests and checks

```bash
cd backend
.venv/Scripts/python -m pytest tests -q   # uses an isolated database named drch_test (created by you once:
                                          #   docker exec drch_postgres psql -U postgres -c 'CREATE DATABASE drch_test')
ruff check backend/ ai-workers/ && bandit -r backend/ ai-workers/ -ll -ii   # from the repo root, as CI does
cd ../frontend && npx tsc --noEmit && npm run lint && npm run build
```

The test suite refuses to run against a database whose name does not end in `_test`. With no database reachable (as in the current CI job), the database tests are skipped and only the unit tests run.

## Not implemented, and why

- **Live AI triage:** `ai-workers/worker.py` is a placeholder. The image classifier (`ai-workers/model/app.py`) can't serve triage yet: `best_model.pt` isn't in the repository, so the service won't start, and it classifies images while evidence files have no storage service. The boundary, guardrails and human-decision flow are complete; set `AI_TRIAGE_URL` to a service that returns `{model, scenario, priority, confidence, uncertainty?, factors?}`. An adapter for the classifier would map `fire → industrial_fire`, `flood → urban_flooding`, `hurricane → cyclone`, and flag everything else as out of scope.
- **Portal data:** the ResQ portal's dashboards and demo pins still read `localStorage` mock data. Moving them to the backend belongs to the portal owners; the DM live layer shows the real data on the same map.
- **Message and dispatch transmission:** there is no messaging integration. Orders and messages stay `QUEUED`, and staff record agency responses. The trusted-integration webhooks (SRS s.15.6) are not built.
- **Evidence file previews:** there is no storage service; only metadata and the moderation state are shown.
- **Staff account administration** belongs to Application Management (AM-FR-02). Until that console exists, use `python -m app.cli` (`create-staff`, `set-permissions`, `reset-mfa`).
- Optional SRS items not built: route and affected-area map layers, agency directory editing (DM-FR-20 is read-only here), campaign period fields (the schema has none).
