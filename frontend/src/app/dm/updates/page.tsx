"use client";

import Link from "next/link";
import { useState } from "react";

import { StatusBadge } from "@/components/badges";
import { useAction } from "@/components/use-action";
import { Button, Card, Dialog, EmptyState, ErrorState, Field, Input, LoadingRows, Notice, PageHeader, Pagination, Select, Textarea, cx } from "@/components/ui";
import { api, useQuery } from "@/lib/api";
import { SCENARIOS, formatDateTime, scenarioLabel } from "@/lib/format";
import type { Paged } from "@/lib/types";

import { useStaff } from "../shell";

type Update = {
  update_id: string;
  incident_id: string | null;
  incident_ref: string | null;
  scenario: string;
  title: string;
  body: string;
  area_label: string | null;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  created_at: string;
  updated_at: string;
  published_at: string | null;
  author_name: string | null;
  published_by_name: string | null;
};

const TABS = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;

export default function UpdatesPage() {
  const { can } = useStaff();
  const [tab, setTab] = useState<(typeof TABS)[number]>("DRAFT");
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useQuery<Paged<Update>>("public-updates", { status: tab, page, limit: 20 });
  const { run, busy } = useAction();
  const [editing, setEditing] = useState<Update | "new" | null>(null);
  const [confirm, setConfirm] = useState<{ u: Update; action: "publish" | "archive" } | null>(null);
  const [reason, setReason] = useState("");

  async function act() {
    if (!confirm) return;
    const { u, action } = confirm;
    const ok = await run(
      action,
      () => api(`public-updates/${u.update_id}/${action}`, { method: "POST", body: action === "archive" ? { reason } : undefined }),
      action === "publish" ? "Update published" : "Update archived",
    );
    if (ok !== undefined) {
      setConfirm(null);
      setReason("");
      reload();
    }
  }

  return (
    <>
      <PageHeader
        title="Verified public updates"
        description="Drafts are internal. Only staff with the publisher permission can publish, and updates about an incident require it to be verified."
        actions={<Button variant="primary" onClick={() => setEditing("new")}>New draft</Button>}
      />
      {!can("PUBLISHER") && <div className="mb-4"><Notice tone="neutral">You can draft and edit. Publishing needs a colleague with the publisher permission.</Notice></div>}
      <div className="mb-4 flex gap-1 rounded-lg border border-border bg-surface p-1 text-sm" role="tablist">
        {TABS.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => { setTab(t); setPage(1); }} className={cx("flex-1 rounded-md px-3 py-1.5", tab === t ? "bg-surface-muted font-medium" : "text-muted hover:text-foreground")}>
            {t === "DRAFT" ? "Drafts" : t === "PUBLISHED" ? "Published" : "Archived"}
          </button>
        ))}
      </div>
      {error && <ErrorState message={error} onRetry={reload} />}
      {loading && !data && <LoadingRows />}
      {data && data.items.length === 0 && <EmptyState title={`No ${tab.toLowerCase()} updates.`} />}
      <div className="space-y-4">
        {data?.items.map((u) => (
          <Card
            key={u.update_id}
            title={u.title}
            subtitle={
              <>
                {scenarioLabel[u.scenario]}
                {u.area_label && ` · ${u.area_label}`}
                {u.incident_ref && <> · <Link href={`/dm/incidents/${u.incident_id}`} className="font-mono text-info hover:underline">{u.incident_ref}</Link></>}
              </>
            }
            actions={
              <>
                <StatusBadge status={u.status} />
                {u.status === "DRAFT" && <Button size="sm" onClick={() => setEditing(u)}>Edit</Button>}
                {u.status === "DRAFT" && <Button size="sm" variant="primary" disabled={!can("PUBLISHER")} onClick={() => setConfirm({ u, action: "publish" })}>Publish…</Button>}
                {u.status === "PUBLISHED" && <Button size="sm" disabled={!can("PUBLISHER")} onClick={() => setConfirm({ u, action: "archive" })}>Archive…</Button>}
              </>
            }
          >
            <p className="whitespace-pre-wrap text-sm">{u.body}</p>
            <p className="mt-3 text-xs text-muted">
              Drafted by {u.author_name ?? "unknown"} · {formatDateTime(u.created_at)}
              {u.published_at && ` · published ${formatDateTime(u.published_at)} by ${u.published_by_name ?? "unknown"}`}
            </p>
          </Card>
        ))}
      </div>
      {data && <div className="mt-4"><Pagination page={data.page} pages={data.pages} total={data.total} onPage={setPage} /></div>}

      {editing && <UpdateForm update={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} onDone={() => { setEditing(null); setTab("DRAFT"); reload(); }} />}
      <Dialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={confirm?.action === "publish" ? "Publish this update?" : "Archive this update?"}
        footer={<><Button onClick={() => setConfirm(null)}>Cancel</Button><Button variant="primary" busy={busy === confirm?.action} disabled={confirm?.action === "archive" && reason.trim().length < 3} onClick={act}>{confirm?.action === "publish" ? "Publish" : "Archive"}</Button></>}
      >
        {confirm?.action === "publish" ? (
          <p className="text-sm">“{confirm.u.title}” will become an official, public update attributed to you.</p>
        ) : (
          <Field label="Reason for withdrawing">{(id) => <Textarea id={id} value={reason} onChange={(e) => setReason(e.target.value)} />}</Field>
        )}
      </Dialog>
    </>
  );
}

function UpdateForm({ update, onClose, onDone }: { update?: Update; onClose: () => void; onDone: () => void }) {
  const { run, busy } = useAction();
  const [scenario, setScenario] = useState(update?.scenario ?? "");
  const [title, setTitle] = useState(update?.title ?? "");
  const [body, setBody] = useState(update?.body ?? "");
  const [area, setArea] = useState(update?.area_label ?? "");
  const [incidentId, setIncidentId] = useState("");
  const valid = scenario && title.trim().length >= 5 && body.trim().length >= 10;

  async function save() {
    const ok = await run(
      "save",
      () =>
        update
          ? api(`public-updates/${update.update_id}`, { method: "PATCH", body: { title, body, area_label: area || undefined } })
          : api("public-updates", { method: "POST", body: { scenario, title, body, area_label: area || undefined, incident_id: incidentId.trim() || undefined } }),
      update ? "Draft saved" : "Draft created",
    );
    if (ok !== undefined) onDone();
  }

  return (
    <Dialog open wide onClose={onClose} title={update ? "Edit draft" : "New public update"} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!valid} busy={busy === "save"} onClick={save}>Save draft</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Scenario">
          {(id) => (
            <Select id={id} value={scenario} disabled={!!update} onChange={(e) => setScenario(e.target.value)}>
              <option value="">Select scenario</option>
              {SCENARIOS.map((s) => <option key={s} value={s}>{scenarioLabel[s]}</option>)}
            </Select>
          )}
        </Field>
        <Field label="Affected area (optional)">{(id) => <Input id={id} value={area} onChange={(e) => setArea(e.target.value)} maxLength={200} />}</Field>
        {!update && (
          <div className="sm:col-span-2">
            <Field label="Linked incident ID (optional)" hint="Paste the incident's ID from its page URL. The scenario must match.">
              {(id) => <Input id={id} value={incidentId} onChange={(e) => setIncidentId(e.target.value)} className="font-mono" />}
            </Field>
          </div>
        )}
        <div className="sm:col-span-2"><Field label="Title">{(id) => <Input id={id} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />}</Field></div>
        <div className="sm:col-span-2"><Field label="Update text">{(id) => <Textarea id={id} rows={6} value={body} onChange={(e) => setBody(e.target.value)} maxLength={8000} />}</Field></div>
      </div>
    </Dialog>
  );
}
