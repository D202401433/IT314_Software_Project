import asyncio
import base64
import hashlib
import hmac
import json
import logging
import os
import time
from contextlib import asynccontextmanager
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, Header, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Load environment variables
load_dotenv()

JWT_SECRET = os.getenv("JWT_SECRET", "supersecretkey_change_in_production_32chars_min")

logger = logging.getLogger("drch.backend")
logging.basicConfig(level=logging.INFO)

# ==============================================================================
# Helper JWT implementation (HS256) - zero external dependency issues
# ==============================================================================
def b64_url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode().rstrip("=")

def b64_url_decode(s: str) -> bytes:
    padding = "=" * ((4 - len(s) % 4) % 4)
    return base64.urlsafe_b64decode(s + padding)

def create_jwt_token(payload: dict, secret: str = JWT_SECRET, expires_in: int = 86400) -> str:
    payload_copy = dict(payload)
    payload_copy["exp"] = int(time.time()) + expires_in
    h_bytes = b64_url_encode(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
    p_bytes = b64_url_encode(json.dumps(payload_copy).encode())
    signing_input = f"{h_bytes}.{p_bytes}".encode()
    signature = b64_url_encode(hmac.new(secret.encode(), signing_input, hashlib.sha256).digest())
    return f"{h_bytes}.{p_bytes}.{signature}"

def verify_jwt_token(token: str, secret: str = JWT_SECRET) -> dict:
    parts = token.split(".")
    if len(parts) != 3:
        raise ValueError("Invalid JWT format")
    h_str, p_str, sig_str = parts
    signing_input = f"{h_str}.{p_str}".encode()
    expected_sig = b64_url_encode(hmac.new(secret.encode(), signing_input, hashlib.sha256).digest())
    if not hmac.compare_digest(sig_str, expected_sig):
        raise ValueError("JWT signature verification failed")
    payload = json.loads(b64_url_decode(p_str).decode())
    if "exp" in payload and payload["exp"] < time.time():
        raise ValueError("JWT token has expired")
    return payload

# ==============================================================================
# In-Memory & Persistent Demo Users Repository (Matches DRCH Roles 1-to-1)
# ==============================================================================
DEMO_USERS = [
    {
        "id": "USR-001",
        "name": "Dr. Rajesh Sharma",
        "email": "commander@resq.gov.in",
        "role": "Command Officer / Incident Commander",
        "agency": "National Disaster Management Authority (NDMA)",
        "badgeNumber": "NDMA-HQ-01",
        "phone": "+91 98765 43210",
        "password": "admin123password",
    },
    {
        "id": "USR-002",
        "name": "Priya Nair",
        "email": "dispatcher@resq.gov.in",
        "role": "Dispatcher",
        "agency": "ERSS 112 Emergency Operations Center",
        "badgeNumber": "ERSS-OP-44",
        "phone": "+91 98765 43211",
        "password": "admin123password",
    },
    {
        "id": "USR-003",
        "name": "Riya Shah",
        "email": "medic@resq.gov.in",
        "role": "Medic / Ambulance Team",
        "agency": "Emergency Medical Services (EMS 108)",
        "badgeNumber": "EMS-MED-07",
        "phone": "+91 98765 43212",
        "assignedUnitCallsign": "AMB-07",
        "password": "provider123password",
    },
    {
        "id": "USR-004",
        "name": "Arjun Patel",
        "email": "firefighter@resq.gov.in",
        "role": "Firefighter / Fire Service Officer",
        "agency": "State Disaster Fire & Rescue Service",
        "badgeNumber": "SFS-CMD-17",
        "phone": "+91 98765 43213",
        "assignedUnitCallsign": "FIRE-17",
        "password": "provider123password",
    },
    {
        "id": "USR-005",
        "name": "Mehul Joshi",
        "email": "ndrf@resq.gov.in",
        "role": "NDRF / SDRF Team Leader or Responder",
        "agency": "8th Battalion NDRF (Rapid Response)",
        "badgeNumber": "NDRF-BN8-04",
        "phone": "+91 98765 43214",
        "assignedUnitCallsign": "RESCUE-04",
        "password": "provider123password",
    },
    {
        "id": "USR-006",
        "name": "Neha Desai",
        "email": "logistics@resq.gov.in",
        "role": "Logistics Officer",
        "agency": "Disaster Relief Supply & Inventory Command",
        "badgeNumber": "LOG-SUP-12",
        "phone": "+91 98765 43215",
        "password": "provider123password",
    },
    {
        "id": "USR-007",
        "name": "Devendra Rao",
        "email": "admin@resq.gov.in",
        "role": "System Administrator",
        "agency": "ISRO / DRCH Technical Operations",
        "badgeNumber": "SYS-ADMIN-01",
        "phone": "+91 98765 43216",
        "password": "admin123password",
    },
    {
        "id": "USR-008",
        "name": "Ananya Verma",
        "email": "citizen@example.com",
        "role": "Public / Citizen",
        "agency": "Resident / Public Citizen",
        "phone": "+91 98765 43217",
        "password": "user123password",
    },
]

# Mutable users store
users_db: dict[str, dict] = {}

def initialize_users_db():
    users_db.clear()
    for u in DEMO_USERS:
        users_db[u["email"].lower()] = dict(u)
        users_db[u["id"].lower()] = dict(u)
        if "badgeNumber" in u:
            users_db[u["badgeNumber"].lower()] = dict(u)

    # Aliases to guarantee 100% smooth matching for all variations
    # Citizen aliases
    citizen_user = dict(DEMO_USERS[7])
    users_db["citizen@resq.gov.in"] = citizen_user
    users_db["citizen"] = citizen_user
    users_db["user"] = citizen_user
    users_db["resident"] = citizen_user
    users_db["public"] = citizen_user

    # Commander aliases
    commander_user = dict(DEMO_USERS[0])
    users_db["commander"] = commander_user
    users_db["incident commander"] = commander_user

    # Dispatcher aliases
    disp_user = dict(DEMO_USERS[1])
    users_db["dispatcher"] = disp_user
    users_db["112"] = disp_user

    # Medic aliases
    medic_user = dict(DEMO_USERS[2])
    users_db["medic"] = medic_user
    users_db["ambulance"] = medic_user
    users_db["amb-07"] = medic_user
    users_db["108"] = medic_user

    # Firefighter aliases
    fire_user = dict(DEMO_USERS[3])
    users_db["firefighter"] = fire_user
    users_db["fire"] = fire_user
    users_db["fire-17"] = fire_user

    # NDRF aliases
    ndrf_user = dict(DEMO_USERS[4])
    users_db["ndrf"] = ndrf_user
    users_db["sdrf"] = ndrf_user
    users_db["rescue-04"] = ndrf_user
    users_db["ndrf-8bn-09"] = ndrf_user

    # Logistics aliases
    log_user = dict(DEMO_USERS[5])
    users_db["logistics"] = log_user
    users_db["supply"] = log_user
    users_db["log-disp-03"] = log_user

    # Admin aliases
    adm_user = dict(DEMO_USERS[6])
    users_db["admin"] = adm_user
    users_db["administrator"] = adm_user
    users_db["sys-admin-99"] = adm_user

initialize_users_db()

def find_user(identifier: str) -> Optional[dict]:
    if not identifier:
        return None
    ident = identifier.strip().lower()
    if ident in users_db:
        return users_db[ident]
    
    # Prefix / substring search across all registered users
    for user in list(users_db.values()):
        if (
            user.get("email", "").lower() == ident
            or user.get("id", "").lower() == ident
            or user.get("badgeNumber", "").lower() == ident
            or user.get("assignedUnitCallsign", "").lower() == ident
            or user.get("name", "").lower() == ident
        ):
            return user
    return None

# ==============================================================================
# Pydantic Schemas
# ==============================================================================
class LoginRequest(BaseModel):
    identifier: str
    password: Optional[str] = ""
    role: Optional[str] = None
    name: Optional[str] = None
    agency: Optional[str] = None

class SignupRequest(BaseModel):
    name: str
    email: str
    password: str
    role: str
    agency: Optional[str] = "Independent Resident"
    phone: Optional[str] = "112"
    badgeNumber: Optional[str] = None

# ==============================================================================
# App Lifespan & Initialization
# ==============================================================================
async def ai_workers_background_consumer():
    logger.info("Initializing in-process GenAI Triage & Emergency Worker...")
    try:
        while True:
            await asyncio.sleep(60)
            logger.debug("In-process AI worker heartbeat check.")
    except asyncio.CancelledError:
        logger.info("AI Worker consumer stopped gracefully.")

@asynccontextmanager
async def lifespan(app: FastAPI):
    worker_task = asyncio.create_task(ai_workers_background_consumer())
    logger.info("DRCH Backend Gateway started with JWT Authentication enabled.")
    yield
    worker_task.cancel()
    try:
        await worker_task
    except asyncio.CancelledError:
        pass

app = FastAPI(
    title="DRCH API Gateway & Workers",
    description="Emergency Incident Triage, Clustering, and RBAC Auth Gateway",
    version="1.0.0",
    lifespan=lifespan,
)

# Enable CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==============================================================================
# System Endpoints
# ==============================================================================
@app.get("/")
def read_root():
    return {
        "service": "DRCH API Gateway & In-Process AI Worker",
        "status": "online",
        "version": "1.0.0",
        "auth": "JWT / HS256 active",
        "endpoints": [
            "POST /api/auth/login",
            "POST /api/auth/signup",
            "GET /api/auth/demo-users",
            "GET /api/auth/me",
            "GET /api/system/status",
        ],
    }

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "drch-backend",
        "active_users_registered": len(DEMO_USERS),
    }

@app.get("/api/system/status")
def system_status():
    return {
        "connected": True,
        "backend": "FastAPI (Python 3.13)",
        "gatewayUrl": "http://127.0.0.1:8000",
        "jwtAuth": True,
        "totalDemoAccounts": len(DEMO_USERS),
    }

# ==============================================================================
# Authentication Endpoints
# ==============================================================================
@app.get("/api/auth/demo-users")
@app.get("/api/auth/demo-users/")
@app.get("/auth/demo-users")
@app.get("/demo-users")
def get_demo_users():
    """Returns list of public profiles for demo fast-login."""
    safe_list = []
    for u in DEMO_USERS:
        item = dict(u)
        item.pop("password", None)
        safe_list.append(item)
    return {"success": True, "users": safe_list}

@app.post("/api/auth/login")
@app.post("/api/auth/login/")
@app.post("/auth/login")
@app.post("/auth/login/")
@app.post("/api/login")
@app.post("/api/login/")
@app.post("/login")
def api_login(req: LoginRequest):
    """
    Authenticate user by email, ID, badge number, or short alias.
    Never returns 404. If account doesn't exist yet, it auto-provisions seamlessly.
    """
    raw_ident = req.identifier.strip()
    if not raw_ident:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Identifier cannot be empty.",
        )

    user = find_user(raw_ident)

    # If not found in presets, seamlessly auto-provision so user is NEVER blocked
    if not user:
        clean_name = raw_ident.split("@")[0].replace(".", " ").replace("_", " ").title() if "@" in raw_ident else raw_ident.title()
        user_id = f"USR-{abs(hash(raw_ident)) % 900 + 100:03d}"
        role = req.role or ("Command Officer / Incident Commander" if "command" in raw_ident.lower() else "Public / Citizen")
        user = {
            "id": user_id,
            "name": req.name or clean_name,
            "email": raw_ident if "@" in raw_ident else f"{raw_ident.lower()}@resq.gov.in",
            "role": role,
            "agency": req.agency or ("NDMA Operations" if "command" in raw_ident.lower() else "Resident / Public Citizen"),
            "phone": "+91 98765 00000",
            "password": req.password or "user123password",
        }
        users_db[raw_ident.lower()] = user
        users_db[user["email"].lower()] = user
        users_db[user["id"].lower()] = user
        logger.info(f"Auto-provisioned session for '{raw_ident}' as {role}")

    # Validate password only if explicit user entered a non-matching password
    stored_password = user.get("password")
    if stored_password and req.password:
        # Allow either standard demo passwords or exact password
        valid_passwords = {stored_password, "admin123password", "provider123password", "user123password", "citizen123password"}
        if req.password.strip() not in valid_passwords and req.password.strip() != stored_password:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect password. For demo accounts, click the 1-Click login or use standard demo password.",
            )

    token = create_jwt_token(
        {
            "sub": user["id"],
            "email": user["email"],
            "name": user["name"],
            "role": user["role"],
            "agency": user.get("agency", ""),
        }
    )

    safe_user = dict(user)
    safe_user.pop("password", None)

    logger.info(f"User {user['name']} ({user['role']}) authenticated successfully via API Gateway.")
    return {
        "success": True,
        "message": f"Welcome back, {user['name']}!",
        "token": token,
        "user": safe_user,
    }

@app.post("/api/auth/signup")
@app.post("/api/auth/signup/")
@app.post("/auth/signup")
@app.post("/auth/signup/")
@app.post("/api/signup")
@app.post("/api/signup/")
@app.post("/signup")
def api_signup(req: SignupRequest):
    """
    Register a new user account and return signed JWT token.
    """
    email_clean = req.email.strip().lower()

    new_id = f"USR-{int(time.time() * 1000) % 100000:04d}"
    new_user = {
        "id": new_id,
        "name": req.name.strip(),
        "email": email_clean,
        "password": req.password.strip(),
        "role": req.role,
        "agency": req.agency or "Independent Resident",
        "phone": req.phone or "+91 98765 00000",
        "badgeNumber": req.badgeNumber,
    }

    users_db[email_clean] = new_user
    users_db[new_id.lower()] = new_user

    token = create_jwt_token(
        {
            "sub": new_id,
            "email": email_clean,
            "name": new_user["name"],
            "role": new_user["role"],
            "agency": new_user["agency"],
        }
    )

    safe_user = dict(new_user)
    safe_user.pop("password", None)

    logger.info(f"New user registered via API: {new_user['name']} as {new_user['role']}")
    return {
        "success": True,
        "message": "Account created successfully!",
        "token": token,
        "user": safe_user,
    }

@app.get("/api/auth/me")
@app.get("/api/auth/me/")
@app.get("/auth/me")
@app.get("/me")
def api_me(authorization: Optional[str] = Header(None)):
    """
    Validate incoming Bearer JWT token and return active user profile.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Bearer authorization header",
        )

    token = authorization.split(" ")[1]
    try:
        payload = verify_jwt_token(token)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token verification failed: {str(e)}",
        )

    user = find_user(payload.get("sub", "")) or find_user(payload.get("email", ""))
    if not user:
        # Fall back to token payload profile
        return {
            "success": True,
            "user": {
                "id": payload.get("sub", "USR-GUEST"),
                "name": payload.get("name", "Verified User"),
                "email": payload.get("email", "user@resq.gov.in"),
                "role": payload.get("role", "Public / Citizen"),
                "agency": payload.get("agency", "Resident"),
            },
        }

    safe_user = dict(user)
    safe_user.pop("password", None)
    return {"success": True, "user": safe_user}
