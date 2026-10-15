import { priorityTone, label, statusTone } from "@/lib/format";

import { Badge } from "./ui";

export function StatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return <Badge>—</Badge>;
  return <Badge tone={statusTone[status] ?? "neutral"}>{label(status)}</Badge>;
}

export function PriorityBadge({ priority }: { priority: string | null | undefined }) {
  if (!priority) return <Badge tone="neutral">Unassigned</Badge>;
  return <Badge tone={priorityTone[priority] ?? "neutral"}>{label(priority)}</Badge>;
}

/** AI output is always visibly labelled as advisory, never styled like a human decision. */
export function AiBadge({ children = "AI advisory" }: { children?: React.ReactNode }) {
  return (
    <Badge tone="ai">
      <span aria-hidden>✦</span> {children}
    </Badge>
  );
}
