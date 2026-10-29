# DRCH Backend Test Suite Reference

Comprehensive guide to executing backend unit and integration tests, configuring database guards, starting the local PostGIS test container, and utilizing test fixtures.

---

## 1. How to Run Tests

The backend test suite is managed via `pytest` from the `backend/` directory.

### Quick Start (Unit Tests Only / No Database)

When `TEST_DATABASE_URL` is unset or PostgreSQL is unreachable, all DB-backed tests skip automatically. Only unit and fallback tests run:

```bash
cd backend
python -m pytest tests/ -v --tb=short
```

### Full Test Suite (With Database)

To run both unit tests and PostGIS-backed integration tests, configure `TEST_DATABASE_URL`:

**Linux / macOS / Git Bash:**
```bash
cd backend
export TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/drch_test"
python -m pytest tests/ -v --tb=short
```

**Windows PowerShell:**
```powershell
cd backend
$env:TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/drch_test"
python -m pytest tests/ -v --tb=short
```

### Running with CI Guard Active

To guarantee that DB-backed tests are not accidentally skipped:

```bash
export REQUIRE_DB_TESTS=1
python -m pytest tests/ -v --tb=short
```

If zero DB tests execute while `REQUIRE_DB_TESTS=1`, the test suite fails with exit status `1`.

---

## 2. How to Start the PostGIS Test Container

The integration suite requires PostgreSQL with PostGIS extensions. Start an isolated container using Docker:

```bash
docker run -d \
  --name drch_test_db \
  -p 5432:5432 \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=drch_test \
  postgis/postgis:16-3.4
```

Verify that the container is healthy and ready to accept connections:

```bash
docker exec -it drch_test_db pg_isready -U postgres -d drch_test
```

To stop and clean up the test database container:

```bash
docker stop drch_test_db && docker rm drch_test_db
```

---

## 3. Environment Variables Reference

| Variable | Required | Secret | Purpose |
|---|---|---|---|
| `TEST_DATABASE_URL` | No | S | Explicit connection string for the test database; must end with `_test`. If omitted, defaults to `/drch_test` on `DATABASE_URL`. |
| `REQUIRE_DB_TESTS` | No | — | CI test guard; set to `1` to fail the test run if zero DB-marked tests executed. |

---

## 4. Test Fixtures (`backend/tests/conftest.py`)

- `client`: Session-scoped FastAPI `TestClient` initialized without background worker loops.
- `sql`: Autocommit `psycopg` connection using `dict_row` row factory for direct database state arrangement and assertion.
- `make`: Factory instance bound to `sql` connection for creating test entities (users, incidents, agencies, resources).
- `citizen_user`: Active `NORMAL_USER` citizen account with pre-issued bearer headers and no MFA.
- `staff_user`: Active `DISASTER_MGMT` staff account with TOTP MFA secret and `DISPATCH`, `SUPERVISOR` permissions.
- `field_user`: Active `FIELD_TEAM` user bound to a team resource, gracefully skipping if table or role is not yet in schema.

---

## 5. Database Seed Reset (`make seed-reset`)

The seed reset utility safely cleans dynamic operational data and reapplies baseline seed files (`backend/db/seeds/seed_data.sql`). It is completely idempotent.

### Running Seed Reset

**Using Make (Linux / macOS / Git Bash):**
```bash
make seed-reset
```

**Using PowerShell (Windows without Make):**
```powershell
python scripts/seed_reset.py
```

**Custom Seed Files:**
The seed file list is defined at the top of the root `Makefile` via `SEED_FILES`. In PowerShell:
```powershell
$env:SEED_FILES="backend/db/seeds/seed_data.sql"; python scripts/seed_reset.py
```

### Safety Guard
To prevent accidental data loss on external cloud environments (e.g. Neon, Render, AWS RDS), `seed_reset.py` refuses execution unless:
1. The host is `localhost`, `127.0.0.1`, `::1`, or a docker-compose service name (`postgres-postgis`, `postgres`, `db`), OR
2. The database name ends with `_test` or contains `dev`.

To override the guard on cloud staging databases, supply `FORCE=1`:
```bash
FORCE=1 make seed-reset
# Windows PowerShell:
$env:FORCE="1"; python scripts/seed_reset.py
```

### Post-Reset Verification Row Counts
After applying seeds, the script prints verified row counts:
- `users`: 3 (System Administrator, Automated Ingestion System, Dispatch Supervisor)
- `incidents`: 4 (Ahmedabad, Surat, Anjar, Veraval)
- `resources`: 5 (NDRF, SDRF, 108 Ambulance, Fire HQ, Medical)
- `donation_campaigns`: 3 (CM Relief Fund, Cyclone Relief, Flood Response)

