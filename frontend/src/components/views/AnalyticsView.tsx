"use client";

import React, { useState } from "react";
import { useResQ } from "../../context/ResQContext";

export const AnalyticsView: React.FC = () => {
  const { incidents, dispatches, responders, resources, reports } = useResQ();
  const [exportSuccess, setExportSuccess] = useState(false);

  // Real aggregations computed from live shared records
  const activeIncidents = incidents.filter(
    (i) => i.lifecycleStatus !== "RESOLVED" && i.lifecycleStatus !== "CLOSED"
  );
  const criticalCount = incidents.filter((i) => i.severity === "CRITICAL").length;
  const resolvedCount = incidents.filter(
    (i) => i.lifecycleStatus === "RESOLVED" || i.lifecycleStatus === "CLOSED"
  ).length;
  const pendingReports = reports.filter((r) => r.verificationStatus === "PENDING").length;

  // Breakdown by disaster category
  const categoryCounts: Record<string, number> = {
    "Flood / Urban Flood": 0,
    "Cyclone / Coastal Flooding": 0,
    "Major Urban / Building Fire": 0,
  };
  incidents.forEach((i) => {
    if (categoryCounts[i.category] !== undefined) {
      categoryCounts[i.category]++;
    }
  });

  const totalCategorized = Object.values(categoryCounts).reduce((a, b) => a + b, 0) || 1;

  // Severity counts
  const severityCounts = {
    CRITICAL: incidents.filter((i) => i.severity === "CRITICAL").length,
    HIGH: incidents.filter((i) => i.severity === "HIGH").length,
    MODERATE: incidents.filter((i) => i.severity === "MODERATE").length,
    LOW: incidents.filter((i) => i.severity === "LOW").length,
  };

  // Resource total vs allocated
  const totalResourceUnits = resources.reduce((acc, r) => acc + r.totalStock, 0);
  const allocatedResourceUnits = resources.reduce((acc, r) => acc + r.allocatedStock, 0);
  const resourceUtilizationPct =
    totalResourceUnits > 0
      ? Math.round((allocatedResourceUnits / totalResourceUnits) * 100)
      : 0;

  // Total affected population
  const totalAffected = incidents.reduce((acc, i) => acc + (i.affectedPeopleEstimate || 0), 0);

  // Units deployed
  const deployedResponders = responders.filter((r) => r.status !== "AVAILABLE").length;

  // CSV Export Generator
  const handleExportCSV = () => {
    const headers = [
      "ID",
      "Title",
      "Category",
      "Location",
      "Latitude",
      "Longitude",
      "Severity",
      "LifecycleStatus",
      "AffectedPeopleEstimate",
      "UrgentNeeds",
      "DetectedAt",
      "UpdatedAt",
    ];

    const rows = incidents.map((inc) => [
      inc.id,
      `"${inc.title.replace(/"/g, '""')}"`,
      `"${inc.category}"`,
      `"${inc.locationName.replace(/"/g, '""')}"`,
      inc.lat,
      inc.lon,
      inc.severity,
      inc.lifecycleStatus,
      inc.affectedPeopleEstimate,
      `"${inc.urgentNeeds.join("; ")}"`,
      inc.detectedAt,
      inc.updatedAt,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `ResQ_Situation_Report_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setExportSuccess(true);
    setTimeout(() => setExportSuccess(false), 3500);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Operations Research • NDMA Situation Reporting
          </p>
          <h2 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">
            Disaster Response Analytics &amp; Situation Report
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Aggregated telemetry and operational metrics derived in real-time from active incident logs.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 rounded-lg bg-[#075cab] px-4 py-2 text-sm font-semibold text-white shadow-xs transition hover:bg-[#064a85] cursor-pointer"
          >
            <span>📥</span> Export Situation Report (CSV)
          </button>
        </div>
      </div>

      {exportSuccess && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-800 flex items-center justify-between shadow-xs">
          <span>✓ Situation Report CSV generated and downloaded successfully.</span>
          <button onClick={() => setExportSuccess(false)} className="hover:opacity-75">✕</button>
        </div>
      )}

      {/* Top Cards Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Active Incidents</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{activeIncidents.length}</p>
          <p className="mt-1 text-xs text-slate-500">Total {incidents.length} logged</p>
        </div>

        <div className="rounded-xl border border-red-200 bg-red-50/50 p-4 shadow-xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-red-600">Critical Severity</p>
          <p className="mt-2 text-3xl font-bold text-red-700">{criticalCount}</p>
          <p className="mt-1 text-xs text-red-600/80">Immediate action required</p>
        </div>

        <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-4 shadow-xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#07569c]">Deployed Responders</p>
          <p className="mt-2 text-3xl font-bold text-[#07569c]">
            {deployedResponders} <span className="text-lg text-slate-400">/ {responders.length}</span>
          </p>
          <p className="mt-1 text-xs text-slate-500">{dispatches.length} missions executed</p>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Resolved / Closed</p>
          <p className="mt-2 text-3xl font-bold text-emerald-800">{resolvedCount}</p>
          <p className="mt-1 text-xs text-emerald-700/80">Operations completed</p>
        </div>
      </div>

      {/* Disaster Category Distribution */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="font-bold text-slate-900 text-sm tracking-tight">
            Distribution by Disaster Category (Exclusive to 3 Supported Types)
          </h3>
          <span className="text-xs text-slate-400 font-medium">NDMA Tier-1 Response Scope</span>
        </div>

        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1.5">
              <span className="flex items-center gap-1.5">
                <span>🌊</span> Flood / Urban Flood
              </span>
              <span>
                {categoryCounts["Flood / Urban Flood"]} incidents (
                {Math.round((categoryCounts["Flood / Urban Flood"] / totalCategorized) * 100)}%)
              </span>
            </div>
            <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-[#075cab] transition-all duration-500"
                style={{
                  width: `${(categoryCounts["Flood / Urban Flood"] / totalCategorized) * 100}%`,
                }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1.5">
              <span className="flex items-center gap-1.5">
                <span>🌀</span> Cyclone / Coastal Flooding
              </span>
              <span>
                {categoryCounts["Cyclone / Coastal Flooding"]} incidents (
                {Math.round((categoryCounts["Cyclone / Coastal Flooding"] / totalCategorized) * 100)}%)
              </span>
            </div>
            <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-sky-500 transition-all duration-500"
                style={{
                  width: `${
                    (categoryCounts["Cyclone / Coastal Flooding"] / totalCategorized) * 100
                  }%`,
                }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1.5">
              <span className="flex items-center gap-1.5">
                <span>🔥</span> Major Urban / Building Fire
              </span>
              <span>
                {categoryCounts["Major Urban / Building Fire"]} incidents (
                {Math.round((categoryCounts["Major Urban / Building Fire"] / totalCategorized) * 100)}%)
              </span>
            </div>
            <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-orange-500 transition-all duration-500"
                style={{
                  width: `${
                    (categoryCounts["Major Urban / Building Fire"] / totalCategorized) * 100
                  }%`,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Two Columns: Severity Classification + Relief Supplies Utilization */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Severity Classification */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="font-bold text-slate-900 text-sm">Severity Classification</h3>
            <p className="text-xs text-slate-500">Breakdown of operational risk levels</p>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between p-3 rounded-lg border border-red-200 bg-red-50/50">
              <span className="font-bold text-red-700 flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-red-600" /> CRITICAL
              </span>
              <span className="text-base font-bold text-red-800 font-mono">
                {severityCounts.CRITICAL}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border border-orange-200 bg-orange-50/50">
              <span className="font-bold text-orange-700 flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-orange-600" /> HIGH
              </span>
              <span className="text-base font-bold text-orange-800 font-mono">
                {severityCounts.HIGH}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border border-amber-200 bg-amber-50/50">
              <span className="font-bold text-amber-700 flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-amber-600" /> MODERATE
              </span>
              <span className="text-base font-bold text-amber-800 font-mono">
                {severityCounts.MODERATE}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border border-emerald-200 bg-emerald-50/50">
              <span className="font-bold text-emerald-700 flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-emerald-600" /> LOW
              </span>
              <span className="text-base font-bold text-emerald-800 font-mono">
                {severityCounts.LOW}
              </span>
            </div>
          </div>
        </div>

        {/* Relief Supplies Utilization */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="font-bold text-slate-900 text-sm">Relief Supplies Utilization</h3>
            <p className="text-xs text-slate-500">Resource deployment and population impact</p>
          </div>

          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1.5">
                <span>Total Warehouse Stock Allocated</span>
                <span className="text-emerald-700 font-bold">{resourceUtilizationPct}%</span>
              </div>
              <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                  style={{ width: `${resourceUtilizationPct}%` }}
                />
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-100 text-xs">
              <div className="flex justify-between py-1.5">
                <span className="text-slate-500">Pending Citizen Intake Reports:</span>
                <span className="font-bold text-slate-800 font-mono">{pendingReports}</span>
              </div>
              <div className="flex justify-between py-1.5 border-t border-slate-50">
                <span className="text-slate-500">Estimated Affected Population:</span>
                <span className="font-bold text-slate-900 font-mono">
                  {totalAffected.toLocaleString()} citizens
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-t border-slate-50">
                <span className="text-slate-500">Average Response Time (Simulated):</span>
                <span className="font-bold text-[#075cab] font-mono">14.2 mins</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
