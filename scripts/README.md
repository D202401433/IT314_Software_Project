# 🛠️ DRCH Operational & Test Scripts

This directory contains test automation, database maintenance, and operational utilities for the Gujarat Disaster Management Platform (DRCH).

---

## 🚀 1. Core Loop Smoke Test (`scripts/smoke.sh`)

`scripts/smoke.sh` is a black-box smoke test validating the core disaster reporting, triage, and verification lifecycle against any running DRCH backend instance.

### Prerequisites & Dependencies
The script is POSIX/bash compliant and runs on Linux (e.g., Ubuntu CI runners), macOS, and Windows via Git Bash or WSL:
* `bash` (shell interpreter)
* `curl` (HTTP requests)
* `jq` (JSON parsing; falls back automatically to standard Python if unavailable)
* `python3`, `python`, or `oathtool` (for RFC 6238 TOTP MFA token generation)

---

### Configuration & Environment Variables

All secrets and targets are supplied strictly via environment variables. **No secret values are ever hardcoded or printed to the terminal.**

| Variable Name | Required | Default | Description |
| :--- | :--- | :--- | :--- |
| `SMOKE_BASE_URL` | No | `http://localhost:8000` | Target base URL of the DRCH backend gateway. |
| `SMOKE_STAFF_EMAIL` | **Yes** | *None* | Email address of the test staff/dispatcher account. |
| `SMOKE_STAFF_PASSWORD` | **Yes** | *None* | Password for the staff account (never logged). |
| `SMOKE_STAFF_TOTP_SECRET` | **Yes** | *None* | Base32-encoded TOTP shared secret for MFA verification. |

#### Contract Skip Switches (Pending Endpoints)
Per Phase 0 contracts (`docs/api_contracts.md`), certain endpoints are currently being implemented by backend module owners. Set any switch to `1` to bypass assertion while contract work is completed:

| Switch Variable | Step Covered | Contract Path | Responsible Owner |
| :--- | :--- | :--- | :--- |
| `SMOKE_SKIP_REGISTER` | Step 2 (Citizen Registration) | `POST /api/v1/auth/register` | **Zalak** |
| `SMOKE_SKIP_INCIDENT_SUBMIT` | Step 5 (Incident Submission) | `POST /api/v1/incidents` | **Zalak** |
| `SMOKE_SKIP_OUTSIDE_GUJARAT` | Step 6 (Gujarat Spatial Boundary) | `POST /api/v1/incidents` | **Zalak** |
| `SMOKE_SKIP_PUBLIC_UNVERIFIED`| Step 7 (Public Unverified Isolation) | `GET /api/v1/public/incidents` | **Nisarg** |
| `SMOKE_SKIP_PUBLIC_VERIFIED` | Step 10 (Verified Public Feed) | `GET /api/v1/public/incidents` | **Nisarg** |

*(Note: Step-numbered aliases such as `SMOKE_SKIP_STEP2=1` are also supported).*

---

### Running Against Local Docker Compose

1. **Start infrastructure and backend:**
   ```bash
   docker compose up -d
   ```

2. **Run smoke test with placeholder credentials:**
   ```bash
   export SMOKE_BASE_URL="http://localhost:8000"
   export SMOKE_STAFF_EMAIL="smoke-dispatcher@drch.gov.in"
   export SMOKE_STAFF_PASSWORD="CorrectHorseBattery123!"
   export SMOKE_STAFF_TOTP_SECRET="JBSWY3DPEHPK3PXP"

   ./scripts/smoke.sh
   ```

3. **Running with blocked contract steps skipped:**
   ```bash
   SMOKE_SKIP_REGISTER=1 \
   SMOKE_SKIP_INCIDENT_SUBMIT=1 \
   SMOKE_SKIP_OUTSIDE_GUJARAT=1 \
   SMOKE_SKIP_PUBLIC_UNVERIFIED=1 \
   SMOKE_SKIP_PUBLIC_VERIFIED=1 \
   ./scripts/smoke.sh
   ```

---

### Running Against Staging (Render)

When testing against staging deployments:

1. **Set staging URL and staff credentials:**
   ```bash
   export SMOKE_BASE_URL="https://drch-backend-staging.onrender.com"
   export SMOKE_STAFF_EMAIL="staging-dispatcher@drch.gov.in"
   export SMOKE_STAFF_PASSWORD="<STAGING_STAFF_PASSWORD>"
   export SMOKE_STAFF_TOTP_SECRET="<STAGING_STAFF_TOTP_SECRET>"
   ```

2. **Execute smoke test:**
   ```bash
   ./scripts/smoke.sh
   ```

---

### Windows Execution (PowerShell & Git Bash)

Dhruv and Windows developers can invoke `smoke.sh` using Git Bash or WSL directly from PowerShell:

```powershell
# Using Git Bash:
$env:SMOKE_BASE_URL="http://localhost:8000"
$env:SMOKE_STAFF_EMAIL="smoke-dispatcher@drch.gov.in"
$env:SMOKE_STAFF_PASSWORD="CorrectHorseBattery123!"
$env:SMOKE_STAFF_TOTP_SECRET="JBSWY3DPEHPK3PXP"

& "C:\Program Files\Git\bin\bash.exe" ./scripts/smoke.sh
```

---

## 🗄️ 2. Database Reset & Seeding (`scripts/seed_reset.py`)

`scripts/seed_reset.py` safely restores the database to a known baseline state by purging operational records and re-executing SQL seed migrations.

### Safety Guard
To protect production or staging environments, `seed_reset.py` refuses execution if the target database host is not `localhost`, `127.0.0.1`, `::1`, or a Docker Compose service name (`postgres`, `db`), or if the database name does not end in `_test` or contain `dev`.

To explicitly override this guard on managed cloud databases (e.g., Neon or Render test branches), pass `FORCE=1`:
```bash
FORCE=1 python scripts/seed_reset.py
```

### Usage
```bash
# Using Makefile:
make seed-reset

# Using PowerShell:
python scripts/seed_reset.py
```
After resetting, row counts are displayed for `users`, `incidents`, `resources`, and `donation_campaigns`.
