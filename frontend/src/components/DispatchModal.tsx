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
  const { responders, dispatchUnit, activeRole, incidents } = useResQ();

  const [overrideIncidentId, setOverrideIncidentId] = useState<string | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState<string>("");
  const [customEta, setCustomEta] = useState<number>(12);
  const [notes, setNotes] = useState<string>("");
  const [overrideBusy, setOverrideBusy] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  if (!isOpen) return null;

  const activeIncident =
    (overrideIncidentId ? incidents.find((i) => i.id === overrideIncidentId) : null) ||
    incident ||
    incidents[0] ||
    null;
  if (!activeIncident) return null;

  // Capability matching logic
  const getSuitabilityScore = (unit: ResponderUnitRecord): { score: number; label: string } => {
    let score = 0;

    if (activeIncident.category === "Major Urban / Building Fire") {
      if (
        unit.callsign.includes("FIRE") ||
        unit.capabilities.some((c) => c.toLowerCase().includes("fire") || c.toLowerCase().includes("thermal"))
      ) {
        score += 60;
      }
    } else if (
      activeIncident.category === "Flood / Urban Flood" ||
      activeIncident.category === "Cyclone / Coastal Flooding"
    ) {
      if (
        unit.callsign.includes("RESCUE") ||
        unit.agency.includes("NDRF") ||
        unit.capabilities.some((c) => c.toLowerCase().includes("boat") || c.toLowerCase().includes("diver"))
      ) {
        score += 60;
      }
    }

    if (
      activeIncident.urgentNeeds.some(
        (n) => n.toLowerCase().includes("medic") || n.toLowerCase().includes("casualt") || n.toLowerCase().includes("injur")
      )
    ) {
      if (unit.callsign.includes("AMB") || unit.role === "Medic / Ambulance Team") {
        score += 40;
      }
    }

    if (unit.status === "AVAILABLE") {
      score += 30;
    } else {
      score -= 20;
    }

    return {
      score,
      label: score >= 60 ? "Best Match" : score >= 30 ? "Good Match" : "Standard",
    };
  };

  // Sort responders by suitability
  const sortedResponders = [...responders].sort((a, b) => {
    return getSuitabilityScore(b).score - getSuitabilityScore(a).score;
  });

  const selectedUnit = responders.find((u) => u.id === selectedUnitId);

  const handleConfirmDispatch = () => {
    if (!selectedUnit) {
      setFeedbackMsg({ type: "error", text: "Please select a response unit to dispatch." });
      return;
    }

    if (selectedUnit.status !== "AVAILABLE" && !overrideBusy) {
      setFeedbackMsg({
        type: "error",
        text: `Unit ${selectedUnit.callsign} is ${selectedUnit.status}. Check authorize preemption below to proceed.`,
      });
      return;
    }

    try {
      dispatchUnit(activeIncident.id, selectedUnit.id, customEta, notes || `Dispatched to ${activeIncident.locationName}`);
      setFeedbackMsg({
        type: "success",
        text: `Dispatched ${selectedUnit.callsign} (${selectedUnit.personnelName}) with ${customEta}m ETA.`,
      });
      setTimeout(() => {
        setFeedbackMsg(null);
        setSelectedUnitId("");
        setNotes("");
        onClose();
      }, 1000);
    } catch (err: any) {
      setFeedbackMsg({ type: "error", text: err.message || "Dispatch operation failed." });
    }
  };

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 text-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center text-red-600 text-lg shadow-2xs shrink-0">
              🚨
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 tracking-tight">
                  Emergency Dispatch
                </h2>
                <span className="text-xs bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded-md font-mono font-semibold">
                  {activeIncident.id}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 truncate max-w-md">
                {activeIncident.title} • {activeIncident.locationName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-2 rounded-lg transition cursor-pointer text-sm"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {feedbackMsg && (
            <div
              className={`p-3 rounded-xl text-xs font-medium border flex items-center justify-between ${
                feedbackMsg.type === "success"
                  ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                  : "bg-red-50 border-red-200 text-red-800"
              }`}
            >
              <span>{feedbackMsg.text}</span>
              <button onClick={() => setFeedbackMsg(null)} className="ml-2 hover:opacity-75 cursor-pointer font-bold">
                ✕
              </button>
            </div>
          )}

          {/* Incident Selector (if multiple incidents available) */}
          {incidents.length > 1 && (
            <div className="flex items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
              <span className="text-xs font-semibold text-slate-600 shrink-0">Target Incident:</span>
              <select
                value={activeIncident.id}
                onChange={(e) => setOverrideIncidentId(e.target.value)}
                className="bg-white border border-slate-200 text-xs font-medium text-slate-800 rounded-lg px-2.5 py-1.5 outline-none cursor-pointer w-full max-w-md focus:border-[#075cab]"
              >
                {incidents.map((inc) => (
                  <option key={inc.id} value={inc.id}>
                    {inc.id} — {inc.title} ({inc.locationName})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Incident Overview Strip */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Category</span>
              <span className="font-semibold text-slate-800 truncate block mt-0.5">{activeIncident.category}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Severity</span>
              <span
                className={`font-bold mt-0.5 block ${
                  activeIncident.severity === "CRITICAL" ? "text-red-600" : "text-amber-600"
                }`}
              >
                {activeIncident.severity}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Est. Affected</span>
              <span className="font-semibold text-slate-800 mt-0.5 block">
                {activeIncident.affectedPeopleEstimate || 0} people
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Priority</span>
              <span className="font-bold text-red-600 mt-0.5 block">
                Level {activeIncident.aiRecommendation?.recommendedPriority || 1}
              </span>
            </div>
          </div>

          {/* AI Capability Recommendation */}
          {activeIncident.aiRecommendation?.suggestedCapabilities && (
            <div className="bg-sky-50/60 border border-sky-100 rounded-xl p-3 text-xs">
              <div className="flex items-center gap-1.5 font-semibold text-[#075cab] mb-1.5">
                <span>🤖 Recommended Capabilities:</span>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-1.5">
                {activeIncident.aiRecommendation.suggestedCapabilities.slice(0, 3).map((cap, i) => (
                  <span
                    key={i}
                    className="bg-white text-[#075cab] border border-sky-200 px-2 py-0.5 rounded-md text-[11px] font-medium shadow-2xs"
                  >
                    ✓ {cap}
                  </span>
                ))}
              </div>
              {activeIncident.urgentNeeds.length > 0 && (
                <p className="text-[11px] text-slate-500">
                  Required: {activeIncident.urgentNeeds.slice(0, 3).join(", ")}
                </p>
              )}
            </div>
          )}

          {/* Unit Selection List */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Select Response Unit ({responders.length})
              </label>
              <span className="text-[11px] text-slate-400 font-medium">Ranked by capability fit</span>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {sortedResponders.map((unit) => {
                const { score, label } = getSuitabilityScore(unit);
                const isSelected = selectedUnitId === unit.id;
                const isAvailable = unit.status === "AVAILABLE";

                return (
                  <div
                    key={unit.id}
                    onClick={() => setSelectedUnitId(unit.id)}
                    className={`p-3 rounded-xl border cursor-pointer transition flex items-center justify-between gap-3 ${
                      isSelected
                        ? "bg-sky-50/60 border-[#075cab] ring-1 ring-[#075cab] shadow-xs"
                        : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        checked={isSelected}
                        onChange={() => setSelectedUnitId(unit.id)}
                        className="text-[#075cab] focus:ring-0 cursor-pointer"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-900 font-mono">{unit.callsign}</span>
                          <span className="text-xs text-slate-600 font-medium">({unit.personnelName})</span>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                              isAvailable
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-amber-50 text-amber-700 border border-amber-200"
                            }`}
                          >
                            {unit.status}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {unit.agency} • {unit.vehicleType}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span
                        className={`text-xs font-semibold ${
                          score >= 60 ? "text-[#075cab]" : "text-slate-600"
                        }`}
                      >
                        {label}
                      </span>
                      <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                        ~{10 + (unit.callsign.length % 7)} min ETA
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Dispatch Assignment Details */}
          {selectedUnit && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Mission Parameters for {selectedUnit.callsign}
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Route ETA (Minutes)
                  </label>
                  <input
                    type="number"
                    min="2"
                    max="120"
                    value={customEta}
                    onChange={(e) => setCustomEta(Number(e.target.value))}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 outline-none focus:border-[#075cab]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Direct Contact
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={`${selectedUnit.phone} (${selectedUnit.agency})`}
                    className="w-full bg-slate-100 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-600 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Briefing Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Proceed via Highway 44. Avoid flooded underpass."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-[#075cab]"
                />
              </div>

              {selectedUnit.status !== "AVAILABLE" && (
                <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-lg flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="overrideBusy"
                    checked={overrideBusy}
                    onChange={(e) => setOverrideBusy(e.target.checked)}
                    className="text-amber-600 rounded cursor-pointer"
                  />
                  <label htmlFor="overrideBusy" className="text-xs text-amber-800 font-medium cursor-pointer">
                    Authorize preemption (Unit is currently {selectedUnit.status})
                  </label>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="text-xs text-slate-500 font-medium">
            Dispatcher: <strong className="text-slate-800">{activeRole}</strong>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 transition cursor-pointer shadow-2xs"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmDispatch}
              disabled={!selectedUnitId}
              className="px-5 py-2 rounded-lg text-xs font-bold text-white bg-[#075cab] hover:bg-[#064a85] disabled:opacity-50 disabled:cursor-not-allowed shadow-xs transition cursor-pointer flex items-center gap-1.5"
            >
              <span>🚀</span> Confirm & Dispatch
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
