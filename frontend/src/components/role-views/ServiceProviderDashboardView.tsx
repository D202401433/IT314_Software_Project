"use client";

import React, { useState } from "react";
import { useResQ } from "../../context/ResQContext";
import { UnitStatus } from "../../types/resq";

interface ServiceProviderDashboardViewProps {
  onOpenWorkspace: () => void;
  onClose?: () => void;
}

export const ServiceProviderDashboardView: React.FC<ServiceProviderDashboardViewProps> = ({
  onOpenWorkspace,
  onClose,
}) => {
  const {
    currentUser,
    responders,
    updateUnitStatus,
    incidents,
    dispatches,
    sendMessage,
    infrastructure,
    setMapFocusTarget,
  } = useResQ();

  const [isMinimized, setIsMinimized] = useState(false);
  const [sitrepFeedback, setSitrepFeedback] = useState<string | null>(null);

  // Find the responder unit corresponding to this user
  const myUnit =
    responders.find(
      (r) =>
        r.personnelName.toLowerCase() === currentUser.name.toLowerCase() ||
        r.callsign === currentUser.assignedUnitCallsign ||
        (r.role === currentUser.role && r.agency === currentUser.agency)
    ) || responders[0];

  // Find active dispatch assignment for this unit
  const activeDispatch = dispatches.find(
    (d) => d.unitId === myUnit?.id && d.status !== "COMPLETED" && d.status !== "CANCELLED"
  );

  const assignedIncident = activeDispatch
    ? incidents.find((i) => i.id === activeDispatch.incidentId)
    : myUnit?.assignedIncidentId
    ? incidents.find((i) => i.id === myUnit.assignedIncidentId)
    : null;

  // Status changer
  const handleStatusChange = (newStatus: UnitStatus) => {
    if (myUnit) {
      updateUnitStatus(myUnit.id, newStatus);
    }
  };

  // SITREP Transmitter
  const handleSendSITREP = (msg: string) => {
    if (assignedIncident) {
      sendMessage(assignedIncident.id, `[FIELD SITREP - ${myUnit?.callsign || "RESPONDER"}] ${msg}`, true);
      setSitrepFeedback(`Transmitted: "${msg}"`);
      setTimeout(() => setSitrepFeedback(null), 3000);
    } else {
      setSitrepFeedback("No active assigned mission to attach SITREP to.");
      setTimeout(() => setSitrepFeedback(null), 3000);
    }
  };

  // Relevant infrastructure (Hospitals for medics, Fire stations for firefighters, etc.)
  const relevantInfra = infrastructure.filter((inf) => {
    if (currentUser.role.includes("Medic") || currentUser.role.includes("Ambulance")) {
      return inf.type === "HOSPITAL";
    }
    if (currentUser.role.includes("Fire")) {
      return inf.type === "FIRE_STATION" || inf.type === "HOSPITAL";
    }
    return inf.type === "SHELTER" || inf.type === "HOSPITAL";
  });

  return (
    <div className="fixed bottom-4 left-4 z-[900] max-w-lg w-full animate-fadeIn font-sans">
      <div className="bg-[#0b1222]/95 backdrop-blur-md border border-amber-500/40 rounded-2xl shadow-2xl overflow-hidden text-white transition-all duration-300 ring-1 ring-amber-500/30">
        {/* Banner Top Bar */}
        <div className="px-4 py-2.5 bg-gradient-to-r from-amber-950 via-[#78350f] to-slate-900 border-b border-amber-600/40 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-base">🚑</span>
            <div>
              <div className="text-xs font-bold tracking-wide text-white flex items-center gap-1.5">
                <span>Field Responder Unit Console</span>
                <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.2 rounded font-mono font-bold">
                  {myUnit ? myUnit.callsign : "UNIT"}
                </span>
              </div>
              <div className="text-[10px] text-amber-200">
                Personnel: <span className="font-semibold text-white">{currentUser.name}</span> • {currentUser.agency}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={onOpenWorkspace}
              className="bg-amber-600 hover:bg-amber-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-lg transition cursor-pointer shadow"
              title="Open Responder Workspace"
            >
              Full HUD
            </button>
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="text-slate-400 hover:text-white text-xs px-1.5 py-0.5 rounded hover:bg-white/10 cursor-pointer"
            >
              {isMinimized ? "▲" : "▼"}
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-white text-xs px-1.5 py-0.5 rounded hover:bg-white/10 cursor-pointer font-bold"
                title="Close Dashboard Panel"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {!isMinimized && (
          <div className="p-3.5 space-y-3">
            {/* Live Operational Status Switcher */}
            <div>
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-300 mb-1.5">
                <span>Current Unit Status:</span>
                <span className="text-amber-400 font-mono font-bold">{myUnit?.status || "AVAILABLE"}</span>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {(["AVAILABLE", "EN ROUTE", "ON SCENE", "BUSY"] as UnitStatus[]).map((st) => (
                  <button
                    key={st}
                    onClick={() => handleStatusChange(st)}
                    className={`py-1.5 px-1 rounded-xl text-[10px] font-bold transition cursor-pointer border flex flex-col items-center justify-center ${
                      myUnit?.status === st
                        ? st === "AVAILABLE"
                          ? "bg-emerald-600 border-emerald-400 text-white shadow-md shadow-emerald-600/30"
                          : st === "EN ROUTE"
                          ? "bg-amber-600 border-amber-400 text-white shadow-md shadow-amber-600/30"
                          : st === "ON SCENE"
                          ? "bg-blue-600 border-blue-400 text-white shadow-md shadow-blue-600/30"
                          : "bg-red-600 border-red-400 text-white shadow-md shadow-red-600/30"
                        : "bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <span>
                      {st === "AVAILABLE" ? "🟢" : st === "EN ROUTE" ? "🟡" : st === "ON SCENE" ? "🔵" : "🔴"}
                    </span>
                    <span>{st}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Active Mission HUD */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1">
                  <span>🎯</span> Active Mission Assignment
                </span>
                {assignedIncident && (
                  <span className="text-[10px] bg-red-500/20 text-red-300 border border-red-500/40 px-2 py-0.5 rounded-full font-bold">
                    PRIORITY 1
                  </span>
                )}
              </div>

              {assignedIncident ? (
                <div className="space-y-1.5">
                  <div className="text-xs font-bold text-white">
                    {assignedIncident.id}: {assignedIncident.title}
                  </div>
                  <div className="text-[11px] text-slate-300 flex items-center gap-2">
                    <span>📍 {assignedIncident.locationName}</span>
                    <span className="text-sky-400 font-mono font-bold">
                      ~{activeDispatch?.etaMinutes || 12} mins ETA
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 line-clamp-2">
                    {assignedIncident.description}
                  </div>
                  <div className="text-[10px] text-amber-300 bg-amber-950/40 p-1.5 rounded border border-amber-900/40">
                    <b>Urgent Needs:</b> {assignedIncident.urgentNeeds.join(", ")}
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <button
                      onClick={() =>
                        setMapFocusTarget({
                          lat: assignedIncident.lat,
                          lon: assignedIncident.lon,
                          zoom: 16,
                          title: assignedIncident.title,
                        })
                      }
                      className="text-xs text-sky-400 hover:text-sky-300 underline font-semibold cursor-pointer flex items-center gap-1"
                    >
                      <span>🧭</span> Trace Mission Route on Map
                    </button>
                    <span className="text-[10px] text-slate-400">
                      Dispatched by: ERSS 112 Command
                    </span>
                  </div>
                </div>
              ) : (
                <div className="py-3 text-center text-xs text-slate-400">
                  <span>No active incident assigned to your callsign. Unit is currently on stand-by.</span>
                </div>
              )}
            </div>

            {/* SITREP Fast Buttons */}
            <div>
              <div className="text-[11px] font-bold text-slate-300 mb-1.5 flex items-center justify-between">
                <span>Transmit Field SITREP to Command HQ:</span>
                {sitrepFeedback && (
                  <span className="text-[10px] text-emerald-400 font-semibold">{sitrepFeedback}</span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => handleSendSITREP("Arrived on scene, assessing perimeter safety")}
                  className="text-[10.5px] bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 p-1.5 rounded-lg text-left transition cursor-pointer"
                >
                  📍 Arrived on scene
                </button>
                <button
                  onClick={() => handleSendSITREP("Extricating casualties, medical triage in progress")}
                  className="text-[10.5px] bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 p-1.5 rounded-lg text-left transition cursor-pointer"
                >
                  🚑 Casualties extricated
                </button>
                <button
                  onClick={() => handleSendSITREP("Road inundated, requesting backup boat unit")}
                  className="text-[10.5px] bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 p-1.5 rounded-lg text-left transition cursor-pointer"
                >
                  ⚠️ Requesting backup boat
                </button>
                <button
                  onClick={() => handleSendSITREP("Casualties transported to hospital. Mission complete.")}
                  className="text-[10.5px] bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 p-1.5 rounded-lg text-left transition cursor-pointer"
                >
                  ✅ Delivered to ER
                </button>
              </div>
            </div>

            {/* Nearest Critical Infrastructure */}
            <div className="pt-1 border-t border-slate-800">
              <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
                <span>Nearest ER Trauma Centers / Hydrants:</span>
                <span className="text-amber-400">Click to locate</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {relevantInfra.slice(0, 3).map((inf) => (
                  <button
                    key={inf.id}
                    onClick={() =>
                      setMapFocusTarget({
                        lat: inf.lat,
                        lon: inf.lon,
                        zoom: 16,
                        title: inf.name,
                      })
                    }
                    className="text-[10.5px] bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-2 py-1 rounded-lg transition cursor-pointer flex items-center gap-1"
                  >
                    <span>🏥</span>
                    <span className="truncate max-w-[130px]">{inf.name.split(" ")[0]} {inf.name.split(" ")[1]}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
