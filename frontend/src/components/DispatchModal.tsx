"use client";

import React, { useState } from "react";
import { useResQ } from "../context/ResQContext";
import { IncidentRecord, ResponderUnitRecord } from "../types/resq";

interface DispatchModalProps {
  incident: IncidentRecord | null;
  isOpen: boolean;
  onClose: () => void;
}

export const DispatchModal: React.FC<DispatchModalProps> = ({
  incident,
  isOpen,
  onClose,
}) => {
  const { responders, dispatchUnit, activeRole } = useResQ();
  const [selectedUnitId, setSelectedUnitId] = useState<string>("");
  const [customEta, setCustomEta] = useState<number>(12);
  const [notes, setNotes] = useState<string>("");
  const [overrideBusy, setOverrideBusy] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  if (!isOpen || !incident) return null;

  // Capability matching logic
  const getSuitabilityScore = (unit: ResponderUnitRecord): { score: number; reason: string } => {
    let score = 0;
    const reasons: string[] = [];

    if (incident.category === "Major Urban / Building Fire") {
      if (unit.callsign.includes("FIRE") || unit.capabilities.some(c => c.toLowerCase().includes("fire") || c.toLowerCase().includes("smoke") || c.toLowerCase().includes("thermal"))) {
        score += 60;
        reasons.push("Fire suppression capability");
      }
    } else if (incident.category === "Flood / Urban Flood" || incident.category === "Cyclone / Coastal Flooding") {
      if (unit.callsign.includes("RESCUE") || unit.agency.includes("NDRF") || unit.capabilities.some(c => c.toLowerCase().includes("boat") || c.toLowerCase().includes("flood") || c.toLowerCase().includes("cyclone") || c.toLowerCase().includes("diver"))) {
        score += 60;
        reasons.push("Flood/Disaster water rescue capability");
      }
    }

    if (incident.urgentNeeds.some(n => n.toLowerCase().includes("medic") || n.toLowerCase().includes("casualt") || n.toLowerCase().includes("injur"))) {
      if (unit.callsign.includes("AMB") || unit.role === "Medic / Ambulance Team") {
        score += 40;
        reasons.push("Immediate medical evacuation match");
      }
    }

    if (unit.capabilities.some(c => c.toLowerCase().includes("drone") || c.toLowerCase().includes("recon"))) {
      score += 20;
      reasons.push("Aerial reconnaissance capability");
    }

    if (unit.status === "AVAILABLE") {
      score += 30;
      reasons.push("Unit currently AVAILABLE");
    } else {
      score -= 20;
      reasons.push(`Status: ${unit.status}`);
    }

    return { score, reason: reasons.join(" • ") };
  };

  // Sort responders by suitability
  const sortedResponders = [...responders].sort((a, b) => {
    return getSuitabilityScore(b).score - getSuitabilityScore(a).score;
  });

  const selectedUnit = responders.find((u) => u.id === selectedUnitId);

  const handleConfirmDispatch = () => {
    if (!selectedUnit) {
      setFeedbackMsg({ type: "error", text: "Please select an emergency response unit to dispatch." });
      return;
    }

    if (selectedUnit.status !== "AVAILABLE" && !overrideBusy) {
      setFeedbackMsg({
        type: "error",
        text: `Unit ${selectedUnit.callsign} is currently ${selectedUnit.status}. Enable authorized override to dispatch.`,
      });
      return;
    }

    try {
      dispatchUnit(incident.id, selectedUnit.id, customEta, notes || `Dispatched to ${incident.locationName}`);
      setFeedbackMsg({
        type: "success",
        text: `Successfully dispatched ${selectedUnit.callsign} (${selectedUnit.personnelName}) with simulated ETA ${customEta} mins.`,
      });
      setTimeout(() => {
        setFeedbackMsg(null);
        setSelectedUnitId("");
        setNotes("");
        onClose();
      }, 1200);
    } catch (err: any) {
      setFeedbackMsg({ type: "error", text: err.message || "Dispatch operation failed." });
    }
  };

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-[#0f172a] border border-[#1e293b] text-slate-100 rounded-lg shadow-2xl max-w-2xl w-full flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 bg-linear-to-r from-red-950/70 via-slate-900 to-slate-900 border-b border-red-900/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-red-600/20 border border-red-500/40 flex items-center justify-center text-red-400 font-bold text-lg">
              🚨
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
                EMERGENCY DISPATCH CENTER
                <span className="text-[10px] bg-red-500/20 text-red-300 border border-red-500/30 px-2 py-0.5 rounded font-mono">
                  {incident.id}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Incident: {incident.title} ({incident.locationName})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white hover:bg-slate-800 p-1.5 rounded transition text-sm"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {feedbackMsg && (
            <div
              className={`p-3 rounded-md text-xs font-medium border flex items-center justify-between ${
                feedbackMsg.type === "success"
                  ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-300"
                  : "bg-red-950/40 border-red-500/40 text-red-300"
              }`}
            >
              <span>{feedbackMsg.text}</span>
              <button onClick={() => setFeedbackMsg(null)} className="ml-2 hover:opacity-75">✕</button>
            </div>
          )}

          {/* Incident Overview Banner */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-md p-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Category</span>
              <span className="font-semibold text-amber-400">{incident.category}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Severity</span>
              <span className={`font-semibold ${incident.severity === "CRITICAL" ? "text-red-400" : "text-orange-400"}`}>
                {incident.severity}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Est. Casualties</span>
              <span className="font-semibold text-slate-200">{incident.affectedPeopleEstimate} people</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Priority</span>
              <span className="font-mono font-bold text-red-300">
                LEVEL {incident.aiRecommendation?.recommendedPriority || 1}
              </span>
            </div>
          </div>

          {/* Urgent Needs & AI Suggestion */}
          <div className="bg-blue-950/20 border border-blue-900/40 rounded-md p-3 text-xs">
            <div className="flex items-center gap-1.5 font-semibold text-blue-400 mb-1.5">
              <span>🤖 NDMA AI Capability Recommendation:</span>
            </div>
            <div className="flex flex-wrap gap-1 mb-2">
              {incident.aiRecommendation?.suggestedCapabilities?.map((cap, i) => (
                <span key={i} className="bg-blue-900/50 text-blue-200 border border-blue-700/50 px-2 py-0.5 rounded text-[11px]">
                  ✓ {cap}
                </span>
              ))}
            </div>
            <p className="text-[11px] text-slate-400">
              Needs: {incident.urgentNeeds.join(", ") || "Standard field assistance"}
            </p>
          </div>

          {/* Responders Selection Queue */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Select Tactical Response Unit ({responders.length} registered)
              </label>
              <span className="text-[10px] text-slate-400">Sorted by Capability Fit</span>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {sortedResponders.map((unit) => {
                const { score, reason } = getSuitabilityScore(unit);
                const isSelected = selectedUnitId === unit.id;
                const isAvailable = unit.status === "AVAILABLE";

                return (
                  <div
                    key={unit.id}
                    onClick={() => setSelectedUnitId(unit.id)}
                    className={`p-3 rounded-md border cursor-pointer transition flex items-start justify-between gap-3 ${
                      isSelected
                        ? "bg-blue-950/40 border-blue-500 shadow-md ring-1 ring-blue-500"
                        : "bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900"
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <input
                        type="radio"
                        checked={isSelected}
                        onChange={() => setSelectedUnitId(unit.id)}
                        className="mt-1 text-blue-600 focus:ring-0"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-white font-mono">{unit.callsign}</span>
                          <span className="text-xs text-slate-300 font-medium">({unit.personnelName})</span>
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${
                              isAvailable
                                ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                                : "bg-amber-950 text-amber-400 border border-amber-800"
                            }`}
                          >
                            {unit.status}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {unit.agency} • {unit.vehicleType}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                          <span className="text-cyan-400 font-medium">Equipped:</span>{" "}
                          {unit.capabilities.join(", ")}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-xs font-bold text-blue-400">
                        {score > 50 ? "⭐️ High Match" : "Standard"}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        ~{Math.round(10 + Math.random() * 8)} min ETA
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Dispatch Assignment Details */}
          {selectedUnit && (
            <div className="bg-slate-900 border border-slate-800 rounded-md p-3 space-y-3">
              <h4 className="text-xs font-bold text-slate-200 uppercase">
                Dispatch Parameters for {selectedUnit.callsign}
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Simulated Route ETA (Minutes)
                  </label>
                  <input
                    type="number"
                    min="2"
                    max="120"
                    value={customEta}
                    onChange={(e) => setCustomEta(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Calculated via simulated road network routing.
                  </span>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Operational Channel / Caller
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={`${selectedUnit.phone} (${selectedUnit.agency})`}
                    className="w-full bg-slate-950/60 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-300 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Tactical Dispatch Instructions & Briefing
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Proceed via Highway 44 avoiding flooded bypass. Coordinate with NDRF Sector 2."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              {selectedUnit.status !== "AVAILABLE" && (
                <div className="bg-amber-950/30 border border-amber-900/50 p-2 rounded flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="overrideBusy"
                    checked={overrideBusy}
                    onChange={(e) => setOverrideBusy(e.target.checked)}
                    className="text-amber-500"
                  />
                  <label htmlFor="overrideBusy" className="text-[11px] text-amber-300 cursor-pointer">
                    Authorize Priority Reassignment / Preemption (Unit is currently {selectedUnit.status})
                  </label>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-900 border-t border-slate-800 flex items-center justify-between">
          <div className="text-[11px] text-slate-400 font-mono">
            Dispatcher: <span className="text-slate-300 font-bold">{activeRole}</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 rounded text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmDispatch}
              disabled={!selectedUnitId}
              className="px-4 py-1.5 rounded text-xs font-bold text-white bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed shadow transition flex items-center gap-1.5"
            >
              <span>🚀</span> Confirm & Transmit Dispatch
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
