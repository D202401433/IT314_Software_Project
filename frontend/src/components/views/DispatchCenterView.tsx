"use client";

import React, { useState } from "react";
import { useResQ } from "../../context/ResQContext";
import { IncidentRecord } from "../../types/resq";

interface DispatchCenterViewProps {
  onOpenMap: (incident?: IncidentRecord) => void;
  onOpenDispatchModal: (incident?: IncidentRecord) => void;
}

export const DispatchCenterView: React.FC<DispatchCenterViewProps> = ({
  onOpenMap,
  onOpenDispatchModal,
}) => {
  const {
    dispatches,
    responders,
    incidents,
    updateUnitStatus,
  } = useResQ();

  const [filterStatus, setFilterStatus] = useState<string>("ALL");

  const filteredDispatches = dispatches.filter((d) => {
    if (filterStatus !== "ALL" && d.status !== filterStatus) return false;
    return true;
  });

  const availableUnits = responders.filter((r) => r.status === "AVAILABLE");
  const enRouteUnits = responders.filter((r) => r.status === "EN ROUTE");
  const onSceneUnits = responders.filter((r) => r.status === "ON SCENE");

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ASSIGNED":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "EN ROUTE":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "ON SCENE":
        return "bg-purple-50 text-purple-700 border-purple-200";
      case "COMPLETED":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "CANCELLED":
        return "bg-slate-50 text-slate-500 border-slate-200";
      default:
        return "bg-slate-50 text-slate-700 border-slate-200";
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Emergency Communications • Field Operations
          </p>
          <h2 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">
            Dispatch Center
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Real-time responder unit assignment, mission orders, and field coordination.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onOpenDispatchModal()}
            className="flex items-center gap-1.5 rounded-lg bg-[#075cab] px-4 py-2 text-sm font-semibold text-white shadow-xs transition hover:bg-[#064a85] cursor-pointer"
          >
            <span>+</span> Assign New Mission
          </button>
        </div>
      </div>

      {/* Metrics Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Active Missions</p>
          <p className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">{dispatches.length}</p>
          <p className="mt-1 text-xs text-slate-500">Total logged orders</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Available Units</p>
          <p className="mt-2 text-2xl font-bold text-emerald-800 sm:text-3xl">{availableUnits.length}</p>
          <p className="mt-1 text-xs text-emerald-700/80">Ready for instant dispatch</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 shadow-xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700">En Route</p>
          <p className="mt-2 text-2xl font-bold text-amber-800 sm:text-3xl">{enRouteUnits.length}</p>
          <p className="mt-1 text-xs text-amber-700/80">Units mobilizing to site</p>
        </div>
        <div className="rounded-xl border border-purple-200 bg-purple-50/50 p-4 shadow-xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-purple-700">On Scene</p>
          <p className="mt-2 text-2xl font-bold text-purple-800 sm:text-3xl">{onSceneUnits.length}</p>
          <p className="mt-1 text-xs text-purple-700/80">Active rescue / triage ops</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3 text-xs overflow-x-auto">
        <span className="font-semibold text-slate-500 mr-2">Filter Missions:</span>
        {["ALL", "ASSIGNED", "EN ROUTE", "ON SCENE", "COMPLETED"].map((st) => (
          <button
            key={st}
            onClick={() => setFilterStatus(st)}
            className={`rounded-lg px-3 py-1.5 font-semibold transition cursor-pointer ${
              filterStatus === st
                ? "bg-[#075cab] text-white shadow-xs"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {st}
          </button>
        ))}
      </div>

      {/* Dispatches Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">Mission ID</th>
                <th className="px-4 py-3">Assigned Unit</th>
                <th className="px-4 py-3">Incident Target</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Assigned At</th>
                <th className="px-4 py-3">Mission Notes</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredDispatches.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No dispatches matching filter criteria.
                  </td>
                </tr>
              ) : (
                filteredDispatches.map((dispatch) => {
                  const targetIncident = incidents.find((i) => i.id === dispatch.incidentId);
                  const assignedUnit = responders.find((r) => r.id === dispatch.unitId);

                  return (
                    <tr key={dispatch.id} className="hover:bg-slate-50/80 transition">
                      <td className="px-4 py-3 font-mono font-bold text-slate-900">
                        {dispatch.id}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          <span>{assignedUnit?.callsign || dispatch.unitId}</span>
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {assignedUnit?.personnelName || assignedUnit?.agency}
                        </div>
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        <div className="font-semibold text-[#075cab] hover:underline cursor-pointer truncate" onClick={() => onOpenMap(targetIncident)}>
                          {targetIncident?.title || dispatch.incidentId}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">
                          {targetIncident?.locationName}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${getStatusBadge(
                            dispatch.status
                          )}`}
                        >
                          {dispatch.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-500">
                        {dispatch.assignedAt}
                      </td>
                      <td className="px-4 py-3 max-w-xs text-slate-600 truncate">
                        {dispatch.notes || "Standard response deployment."}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {dispatch.status === "ASSIGNED" && (
                            <button
                              onClick={() => updateUnitStatus(dispatch.unitId, "EN ROUTE")}
                              className="rounded bg-amber-500 hover:bg-amber-600 text-white px-2 py-1 text-[10px] font-bold cursor-pointer"
                              title="Set En Route"
                            >
                              En Route 🚗
                            </button>
                          )}
                          {dispatch.status === "EN ROUTE" && (
                            <button
                              onClick={() => updateUnitStatus(dispatch.unitId, "ON SCENE")}
                              className="rounded bg-purple-600 hover:bg-purple-700 text-white px-2 py-1 text-[10px] font-bold cursor-pointer"
                              title="Set On Scene"
                            >
                              On Scene 📍
                            </button>
                          )}
                          {dispatch.status === "ON SCENE" && (
                            <button
                              onClick={() => updateUnitStatus(dispatch.unitId, "AVAILABLE")}
                              className="rounded bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-1 text-[10px] font-bold cursor-pointer"
                              title="Mark Completed"
                            >
                              Complete ✓
                            </button>
                          )}
                          <button
                            onClick={() => onOpenMap(targetIncident)}
                            className="rounded border border-slate-300 bg-white px-2 py-1 text-[10px] font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                          >
                            Map ⌖
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
