"use client";

import React, { useState } from "react";
import { useResQ } from "../../context/ResQContext";
import { ResponderUnitRecord } from "../../types/resq";

interface RespondersViewProps {
  onOpenMap: (target?: { lat: number; lon: number; title: string }) => void;
}

export const RespondersView: React.FC<RespondersViewProps> = ({ onOpenMap }) => {
  const { responders, updateUnitStatus, incidents } = useResQ();
  const [agencyFilter, setAgencyFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [feedback, setFeedback] = useState<string | null>(null);

  const notify = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 3000);
  };

  const filteredResponders = responders.filter((r) => {
    if (agencyFilter !== "ALL" && !r.agency.toLowerCase().includes(agencyFilter.toLowerCase()))
      return false;
    if (statusFilter !== "ALL" && r.status !== statusFilter) return false;
    return true;
  });

  const getStatusBadge = (status: ResponderUnitRecord["status"]) => {
    switch (status) {
      case "AVAILABLE":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "EN ROUTE":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "ON SCENE":
        return "bg-purple-50 text-purple-700 border-purple-200";
      case "ASSIGNED":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "BUSY":
      case "OFFLINE":
        return "bg-slate-100 text-slate-600 border-slate-200";
      default:
        return "bg-slate-50 text-slate-700 border-slate-200";
    }
  };

  const getVehicleIcon = (callsign: string, vehicle: string) => {
    if (callsign.includes("AMB") || vehicle.toLowerCase().includes("ambulance")) return "🚑";
    if (callsign.includes("FIRE") || vehicle.toLowerCase().includes("fire")) return "🚒";
    if (callsign.includes("RESCUE") || vehicle.toLowerCase().includes("boat")) return "🚤";
    if (callsign.includes("DRONE") || vehicle.toLowerCase().includes("drone")) return "🚁";
    return "🚓";
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Field Force Telemetry • Readiness Registry
          </p>
          <h2 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">
            Emergency Responders
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Multi-agency personnel, rescue vehicles, live readiness statuses, and field deployments.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onOpenMap()}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 cursor-pointer"
          >
            <span>⌖</span> View All on Map
          </button>
        </div>
      </div>

      {feedback && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-semibold text-emerald-800 flex items-center justify-between">
          <span>✓ {feedback}</span>
          <button onClick={() => setFeedback(null)} className="hover:opacity-70">✕</button>
        </div>
      )}

      {/* Metrics Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Force Units</p>
          <p className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">{responders.length}</p>
          <p className="mt-1 text-xs text-slate-500">Registered responder units</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Available / Ready</p>
          <p className="mt-2 text-2xl font-bold text-emerald-800 sm:text-3xl">
            {responders.filter((r) => r.status === "AVAILABLE").length}
          </p>
          <p className="mt-1 text-xs text-emerald-700/80">Immediate taskable units</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 shadow-xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700">Mobilizing En Route</p>
          <p className="mt-2 text-2xl font-bold text-amber-800 sm:text-3xl">
            {responders.filter((r) => r.status === "EN ROUTE").length}
          </p>
          <p className="mt-1 text-xs text-amber-700/80">Moving to casualty sites</p>
        </div>
        <div className="rounded-xl border border-purple-200 bg-purple-50/50 p-4 shadow-xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-purple-700">Active On Scene</p>
          <p className="mt-2 text-2xl font-bold text-purple-800 sm:text-3xl">
            {responders.filter((r) => r.status === "ON SCENE").length}
          </p>
          <p className="mt-1 text-xs text-purple-700/80">Executing search & rescue</p>
        </div>
      </div>

      {/* Filter and Agencies */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xs md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-semibold text-slate-500">Agency:</span>
          {["ALL", "NDRF", "Fire", "EMS", "Police"].map((ag) => (
            <button
              key={ag}
              onClick={() => setAgencyFilter(ag)}
              className={`rounded-lg px-3 py-1 font-semibold transition cursor-pointer ${
                agencyFilter === ag
                  ? "bg-[#075cab] text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {ag === "EMS" ? "EMS 108" : ag === "Fire" ? "Fire Service" : ag}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="font-semibold text-slate-500">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 outline-none cursor-pointer"
          >
            <option value="ALL">All Statuses</option>
            <option value="AVAILABLE">Available</option>
            <option value="EN ROUTE">En Route</option>
            <option value="ON SCENE">On Scene</option>
            <option value="ASSIGNED">Assigned</option>
          </select>
        </div>
      </div>

      {/* Units Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredResponders.map((unit) => {
          const assignedIncident = unit.assignedIncidentId
            ? incidents.find((i) => i.id === unit.assignedIncidentId)
            : null;

          return (
            <div
              key={unit.id}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs transition hover:border-slate-300 hover:shadow-sm flex flex-col justify-between space-y-3"
            >
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="text-xl" aria-hidden>
                      {getVehicleIcon(unit.callsign, unit.vehicleType)}
                    </span>
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm font-mono tracking-tight">
                        {unit.callsign}
                      </h3>
                      <p className="text-[10px] text-slate-400 uppercase font-semibold">{unit.agency}</p>
                    </div>
                  </div>
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${getStatusBadge(
                      unit.status
                    )}`}
                  >
                    {unit.status}
                  </span>
                </div>

                <div className="mt-3 space-y-1.5 text-xs text-slate-600">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Team Lead:</span>
                    <span className="font-semibold text-slate-800">{unit.personnelName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Vehicle:</span>
                    <span className="font-medium text-slate-700">{unit.vehicleType}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">GPS Position:</span>
                    <span className="font-mono text-slate-600">
                      {unit.currentLat.toFixed(3)}°N, {unit.currentLon.toFixed(3)}°E
                    </span>
                  </div>
                  {assignedIncident && (
                    <div className="pt-2 border-t border-slate-100">
                      <span className="text-[10px] text-slate-400 block uppercase font-bold">Assigned Incident:</span>
                      <span className="text-[11px] font-semibold text-[#075cab] line-clamp-1">
                        {assignedIncident.title} ({assignedIncident.id})
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Status and Action Buttons */}
              <div className="pt-3 border-t border-slate-100 space-y-2">
                <div className="grid grid-cols-3 gap-1">
                  <button
                    onClick={() => {
                      updateUnitStatus(unit.id, "EN ROUTE");
                      notify(`Unit ${unit.callsign} set to EN ROUTE.`);
                    }}
                    className={`rounded px-1.5 py-1 text-[10px] font-bold transition cursor-pointer text-center ${
                      unit.status === "EN ROUTE"
                        ? "bg-amber-600 text-white"
                        : "bg-amber-50 text-amber-700 hover:bg-amber-100"
                    }`}
                  >
                    En Route 🚗
                  </button>
                  <button
                    onClick={() => {
                      updateUnitStatus(unit.id, "ON SCENE");
                      notify(`Unit ${unit.callsign} set to ON SCENE.`);
                    }}
                    className={`rounded px-1.5 py-1 text-[10px] font-bold transition cursor-pointer text-center ${
                      unit.status === "ON SCENE"
                        ? "bg-purple-600 text-white"
                        : "bg-purple-50 text-purple-700 hover:bg-purple-100"
                    }`}
                  >
                    On Scene 📍
                  </button>
                  <button
                    onClick={() => {
                      updateUnitStatus(unit.id, "AVAILABLE");
                      notify(`Unit ${unit.callsign} marked AVAILABLE.`);
                    }}
                    className={`rounded px-1.5 py-1 text-[10px] font-bold transition cursor-pointer text-center ${
                      unit.status === "AVAILABLE"
                        ? "bg-emerald-600 text-white"
                        : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                    }`}
                  >
                    Ready ✓
                  </button>
                </div>

                <button
                  onClick={() =>
                    onOpenMap({
                      lat: unit.currentLat,
                      lon: unit.currentLon,
                      title: `${unit.callsign} (${unit.personnelName})`,
                    })
                  }
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition cursor-pointer flex items-center justify-center gap-1"
                >
                  <span>⌖</span> Locate on Map
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
