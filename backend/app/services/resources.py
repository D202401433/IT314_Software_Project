"""Resource reservation and release with row locks, so quantities can never go negative (DM-FR-08, DM-NFR-11)."""

from decimal import Decimal

from app import audit
from app.auth import Principal
from app.errors import ApiError, conflict, not_found

TERMINAL_DISPATCH = ("REJECTED", "FAILED", "COMPLETED")
_OPERATOR_STATUSES = ("UNAVAILABLE", "MAINTENANCE")


def derive_status(current: str, available: Decimal) -> str:
    """Availability-driven status; operator-set UNAVAILABLE/MAINTENANCE is kept."""
    if current in _OPERATOR_STATUSES:
        return current
    return "AVAILABLE" if available > 0 else "ASSIGNED"


def reserve(conn, principal: Principal, *, resource_id, dispatch: dict, quantity: Decimal) -> dict:
    if dispatch["status"] in TERMINAL_DISPATCH:
        raise conflict("DISPATCH_CLOSED", f"Dispatch {dispatch['dispatch_ref']} is {dispatch['status']}")
    resource = conn.execute(
        "SELECT * FROM resources WHERE resource_id = %s FOR UPDATE", (resource_id,)
    ).fetchone()
    if resource is None:
        raise not_found("Resource")
    if quantity <= 0:
        raise ApiError(422, "VALIDATION_FAILED", "Quantity must be greater than zero")
    if resource["status"] in _OPERATOR_STATUSES:
        raise conflict(
            "RESOURCE_UNAVAILABLE",
            f"{resource['name']} is {resource['status'].lower()}",
            {"resource_id": str(resource_id)},
        )
    available = resource["quantity_available"] or Decimal(0)
    if quantity > available:
        raise conflict(
            "RESOURCE_CONFLICT",
            f"Only {available} of {resource['name']} is available",
            {"resource_id": str(resource_id), "available": str(available), "requested": str(quantity)},
        )
    remaining = available - quantity
    conn.execute(
        """
        UPDATE resources SET quantity_available = %s, status = %s, version = version + 1
        WHERE resource_id = %s
        """,
        (remaining, derive_status(resource["status"], remaining), resource_id),
    )
    assignment = conn.execute(
        """
        INSERT INTO resource_assignments (dispatch_id, resource_id, quantity, assigned_by)
        VALUES (%s, %s, %s, %s) RETURNING *
        """,
        (dispatch["dispatch_id"], resource_id, quantity, principal.user_id),
    ).fetchone()
    audit.record(
        conn,
        actor=principal,
        action="RESOURCE_RESERVED",
        entity_type="resource",
        entity_id=resource_id,
        before={"quantity_available": resource["quantity_available"], "status": resource["status"]},
        after={
            "quantity_available": remaining,
            "dispatch_id": str(dispatch["dispatch_id"]),
            "assignment_id": str(assignment["assignment_id"]),
        },
        ip=principal.ip,
    )
    return assignment


def release(conn, principal: Principal | None, assignment: dict, reason: str) -> None:
    resource = conn.execute(
        "SELECT * FROM resources WHERE resource_id = %s FOR UPDATE", (assignment["resource_id"],)
    ).fetchone()
    restored = min(
        (resource["quantity_available"] or Decimal(0)) + (assignment["quantity"] or Decimal(0)),
        resource["quantity_total"] or Decimal(0),
    )
    conn.execute(
        "UPDATE resource_assignments SET released_at = now() WHERE assignment_id = %s",
        (assignment["assignment_id"],),
    )
    conn.execute(
        """
        UPDATE resources SET quantity_available = %s, status = %s, version = version + 1
        WHERE resource_id = %s
        """,
        (restored, derive_status(resource["status"], restored), resource["resource_id"]),
    )
    audit.record(
        conn,
        actor=principal,
        action="RESOURCE_RELEASED",
        entity_type="resource",
        entity_id=resource["resource_id"],
        rationale=reason,
        after={"quantity_available": restored, "assignment_id": str(assignment["assignment_id"])},
        ip=principal.ip if principal else None,
    )


def release_all_for_dispatch(conn, principal: Principal | None, dispatch_id, reason: str) -> int:
    assignments = conn.execute(
        """
        SELECT * FROM resource_assignments
        WHERE dispatch_id = %s AND released_at IS NULL
        ORDER BY resource_id FOR UPDATE
        """,
        (dispatch_id,),
    ).fetchall()
    for assignment in assignments:
        release(conn, principal, assignment, reason)
    return len(assignments)
