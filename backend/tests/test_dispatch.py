"""Resources, reservations, dispatch state machine, concurrency and escalation."""

import threading
from decimal import Decimal

import pytest

pytestmark = pytest.mark.db

BASE = "/api/v1/dm"


def _verified(make):
    return make.incident(status="VERIFIED", verified_priority="HIGH")


def _dispatch(client, staff, incident, agency, resources, key=None):
    headers = dict(staff["headers"])
    if key:
        headers["Idempotency-Key"] = key
    return client.post(
        f"{BASE}/incidents/{incident['incident_id']}/dispatches",
        headers=headers,
        json={
            "receiving_agency_id": str(agency["agency_id"]),
            "instructions": "Send boat team to the junction",
            "resources": [{"resource_id": str(r["resource_id"]), "quantity": q} for r, q in resources],
        },
    )


def test_resource_create_and_availability_update(client, make):
    staff = make.staff()
    agency = make.agency()
    r = client.post(f"{BASE}/resources", headers=staff["headers"], json={
        "name": "Rescue boat team", "type": "TEAM", "agency_id": str(agency["agency_id"]),
        "capability": {"boat": True}, "quantity_total": 1, "latitude": 23.0, "longitude": 72.5,
    })
    assert r.status_code == 201, r.text
    res = r.json()
    assert res["status"] == "AVAILABLE" and Decimal(res["quantity_available"]) == 1
    upd = client.patch(f"{BASE}/resources/{res['resource_id']}", headers=staff["headers"],
                       json={"version": res["version"], "status": "MAINTENANCE", "reason": "Engine repair"})
    assert upd.json()["status"] == "MAINTENANCE"
    stale = client.patch(f"{BASE}/resources/{res['resource_id']}", headers=staff["headers"],
                         json={"version": res["version"], "status": "AVAILABLE"})
    assert stale.status_code == 409


def test_dispatch_requires_permission_and_verified_incident(client, make):
    plain = make.staff()
    dispatcher = make.staff("DISPATCH")
    agency, res = make.agency(), make.resource()
    assert _dispatch(client, plain, _verified(make), agency, [(res, 1)]).status_code == 403
    r = _dispatch(client, dispatcher, make.incident(), agency, [(res, 1)])
    assert r.status_code == 409 and r.json()["error"]["code"] == "INCIDENT_NOT_VERIFIED"


def test_over_allocation_is_refused_and_nothing_is_created(client, make, sql):
    dispatcher = make.staff("DISPATCH")
    agency, supply = make.agency(), make.resource(quantity=10, type_="SUPPLY")
    inc = _verified(make)
    r = _dispatch(client, dispatcher, inc, agency, [(supply, 11)])
    assert r.status_code == 409 and r.json()["error"]["code"] == "RESOURCE_CONFLICT"
    assert sql.execute("SELECT COUNT(*) AS n FROM dispatch_orders WHERE incident_id = %s",
                       (inc["incident_id"],)).fetchone()["n"] == 0
    assert sql.execute("SELECT quantity_available FROM resources WHERE resource_id = %s",
                       (supply["resource_id"],)).fetchone()["quantity_available"] == 10


def test_concurrent_dispatches_cannot_double_book(client, make, sql):
    dispatcher = make.staff("DISPATCH")
    agency, team = make.agency(), make.resource(quantity=1)
    incidents = [_verified(make) for _ in range(4)]
    results = []

    def go(inc):
        results.append(_dispatch(client, dispatcher, inc, agency, [(team, 1)]).status_code)

    threads = [threading.Thread(target=go, args=(i,)) for i in incidents]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert sorted(results) == [201, 409, 409, 409]
    row = sql.execute("SELECT quantity_available, status FROM resources WHERE resource_id = %s",
                      (team["resource_id"],)).fetchone()
    assert row == {"quantity_available": 0, "status": "ASSIGNED"}


def test_dispatch_lifecycle_never_skips_confirmation(client, make, sql):
    dispatcher = make.staff("DISPATCH")
    agency, team = make.agency(), make.resource()
    inc = _verified(make)
    created = _dispatch(client, dispatcher, inc, agency, [(team, 1)])
    assert created.status_code == 201, created.text
    d = created.json()
    assert d["status"] == "REQUESTED" and d["dispatch_ref"].startswith("DISP-")
    msg = sql.execute("SELECT status FROM agency_messages WHERE dispatch_id = %s", (d["dispatch_id"],)).fetchone()
    assert msg["status"] == "QUEUED"  # no integration: never shown as sent

    url = f"{BASE}/dispatches/{d['dispatch_id']}"
    h = dispatcher["headers"]
    early = client.post(f"{url}/progress", headers=h, json={"event": "EN_ROUTE", "reported_by": "Ops", "channel": "PHONE"})
    assert early.status_code == 409 and early.json()["error"]["code"] == "DISPATCH_NOT_ACKNOWLEDGED"
    assert sql.execute("SELECT 1 FROM audit_logs WHERE entity_id = %s AND action = 'DISPATCH_EN_ROUTE_CONFLICT'",
                       (d["dispatch_id"],)).fetchone()
    complete_early = client.post(f"{url}/completion", headers=h, json={"confirmed_by": "Ops", "channel": "PHONE"})
    assert complete_early.status_code == 409

    ack = client.post(f"{url}/acknowledgement", headers=h,
                      json={"acknowledged_by": "Station Officer Rao", "channel": "PHONE"})
    assert ack.json()["status"] == "ACKNOWLEDGED"
    assert ack.json()["acknowledged_by"] == "Station Officer Rao (via phone)"
    en_route = client.post(f"{url}/progress", headers=h,
                           json={"event": "EN_ROUTE", "reported_by": "Rao", "channel": "RADIO"})
    assert en_route.json()["status"] == "DISPATCHED"
    assert sql.execute("SELECT status FROM incidents WHERE incident_id = %s",
                       (inc["incident_id"],)).fetchone()["status"] == "DISPATCHED"
    done = client.post(f"{url}/completion", headers=h, json={"confirmed_by": "Rao", "channel": "RADIO"})
    assert done.json()["status"] == "COMPLETED"
    res = sql.execute("SELECT quantity_available, status FROM resources WHERE resource_id = %s",
                      (team["resource_id"],)).fetchone()
    assert res == {"quantity_available": 1, "status": "AVAILABLE"}
    detail = client.get(url, headers=h).json()
    actions = [e["action"] for e in detail["events"]]
    assert actions[:1] == ["DISPATCH_CREATED"] and "DISPATCH_COMPLETED" in actions


def test_rejection_releases_resources(client, make, sql):
    dispatcher = make.staff("DISPATCH")
    agency, team = make.agency(), make.resource()
    d = _dispatch(client, dispatcher, _verified(make), agency, [(team, 1)]).json()
    r = client.post(f"{BASE}/dispatches/{d['dispatch_id']}/rejection", headers=dispatcher["headers"],
                    json={"reason": "No crew on shift", "reported_by": "Duty officer", "channel": "PHONE"})
    assert r.json()["status"] == "REJECTED"
    assert sql.execute("SELECT quantity_available FROM resources WHERE resource_id = %s",
                       (team["resource_id"],)).fetchone()["quantity_available"] == 1


def test_idempotency_key_prevents_duplicate_dispatch(client, make, sql):
    dispatcher = make.staff("DISPATCH")
    agency, supply = make.agency(), make.resource(quantity=5, type_="SUPPLY")
    inc = _verified(make)
    key = f"key-{inc['incident_ref']}"
    first = _dispatch(client, dispatcher, inc, agency, [(supply, 1)], key=key)
    retry = _dispatch(client, dispatcher, inc, agency, [(supply, 1)], key=key)
    assert first.status_code == 201 and retry.status_code == 200
    assert first.json()["dispatch_id"] == retry.json()["dispatch_id"]
    assert sql.execute("SELECT quantity_available FROM resources WHERE resource_id = %s",
                       (supply["resource_id"],)).fetchone()["quantity_available"] == 4

    # Reusing the same key on a different incident must fail with 409 IDEMPOTENCY_CONFLICT
    other_inc = _verified(make)
    other_dispatch = _dispatch(client, dispatcher, other_inc, agency, [(supply, 1)], key=key)
    assert other_dispatch.status_code == 409
    assert other_dispatch.json()["error"]["code"] == "IDEMPOTENCY_CONFLICT"

    # Reusing the same key on the same incident with mismatched agency must also fail
    other_agency = make.agency()
    conflict_dispatch = _dispatch(client, dispatcher, inc, other_agency, [(supply, 1)], key=key)
    assert conflict_dispatch.status_code == 409
    assert conflict_dispatch.json()["error"]["code"] == "IDEMPOTENCY_CONFLICT"


def test_escalation_permission_and_automatic_timeout(client, make, sql):
    from app.services.dispatch import escalate_overdue

    dispatcher = make.staff("DISPATCH")
    supervisor = make.staff("SUPERVISOR")
    agency, team = make.agency(), make.resource()
    d = _dispatch(client, dispatcher, _verified(make), agency, [(team, 1)]).json()
    url = f"{BASE}/dispatches/{d['dispatch_id']}/escalation"
    assert client.post(url, headers=dispatcher["headers"], json={"reason": "No answer"}).status_code == 403

    sql.execute("UPDATE dispatch_orders SET created_at = now() - interval '20 minutes' WHERE dispatch_id = %s",
                (d["dispatch_id"],))
    listed = client.get(f"{BASE}/dispatches", headers=dispatcher["headers"], params={"overdue": True, "limit": 100})
    assert d["dispatch_id"] in [x["dispatch_id"] for x in listed.json()["items"]]
    assert escalate_overdue() >= 1
    escalate_overdue()  # a second run must not escalate the same dispatch again
    count = sql.execute("SELECT COUNT(*) AS n FROM audit_logs WHERE entity_id = %s AND action = 'DISPATCH_ESCALATED'",
                        (d["dispatch_id"],)).fetchone()["n"]
    assert count == 1
    assert sql.execute("SELECT 1 FROM notifications WHERE user_id = %s AND related_id = %s",
                       (supervisor["user_id"], d["dispatch_id"])).fetchone()
    assert client.get(f"{BASE}/dispatches/{d['dispatch_id']}", headers=dispatcher["headers"]).json()["escalated"]


def test_agency_message_ack_is_attributed(client, make):
    staff = make.staff()
    inc, agency = make.incident(), make.agency()
    r = client.post(f"{BASE}/incidents/{inc['incident_id']}/agency-messages", headers=staff["headers"],
                    json={"recipient_agency_ids": [str(agency["agency_id"])], "subject": "Road closure",
                          "body": "Please divert traffic at the junction"})
    assert r.status_code == 201
    msg = r.json()["items"][0]
    assert msg["status"] == "QUEUED"
    ack = client.post(f"{BASE}/agency-messages/{msg['message_id']}/events", headers=staff["headers"],
                      json={"outcome": "ACKNOWLEDGED", "note": "Inspector Shah confirmed by phone"})
    assert ack.json()["status"] == "ACKNOWLEDGED"
    assert ack.json()["last_recorded_event"]["recorded_by"] == "Test Disaster_Mgmt"
    inactive = make.agency(active=False)
    bad = client.post(f"{BASE}/incidents/{inc['incident_id']}/agency-messages", headers=staff["headers"],
                      json={"recipient_agency_ids": [str(inactive["agency_id"])], "subject": "x" * 5, "body": "y" * 5})
    assert bad.status_code == 422
