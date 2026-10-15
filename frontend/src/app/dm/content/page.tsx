"use client";

import { useState } from "react";

import { StatusBadge } from "@/components/badges";
import { useAction } from "@/components/use-action";
import { Button, Card, Dialog, EmptyState, ErrorState, Field, Input, LoadingRows, Notice, PageHeader, Select, Textarea } from "@/components/ui";
import { api, useQuery } from "@/lib/api";
import { SCENARIOS, formatDateTime, scenarioLabel } from "@/lib/format";

import { useStaff } from "../shell";

type Content = {
  content_id: string;
  scenario: string;
  title: string;
  body: string;
  source: string | null;
  version: number;
  state: "DRAFT" | "APPROVED" | "PUBLISHED" | "SUPERSEDED";
  created_at: string;
  approved_at: string | null;
  published_at: string | null;
  author_name: string | null;
  approver_name: string | null;
  published_by_name: string | null;
};

export default function ContentPage() {
  const { can } = useStaff();
  const [scenario, setScenario] = useState("");
  const { data, error, loading, reload } = useQuery<{ items: Content[] }>("safety-content", { scenario: scenario || undefined });
  const { run, busy } = useAction();
  const [drafting, setDrafting] = useState<{ base?: Content } | null>(null);
  const [editing, setEditing] = useState<Content | null>(null);
  const [confirm, setConfirm] = useState<{ c: Content; action: "approval" | "publish" } | null>(null);

  // Group every version under its (scenario, title); newest version first.
  const groups = new Map<string, Content[]>();
  for (const c of data?.items ?? []) {
    const key = `${c.scenario}::${c.title}`;
    groups.set(key, [...(groups.get(key) ?? []), c]);
  }

  async function act() {
    if (!confirm) return;
    const ok = await run(confirm.action, () => api(`safety-content/${confirm.c.content_id}/${confirm.action}`, { method: "POST" }),
      confirm.action === "approval" ? "Version approved" : "Version published; the previous version is superseded");
    if (ok !== undefined) {
      setConfirm(null);
      reload();
    }
  }

  return (
    <>
      <PageHeader
        title="Safety content"
        description="Versioned guidance per scenario. Draft → approved by a publisher → published. Every version is kept with its author and approver."
        actions={<Button variant="primary" onClick={() => setDrafting({})}>New guidance</Button>}
      />
      <div className="mb-4">
        <Field label="Scenario">
          {(id) => (
            <Select id={id} value={scenario} onChange={(e) => setScenario(e.target.value)} className="w-48">
              <option value="">All scenarios</option>
              {SCENARIOS.map((s) => <option key={s} value={s}>{scenarioLabel[s]}</option>)}
            </Select>
          )}
        </Field>
      </div>
      {!can("PUBLISHER") && <div className="mb-4"><Notice tone="neutral">Approving and publishing require the publisher permission.</Notice></div>}
      {error && <ErrorState message={error} onRetry={reload} />}
      {loading && !data && <LoadingRows />}
      {data && groups.size === 0 && <EmptyState title="No safety content yet." />}
      <div className="space-y-4">
        {[...groups.values()].map((versions) => {
          const [latest] = versions;
          const live = versions.find((v) => v.state === "PUBLISHED");
          return (
            <Card
              key={latest.content_id}
              title={latest.title}
              subtitle={`${scenarioLabel[latest.scenario]} · ${versions.length} version(s)${live ? ` · v${live.version} is live` : " · not published"}`}
              actions={!versions.some((v) => v.state === "DRAFT" || v.state === "APPROVED") && <Button size="sm" onClick={() => setDrafting({ base: latest })}>New version…</Button>}
            >
              <ol className="space-y-4">
                {versions.map((v) => (
                  <li key={v.content_id} className="rounded-lg border border-border p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold">v{v.version}</span>
                      <StatusBadge status={v.state} />
                      <span className="text-xs text-muted">
                        by {v.author_name ?? "unknown (seeded)"}
                        {v.approver_name && ` · approved by ${v.approver_name} ${formatDateTime(v.approved_at)}`}
                        {v.published_at && ` · published ${formatDateTime(v.published_at)}`}
                      </span>
                      <div className="ml-auto flex gap-2">
                        {v.state === "DRAFT" && <Button size="sm" onClick={() => setEditing(v)}>Edit</Button>}
                        {v.state === "DRAFT" && <Button size="sm" disabled={!can("PUBLISHER")} onClick={() => setConfirm({ c: v, action: "approval" })}>Approve…</Button>}
                        {v.state === "APPROVED" && <Button size="sm" variant="primary" disabled={!can("PUBLISHER")} onClick={() => setConfirm({ c: v, action: "publish" })}>Publish…</Button>}
                      </div>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm">{v.body}</p>
                    {v.source && <p className="mt-1 text-xs text-muted">Source: {v.source}</p>}
                  </li>
                ))}
              </ol>
            </Card>
          );
        })}
      </div>

      {drafting && <DraftForm base={drafting.base} onClose={() => setDrafting(null)} onDone={() => { setDrafting(null); reload(); }} />}
      {editing && <DraftForm edit={editing} onClose={() => setEditing(null)} onDone={() => { setEditing(null); reload(); }} />}
      <Dialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={confirm?.action === "approval" ? "Approve this version?" : "Publish this version?"}
        footer={<><Button onClick={() => setConfirm(null)}>Cancel</Button><Button variant="primary" busy={busy === confirm?.action} onClick={act}>{confirm?.action === "approval" ? "Approve" : "Publish"}</Button></>}
      >
        <p className="text-sm">
          {confirm?.action === "approval"
            ? "You will be recorded as the approver. Approved text can no longer be edited."
            : "This version becomes the official guidance shown to the public. Any currently published version is superseded but kept."}
        </p>
      </Dialog>
    </>
  );
}

function DraftForm({ base, edit, onClose, onDone }: { base?: Content; edit?: Content; onClose: () => void; onDone: () => void }) {
  const { run, busy } = useAction();
  const [scenario, setScenario] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState(edit?.body ?? base?.body ?? "");
  const [source, setSource] = useState(edit?.source ?? base?.source ?? "");
  const isNew = !base && !edit;
  const valid = body.trim().length >= 10 && source.trim().length >= 3 && (!isNew || (scenario && title.trim().length >= 5));

  async function save() {
    const ok = await run(
      "save",
      () =>
        edit
          ? api(`safety-content/${edit.content_id}`, { method: "PATCH", body: { body, source } })
          : api("safety-content", { method: "POST", body: base ? { based_on_id: base.content_id, body, source } : { scenario, title, body, source } }),
      edit ? "Draft saved" : "Draft created",
    );
    if (ok !== undefined) onDone();
  }

  return (
    <Dialog open wide onClose={onClose} title={edit ? `Edit v${edit.version}` : base ? `New version of “${base.title}”` : "New safety guidance"}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!valid} busy={busy === "save"} onClick={save}>Save draft</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        {isNew && (
          <>
            <Field label="Scenario">
              {(id) => (
                <Select id={id} value={scenario} onChange={(e) => setScenario(e.target.value)}>
                  <option value="">Select scenario</option>
                  {SCENARIOS.map((s) => <option key={s} value={s}>{scenarioLabel[s]}</option>)}
                </Select>
              )}
            </Field>
            <Field label="Title">{(id) => <Input id={id} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />}</Field>
          </>
        )}
        <div className="sm:col-span-2"><Field label="Guidance">{(id) => <Textarea id={id} rows={8} value={body} onChange={(e) => setBody(e.target.value)} maxLength={20000} />}</Field></div>
        <div className="sm:col-span-2"><Field label="Source" hint="The authority or document this guidance is based on.">{(id) => <Input id={id} value={source} onChange={(e) => setSource(e.target.value)} maxLength={500} />}</Field></div>
      </div>
    </Dialog>
  );
}
