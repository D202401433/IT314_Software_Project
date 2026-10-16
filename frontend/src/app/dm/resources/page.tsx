"use client";

import { useState } from "react";

import { StatusBadge } from "@/components/badges";
import { useAction } from "@/components/use-action";
import { Button, Card, Dialog, EmptyState, ErrorState, Field, Input, LoadingRows, PageHeader, Pagination, Select, Textarea } from "@/components/ui";
import { api, useQuery } from "@/lib/api";
import { label, timeAgo } from "@/lib/format";
import type { Agency, Paged, Resource } from "@/lib/types";

const TYPES = ["TEAM", "VEHICLE", "SUPPLY", "SUPPORT"];

export default function ResourcesPage() {
  const [type, setType] = useState("");
  const [availableOnly, setAvailableOnly] = useState(false);
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useQuery<Paged<Resource>>("resources", {
    type: type || undefined,
    available_only: availableOnly || undefined,
    page,
    limit: 25,
  });
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Resource | null>(null);

  return (
    <>
      <PageHeader
        title="Resources"
        description="Teams, vehicles, supplies and support. Quantities are reserved when assigned to a dispatch and released when it ends."
        actions={<Button variant="primary" onClick={() => setCreating(true)}>Add resource</Button>}
      />
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Field label="Type">
          {(id) => (
            <Select id={id} value={type} onChange={(e) => { setType(e.target.value); setPage(1); }} className="w-44">
              <option value="">All types</option>
              {TYPES.map((t) => <option key={t} value={t}>{label(t)}</option>)}
            </Select>
          )}
        </Field>
        <label className="flex h-10 items-center gap-2 text-sm">
          <input type="checkbox" checked={availableOnly} onChange={(e) => { setAvailableOnly(e.target.checked); setPage(1); }} />
          Available now only
        </label>
      </div>
      {error && <ErrorState message={error} onRetry={reload} />}
      {loading && !data && <LoadingRows />}
      {data && (
        <Card bodyClassName="p-0">
          {data.items.length === 0 ? (
            <div className="p-5"><EmptyState title="No resources match.">Add the teams, vehicles and supplies your agencies can deploy.</EmptyState></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="border-b border-border text-left text-xs text-muted">
                  <tr>
                    <th scope="col" className="px-5 py-3 font-medium">Resource</th>
                    <th scope="col" className="px-3 py-3 font-medium">Agency</th>
                    <th scope="col" className="px-3 py-3 font-medium">Status</th>
                    <th scope="col" className="px-3 py-3 text-right font-medium">Available / total</th>
                    <th scope="col" className="px-3 py-3 font-medium">Updated</th>
                    <th scope="col" className="px-5 py-3"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((r) => (
                    <tr key={r.resource_id} className="border-b border-border last:border-0">
                      <td className="px-5 py-3">
                        <p className="font-medium">{r.name}</p>
                        <p className="text-xs text-muted">
                          {label(r.type)}
                          {r.capability && Object.keys(r.capability).length > 0 && ` · ${Object.entries(r.capability).map(([k, v]) => `${k}: ${String(v)}`).join(", ")}`}
                        </p>
                      </td>
                      <td className="px-3 py-3">{r.agency_name ?? <span className="text-muted">—</span>}</td>
                      <td className="px-3 py-3"><StatusBadge status={r.status} /></td>
                      <td className="px-3 py-3 text-right tabular-nums">{Number(r.quantity_available)} / {Number(r.quantity_total)}</td>
                      <td className="px-3 py-3 text-xs text-muted">{timeAgo(r.updated_at)}</td>
                      <td className="px-5 py-3 text-right"><Button size="sm" onClick={() => setEditing(r)}>Update</Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="border-t border-border px-5 py-3"><Pagination page={data.page} pages={data.pages} total={data.total} onPage={setPage} /></div>
        </Card>
      )}
      {creating && <ResourceForm onClose={() => setCreating(false)} onDone={() => { setCreating(false); reload(); }} />}
      {editing && <ResourceForm resource={editing} onClose={() => setEditing(null)} onDone={() => { setEditing(null); reload(); }} />}
    </>
  );
}

function ResourceForm({ resource, onClose, onDone }: { resource?: Resource; onClose: () => void; onDone: () => void }) {
  const agencies = useQuery<{ items: Agency[] }>(resource ? null : "agency-contacts");
  const { run, busy } = useAction(onDone);
  const [name, setName] = useState(resource?.name ?? "");
  const [type, setType] = useState(resource?.type ?? "TEAM");
  const [agencyId, setAgencyId] = useState(resource?.agency_id ?? "");
  const [quantity, setQuantity] = useState(resource ? String(Number(resource.quantity_total)) : "1");
  const [status, setStatus] = useState(resource && ["UNAVAILABLE", "MAINTENANCE"].includes(resource.status) ? resource.status : "AVAILABLE");
  const [capability, setCapability] = useState(resource?.capability ? JSON.stringify(resource.capability) : "");
  const [lat, setLat] = useState(resource?.latitude?.toString() ?? "");
  const [lon, setLon] = useState(resource?.longitude?.toString() ?? "");
  const [reason, setReason] = useState("");

  let parsedCapability: Record<string, unknown> | null = {};
  try {
    parsedCapability = capability.trim() ? JSON.parse(capability) : {};
  } catch {
    parsedCapability = null;
  }
  const coordsOk = (lat === "" && lon === "") || (lat !== "" && lon !== "" && Math.abs(Number(lat)) <= 90 && Math.abs(Number(lon)) <= 180);
  const valid = name.trim().length >= 2 && Number(quantity) > 0 && parsedCapability !== null && coordsOk;

  async function submit() {
    const location = lat !== "" ? { latitude: Number(lat), longitude: Number(lon) } : {};
    const ok = await run(
      "save",
      () =>
        resource
          ? api(`resources/${resource.resource_id}`, {
              method: "PATCH",
              body: { version: resource.version, name, quantity_total: Number(quantity), status, capability: parsedCapability, reason: reason || undefined, ...location },
            })
          : api("resources", {
              method: "POST",
              body: { name, type, agency_id: agencyId || undefined, quantity_total: Number(quantity), capability: parsedCapability, ...location },
            }),
      resource ? "Resource updated" : "Resource added",
    );
    if (ok !== undefined) onDone();
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={resource ? `Update ${resource.name}` : "Add resource"}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!valid} busy={busy === "save"} onClick={submit}>Save</Button></>}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><Field label="Name">{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} maxLength={150} />}</Field></div>
        {!resource && (
          <>
            <Field label="Type">{(id) => <Select id={id} value={type} onChange={(e) => setType(e.target.value)}>{TYPES.map((t) => <option key={t} value={t}>{label(t)}</option>)}</Select>}</Field>
            <Field label="Agency">
              {(id) => (
                <Select id={id} value={agencyId} onChange={(e) => setAgencyId(e.target.value)}>
                  <option value="">None</option>
                  {agencies.data?.items.filter((a) => a.is_active).map((a) => <option key={a.agency_id} value={a.agency_id}>{a.name}</option>)}
                </Select>
              )}
            </Field>
          </>
        )}
        <Field label="Total quantity" hint={resource ? `${Number(resource.quantity_total) - Number(resource.quantity_available)} currently assigned` : undefined}>
          {(id) => <Input id={id} type="number" min={0} step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} />}
        </Field>
        {resource && (
          <Field label="Availability">
            {(id) => (
              <Select id={id} value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="AVAILABLE">Available</option>
                <option value="UNAVAILABLE">Unavailable</option>
                <option value="MAINTENANCE">Maintenance</option>
              </Select>
            )}
          </Field>
        )}
        <Field label="Latitude">{(id) => <Input id={id} type="number" step="any" value={lat} onChange={(e) => setLat(e.target.value)} />}</Field>
        <Field label="Longitude" error={coordsOk ? undefined : "Give both coordinates within range"}>{(id) => <Input id={id} type="number" step="any" value={lon} onChange={(e) => setLon(e.target.value)} />}</Field>
        <div className="sm:col-span-2">
          <Field label="Capabilities (JSON)" hint='e.g. {"boat": true, "capacity": 12}' error={parsedCapability === null ? "Not valid JSON" : undefined}>
            {(id) => <Input id={id} value={capability} onChange={(e) => setCapability(e.target.value)} className="font-mono" />}
          </Field>
        </div>
        {resource && <div className="sm:col-span-2"><Field label="Reason (recorded in the audit log)">{(id) => <Textarea id={id} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} />}</Field></div>}
      </div>
    </Dialog>
  );
}
