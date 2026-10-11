#!/usr/bin/env python3
"""
DRCH Sprint 1 - GitHub setup: labels, milestone and issues (idempotent).

Source: DRCH_User_Stories_SRS_Final_v4.xlsx (story text, acceptance criteria) and
DRCH_Sprint_Plan_10-person_team_5_sprints.pdf (Sprint 1 scope, allocation, order).

Authentication: this script never reads, stores or prints a token. It calls the
GitHub CLI (`gh`), which uses your `gh auth login` session or the GH_TOKEN env var.

Usage:
  python create_sprint1_issues.py --dry-run     # show what would happen, change nothing
  python create_sprint1_issues.py               # create missing labels, milestone, issues
  python create_sprint1_issues.py --refresh     # also re-link bodies and add missing assignees
"""
import argparse, json, os, re, shutil, subprocess, sys, time

# =============================== CONFIGURATION ===============================
REPO = os.environ.get("DRCH_REPO", "OWNER/REPO")            # e.g. "my-org/drch"
MILESTONE_TITLE = "Sprint 1 (Weeks 1-2)"
MILESTONE_DUE = os.environ.get("DRCH_S1_DUE", "")            # YYYY-MM-DD; blank = none (start date TBD)
CREATE_DELAY_SECONDS = 1.0                                   # pause between writes (GitHub guidance)

# Role -> GitHub username. Set via env vars (DRCH_USER_FE1 ...) or edit the defaults.
# Unset / "REPLACE_ME" roles are skipped: the issue is created unassigned + 'needs-assignee'.
PLACEHOLDER = "REPLACE_ME"
TEAM = {role: os.environ.get(f"DRCH_USER_{role}", PLACEHOLDER) for role in
        ["FE1", "FE2", "BE1", "BE2", "BE3", "DB1", "INT1", "QA1", "QA2", "DO1", "SRS_OWNER"]}
# SRS_OWNER = person who decides the open SRS questions (CR-23, CR-46, CR-47); not in the plan's 10 roles.

# =============================== DATA (from your documents) ==================
# Priority is derived from the plan's in-sprint order ("auth and RBAC first, then config,
# then abuse and policy"). MoSCoW priority is TBD in the plan; edit PRIORITY if you set one.
STORIES = [
 {
  "id": "US-N01",
  "front": "As a Normal User, I want to register an account, so that I can report incidents, donate and contribute aid.",
  "ac": "• Public sign-up creates a Normal User account only.\n• Duplicate or invalid registration is rejected with a clear message.\n• The dashboard is shown only after authentication.\n• Consent is captured as part of the registration input.",
  "fr": "NU-FR-01, AM-FR-11",
  "nfr": "NU-NFR-12",
  "eh": "EH-01"
 },
 {
  "id": "US-N02",
  "front": "As a Normal User, I want to log in and log out securely, so that my account and reports stay protected.",
  "ac": "• Valid credentials create a secure session.\n• Failed login shows a generic message that does not reveal whether the account exists.\n• Repeated failures trigger the configured rate limit or lockout.\n• I can request a password reset; the response is the same whether or not the account exists.",
  "fr": "NU-FR-01, AM-FR-11",
  "nfr": "NU-NFR-12",
  "eh": "EH-02, EH-19"
 },
 {
  "id": "US-D01",
  "front": "As a Disaster Management staff member, I want to log in with MFA, so that only authorised staff access operational tools.",
  "ac": "• Valid credentials plus MFA give a secure session with my permission set.\n• Suspended or expired accounts and failed MFA are refused.\n• The dashboard loads only after authentication.",
  "fr": "DM-FR-01",
  "nfr": "DM-NFR-05",
  "eh": "EH-02, EH-11"
 },
 {
  "id": "US-D30",
  "front": "As a Disaster Management staff member, I want to be limited to actions my permissions allow, so that no one can act beyond their authority.",
  "ac": "• Only three roles exist; moderator, closer, Publisher/Approver and supervisor are permissions.\n• Self-escalation is impossible; RBAC and penetration tests pass.\n• A page requested without the matching role redirects to login if I am not signed in, or shows an access-denied page if I am.",
  "fr": "DM-FR-01, AM-FR-02",
  "nfr": "DM-NFR-05",
  "eh": "EH-11"
 },
 {
  "id": "US-A01",
  "front": "As an Application Management administrator, I want to log in with MFA, so that platform administration is protected.",
  "ac": "• Valid credentials plus MFA give an admin session.\n• Invalid or disabled accounts and MFA failure are refused.\n• The console loads only after authentication.",
  "fr": "AM-FR-01",
  "nfr": "AM-NFR-06",
  "eh": "EH-02"
 },
 {
  "id": "US-A02",
  "front": "As an Application Management administrator, I want to create, suspend and reactivate staff, admin and user accounts, so that only vetted people have access.",
  "ac": "• Staff and admin accounts are created only by me.\n• Only the three roles can be assigned.\n• Before and after states are audited.",
  "fr": "AM-FR-02",
  "nfr": "AM-NFR-06",
  "eh": "EH-11"
 },
 {
  "id": "US-A03",
  "front": "As an Application Management administrator, I want to grant Publisher/Approver, moderator, closer and supervisor permissions inside Disaster Management, so that staff only get the authority they need.",
  "ac": "• Permissions are granted and revoked individually.\n• No fourth role can be created.\n• Changes take effect immediately and are audited.",
  "fr": "AM-FR-02",
  "nfr": "DM-NFR-05",
  "eh": "EH-11"
 },
 {
  "id": "US-A04",
  "front": "As an Application Management administrator, I want to be prevented from removing the last active administrator or escalating my own privileges, so that the platform is never left without control.",
  "ac": "• Removing the last admin is refused.\n• Self-escalation is refused and logged.",
  "fr": "AM-FR-02",
  "nfr": "AM-NFR-06",
  "eh": "EH-11"
 },
 {
  "id": "US-A05",
  "front": "As an Application Management administrator, I want to manage scenario, notification, timeout, escalation and duplicate-detection settings, so that behaviour can change safely.",
  "ac": "• Settings are versioned and audited.\n• The scenario setting can enable or disable only the three scenarios.\n• Attempts to add a scenario or role are refused.",
  "fr": "AM-FR-03",
  "nfr": "AM-NFR-01, AM-NFR-14",
  "eh": "EH-24"
 },
 {
  "id": "US-A07",
  "front": "As an Application Management administrator, I want to search and filter protected audit records of security and operational events, so that I can investigate and prove what happened.",
  "ac": "• Moderation decisions, closures and staff-recorded agency acknowledgements are included.\n• Logs are protected from alteration.\n• Access to logs is controlled.",
  "fr": "AM-FR-05",
  "nfr": "AM-NFR-09, DM-NFR-06",
  "eh": "–"
 },
 {
  "id": "US-A09",
  "front": "As an Application Management administrator, I want to manage security controls, secrets and security incidents, so that the platform resists attacks.",
  "ac": "• Secrets are protected and rotated.\n• Every change is audited.\n• Actionable alerts are shown.",
  "fr": "AM-FR-07",
  "nfr": "AM-NFR-06",
  "eh": "–"
 },
 {
  "id": "US-A11",
  "front": "As an Application Management administrator, I want to configure notification channels, templates, routing and retry including the in-app fallback, so that notifications are reliable.",
  "ac": "• Configuration is validated, versioned and tested before activation.\n• The in-app channel is the fallback.",
  "fr": "AM-FR-09",
  "nfr": "AM-NFR-08",
  "eh": "EH-13"
 },
 {
  "id": "US-A13",
  "front": "As an Application Management administrator, I want to configure per-account, per-IP and per-endpoint rate limits and block or allow lists, so that spam and bots are contained.",
  "ac": "• Limits apply to sign-up, login, reporting, uploads, flags and donations.\n• Every action is logged.\n• Legitimate reports are never silently discarded and thresholds are not revealed.\n• A source that keeps exceeding limits is throttled and then blocked, Application Management is alerted, and other users' reports continue to be accepted.\n• A block can be lifted after review.\n• If the abuse-control service itself fails, it fails safe and an alert is raised.",
  "fr": "AM-FR-11",
  "nfr": "AM-NFR-13",
  "eh": "EH-18, EH-19"
 },
 {
  "id": "US-A14",
  "front": "As an Application Management administrator, I want to configure the moderation policy (allowed types, scan settings, auto-quarantine rules, backlog thresholds), so that moderators enforce a consistent policy.",
  "ac": "• Policy is versioned and audited.\n• Moderators see the effective policy and version.\n• A backlog above threshold raises an alert.",
  "fr": "AM-FR-12",
  "nfr": "DM-NFR-14",
  "eh": "EH-20, EH-21"
 },
 {
  "id": "US-A17",
  "front": "As an Application Management administrator, I want to work with modular, documented and testable services and configuration, so that the system is easy to change.",
  "ac": "• Configuration covers scenarios, notifications, timeouts, escalation, duplicate detection, abuse thresholds and moderation policy.\n• Architecture and change-impact reviews pass.",
  "fr": "AM-FR-03, AM-FR-11, AM-FR-12",
  "nfr": "AM-NFR-01",
  "eh": "–"
 },
 {
  "id": "US-A20",
  "front": "As an Application Management administrator, I want to make administrative changes with validation, controlled transactions and audit records, so that data stays consistent.",
  "ac": "• Failed changes roll back.\n• Mutation and rollback tests pass.",
  "fr": "AM-FR-06",
  "nfr": "AM-NFR-04",
  "eh": "–"
 },
 {
  "id": "US-A22",
  "front": "As an Application Management administrator, I want to have admin interfaces use strong authentication, least privilege and protected secrets, so that the admin surface is hard to attack.",
  "ac": "• Staff and admin accounts require MFA.\n• Role and scenario lists change only through a formal change.\n• Security and secret-scanning tests pass.",
  "fr": "AM-FR-01, AM-FR-07",
  "nfr": "AM-NFR-06",
  "eh": "EH-11"
 },
 {
  "id": "US-A25",
  "front": "As an Application Management administrator, I want to have admin, security and configuration actions retained and protected from alteration, so that the audit trail is trustworthy.",
  "ac": "• Staff-recorded agency acknowledgements are included.\n• Audit access and integrity tests pass.",
  "fr": "AM-FR-05",
  "nfr": "AM-NFR-09",
  "eh": "–"
 },
 {
  "id": "US-A27",
  "front": "As an Application Management administrator, I want to have deployment follow data-protection, payment, accessibility, retention and security obligations, so that the platform stays compliant.",
  "ac": "• A compliance evidence checklist is completed.",
  "fr": "AM-FR-06, AM-FR-07",
  "nfr": "AM-NFR-11",
  "eh": "–"
 },
 {
  "id": "US-A30",
  "front": "As an Application Management administrator, I want to have scenario, account role and permission assignments, timeout and moderation settings versioned, attributable and reversible, so that configuration changes can be audited and rolled back.",
  "ac": "• Configuration audit, rollback and approval tests pass.\n• The role list is fixed (AM-NFR-06): only which of the three roles and permissions an account holds is versioned and reversible; a rollback can never create or restore a role outside the three.",
  "fr": "AM-FR-02, AM-FR-03, AM-FR-14 (Optional)",
  "nfr": "AM-NFR-06, AM-NFR-14",
  "eh": "EH-24"
 },
 {
  "id": "US-X08",
  "front": "As the map service, I want to return map data for incident and resource display, so that staff can see locations.",
  "ac": "• Outage falls back to list and manual location.\n• Records are never corrupted by a map failure.",
  "fr": "DM-FR-07, NU-FR-04",
  "nfr": "DM-NFR-08, DM-NFR-07",
  "eh": "EH-12"
 },
 {
  "id": "US-X10",
  "front": "As the identity service, I want to authenticate users and staff, so that only valid people sign in.",
  "ac": "• Identity-service failure shows a safe error.\n• No session is created on failure.",
  "fr": "NU-FR-01, DM-FR-01, AM-FR-01",
  "nfr": "NU-NFR-04",
  "eh": "EH-02"
 }
]

TITLES = {
 "N01": "Register a Normal User account", "N02": "Log in and out securely (Normal User)",
 "D01": "Staff login with MFA", "D30": "Limit staff to actions their permissions allow",
 "A01": "Administrator login with MFA", "A02": "Create, suspend and reactivate accounts",
 "A03": "Grant Disaster Management permissions", "A04": "Protect the last active administrator",
 "A05": "Manage scenario, notification, timeout, escalation and duplicate settings",
 "A07": "Search and filter protected audit records", "A09": "Manage security controls, secrets and incidents",
 "A11": "Configure notification channels, templates and routing", "A13": "Configure rate limits and abuse controls",
 "A14": "Configure the moderation policy", "A17": "Modular, documented and testable services",
 "A20": "Validated, controlled and audited admin changes", "A22": "Strong authentication for admin interfaces",
 "A25": "Retain and protect audit records from alteration", "A27": "Deployment follows data-protection and security obligations",
 "A30": "Versioned, attributable and reversible configuration", "X08": "Map service: return map data",
 "X10": "Identity service: authenticate users and staff",
}
# Owner roles per story, from the plan's Sprint 1 allocation row.
ROLES = {
 "N01": ["FE1", "BE1"], "N02": ["FE1", "BE1"], "D01": ["FE2", "BE2"], "D30": ["BE2"],
 "A01": ["FE1", "BE2"], "A02": ["FE1", "BE3"], "A03": ["FE1", "BE3"], "A04": ["BE2"],
 "A05": ["FE1", "BE3"], "A07": ["FE2", "BE3"], "A09": ["FE2", "BE3"], "A11": ["FE2", "BE3", "INT1"],
 "A13": ["FE2", "BE2"], "A14": ["FE2", "BE3"], "A17": ["BE2"], "A20": ["BE1"], "A22": ["BE2"],
 "A25": ["BE3"], "A27": ["DO1"], "A30": ["BE1"], "X08": ["INT1"], "X10": ["BE1", "INT1"],
}
PRIORITY = {"P1": ["N01","N02","D01","A01","X10","A22","D30","A02","A03","A04","A27","A17"],
            "P2": ["A07","A25","A05","A30","A20","A11","X08"],
            "P3": ["A13","A14","A09"]}
AUTH = ["N01","N02","D01","A01","X10","A22","D30","A02","A03","A04"]
CONFIG = ["A05","A30","A20","A11"]
ABUSE = ["A13","A14","A09"]
# Completed in later sprints (plan, S1 "Completed later").
LATER = {
 "A07": "Audit event types are registered as each feature lands (moderation decisions S2, agency acknowledgements S3, closures S5).",
 "A25": "Audit event types are registered as each feature lands (moderation decisions S2, agency acknowledgements S3, closures S5).",
 "A13": "Rate limits start with sign-up, login, reporting, uploads and flags; donation limits are added in S4.",
}
LAYER = {"FE": "frontend", "BE": "backend", "DB": "database", "INT": "integration", "QA": "qa", "DO": "devops"}
LAYER_TASK = {"FE": "Frontend: build the screens and states for this story",
              "BE": "Backend: implement the service/API behaviour for this story",
              "INT": "Integration: build and test the external adapter or channel",
              "DB": "Database: design and implement the required schema", "DO": "DevOps: set up and verify the pipeline/environment work",
              "QA": "QA: write and run the tests listed below"}
AREA = {"N": "area:normal-user", "D": "area:disaster-mgmt", "A": "area:app-mgmt", "X": "area:external"}

DEC_TITLE = {"CR-46": "'dispatch' permission is not one of the four documented permissions",
             "CR-23": "AM-NFR-14 'role settings' vs the fixed three-role model",
             "CR-47": "s.15.7 error-code mapping (EH-04, EH-05, EH-14)"}
DEC_TEXT = {
 "CR-46": ("'dispatch' permission: SRS s.15.4/15.5 use a fifth 'dispatch' permission, but s.1, s.2, s.5 and AM-FR-02 define four (Publisher/Approver, moderator, closer, supervisor).",
           "SRS owner decides: (A) delete 'dispatch' from s.15.4/15.5 so those routes need only the Disaster Management role; or (B) add 'dispatch' as a fifth permission in s.1, s.2, s.5, AM-FR-02 and 7.5, after which US-A03, US-D11, US-D13 and US-X02 to US-X04 must be updated. Align permission names either way.",
           ["D30", "A03"]),
 "CR-23": ("AM-NFR-14 says 'role' settings are reversible, but AM-NFR-06 fixes the role list at three.",
           "SRS owner confirms that 'role' in AM-NFR-14 means role/permission assignment (AM-FR-02), or deletes 'role' from the NFR, and says whether role-assignment rollback is wanted (no route exists for it).",
           ["A30"]),
 "CR-47": ("SRS s.15.7 maps EH-04 and EH-05 to 404 and EH-14 to 409, but Section 11 defines them as duplicate report, unverified incident and failed aid delivery.",
           "SRS owner corrects s.15.7: remove EH-04 and EH-05 from the 404 row and EH-14 from the 409 row (or state the HTTP condition each triggers); cite s.15.1 Ownership for 404 and add or cite a case for concurrent update and double-booking.",
           []),
}

# =============================== ISSUE MODEL =================================
def build_issues():
    issues = {}
    def add(key, title, itype, roles, prio, labels, tasks, ac, blocked_by=(), related=(), notes=(), meta=()):
        issues[key] = dict(key=key, title=title, type=itype, roles=roles, prio=prio, labels=labels,
                           tasks=tasks, ac=ac, blocked_by=list(blocked_by), related=list(related),
                           notes=list(notes), meta=list(meta))
    pri = {s: p for p, ss in PRIORITY.items() for s in ss}
    decs = {c: f"S1-DEC-{c.replace('CR-', 'CR')}" for c in DEC_TEXT}
    dec_for = {s: [decs[c]] for c, (_, _, ss) in DEC_TEXT.items() for s in ss}
    # foundation issues
    add("S1-INF-01", "[S1][INF] CI/CD, environments and secrets", "type:infra", ["DO1"], "P1",
        ["devops"], ["Set up the CI/CD pipeline (tool and stack: TBD)", "Create the environments (names and hosting: TBD)",
                     "Set up secret handling for the environments"],
        ["A deployable pipeline exists (Sprint 1 deliverable)", "Secrets are not stored in the repository"],
        related=["S1-US-A27", "S1-US-A09", "S1-US-A17"], notes=["Technology stack is TBD in the plan. Confirm it before starting."])
    add("S1-DB-01", "[S1][DB] Account, role, audit and config schema", "type:infra", ["DB1"], "P1",
        ["database"], ["Design the account, role, audit and config schema (database engine: TBD)",
                       "Review the schema with BE1-BE3 against the Sprint 1 story acceptance criteria",
                       "Implement the schema in the chosen database"],
        ["Schema supports accounts, roles, audit records and configuration for the Sprint 1 stories",
         "Audit storage supports protection from alteration (US-A25)"],
        related=["S1-US-A25", "S1-US-A07", "S1-US-A05"])
    for c, (issue_txt, dec_txt, _) in DEC_TEXT.items():
        k = decs[c]
        add(k, f"[S1][DECISION] {c}: {DEC_TITLE[c]}", "type:decision", ["SRS_OWNER"], "P1",
            ["decision"], ["Decide and record the outcome in the SRS and in the Conflict Register",
                           "Tell the owners of the blocked issues"],
            [f"Decision recorded for {c}", "Affected stories updated if the decision changes them"],
            notes=[f"**Issue:** {issue_txt}", f"**Decision required:** {dec_txt}",
                   "Source: DRCH_User_Stories_SRS_Final_v4.xlsx, Conflict Register. Needed before Sprint 1 build starts (plan)."])
    # stories
    for s in STORIES:
        sid = s["id"][3:]
        key = f"S1-{s['id']}"
        roles = ROLES[sid]
        layer_keys = []
        for r in roles:
            lk = "INT" if r.startswith("INT") else r[:2]
            if lk not in layer_keys: layer_keys.append(lk)
        tasks = [LAYER_TASK[lk] for lk in layer_keys]
        tasks += ["Write tests, including the related error cases"]
        blocked = ["S1-DB-01", "S1-INF-01"] if sid in AUTH or sid in ("A07", "A25") else []
        if sid in ("A27", "A17", "X08", "X10"): blocked = ["S1-INF-01"] if sid != "X10" else ["S1-DB-01", "S1-INF-01"]
        if sid in CONFIG: blocked = ["S1-DB-01", "S1-US-D30"]
        if sid in ABUSE: blocked = ["S1-US-A05"]
        blocked += dec_for.get(sid, [])
        notes = []
        if sid in LATER: notes.append(f"**Completed later:** {LATER[sid]}")
        meta = [f"**Story:** {s['front']}", f"**Sources:** {s['fr']} | NFR: {s['nfr']} | Error cases: {s['eh']}"]
        labels = ["type:story", *[LAYER[l] for l in layer_keys]]
        if any(b.startswith("S1-DEC") for b in blocked): labels.append("blocked")
        add(key, f"[S1][{s['id']}] {TITLES[sid]}", "type:story", roles, pri[sid], labels, tasks, s["ac"],
            blocked, notes=notes, meta=meta)
    # QA
    add("S1-QA-01", "[S1][QA] Sprint 1 test suite: auth, config, RBAC, audit-tamper, rollback", "type:qa", ["QA1", "QA2"], "P2",
        ["test"], ["QA1: auth and config tests", "QA2: RBAC, audit-tamper, rollback and throttle tests",
                 "Cover error cases EH-01, EH-02, EH-11, EH-18, EH-19, EH-24",
                 "Run auth, MFA and RBAC API tests; run audit-tamper, rollback and throttle tests"],
        ["Tests exist and pass for each Sprint 1 story", "Error cases EH-01, EH-02, EH-11, EH-18, EH-19, EH-24 are covered"],
        related=[f"S1-{s['id']}" for s in STORIES])
    # EPIC (created last: lists every other issue)
    add("S1-EPIC", "[S1][EPIC] Sprint 1: Identity, RBAC, audit, config, abuse", "type:epic", [], "P1", [],
        [], [], related=[k for k in issues],
        meta=["**Goal:** three-role auth, account admin, audit trail, config service, abuse controls, deployable pipeline.",
              "**Milestone:** Three roles log in; platform governed (weeks 1-2).",
              "**In-sprint order:** auth and RBAC first, then config, then abuse and policy.",
              "**Done when:** each role reaches only its own area, the last admin can't be removed, audit records can't be altered, and config changes are reversible.",
              "**Testing:** auth, MFA and RBAC API tests; audit-tamper, rollback and throttle tests; error cases EH-01, EH-02, EH-11, EH-18, EH-19, EH-24.",
              "**Before build (plan):** settle CR-46, CR-23 and CR-47. Build with the four documented permissions (Publisher/Approver, moderator, closer, supervisor)."])
    # Standardize and clean up issue labels:
    # 1. 'sprint:S1' is already represented by the GitHub Milestone 'Sprint 1 (Weeks 1-2)'
    # 2. Priority uses standard clean names (p1-high, p2-medium, p3-low)
    # 3. Simplify type labels to clean standards (enhancement, infrastructure, test, decision, epic)
    PRIO_LABEL_MAP = {"P1": "p1-high", "P2": "p2-medium", "P3": "p3-low"}
    TYPE_LABEL_MAP = {
        "type:story": "enhancement",
        "type:infra": "infrastructure",
        "type:qa": "test",
        "type:decision": "decision",
        "type:epic": "epic",
    }
    for k, i in issues.items():
        std_type = TYPE_LABEL_MAP.get(i["type"], i["type"])
        std_prio = PRIO_LABEL_MAP.get(i["prio"], f"priority:{i['prio']}")
        cleaned_labels = [std_type, std_prio] + [
            l for l in i["labels"] 
            if l not in ("sprint:S1", "decision") and not l.startswith("type:")
        ]
        i["labels"] = list(dict.fromkeys(cleaned_labels))
    return issues

LABELS = {
 # Standard GitHub / Feature Types
 "enhancement": ("a2eeef", "New feature or user story"),
 "infrastructure": ("5319e7", "Infrastructure, database, CI/CD work"),
 "test": ("fbca04", "Testing and QA suite"),
 "decision": ("d93f0b", "Architectural or requirements decision needed"),
 "epic": ("3e4b9e", "Sprint tracker and aggregate epic"),

 # Priorities
 "p1-high": ("b60205", "High priority - must be done first"),
 "p2-medium": ("d93f0b", "Medium priority"),
 "p3-low": ("0e8a16", "Low priority"),

 # Components / Layers
 "frontend": ("bfdadc", "Frontend work"),
 "backend": ("1d76db", "Backend work"),
 "database": ("0052cc", "Database work"),
 "integration": ("5319e7", "External adapter or integration work"),
 "devops": ("bfdadc", "DevOps and pipeline work"),

 # Status / Assignment
 "blocked": ("e99695", "Blocked by dependency or open decision"),
}

# =============================== GITHUB (via gh CLI) =========================
class GhError(RuntimeError): pass
DRY = False

def gh(args, stdin=None, retries=4):
    for attempt in range(retries + 1):
        p = subprocess.run(["gh"] + args, input=stdin, capture_output=True, text=True)
        if p.returncode == 0: return p.stdout
        err = (p.stderr or "") + (p.stdout or "")
        transient = re.search(r"rate limit|secondary|abuse|HTTP (429|500|502|503|504)|timeout|temporar", err, re.I)
        if transient and attempt < retries:
            wait = 5 * (2 ** attempt); print(f"  transient GitHub error, retrying in {wait}s ..."); time.sleep(wait); continue
        raise GhError(err.strip() or f"gh exited with {p.returncode}")

def json_stream(text):
    dec, i, out = json.JSONDecoder(), 0, []
    text = text.strip()
    while i < len(text):
        obj, j = dec.raw_decode(text, i); out.append(obj); i = j
        while i < len(text) and text[i].isspace(): i += 1
    return out

def preflight():
    if not shutil.which("gh"): sys.exit("ERROR: GitHub CLI 'gh' not found. Install it from https://cli.github.com/")
    if not re.fullmatch(r"[\w.-]+/[\w.-]+", REPO) or REPO == "OWNER/REPO":
        sys.exit("ERROR: set your repository, e.g. export DRCH_REPO=my-org/drch")
    try: gh(["auth", "status"])
    except GhError as e: sys.exit(f"ERROR: not authenticated. Run 'gh auth login' or set GH_TOKEN.\n{e}")
    try: repo = json.loads(gh(["api", f"repos/{REPO}"]))
    except GhError as e: sys.exit(f"ERROR: cannot access {REPO} (check the name and token access).\n{e}")
    if repo.get("has_issues") is False: sys.exit("ERROR: Issues are disabled on this repository. Enable them in Settings.")
    perms = repo.get("permissions") or {}
    if perms and not (perms.get("push") or perms.get("triage") or perms.get("admin")):
        sys.exit("ERROR: your token needs write/triage access (Issues: read and write).")

def configured(role): 
    u = TEAM.get(role, PLACEHOLDER).strip()
    return u if u and u != PLACEHOLDER else None

def valid_assignee(user, cache={}):
    if user in cache: return cache[user]
    try: gh(["api", f"repos/{REPO}/assignees/{user}"]); ok = True
    except GhError as e:
        if "404" in str(e): ok = False
        else: raise
    cache[user] = ok
    return ok

def fetch_existing():
    labels = {l for l in gh(["api", "--paginate", f"repos/{REPO}/labels?per_page=100", "--jq", ".[].name"]).split("\n") if l}
    ms = {m["title"]: m["number"] for m in json_stream(gh(["api", "--paginate", f"repos/{REPO}/milestones?state=all&per_page=100",
                                                           "--jq", ".[] | {title: .title, number: .number}"]) or "")}
    issues = {}
    raw = gh(["api", "--paginate", f"repos/{REPO}/issues?state=all&per_page=100", "--jq",
              ".[] | select(.pull_request == null) | {number: .number, title: .title, body: (.body // \"\"), state: .state}"])
    for it in json_stream(raw or ""):
        m = re.search(r"<!-- drch-key:(\S+) -->", it["body"])
        if m: issues[m.group(1)] = it
    return labels, ms, issues

def write(args, payload=None):
    if DRY: return "{}"
    time.sleep(CREATE_DELAY_SECONDS)
    return gh(args, stdin=json.dumps(payload) if payload is not None else None)

# =============================== RENDERING ===================================
def ref(key, numbers, issues):
    n = numbers.get(key)
    return f"#{n} {issues[key]['title']}" if n else f"{key} (not created yet)"

def render(i, numbers, issues, blocks):
    names = []
    for r in i["roles"]:
        u = configured(r); names.append(f"{r} (@{u})" if u else f"{r} (username TBD)")
    L = [f"<!-- drch-key:{i['key']} -->",
         f"**Sprint:** S1 | **Priority:** {i['prio']} | **Type:** {i['type'].split(':')[1]} | **Owners:** {', '.join(names) or 'n/a'}", ""]
    L += [m for m in i["meta"] if m] + ([""] if i["meta"] else [])
    if i["tasks"]: L += ["### Tasks"] + [f"- [ ] {t}" for t in i["tasks"]] + [""]
    if i["ac"]:
        bullets = [b.strip().lstrip("•").strip() for b in (i["ac"].split("\n") if isinstance(i["ac"], str) else i["ac"]) if b.strip()]
        L += ["### Acceptance criteria"] + [f"- [ ] {b}" for b in bullets] + [""]
    if i["key"] == "S1-EPIC":
        L += ["### Issues"]
        for k in i["related"]:
            L.append(f"- [ ] {ref(k, numbers, issues)}")
        L.append("")
    else:
        dep = [f"- Blocked by: {ref(k, numbers, issues)}" for k in i["blocked_by"]]
        dep += [f"- Blocks: {ref(k, numbers, issues)}" for k in blocks.get(i["key"], [])]
        dep += [f"- Related: {ref(k, numbers, issues)}" for k in i["related"] if k != "S1-EPIC"]
        L += ["### Dependencies"] + (dep or ["- None"]) + [""]
    if i["notes"]: L += ["### Notes"] + [f"- {n}" for n in i["notes"]] + [""]
    L += ["_Generated by create_sprint1_issues.py. Source: DRCH final user stories (v4) and the Sprint 1 plan._"]
    return "\n".join(L)

def topo(issues):
    order, seen, stack = [], set(), set()
    def visit(k):
        if k in seen: return
        if k in stack: sys.exit(f"ERROR: dependency cycle at {k}")
        stack.add(k)
        for d in issues[k]["blocked_by"]: visit(d)
        stack.discard(k); seen.add(k); order.append(k)
    for k in issues:
        if k != "S1-EPIC": visit(k)
    return order + ["S1-EPIC"]

# =============================== MAIN ========================================
def main():
    global DRY
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dry-run", action="store_true", help="print the plan, change nothing")
    ap.add_argument("--refresh", action="store_true", help="re-link bodies and add missing assignees on existing issues")
    a = ap.parse_args(); DRY = a.dry_run
    preflight()
    issues = build_issues()
    blocks = {}
    for k, i in issues.items():
        for d in i["blocked_by"]: blocks.setdefault(d, []).append(k)
    labels, ms, existing = fetch_existing()
    print(f"Repository: {REPO}{'  [DRY RUN]' if DRY else ''}")

    for name, (color, desc) in LABELS.items():          # labels
        if name in labels: continue
        print(f"+ label {name}")
        try: write(["api", "-X", "POST", f"repos/{REPO}/labels", "--input", "-"], {"name": name, "color": color, "description": desc})
        except GhError as e:
            if "already_exists" not in str(e): sys.exit(f"ERROR creating label {name}: {e}")

    if MILESTONE_TITLE in ms: ms_num = ms[MILESTONE_TITLE]
    else:                                                # milestone
        print(f"+ milestone {MILESTONE_TITLE}")
        payload = {"title": MILESTONE_TITLE, "state": "open", "description": "Identity, RBAC, audit, config, abuse (weeks 1-2)"}
        if MILESTONE_DUE: payload["due_on"] = f"{MILESTONE_DUE}T23:59:59Z"
        ms_num = json.loads(write(["api", "-X", "POST", f"repos/{REPO}/milestones", "--input", "-"], payload) or "{}").get("number", 0)

    numbers = {k: v["number"] for k, v in existing.items() if k in issues}
    created, problems, created_body = [], [], {}
    for key in topo(issues):                             # issues, blockers first
        i = issues[key]
        if key in existing:
            print(f"= exists  #{existing[key]['number']} {i['title']}"); continue
        assignees, missing = [], []
        for r in i["roles"]:
            u = configured(r)
            if not u: missing.append(r)
            elif valid_assignee(u): assignees.append(u)
            else: missing.append(r); print(f"  ! @{u} ({r}) cannot be assigned in {REPO}; leaving unassigned")
        labels_i = list(i["labels"])
        body = render(i, numbers, issues, blocks)
        print(f"+ issue   {i['title']}  [{', '.join(assignees) or 'unassigned'}]")
        try:
            res = json.loads(write(["api", "-X", "POST", f"repos/{REPO}/issues", "--input", "-"],
                {"title": i["title"], "body": body, "labels": labels_i, "milestone": ms_num or None, "assignees": assignees}) or "{}")
        except GhError as e:
            problems.append((key, str(e))); print(f"  ERROR: {e}"); continue
        numbers[key] = res.get("number", 0); created.append(key); created_body[key] = body

    def sync(key):                                        # phase 2: resolve references
        i, ex = issues[key], existing.get(key)
        num = numbers.get(key)
        if not num: return
        new_body = render(i, numbers, issues, blocks)
        old_body = ex["body"] if ex else created_body.get(key)
        if old_body != new_body:
            print(f"~ relink  #{num} {i['title']}")
            write(["api", "-X", "PATCH", f"repos/{REPO}/issues/{num}", "--input", "-"], {"body": new_body})
        if a.refresh:
            have = [u for r in i["roles"] if (u := configured(r)) and valid_assignee(u)]
            if have: write(["api", "-X", "POST", f"repos/{REPO}/issues/{num}/assignees", "--input", "-"], {"assignees": have})
    for key in created: sync(key)
    if a.refresh:
        for key in issues:
            if key in existing and key not in created: sync(key)

    print(f"\nDone. created={len(created)} existing={len(existing)} errors={len(problems)}")
    for k, e in problems: print(f"  FAILED {k}: {e}")
    unset = [r for r, u in TEAM.items() if u == PLACEHOLDER]
    if unset: print("Usernames not set (issues created unassigned): " + ", ".join(unset))
    sys.exit(1 if problems else 0)

if __name__ == "__main__":
    main()