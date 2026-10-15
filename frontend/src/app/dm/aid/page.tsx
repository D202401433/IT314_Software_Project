"use client";

import Link from "next/link";
import { useState } from "react";

import { StatusBadge } from "@/components/badges";
import { useAction } from "@/components/use-action";
import { Badge, Button, Card, Dialog, EmptyState, ErrorState, Field, Input, LoadingRows, Notice, PageHeader, Pagination, Select, Textarea, cx } from "@/components/ui";
import { api, useQuery } from "@/lib/api";
import { formatDateTime, formatNumber, label } from "@/lib/format";
import type { Paged } from "@/lib/types";

type Contribution = {
  contribution_id: string;
  aid_type: string;
  description: string | null;
  quantity: string;
  unit: string;
  pickup_address: string | null;
  contact_phone: string | null;
  status: string;
  need_id: string | null;
  created_at: string;
  updated_at: string;
  contributor_name: string;
  verified_by_name: string | null;
  need_incident_ref: string | null;
};

type Need = {
  need_id: string;
  incident_id: string | null;
  incident_ref: string | null;
  aid_type: string;
  unit: string;
  quantity_required: string;
  quantity_fulfilled: string;
  in_flight: string;
  delivery_address: string | null;
  is_open: boolean;
};

const TABS = [
  { key: "contributions", label: "Contributions" },
  { key: "needs", label: "Needs" },
  { key: "allocations", label: "Allocations & delivery" },
] as const;

export default function AidPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("contributions");
  return (
    <>
      <PageHeader title="Aid & needs" description="Verify registered physical aid, allocate it to needs and track delivery. Delivered requires a recorded receipt." />
      <div className="mb-4 flex gap-1 rounded-lg border border-border bg-surface p-1 text-sm" role="tablist">
        {TABS.map((t) => (
          <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)} className={cx("flex-1 rounded-md px-3 py-1.5", tab === t.key ? "bg-surface-muted font-medium" : "text-muted hover:text-foreground")}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === "contributions" && <Contributions />}
      {tab === "needs" && <Needs />}
      {tab === "allocations" && <Allocations />}
    </>
  );
}

function Contributions() {
  const [status, setStatus] = useState("REGISTERED");
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useQuery<Paged<Contribution>>("aid-contributions", { status: status || undefined, page, limit: 20 });
  const needs = useQuery<{ items: Need[] }>("needs");
  const { run, busy } = useAction();
  const [verify, setVerify] = useState<{ c: Contribution; decision: "VERIFIED" | "REJECTED" } | null>(null);
  const [allocate, setAllocate] = useState<Contribution | null>(null);
  const [reason, setReason] = useState("");
  const [needId, setNeedId] = useState("");

  async function submitVerify() {
    if (!verify) return;
    const ok = await run("verify", () => api(`aid-contributions/${verify.c.contribution_id}/verification`, { method: "POST", body: { decision: verify.decision, reason } }),
      verify.decision === "VERIFIED" ? "Aid verified" : "Aid rejected");
    if (ok !== undefined) { setVerify(null); setReason(""); reload(); }
  }
  async function submitAllocate() {
    if (!allocate) return;
    const ok = await run("alloc", () => api("allocations", { method: "POST", body: { contribution_id: allocate.contribution_id, need_id: needId } }), "Aid allocated; a delivery task is open");
    if (ok !== undefined) { setAllocate(null); setNeedId(""); reload(); needs.reload(); }
  }

  const compatible = (c: Contribution) =>
    (needs.data?.items ?? []).filter((n) => n.is_open && n.aid_type === c.aid_type.trim().toUpperCase().replace(/ /g, "_") && n.unit === c.unit.trim().toUpperCase().replace(/ /g, "_"));

  return (
    <>
      <div className="mb-4">
        <Field label="Status">
          {(id) => (
            <Select id={id} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="w-56">
              <option value="">All</option>
              {["REGISTERED", "VERIFIED", "ALLOCATED", "IN_TRANSIT", "DELIVERED", "REJECTED"].map((s) => <option key={s} value={s}>{label(s)}</option>)}
            </Select>
          )}
        </Field>
      </div>
      {error && <ErrorState message={error} onRetry={reload} />}
      {loading && !data && <LoadingRows />}
      {data && (
        <Card bodyClassName="p-0">
          {data.items.length === 0 ? (
            <div className="p-5"><EmptyState title="No contributions in this state.">Contributions registered by the public appear here for verification.</EmptyState></div>
          ) : (
            <ul className="divide-y divide-border">
              {data.items.map((c) => (
                <li key={c.contribution_id} className="flex flex-col gap-2 px-5 py-3 text-sm sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{label(c.aid_type)} × {formatNumber(c.quantity)} {c.unit.toLowerCase()}</span>
                      <StatusBadge status={c.status} />
                    </div>
                    <p className="text-xs text-muted">
                      From {c.contributor_name}{c.contact_phone && ` (${c.contact_phone})`} · {formatDateTime(c.created_at)}
                      {c.pickup_address && ` · pickup: ${c.pickup_address}`}
                      {c.verified_by_name && ` · checked by ${c.verified_by_name}`}
                    </p>
                    {c.description && <p className="mt-1 text-xs">{c.description}</p>}
                  </div>
                  <div className="flex gap-2">
                    {c.status === "REGISTERED" && <>
                      <Button size="sm" onClick={() => setVerify({ c, decision: "VERIFIED" })}>Verify…</Button>
                      <Button size="sm" variant="ghost" onClick={() => setVerify({ c, decision: "REJECTED" })}>Reject…</Button>
                    </>}
                    {c.status === "VERIFIED" && <Button size="sm" variant="primary" onClick={() => setAllocate(c)}>Allocate…</Button>}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="border-t border-border px-5 py-3"><Pagination page={data.page} pages={data.pages} total={data.total} onPage={setPage} /></div>
        </Card>
      )}
      <Dialog open={verify !== null} onClose={() => setVerify(null)} title={verify?.decision === "VERIFIED" ? "Verify contribution" : "Reject contribution"}
        footer={<><Button onClick={() => setVerify(null)}>Cancel</Button><Button variant="primary" disabled={reason.trim().length < 3} busy={busy === "verify"} onClick={submitVerify}>Confirm</Button></>}>
        <Field label={verify?.decision === "VERIFIED" ? "What was checked" : "Reason"}>{(id) => <Textarea id={id} value={reason} onChange={(e) => setReason(e.target.value)} />}</Field>
      </Dialog>
      <Dialog open={allocate !== null} onClose={() => setAllocate(null)} title="Allocate to a need"
        footer={<><Button onClick={() => setAllocate(null)}>Cancel</Button><Button variant="primary" disabled={!needId} busy={busy === "alloc"} onClick={submitAllocate}>Allocate</Button></>}>
        {allocate && (
          compatible(allocate).length === 0 ? (
            <Notice tone="medium">No open need matches {label(allocate.aid_type)} in {allocate.unit.toLowerCase()}. Create one on the Needs tab first.</Notice>
          ) : (
            <Field label="Open need">
              {(id) => (
                <Select id={id} value={needId} onChange={(e) => setNeedId(e.target.value)}>
                  <option value="">Select need</option>
                  {compatible(allocate).map((n) => {
                    const remaining = Number(n.quantity_required) - Number(n.quantity_fulfilled) - Number(n.in_flight);
                    return <option key={n.need_id} value={n.need_id} disabled={remaining < Number(allocate.quantity)}>
                      {n.incident_ref ?? "General"} · {remaining} {n.unit.toLowerCase()} still needed
                    </option>;
                  })}
                </Select>
              )}
            </Field>
          )
        )}
      </Dialog>
    </>
  );
}

function Needs() {
  const [openOnly, setOpenOnly] = useState(true);
  const { data, error, loading, reload } = useQuery<{ items: Need[] }>("needs", { open_only: openOnly });
  const { run, busy } = useAction();
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ aid_type: "", unit: "", quantity_required: "", incident_id: "", delivery_address: "" });

  async function create() {
    const ok = await run("create", () => api("needs", { method: "POST", body: {
      aid_type: form.aid_type, unit: form.unit, quantity_required: Number(form.quantity_required),
      incident_id: form.incident_id.trim() || undefined, delivery_address: form.delivery_address || undefined,
    } }), "Need recorded");
    if (ok !== undefined) { setCreating(false); setForm({ aid_type: "", unit: "", quantity_required: "", incident_id: "", delivery_address: "" }); reload(); }
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={openOnly} onChange={(e) => setOpenOnly(e.target.checked)} /> Open needs only</label>
        <Button variant="primary" onClick={() => setCreating(true)}>Record need</Button>
      </div>
      {error && <ErrorState message={error} onRetry={reload} />}
      {loading && !data && <LoadingRows />}
      {data && data.items.length === 0 && <EmptyState title="No needs recorded." />}
      <div className="grid gap-4 md:grid-cols-2">
        {data?.items.map((n) => {
          const req = Number(n.quantity_required), done = Number(n.quantity_fulfilled), flight = Number(n.in_flight);
          return (
            <Card key={n.need_id} title={`${label(n.aid_type)} · ${formatNumber(req)} ${n.unit.toLowerCase()}`}
              subtitle={<>{n.incident_ref ? <Link href={`/dm/incidents/${n.incident_id}`} className="font-mono text-info hover:underline">{n.incident_ref}</Link> : "General need"}{n.delivery_address && ` · ${n.delivery_address}`}</>}
              actions={<Badge tone={!n.is_open ? "neutral" : done + flight >= req ? "medium" : "info"}>{!n.is_open ? "Closed" : done + flight >= req ? "Fully allocated" : "Open"}</Badge>}>
              <div className="flex h-2 overflow-hidden rounded bg-surface-muted" aria-hidden>
                <div className="bg-low" style={{ width: `${Math.min(100, (done / req) * 100)}%` }} />
                <div className="ml-0.5 bg-medium" style={{ width: `${Math.min(100, (flight / req) * 100)}%` }} />
              </div>
              <p className="mt-2 text-xs text-muted">{formatNumber(done)} delivered · {formatNumber(flight)} in flight · {formatNumber(Math.max(0, req - done - flight))} still needed</p>
            </Card>
          );
        })}
      </div>
      <Dialog open={creating} onClose={() => setCreating(false)} title="Record an aid need"
        footer={<><Button onClick={() => setCreating(false)}>Cancel</Button><Button variant="primary" busy={busy === "create"} disabled={!form.aid_type.trim() || !form.unit.trim() || !(Number(form.quantity_required) > 0)} onClick={create}>Save</Button></>}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Aid type" hint="e.g. water, food, medical, blankets">{(id) => <Input id={id} value={form.aid_type} onChange={(e) => setForm({ ...form, aid_type: e.target.value })} maxLength={80} />}</Field>
          <Field label="Unit" hint="e.g. boxes, kits, litres">{(id) => <Input id={id} value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} maxLength={30} />}</Field>
          <Field label="Quantity required">{(id) => <Input id={id} type="number" min={0} step="any" value={form.quantity_required} onChange={(e) => setForm({ ...form, quantity_required: e.target.value })} />}</Field>
          <Field label="Linked incident ID (optional)">{(id) => <Input id={id} value={form.incident_id} onChange={(e) => setForm({ ...form, incident_id: e.target.value })} className="font-mono" />}</Field>
          <div className="sm:col-span-2"><Field label="Delivery address">{(id) => <Input id={id} value={form.delivery_address} onChange={(e) => setForm({ ...form, delivery_address: e.target.value })} maxLength={500} />}</Field></div>
        </div>
      </Dialog>
    </>
  );
}

function Allocations() {
  const { data, error, loading, reload } = useQuery<{ items: Contribution[] }>("allocations");
  const { run, busy } = useAction();
  const [event, setEvent] = useState<{ c: Contribution; kind: "PICKED_UP" | "DELIVERED" | "FAILED" } | null>(null);
  const [note, setNote] = useState("");
  const [receivedBy, setReceivedBy] = useState("");

  async function submit() {
    if (!event) return;
    const ok = await run("evt", () => api(`allocations/${event.c.contribution_id}/delivery-events`, { method: "POST", body: { event: event.kind, note: note || undefined, received_by: receivedBy || undefined } }),
      event.kind === "DELIVERED" ? "Delivery confirmed" : event.kind === "FAILED" ? "Failure recorded; the aid is available to reallocate" : "Pickup recorded");
    if (ok !== undefined) { setEvent(null); setNote(""); setReceivedBy(""); reload(); }
  }

  const valid = event && (event.kind !== "DELIVERED" || receivedBy.trim().length >= 2) && (event.kind !== "FAILED" || note.trim().length >= 3);

  return (
    <>
      {error && <ErrorState message={error} onRetry={reload} />}
      {loading && !data && <LoadingRows />}
      {data && data.items.length === 0 && <EmptyState title="No allocations yet." />}
      {data && data.items.length > 0 && (
        <Card bodyClassName="p-0">
          <ul className="divide-y divide-border">
            {data.items.map((c) => (
              <li key={c.contribution_id} className="flex flex-col gap-2 px-5 py-3 text-sm sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{label(c.aid_type)} × {formatNumber(c.quantity)} {c.unit.toLowerCase()}</span>
                    <StatusBadge status={c.status} />
                  </div>
                  <p className="text-xs text-muted">From {c.contributor_name} → {c.need_incident_ref ?? "general need"} · updated {formatDateTime(c.updated_at)}</p>
                </div>
                <div className="flex gap-2">
                  {c.status === "ALLOCATED" && <Button size="sm" onClick={() => setEvent({ c, kind: "PICKED_UP" })}>Picked up…</Button>}
                  {c.status === "IN_TRANSIT" && <Button size="sm" variant="primary" onClick={() => setEvent({ c, kind: "DELIVERED" })}>Delivered…</Button>}
                  {["ALLOCATED", "IN_TRANSIT"].includes(c.status) && <Button size="sm" variant="ghost" onClick={() => setEvent({ c, kind: "FAILED" })}>Failed…</Button>}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Dialog open={event !== null} onClose={() => setEvent(null)} title={event ? `${label(event.kind)}: ${label(event.c.aid_type)}` : ""}
        footer={<><Button onClick={() => setEvent(null)}>Cancel</Button><Button variant="primary" disabled={!valid} busy={busy === "evt"} onClick={submit}>Save</Button></>}>
        <div className="space-y-4">
          {event?.kind === "DELIVERED" && (
            <Field label="Received by" hint="Delivered is recorded only with a named recipient confirmation.">
              {(id) => <Input id={id} value={receivedBy} onChange={(e) => setReceivedBy(e.target.value)} maxLength={150} />}
            </Field>
          )}
          <Field label={event?.kind === "FAILED" ? "What went wrong" : "Note (optional)"}>{(id) => <Textarea id={id} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} />}</Field>
        </div>
      </Dialog>
    </>
  );
}
