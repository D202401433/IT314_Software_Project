"""Public updates, safety content, moderation, aid, campaigns, donations and analytics."""

from decimal import Decimal

import pytest

pytestmark = pytest.mark.db

BASE = "/api/v1/dm"


def test_public_update_publication_needs_publisher_and_verified_incident(client, make, sql):
    author = make.staff()
    publisher = make.staff("PUBLISHER")
    inc = make.incident()
    draft = client.post(f"{BASE}/public-updates", headers=author["headers"], json={
        "scenario": "urban_flooding", "title": "Road closed at junction", "body": "Avoid the underpass until further notice.",
        "incident_id": str(inc["incident_id"]), "area_label": "Ward 12",
    })
    assert draft.status_code == 201 and draft.json()["status"] == "DRAFT"
    uid = draft.json()["update_id"]
    denied = client.post(f"{BASE}/public-updates/{uid}/publish", headers=author["headers"])
    assert denied.status_code == 403
    unverified = client.post(f"{BASE}/public-updates/{uid}/publish", headers=publisher["headers"])
    assert unverified.status_code == 409 and unverified.json()["error"]["code"] == "INCIDENT_NOT_VERIFIED"

    sql.execute("UPDATE incidents SET status = 'VERIFIED', verified_priority = 'HIGH', verified_at = now() "
                "WHERE incident_id = %s", (inc["incident_id"],))
    ok = client.post(f"{BASE}/public-updates/{uid}/publish", headers=publisher["headers"])
    assert ok.json()["status"] == "PUBLISHED"
    assert ok.json()["author_name"] and ok.json()["published_by_name"]
    edit = client.patch(f"{BASE}/public-updates/{uid}", headers=author["headers"], json={"title": "Changed title"})
    assert edit.status_code == 409


def test_public_update_scenario_must_match_incident(client, make):
    staff = make.staff()
    inc = make.incident(scenario="CYCLONE")
    r = client.post(f"{BASE}/public-updates", headers=staff["headers"], json={
        "scenario": "urban_flooding", "title": "Mismatch test", "body": "Body text long enough.",
        "incident_id": str(inc["incident_id"]),
    })
    assert r.status_code == 422 and r.json()["error"]["code"] == "SCENARIO_MISMATCH"


def test_safety_content_draft_approve_publish_supersede(client, make, sql):
    author = make.staff()
    publisher = make.staff("PUBLISHER")
    title = f"Shelter guidance {author['email'][:12]}"
    v1 = client.post(f"{BASE}/safety-content", headers=author["headers"], json={
        "scenario": "cyclone", "title": title, "body": "Go to the nearest marked shelter.", "source": "NDMA guidelines",
    }).json()
    assert v1["state"] == "DRAFT" and v1["version"] == 1
    url = f"{BASE}/safety-content/{v1['content_id']}"
    early = client.post(f"{url}/publish", headers=publisher["headers"])
    assert early.status_code == 409 and early.json()["error"]["code"] == "NOT_APPROVED"
    assert client.post(f"{url}/approval", headers=author["headers"]).status_code == 403
    assert client.post(f"{url}/approval", headers=publisher["headers"]).json()["state"] == "APPROVED"
    assert client.post(f"{url}/publish", headers=publisher["headers"]).json()["state"] == "PUBLISHED"

    v2 = client.post(f"{BASE}/safety-content", headers=author["headers"], json={
        "based_on_id": v1["content_id"], "body": "Updated shelter list for coastal wards.", "source": "SEOC bulletin",
    }).json()
    assert v2["version"] == 2
    # The previous version stays live until the new one is approved and published.
    assert sql.execute("SELECT status FROM safety_content WHERE content_id = %s",
                       (v1["content_id"],)).fetchone()["status"] == "PUBLISHED"
    client.post(f"{BASE}/safety-content/{v2['content_id']}/approval", headers=publisher["headers"])
    client.post(f"{BASE}/safety-content/{v2['content_id']}/publish", headers=publisher["headers"])
    versions = client.get(f"{url}/versions", headers=author["headers"]).json()["items"]
    assert [(v["version"], v["state"]) for v in versions] == [(2, "PUBLISHED"), (1, "SUPERSEDED")]
    assert versions[0]["author_name"] and versions[0]["approver_name"]


def test_moderation_queue_and_decision(client, make, sql):
    moderator = make.staff("MODERATOR")
    inc = make.incident()
    ev = sql.execute(
        "INSERT INTO evidence_files (incident_id, uploaded_by, file_name, mime_type, size_bytes, storage_key, sha256) "
        "VALUES (%s, %s, 'photo.jpg', 'image/jpeg', 1024, %s, %s) RETURNING evidence_id",
        (inc["incident_id"], inc["reporter_id"], f"k/{inc['incident_ref']}", "a" * 64),
    ).fetchone()
    queue = client.get(f"{BASE}/moderation/queue", headers=moderator["headers"]).json()
    assert str(ev["evidence_id"]) in [i["evidence_id"] for i in queue["items"]]
    r = client.post(f"{BASE}/moderation/{ev['evidence_id']}/decision", headers=moderator["headers"],
                    json={"decision": "QUARANTINE", "reason": "Contains a visible licence plate"})
    assert r.json()["moderation_state"] == "QUARANTINED"
    r = client.post(f"{BASE}/moderation/{ev['evidence_id']}/decision", headers=moderator["headers"],
                    json={"decision": "REMOVE", "reason": "Not related to the incident"})
    assert r.json()["moderation_state"] == "REMOVED"
    again = client.post(f"{BASE}/moderation/{ev['evidence_id']}/decision", headers=moderator["headers"],
                        json={"decision": "APPROVE", "reason": "try to restore"})
    assert again.status_code == 409


def _contribution(sql, make, aid_type="WATER", unit="BOXES", quantity=50):
    donor = make.user("NORMAL_USER", mfa=False)
    return sql.execute(
        "INSERT INTO aid_contributions (contributor_id, aid_type, quantity, unit) VALUES (%s, %s, %s, %s) RETURNING *",
        (donor["user_id"], aid_type, quantity, unit),
    ).fetchone()


def test_aid_verification_allocation_and_delivery(client, make, sql):
    staff = make.staff()
    inc = make.incident()
    need = client.post(f"{BASE}/needs", headers=staff["headers"], json={
        "aid_type": "water", "unit": "boxes", "quantity_required": 60, "incident_id": str(inc["incident_id"]),
    })
    assert need.status_code == 201, need.text
    need_id = need.json()["need_id"]
    aid = _contribution(sql, make)

    early = client.post(f"{BASE}/allocations", headers=staff["headers"],
                        json={"contribution_id": str(aid["contribution_id"]), "need_id": need_id})
    assert early.status_code == 409 and early.json()["error"]["code"] == "AID_NOT_VERIFIED"
    client.post(f"{BASE}/aid-contributions/{aid['contribution_id']}/verification", headers=staff["headers"],
                json={"decision": "VERIFIED", "reason": "Sealed cartons inspected"})
    alloc = client.post(f"{BASE}/allocations", headers=staff["headers"],
                        json={"contribution_id": str(aid["contribution_id"]), "need_id": need_id})
    assert alloc.json()["status"] == "ALLOCATED"

    second = _contribution(sql, make, quantity=20)
    sql.execute("UPDATE aid_contributions SET status = 'VERIFIED' WHERE contribution_id = %s",
                (second["contribution_id"],))
    over = client.post(f"{BASE}/allocations", headers=staff["headers"],
                       json={"contribution_id": str(second["contribution_id"]), "need_id": need_id})
    assert over.status_code == 409 and over.json()["error"]["code"] == "OVER_ALLOCATION"

    events = f"{BASE}/allocations/{aid['contribution_id']}/delivery-events"
    no_receipt = client.post(events, headers=staff["headers"], json={"event": "DELIVERED"})
    assert no_receipt.status_code == 422
    skipped = client.post(events, headers=staff["headers"], json={"event": "DELIVERED", "received_by": "Camp lead"})
    assert skipped.status_code == 409
    client.post(events, headers=staff["headers"], json={"event": "PICKED_UP"})
    done = client.post(events, headers=staff["headers"], json={"event": "DELIVERED", "received_by": "Camp lead Iyer"})
    assert done.json()["status"] == "DELIVERED"
    assert sql.execute("SELECT quantity_fulfilled, is_open FROM aid_needs WHERE need_id = %s",
                       (need_id,)).fetchone() == {"quantity_fulfilled": Decimal(50), "is_open": True}


def test_failed_delivery_returns_aid_to_the_pool(client, make, sql):
    staff = make.staff()
    need = client.post(f"{BASE}/needs", headers=staff["headers"], json={
        "aid_type": "blankets", "unit": "packets", "quantity_required": 10,
        "incident_id": str(make.incident()["incident_id"]),
    }).json()
    aid = _contribution(sql, make, "BLANKETS", "PACKETS", 5)
    sql.execute("UPDATE aid_contributions SET status = 'VERIFIED' WHERE contribution_id = %s", (aid["contribution_id"],))
    client.post(f"{BASE}/allocations", headers=staff["headers"],
                json={"contribution_id": str(aid["contribution_id"]), "need_id": need["need_id"]})
    r = client.post(f"{BASE}/allocations/{aid['contribution_id']}/delivery-events", headers=staff["headers"],
                    json={"event": "FAILED", "note": "Road washed out"})
    assert r.json()["status"] == "VERIFIED" and r.json()["need_id"] is None


def test_incompatible_aid_is_refused(client, make, sql):
    staff = make.staff()
    need = client.post(f"{BASE}/needs", headers=staff["headers"], json={
        "aid_type": "medical", "unit": "kits", "quantity_required": 10,
        "incident_id": str(make.incident()["incident_id"]),
    }).json()
    aid = _contribution(sql, make, "FOOD", "PACKETS", 5)
    sql.execute("UPDATE aid_contributions SET status = 'VERIFIED' WHERE contribution_id = %s", (aid["contribution_id"],))
    r = client.post(f"{BASE}/allocations", headers=staff["headers"],
                    json={"contribution_id": str(aid["contribution_id"]), "need_id": need["need_id"]})
    assert r.status_code == 409 and r.json()["error"]["code"] == "INCOMPATIBLE_AID"


def test_campaigns_and_read_only_donation_oversight(client, make, sql):
    staff = make.staff()
    title = f"Flood relief {staff['email'][:10]}"
    bad = client.post(f"{BASE}/campaigns", headers=staff["headers"],
                      json={"title": title, "purpose": "Relief for flood victims", "scenario": "earthquake"})
    assert bad.status_code == 422 and bad.json()["error"]["code"] == "UNSUPPORTED_SCENARIO"
    c = client.post(f"{BASE}/campaigns", headers=staff["headers"], json={
        "title": title, "purpose": "Relief for flood victims", "scenario": "urban_flooding",
        "target_amount": 100000, "activate": True,
    })
    assert c.status_code == 201 and c.json()["status"] == "ACTIVE"
    dup = client.post(f"{BASE}/campaigns", headers=staff["headers"],
                      json={"title": title, "purpose": "Same title again", "scenario": "cyclone"})
    assert dup.status_code == 409
    cid = c.json()["campaign_id"]
    for amount, status, key in ((500, "CONFIRMED", "a"), (300, "PENDING", "b"), (200, "FAILED", "c")):
        sql.execute("INSERT INTO donations (campaign_id, amount, status, is_anonymous, idempotency_key) "
                    "VALUES (%s, %s, %s, TRUE, %s)", (cid, amount, status, f"{cid}-{key}"))
    over = client.get(f"{BASE}/oversight/donations", headers=staff["headers"]).json()
    mine = next(x for x in over["campaigns"] if x["campaign_id"] == cid)
    assert Decimal(mine["confirmed_amount"]) == 500 and Decimal(mine["pending_amount"]) == 300
    assert Decimal(mine["failed_amount"]) == 200
    closed = client.post(f"{BASE}/campaigns/{cid}/closure", headers=staff["headers"], json={"reason": "Target met"})
    assert closed.json()["status"] == "CLOSED"


def test_analytics_counts_out_of_scope_separately(client, make, sql):
    staff = make.staff()
    inc = make.incident()
    sql.execute("INSERT INTO ai_recommendations (incident_id, status, factors) VALUES (%s, 'LOW_CONFIDENCE', %s)",
                (inc["incident_id"], '{"out_of_scope": true}'))
    data = client.get(f"{BASE}/analytics", headers=staff["headers"]).json()
    assert sum(r["out_of_scope"] for r in data["ai_recommendations"]) >= 1
    assert "UNASSIGNED" in data["definitions"]
    assert any(p["priority"] == "UNASSIGNED" for p in data["incidents"]["by_priority"])
    filtered = client.get(f"{BASE}/analytics", headers=staff["headers"], params={"scenario": "cyclone"}).json()
    assert all(r["scenario"] == "cyclone" for r in filtered["incidents"]["by_scenario_status"])


def test_map_reports_missing_coordinates(client, make, sql):
    staff = make.staff()
    placed = make.incident()
    unplaced = make.incident(latitude=None, longitude=None, address_text="Near the old mill")
    data = client.get(f"{BASE}/map", headers=staff["headers"]).json()
    assert placed["incident_ref"] in [i["incident_ref"] for i in data["incidents"]]
    assert unplaced["incident_ref"] in [i["incident_ref"] for i in data["incidents_without_coordinates"]]
