"use client";

import React, { useState, useMemo } from "react";
import { useResQ } from "../../context/ResQContext";
import { IncidentRecord, IncidentLifecycleStatus } from "../../types/resq";

interface LiveIncidentsViewProps {
  onOpenMap: (incident?: IncidentRecord) => void;
  onOpenDispatch: (incident: IncidentRecord) => void;
  onOpenReport: () => void;
  onSelectIncident: (incident: IncidentRecord) => void;
}

export const LiveIncidentsView: React.FC<LiveIncidentsViewProps> = ({
  onOpenMap,
  onOpenDispatch,
  onOpenReport,
  onSelectIncident,
}) => {
  const { incidents } = useResQ();
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const filteredIncidents = useMemo(() => {
    return incidents.filter((inc) => {
      if (severityFilter !== "ALL" && inc.severity !== severityFilter) return false;
      if (statusFilter !== "ALL" && inc.lifecycleStatus !== statusFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          inc.title.toLowerCase().includes(q) ||
          inc.locationName.toLowerCase().includes(q) ||
          inc.id.toLowerCase().includes(q) ||
          inc.category.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [incidents, severityFilter, statusFilter, search]);

  const criticalCount = incidents.filter((i) => i.severity === "CRITICAL").length;
  const activeCount = incidents.filter(
    (i) => i.lifecycleStatus !== "RESOLVED" && i.lifecycleStatus !== "CLOSED"
  ).length;

  const getSeverityBadge = (sev: IncidentRecord["severity"]) => {
    switch (sev) {
      case "CRITICAL":
        return "bg-red-50 text-red-700 border-red-200";
      case "HIGH":
        return "bg-orange-50 text-orange-700 border-orange-200";
      case "MODERATE":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "LOW":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      default:
        return "bg-slate-50 text-slate-700 border-slate-200";
    }
  };

  const getStatusBadge = (status: IncidentLifecycleStatus) => {
    switch (status) {
      case "NEW REPORT":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "VERIFIED":
        return "bg-cyan-50 text-cyan-700 border-cyan-200";
      case "DISPATCHED":
        return "bg-purple-50 text-purple-700 border-purple-200";
      case "RESPONSE IN PROGRESS":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "RESOLVED":
      case "CLOSED":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      default:
        return "bg-slate-50 text-slate-600 border-slate-200";
    }
  };

  const getCategoryIcon = (category: string) => {
    if (category.toLowerCase().includes("flood")) return "🌊";
    if (category.toLowerCase().includes("cyclone")) return "🌀";
    if (category.toLowerCase().includes("fire")) return "🔥";
    return "⚠️";
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Operations Center • NDMA IRS Triage
          </p>
          <h2 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">
            Live Incident Register
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Real-time incident feed, severity classification, and active field deployment.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onOpenMap()}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 cursor-pointer"
          >
            <span>⌖</span> View Full Map
          </button>
          <button
            onClick={onOpenReport}
            className="flex items-center gap-1.5 rounded-lg bg-[#075cab] px-4 py-2 text-sm font-semibold text-white shadow-xs transition hover:bg-[#064a85] cursor-pointer"
          >
            <span>+</span> Report Incident
          </button>
        </div>
      </div>

      {/* Metrics Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Incidents</p>
          <p className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">{incidents.length}</p>
          <p className="mt-1 text-xs text-slate-500">Total logged records</p>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50/50 p-4 shadow-xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-red-600">Critical Priority</p>
          <p className="mt-2 text-2xl font-bold text-red-700 sm:text-3xl">{criticalCount}</p>
          <p className="mt-1 text-xs text-red-600/80">Immediate action needed</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Active Missions</p>
          <p className="mt-2 text-2xl font-bold text-[#075cab] sm:text-3xl">{activeCount}</p>
          <p className="mt-1 text-xs text-slate-500">Unresolved incidents</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Resolved / Closed</p>
          <p className="mt-2 text-2xl font-bold text-emerald-800 sm:text-3xl">
            {incidents.length - activeCount}
          </p>
          <p className="mt-1 text-xs text-emerald-700/80">Operations completed</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xs md:flex-row md:items-center md:justify-between">
        <div className="relative flex-1 max-w-md">
          <span className="absolute inset-y-0 left-3 grid place-items-center text-slate-400 text-sm">
            🔍
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search incident by title, location, ID, or disaster..."
            className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-[#075cab] focus:ring-1 focus:ring-[#075cab]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-semibold text-slate-500">Severity:</span>
          {["ALL", "CRITICAL", "HIGH", "MODERATE", "LOW"].map((s) => (
            <button
              key={s}
              onClick={() => setSeverityFilter(s)}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                severityFilter === s
                  ? "bg-[#075cab] text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {s}
            </button>
          ))}

          <div className="h-4 w-px bg-slate-200 mx-1 hidden sm:block" />

          <span className="font-semibold text-slate-500">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 outline-none cursor-pointer"
          >
            <option value="ALL">All Statuses</option>
            <option value="NEW REPORT">New Report</option>
            <option value="VERIFIED">Verified</option>
            <option value="DISPATCHED">Dispatched</option>
            <option value="RESPONSE IN PROGRESS">In Progress</option>
            <option value="RESOLVED">Resolved</option>
          </select>
        </div>
      </div>

      {/* Incidents List Cards */}
      <div className="space-y-3">
        {filteredIncidents.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white py-16 text-center text-slate-400">
            <span className="block text-3xl mb-2">📋</span>
            <p className="text-sm font-medium">No incidents found matching current filters.</p>
          </div>
        ) : (
          filteredIncidents.map((incident) => (
            <article
              key={incident.id}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs transition hover:border-slate-300 hover:shadow-sm sm:p-5"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-bold text-slate-700">
                      {incident.id}
                    </span>
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${getSeverityBadge(
                        incident.severity
                      )}`}
                    >
                      {incident.severity}
                    </span>
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${getStatusBadge(
                        incident.lifecycleStatus
                      )}`}
                    >
                      {incident.lifecycleStatus}
                    </span>
                    <span className="text-[11px] font-medium text-slate-500">
                      {getCategoryIcon(incident.category)} {incident.category}
                    </span>
                  </div>

                  <h3
                    onClick={() => onSelectIncident(incident)}
                    className="text-base font-bold text-slate-900 hover:text-[#075cab] cursor-pointer transition"
                  >
                    {incident.title}
                  </h3>

                  <p className="text-xs text-slate-600 line-clamp-2">{incident.description}</p>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <span>📍</span> {incident.locationName} ({incident.lat.toFixed(3)}, {incident.lon.toFixed(3)})
                    </span>
                    <span className="flex items-center gap-1 font-medium text-slate-700">
                      <span>👥</span> ~{incident.affectedPeopleEstimate} citizens affected
                    </span>
                    <span className="flex items-center gap-1 text-[11px] text-slate-400">
                      <span>🕒</span> Detected: {incident.detectedAt}
                    </span>
                  </div>

                  {incident.urgentNeeds && incident.urgentNeeds.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[11px] font-semibold text-slate-500">Urgent Needs:</span>
                      {incident.urgentNeeds.map((need, idx) => (
                        <span
                          key={idx}
                          className="rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 border border-amber-200"
                        >
                          {need}
                        </span>
                      ))}
                    </div>
                  )}

                  {incident.aiRecommendation && (
                    <div className="mt-2 flex items-center gap-2 rounded-lg bg-sky-50 px-3 py-1.5 text-xs text-[#07569c] border border-sky-100">
                      <span className="font-bold">✦ AI Assist:</span>
                      <span className="truncate">{incident.aiRecommendation.explanation || incident.aiRecommendation.evidenceSummary}</span>
                      <span className="ml-auto shrink-0 font-mono text-[10px] font-bold text-sky-800">
                        {incident.aiRecommendation.confidenceScore}% confidence
                      </span>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex flex-row sm:flex-col items-center sm:items-end gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                  <button
                    onClick={() => onOpenDispatch(incident)}
                    className="w-full sm:w-auto rounded-lg bg-[#075cab] px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-[#064a85] cursor-pointer"
                  >
                    Dispatch Team →
                  </button>
                  <button
                    onClick={() => onOpenMap(incident)}
                    className="w-full sm:w-auto rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 cursor-pointer"
                  >
                    View on Map ⌖
                  </button>
                  <button
                    onClick={() => onSelectIncident(incident)}
                    className="w-full sm:w-auto text-xs font-semibold text-[#075cab] hover:underline cursor-pointer"
                  >
                    Command Triage
                  </button>
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
};
