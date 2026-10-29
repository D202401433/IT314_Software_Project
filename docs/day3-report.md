# 📊 Day 3 Demonstration & Quality Assurance Report

**Repository:** `Siddhcreator-1706/IT314_Software_Project`  
**Lead QA:** Dhruv  
**Execution Timestamp:** 2026-10-29T15:58:54+05:30  
**Overall Status:** **FAIL**  

---

## 1. Executive Status & Stack Diagnostics

* **Overall Result:** **FAIL** (Core loop automated smoke test and demo checklist blocked by missing Phase 0 contract endpoints in backend, inactive local container engine, and missing frontend spatial boundary controls).
* **Container Infrastructure (`docker compose up -d`):** **FAILED**
  - **Command:** `docker compose up -d`
  - **Return Code:** `1`
  - **Error Output:**
    ```
    level=warning msg="docker-compose.yml: the attribute `version` is obsolete, it will be ignored"
    failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified.
    ```
  - **Fact:** Docker Desktop daemon is not running on the Windows host. Local PostGIS container (`drch_postgres`) was not running on port 5432.
* **Standalone Backend Execution:** FastAPI gateway successfully executed on `http://127.0.0.1:8000` via Uvicorn, serving root and health endpoints, but reporting database reachability as `unavailable`.

---

## 2. Demonstration Checklist Execution Matrix

| Step / Test Case | Mode | Target / Contract Endpoint | Actual Status | Result | Likely Owner |
| :--- | :--- | :--- | :--- | :---: | :--- |
| **1. Health & Readiness** | API | `GET /health`<br>`GET /health/ready` | `200 OK`<br>`404 Not Found` (Fallback: `GET /api/v1/health` 200) | **PASS** *(via fallback)* | Siddh |
| **2. Citizen Registration** | API / UI | `POST /api/v1/auth/register` | `404 Not Found` | **FAIL** | Zalak (Citizen API) |
| **3. Incident Report (Gujarat)** | API / UI | `POST /api/v1/incidents` | `404 Not Found` | **FAIL** | Zalak (Citizen API) |
| **4. Staff Login & Verify** | API / UI | `POST /api/v1/auth/mfa/verify`<br>`POST /api/v1/dm/incidents/{id}/verification` | Endpoint code verified in `dm/incidents.py`; blocked on Step 3 submission | **BLOCKED** | Siddh / Zalak |
| **5. Public Map Visibility** | API / UI | `GET /api/v1/public/incidents` | `404 Not Found` | **FAIL** | Nisarg (Public API) |
| **Neg 1: Outside Gujarat (Browser)**| UI | `frontend/src/components/CitizenReportModal.tsx` | No boundary check; modal defaults coordinates to Wayanad, Kerala | **FAIL** | Janvi / Tanishq (Frontend) |
| **Neg 1: Outside Gujarat (Server)** | API | `POST /api/v1/incidents` | `404 Not Found` (expected 422 `OUTSIDE_GUJARAT`) | **FAIL** | Zalak (Citizen API) |
| **Neg 2: Rejected Stays Off Map** | API / UI | `GET /api/v1/public/incidents` | `404 Not Found` | **BLOCKED** | Nisarg (Public API) |
| **Neg 3: Citizen Blocked on `/dm`** | UI / API | `GET /dm` (UI)<br>`GET /api/v1/dm/incidents` (API) | `403 Forbidden` (`ROLE_REQUIRED` in API; 403 unauthorized page in UI) | **PASS** | — |

---

## 3. Detailed Failure Records & Itemized Evidence

### Failure 1: Citizen Registration Endpoint Missing
* **Step:** Demo Checklist Step 1 / Smoke Test Step 2
* **Request:**
  ```http
  POST /api/v1/auth/register HTTP/1.1
  Host: localhost:8000
  Content-Type: application/json

  {
    "email": "ramesh.patel.demo@gujarat.gov.in",
    "password": "[REDACTED]",
    "full_name": "Ramesh Patel",
    "phone": "+91 9876543210"
  }
  ```
* **Actual Status:** `404 Not Found`
* **Response Body (Redacted):**
  ```json
  {
    "detail": "Not Found"
  }
  ```
* **Analysis:** The contract in `docs/api_contracts.md` specifies `POST /api/v1/auth/register`. The backend router `backend/app/routers/auth.py` currently implements `POST /api/v1/auth/signup` instead.
* **Likely Owner:** **Zalak** (Citizen & Public Backend)

---

### Failure 2: Citizen Incident Submission Endpoint Missing
* **Step:** Demo Checklist Step 2 / Smoke Test Step 5
* **Request:**
  ```http
  POST /api/v1/incidents HTTP/1.1
  Host: localhost:8000
  Authorization: Bearer [REDACTED_CITIZEN_TOKEN]
  Idempotency-Key: demo-inc-gujarat-001
  Content-Type: application/json

  {
    "scenario": "urban_flooding",
    "description": "Severe waterlogging on approach road. 8 commuters stranded in vehicles.",
    "reported_urgency": "HIGH",
    "people_affected": 8,
    "location_source": "GPS",
    "latitude": 23.0610,
    "longitude": 72.5810,
    "address_text": "Subhash Bridge Approach, Ahmedabad, Gujarat"
  }
  ```
* **Actual Status:** `404 Not Found`
* **Response Body (Redacted):**
  ```json
  {
    "detail": "Not Found"
  }
  ```
* **Analysis:** `POST /api/v1/incidents` is not mounted on the FastAPI application router. The backend currently contains only the legacy prototype `POST /api/citizen/reports` backed by SQLite.
* **Likely Owner:** **Zalak** (Citizen & Public Backend)

---

### Failure 3: Public Verified Incidents Feed Missing
* **Step:** Demo Checklist Step 4 / Smoke Test Step 7 & 10
* **Request:**
  ```http
  GET /api/v1/public/incidents HTTP/1.1
  Host: localhost:8000
  Accept: application/json
  ```
* **Actual Status:** `404 Not Found`
* **Response Body (Redacted):**
  ```json
  {
    "detail": "Not Found"
  }
  ```
* **Analysis:** The public incident contract endpoint `GET /api/v1/public/incidents` is not implemented in `backend/main.py`. The legacy SQLite endpoint `GET /api/public/incidents` is present, but fails contract filtering and privacy guarantees.
* **Likely Owner:** **Nisarg** (Dispatch & Field Backend / Public Data)

---

### Failure 4: Client-Side Boundary Validation Missing in Frontend
* **Step:** Demo Checklist Negative 1 (Browser Boundary Guard)
* **Observed UI State:**
  - File: `frontend/src/components/CitizenReportModal.tsx` (Lines 19–21)
  - Default coordinates: `lat: 11.5542, lon: 76.1264` (`locationName: "Wayanad, Kerala"`).
  - No client-side spatial polygon or bounding box validation exists to prevent the citizen from selecting or submitting coordinates outside Gujarat boundaries.
* **Analysis:** The browser form allows submission of non-Gujarat coordinates without user warning or validation error.
* **Likely Owner:** **Janvi / Tanishq** (Frontend Architecture & UI Components)

---

### Failure 5: Server Spatial Refusal Unreachable
* **Step:** Demo Checklist Negative 1 (Server Boundary Guard)
* **Request:**
  ```http
  POST /api/v1/incidents HTTP/1.1
  Host: localhost:8000
  Authorization: Bearer [REDACTED_CITIZEN_TOKEN]
  Content-Type: application/json

  {
    "scenario": "urban_flooding",
    "description": "High tidal surge near promenade.",
    "reported_urgency": "HIGH",
    "people_affected": 2,
    "location_source": "GPS",
    "latitude": 18.9438,
    "longitude": 72.8232,
    "address_text": "Marine Drive, Mumbai, Maharashtra"
  }
  ```
* **Actual Status:** `404 Not Found` (Expected: `422 Unprocessable Entity` with error code `OUTSIDE_GUJARAT`)
* **Response Body (Redacted):**
  ```json
  {
    "detail": "Not Found"
  }
  ```
* **Analysis:** Spatial rejection logic cannot trigger because the route `POST /api/v1/incidents` is not mounted.
* **Likely Owner:** **Zalak** (Citizen & Public Backend)

---

## 4. Successful Verification Record

### Verification 1: RBAC Enforcement on Operational Routes (Negative 3)
* **UI Test:**
  - Logged in as citizen (`Public / Citizen`).
  - Navigated to `http://localhost:3000/dm`.
  - Result: Next.js `DmLayout` rendered the blocked access screen:
    ```
    403 · Not authorised
    This workspace is for Disaster Management staff
    Your account does not have access to operational tools.
    ```
* **API Test:**
  - Invoked `GET /api/v1/dm/incidents` with citizen JWT bearer token.
  - Actual Status: `403 Forbidden`
  - Response Body:
    ```json
    {
      "error": {
        "code": "ROLE_REQUIRED",
        "message": "Disaster Management role required",
        "details": null
      }
    }
    ```
* **Result:** **PASS** (Strict role isolation enforced on both client and API gateway).

---

## 5. Test Suite Execution Summary

Executed the automated test suite via pytest in `backend/`:

```
============================= test session starts =============================
platform win32 -- Python 3.13.15, pytest-9.2.0, pluggy-1.7.0 -- C:\Users\Dhruv\AppData\Local\Programs\Python\Python313\python.exe
cachedir: .pytest_cache
rootdir: C:\Users\Dhruv\.gemini\antigravity-ide\scratch\IT314_Software_Project\backend
plugins: anyio-4.15.1, langsmith-0.12.2
collecting ... collected 76 items

======================== DRCH SUITE EXECUTION SUMMARY =========================
Executed Tests: 22 (Passed: 22, Failed: 0)
Skipped Tests:  54
  DB-backed Tests: Passed: 0, Failed: 0, Skipped: 54
  Non-DB Tests:    Passed: 22, Failed: 0, Skipped: 0
REQUIRE_DB_TESTS: OFF (inactive)
================== 22 passed, 54 skipped, 1 warning in 2.53s ==================
```

* **Non-DB Unit Tests:** 22 executed, 22 passed (100% pass rate for pure units, crypto, AI guardrails, geo offline resolution, and CI guard logic).
* **DB-Backed Tests:** 54 skipped (test database container unreachable).
