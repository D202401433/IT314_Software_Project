import { formatNumber } from "@/lib/format";

import { cx } from "./ui";

/**
 * Horizontal bars for a magnitude per labelled category. One hue (category identity
 * comes from the text label, not colour); values are printed in text colour; each bar
 * carries a hover title; callers render a table alongside where precision matters.
 */
export function BarList({
  rows,
  barClass = "bg-info",
  emptyText = "No data yet.",
}: {
  rows: { label: string; value: number; hint?: string; barClass?: string }[];
  barClass?: string;
  emptyText?: string;
}) {
  const max = Math.max(0, ...rows.map((r) => r.value));
  if (!rows.length) return <p className="text-sm text-muted">{emptyText}</p>;
  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li key={row.label} title={`${row.label}: ${formatNumber(row.value)}${row.hint ? ` (${row.hint})` : ""}`}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate">{row.label}</span>
            <span className="tabular-nums font-medium">
              {formatNumber(row.value)}
              {row.hint && <span className="ml-1 text-xs font-normal text-muted">{row.hint}</span>}
            </span>
          </div>
          <div className="h-2 rounded bg-surface-muted" aria-hidden>
            <div
              className={cx("h-2 rounded", row.barClass ?? barClass)}
              style={{ width: max ? `${Math.max(2, (row.value / max) * 100)}%` : "0%" }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Daily counts as thin vertical columns on one axis, with per-column hover values. */
export function ColumnSeries({ points }: { points: { label: string; value: number }[] }) {
  if (!points.length) return <p className="text-sm text-muted">No incidents in this period.</p>;
  const max = Math.max(...points.map((p) => p.value));
  return (
    <div>
      <div className="flex h-36 items-end gap-0.5 border-b border-border" role="img" aria-label="Incidents per day">
        {points.map((p) => (
          <div key={p.label} className="group relative flex h-full flex-1 items-end" title={`${p.label}: ${p.value}`}>
            <div className="w-full rounded-t bg-info" style={{ height: `${Math.max(2, (p.value / max) * 100)}%` }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-xs text-muted">
        <span>{points[0].label}</span>
        <span>Peak {max}/day</span>
        <span>{points[points.length - 1].label}</span>
      </div>
    </div>
  );
}
