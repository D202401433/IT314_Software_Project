import { currentUser } from "@/lib/session";

/**
 * Whether the browser holds a valid Disaster Management session. Lets shared pages
 * (the ResQ portal) decide to load staff-only layers without provoking 401s for guests.
 * Exposes no token and no personal data beyond the staff member's own name.
 */
export async function GET() {
  const user = await currentUser();
  const dm = user !== null && user.role === "DISASTER_MGMT" && user.mfa_verified;
  return Response.json({ dm, name: dm ? user.full_name : null }, { headers: { "cache-control": "no-store" } });
}
