import type { Tone } from "@/components/ui";

export const SCENARIOS = ["cyclone", "industrial_fire", "urban_flooding"] as const;
export const INCIDENT_STATUSES = [
  "SUBMITTED",
  "NEEDS_INFORMATION",
  "VERIFIED",
  "DISPATCHED",
  "RESOLVED",
  "CLOSED",
  "REJECTED",
] as const;
export const PRIORITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;

export const scenarioLabel: Record<string, string> = {
  cyclone: "Cyclone",
  industrial_fire: "Industrial fire",
  urban_flooding: "Urban flooding",
};

export const statusTone: Record<string, Tone> = {
  SUBMITTED: "medium",
  NEEDS_INFORMATION: "medium",
  VERIFIED: "info",
  REQUESTED: "info",
  ACKNOWLEDGED: "info",
  DISPATCHED: "high",
  ACTIVE: "low",
  AVAILABLE: "low",
  RESOLVED: "low",
  COMPLETED: "low",
  CLOSED: "neutral",
  REJECTED: "critical",
  FAILED: "critical",
  UNAVAILABLE: "neutral",
  MAINTENANCE: "medium",
};

export const priorityTone: Record<string, Tone> = {
  CRITICAL: "critical",
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low",
};

const labels: Record<string, string> = {
  NEEDS_INFORMATION: "Needs information",
  INDUSTRIAL_FIRE: "Industrial fire",
  URBAN_FLOODING: "Urban flooding",
  EN_ROUTE: "En route",
  IN_PROGRESS: "In progress",
  UNAVAILABLE: "Unavailable",
};

export function label(value: string): string {
  return labels[value] ?? value.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

export function formatNumber(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number)
    ? new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(number)
    : "—";
}

export function formatMoney(value: number | string, currency = "INR"): string {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number)
    ? new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(number)
    : "—";
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds) || seconds < 0) return "—";
  const totalSeconds = Math.floor(seconds);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (days) return `${days}d ${hours}h`;
  if (hours) return `${hours}h ${minutes}m`;
  if (minutes) return `${minutes}m`;
  return `${totalSeconds}s`;
}

export function timeAgo(value: string | null | undefined): string {
  if (!value) return "—";
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return "—";

  const difference = timestamp - Date.now();
  const absoluteSeconds = Math.abs(difference) / 1000;
  if (absoluteSeconds < 60) return "just now";

  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31536000],
    ["month", 2592000],
    ["week", 604800],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  const [unit, seconds] = units.find(([, unitSeconds]) => absoluteSeconds >= unitSeconds) ?? ["minute", 60];
  const count = Math.round(difference / (seconds * 1000));
  return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(count, unit);
}
