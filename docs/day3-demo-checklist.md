# 📋 DRCH Day 3 Demonstration Checklist & Runbook

**Platform:** Gujarat Disaster Management Platform (DRCH)  
**Author:** Dhruv (QA & Test Lead)  
**Target Environments:** Local Docker Compose (`http://localhost:3000`, `http://localhost:8000`) and Staging Preview  

---

## 1. Scope & Demonstration Overview

This checklist defines the operational verification runbook for the Day 3 demonstration of the core incident response loop:
1. **Citizen Registration**
2. **Citizen Incident Report (Inside Gujarat)**
3. **Staff Incident Verification via Disaster Management (DM) Workspace**
4. **Public Gujarat Map Visibility & PII Redaction**
5. **Negative Test 1: Location Outside Gujarat Blocked (Browser & Server)**
6. **Negative Test 2: Rejected Incident Stays Off Public Map**
7. **Negative Test 3: Citizen Refused Access to `/dm` (UI & API)**

---

## 2. Pre-Requisites & Initial Setup

Before running the demonstration checklist:

1. **Clean Baseline Seed:**
   ```powershell
   # PowerShell (Windows)
   python scripts/seed_reset.py

   # Or in Bash:
   make seed-reset
   ```
2. **Verify Baseline Counts:**
   - `users`: 3 (System Admin, Incident Commander, Field Responder)
   - `incidents`: 4 (Pre-seeded demo Gujarat incidents)
   - `resources`: 5 (NDRF / SDRF reserve teams)
   - `donation_campaigns`: 3

---

## 3. Core Lifecycle Checklist (Positive Path)

### Step 1: Citizen Self-Registration
* **Objective:** Verify a new resident can register a citizen account without administrative intervention.
* **UI Action:**
  1. Open browser to `http://localhost:3000/signup`.
  2. Enter:
     - **Full Name:** `Ramesh Patel`
     - **Email:** `ramesh.patel.demo@gujarat.gov.in`
     - **Phone:** `+91 9876543210`
     - **Password:** `GujaratSafe2026!#`
     - **Confirm Password:** `GujaratSafe2026!#`
  3. Click **"Create Citizen Account"**.
* **API Action:**
  - *Contract (Phase 0):* `POST /api/v1/auth/register`
  - *Current Gateway:* `POST /api/v1/auth/signup`
  ```json
  {
    "full_name": "Ramesh Patel",
    "email": "ramesh.patel.demo@gujarat.gov.in",
    "phone": "+91 9876543210",
    "password": "GujaratSafe2026!#"
  }
  ```
* **Expected Result:**
  - HTTP 201 Created.
  - JWT token issued with role `NORMAL_USER`.
  - Browser redirects to `/` with citizen session active (`Ramesh Patel · Public Resident`).
  - Attempting to submit the same email again returns **HTTP 409 Conflict** (`EMAIL_TAKEN` or `DUPLICATE_EMAIL`).
* **Pass / Fail Verification:**
  - [ ] **PASS:** Session established; duplicate submission displays email already taken error.
  - [ ] **FAIL:** HTTP 404/500; registration hangs; or duplicate email is allowed without error.

---

### Step 2: Citizen Incident Report (Inside Gujarat)
* **Objective:** Report an active emergency within Gujarat boundaries using an idempotent submission.
* **UI Action:**
  1. On home page `http://localhost:3000/` or citizen dashboard, click **"Report Disaster / Emergency"** (🚨).
  2. Fill the emergency form:
     - **Disaster Category:** `Flood / Urban Flood`
     - **Location Name:** `Subhash Bridge Approach, Ahmedabad, Gujarat`
     - **Coordinates:** Latitude `23.0610`, Longitude `72.5810`
     - **Description:** `Severe waterlogging on approach road. 8 commuters stranded in vehicles.`
     - **Estimated People Affected:** `8`
     - **Urgent Needs:** `Rescue Boats`, `Medical Evacuation`
  3. Click **"Submit Disaster Report"**.
* **API Action:**
  - *Contract (Phase 0):* `POST /api/v1/incidents`
  - *Headers:* `Authorization: Bearer <CITIZEN_TOKEN>`, `Idempotency-Key: demo-inc-gujarat-001`
  - *Current Prototype:* `POST /api/citizen/reports`
* **Expected Result:**
  - HTTP 201 Created.
  - Returns `incident_id` and formatted reference (e.g. `INC-2026-000104`).
  - Status is `SUBMITTED` (or `PENDING` verification).
  - Repeated clicks with identical `Idempotency-Key` return identical incident data without duplicate creation.
* **Pass / Fail Verification:**
  - [ ] **PASS:** Success modal displays reference code; report appears in citizen's tracking list; repeated submit is idempotent.
  - [ ] **FAIL:** Report rejected despite valid Gujarat coordinates; no reference code returned.

---

### Step 3: Staff Incident Verification via DM Portal
* **Objective:** Verify staff authentication with password + TOTP MFA, and promotion of incident to `VERIFIED`.
* **UI Action:**
  1. Navigate to `http://localhost:3000/login?next=/dm`.
  2. Select **"Administrator / Command"** tab.
  3. Enter staff email `commander@resq.gov.in` and password. Click "Sign in".
  4. At MFA prompt, enter the current 6-digit TOTP code from authenticator app / secret.
  5. Upon landing in `/dm/incidents` (Incident Queue), locate the submitted incident (`Subhash Bridge Approach`).
  6. Click the incident to open detail view `/dm/incidents/[id]`.
  7. In the **Decisions Panel**, click **"Verify / reject…"**:
     - **Decision:** `VERIFIED`
     - **Priority:** `HIGH`
     - **Rationale:** `Verified inundation via Ahmedabad traffic CCTV camera feed #41.`
  8. Click **"Confirm Decision"**.
* **API Action:**
  - Login Step 1: `POST /api/v1/auth/login` -> returns `mfa_required: true`.
  - Login Step 2: `POST /api/v1/auth/mfa/verify` -> returns staff JWT (`role: "DISASTER_MGMT"`).
  - Verify Decision: `POST /api/v1/dm/incidents/{incident_id}/verification`
  ```json
  {
    "version": 1,
    "decision": "VERIFIED",
    "priority": "HIGH",
    "rationale": "Verified inundation via Ahmedabad traffic CCTV camera feed #41."
  }
  ```
* **Expected Result:**
  - HTTP 200 OK.
  - Incident status updates immediately to `VERIFIED`.
  - Verification metadata recorded: `verified_by`, `verified_at`, `priority_rationale`.
  - Audit trail logs `INCIDENT_VERIFIED`.
* **Pass / Fail Verification:**
  - [ ] **PASS:** Incident status badge turns green (`VERIFIED`); dispatch button becomes active; audit entry appears.
  - [ ] **FAIL:** Staff sign-in fails; MFA rejected; or status remains `SUBMITTED`.

---

### Step 4: Public Gujarat Map Display & PII Protection
* **Objective:** Confirm the verified incident is publicly visible on the map without leaking citizen reporter identity or sensitive free-text descriptions.
* **UI Action:**
  1. Open an incognito browser window (unauthenticated public user).
  2. Navigate to `http://localhost:3000/`.
  3. Inspect the Gujarat OpenStreetMap canvas centered on Ahmedabad (`23.0610, 72.5810`).
  4. Click the incident marker.
* **API Action:**
  - *Contract (Phase 0):* `GET /api/v1/public/incidents`
  - *Current Prototype:* `GET /api/public/incidents`
* **Expected Result:**
  - HTTP 200 OK.
  - Marker is visible at the verified location.
  - Popup displays:
    - Reference code (`INC-2026-000104`)
    - Scenario (`urban_flooding`)
    - District (`Ahmedabad`)
    - Priority (`HIGH`)
  - **Zero Privacy Leakage:**
    - No reporter name (`Ramesh Patel`)
    - No phone number (`+91 9876543210`)
    - No user IDs (`user_id`, `reporter_id`)
    - No raw citizen free-text notes
* **Pass / Fail Verification:**
  - [ ] **PASS:** Marker visible at Subhash Bridge; popup contains verified public badges; inspect network tab to confirm payload contains NO personal fields.
  - [ ] **FAIL:** Marker absent; or payload contains `reporter_name`, `reporter_phone`, or `description`.

---

## 4. Negative Test Cases & Security Guards

### Negative 1: Location Outside Gujarat Blocked in Browser and Server
* **Objective:** Ensure emergency reports outside Gujarat jurisdiction are rejected by both client-side boundaries and PostGIS spatial validation.
* **UI Action:**
  1. Open Report Modal (`/` or `/citizen/dashboard`).
  2. Input coordinates outside Gujarat:
     - **Location Name:** `Marine Drive, Mumbai, Maharashtra`
     - **Latitude:** `18.9438`
     - **Longitude:** `72.8232`
     - **Description:** `High tidal surge near promenade.`
  3. Click **"Submit Disaster Report"**.
* **API Action:**
  - `POST /api/v1/incidents` with coordinates outside Gujarat.
* **Expected Result:**
  - **Browser:** Validation warning or toast indicating location is outside Gujarat state jurisdiction.
  - **Server:** HTTP 422 Unprocessable Entity with error code `OUTSIDE_GUJARAT`:
    ```json
    {
      "error": {
        "code": "OUTSIDE_GUJARAT",
        "message": "Coordinates lie outside the state boundary of Gujarat",
        "details": null
      }
    }
    ```
  - No database record is inserted.
* **Pass / Fail Verification:**
  - [ ] **PASS:** Browser blocks submit or displays warning; API returns 422 `OUTSIDE_GUJARAT`; no out-of-state incident stored.
  - [ ] **FAIL:** Out-of-state incident accepted with 201 Created; or unhandled 500 error.

---

### Negative 2: Rejected Incident Stays Off Public Map
* **Objective:** Verify that false alarms, spam, or unsubstantiated reports marked as `REJECTED` are strictly isolated from the public map.
* **UI Action:**
  1. Log in to DM Portal `/dm` as Incident Commander.
  2. Open an unverified report in `/dm/incidents/[id]`.
  3. In Decisions Panel, click **"Verify / reject…"**:
     - **Decision:** `REJECTED`
     - **Rationale:** `False alarm - on-scene spotter confirms no waterlogging or blockage.`
  4. Confirm rejection.
  5. In unauthenticated incognito window, refresh the public map `/`.
* **API Action:**
  - Verification: `POST /api/v1/dm/incidents/{incident_id}/verification` with `{"decision": "REJECTED", "rationale": "..."}`
  - Public Query: `GET /api/v1/public/incidents`
* **Expected Result:**
  - Incident status becomes `REJECTED`.
  - `GET /api/v1/public/incidents` excludes the rejected incident.
  - Public map `/` displays no marker for the rejected report.
* **Pass / Fail Verification:**
  - [ ] **PASS:** Incident does not appear on public map; public incidents JSON array does not contain the rejected incident ID.
  - [ ] **FAIL:** Rejected incident appears on public map or in public incidents feed.

---

### Negative 3: Citizen Forbidden from Accessing `/dm`
* **Objective:** Ensure RBAC prevents non-staff users from viewing dispatch queues, resources, or operational controls.
* **UI Action:**
  1. Authenticate as a normal citizen (`Ramesh Patel`).
  2. Manually enter URL `http://localhost:3000/dm` in browser address bar and press Enter.
* **API Action:**
  - `GET /api/v1/dm/incidents` with citizen bearer token.
* **Expected Result:**
  - **Browser:** Next.js `/dm/layout.tsx` detects non-staff role and displays:
    ```
    403 · Not authorised
    This workspace is for Disaster Management staff
    Your account does not have access to operational tools.
    ```
  - **API:** Gateway returns **HTTP 403 Forbidden** with error code `ROLE_REQUIRED`:
    ```json
    {
      "error": {
        "code": "ROLE_REQUIRED",
        "message": "Disaster Management role required",
        "details": null
      }
    }
    ```
  - Audit log records `ACCESS_DENIED`.
* **Pass / Fail Verification:**
  - [ ] **PASS:** UI blocks workspace access with 403 banner; API refuses requests with 403 `ROLE_REQUIRED`.
  - [ ] **FAIL:** Citizen views operational tools, or API returns 200 OK.

---

## 5. Automated Execution via `scripts/smoke.sh`

Run the automated contract smoke test covering this lifecycle:

```bash
# In Git Bash (Windows) or Linux:
export SMOKE_BASE_URL="http://localhost:8000"
export SMOKE_STAFF_EMAIL="commander@resq.gov.in"
export SMOKE_STAFF_PASSWORD="<STAFF_PASSWORD>"
export SMOKE_STAFF_TOTP_SECRET="<STAFF_TOTP_SECRET>"

./scripts/smoke.sh
```

To run with pending contract endpoints skipped:
```bash
SMOKE_SKIP_REGISTER=1 \
SMOKE_SKIP_INCIDENT_SUBMIT=1 \
SMOKE_SKIP_OUTSIDE_GUJARAT=1 \
SMOKE_SKIP_PUBLIC_UNVERIFIED=1 \
SMOKE_SKIP_PUBLIC_VERIFIED=1 \
./scripts/smoke.sh
```
