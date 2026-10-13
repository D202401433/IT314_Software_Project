"use client";

import React, { useState } from "react";
import { useResQ } from "../context/ResQContext";
import { IncidentRecord, IncidentSeverity } from "../types/resq";

interface Props {
  incident: IncidentRecord | null;
  onClose: () => void;
  onOpenDispatch: (incidentId: string) => void;
}

export default function IncidentDetailPanel({ incident, onClose, onOpenDispatch }: Props) {
  const {
    updateIncidentStatus,
    acceptAITriage,
    overrideAITriage,
    responders,
    messages,
    sendMessage,
    setMapFocusTarget,
  } = useResQ();

  const [activeTab, setActiveTab] = useState<"overview" | "triage" | "timeline" | "comms">("overview");
  const [chatInput, setChatInput] = useState("");
  const [isPriorityMsg, setIsPriorityMsg] = useState(false);

  // Override severity state
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideSeverity, setOverrideSeverity] = useState<IncidentSeverity>("CRITICAL");
  const [overrideReason, setOverrideReason] = useState("");

  if (!incident) return null;

  const incidentMessages = messages.filter((m) => m.incidentId === incident.id);
  const assignedUnits = responders.filter((r) => incident.assignedUnitIds.includes(r.id));

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    sendMessage(incident.id, chatInput.trim(), isPriorityMsg);
    setChatInput("");
    setIsPriorityMsg(false);
  };

  const handleOverrideSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!overrideReason.trim()) {
      alert("Please provide an operational reason for overriding AI triage severity.");
      return;
    }
    overrideAITriage(incident.id, overrideSeverity, 1, overrideReason);
    setShowOverrideModal(false);
    setOverrideReason("");
  };

  const severityColors = {
    CRITICAL: "bg-red-600 text-white",
    HIGH: "bg-orange-500 text-white",
    MODERATE: "bg-amber-400 text-slate-900",
    LOW: "bg-emerald-600 text-white",
  };

  const lifecycleColors: { [key: string]: string } = {
    "NEW REPORT": "bg-slate-200 text-slate-800",
    "UNDER REVIEW": "bg-purple-100 text-purple-800 border border-purple-300",
    "VERIFIED": "bg-blue-100 text-blue-800 border border-blue-300",
    "DISPATCHED": "bg-amber-100 text-amber-800 border border-amber-300",
    "RESPONSE IN PROGRESS": "bg-red-100 text-red-800 border border-red-300",
    "RESOLVED": "bg-emerald-100 text-emerald-800 border border-emerald-300",
    "CLOSED": "bg-slate-300 text-slate-700",
    "REJECTED": "bg-rose-100 text-rose-800",
  };

  return (
    <div className="fixed top-14 right-3 z-[1100] w-96 max-w-[calc(100vw-24px)] bg-white/98 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[calc(100vh-70px)] overflow-hidden animate-fadeIn">
      {/* Header */}
      <div className="bg-[#0c4a75] text-white p-3.5 flex items-start justify-between">
        <div className="flex-1 pr-2">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-xs font-bold bg-sky-900/90 px-1.5 py-0.5 rounded border border-sky-600/40">
              {incident.id}
            </span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${severityColors[incident.severity]}`}>
              {incident.severity}
            </span>
          </div>
          <h3 className="font-bold text-sm leading-tight text-white line-clamp-1">{incident.title}</h3>
          <p className="text-[11px] text-sky-200 flex items-center gap-1 mt-0.5">
            <span>📍</span> {incident.locationName}
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-white/80 hover:text-white text-lg font-bold p-1 cursor-pointer"
        >
          ✕
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 bg-slate-50 text-[11px] font-semibold">
        <button
          onClick={() => setActiveTab("overview")}
          className={`flex-1 py-2 text-center transition-colors cursor-pointer ${
            activeTab === "overview" ? "border-b-2 border-sky-600 text-sky-800 bg-white" : "text-slate-500 hover:text-slate-800"
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab("triage")}
          className={`flex-1 py-2 text-center transition-colors cursor-pointer relative ${
            activeTab === "triage" ? "border-b-2 border-sky-600 text-sky-800 bg-white" : "text-slate-500 hover:text-slate-800"
          }`}
        >
          AI Triage
          {incident.aiRecommendation?.status === "PENDING_REVIEW" && (
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block ml-1 animate-ping" />
          )}
        </button>
        <button
          onClick={() => setActiveTab("timeline")}
          className={`flex-1 py-2 text-center transition-colors cursor-pointer ${
            activeTab === "timeline" ? "border-b-2 border-sky-600 text-sky-800 bg-white" : "text-slate-500 hover:text-slate-800"
          }`}
        >
          Timeline
        </button>
        <button
          onClick={() => setActiveTab("comms")}
          className={`flex-1 py-2 text-center transition-colors cursor-pointer relative ${
            activeTab === "comms" ? "border-b-2 border-sky-600 text-sky-800 bg-white" : "text-slate-500 hover:text-slate-800"
          }`}
        >
          Chat ({incidentMessages.length})
        </button>
      </div>

      {/* Content */}
      <div className="p-3.5 overflow-y-auto space-y-3.5 text-xs text-slate-700 flex-1">
        {activeTab === "overview" && (
          <div className="space-y-3">
            {/* Status & Focus Button */}
            <div className="flex items-center justify-between bg-slate-50 p-2 rounded-lg border border-slate-200">
              <div>
                <span className="text-[10px] text-slate-400 block font-bold uppercase">Lifecycle State</span>
                <span className={`px-2 py-0.5 rounded text-[11px] font-bold inline-block ${lifecycleColors[incident.lifecycleStatus] || "bg-slate-200"}`}>
                  {incident.lifecycleStatus}
                </span>
              </div>
              <button
                onClick={() => setMapFocusTarget({ lat: incident.lat, lon: incident.lon, zoom: 15, title: incident.title })}
                className="bg-sky-600 hover:bg-sky-700 text-white px-2.5 py-1 rounded text-[11px] font-semibold flex items-center gap-1 cursor-pointer shadow-sm"
              >
                <span>🎯</span> Zoom on Map
              </button>
            </div>

            {/* Description */}
            <div>
              <span className="font-bold text-slate-900 block mb-0.5">Description:</span>
              <p className="text-slate-600 leading-relaxed bg-slate-50 p-2 rounded border border-slate-100">
                {incident.description}
              </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="bg-slate-50 p-2 rounded border border-slate-100">
                <span className="text-slate-400 block">Estimated Affected:</span>
                <b className="text-sm text-slate-900">~{incident.affectedPeopleEstimate} Persons</b>
              </div>
              <div className="bg-slate-50 p-2 rounded border border-slate-100">
                <span className="text-slate-400 block">Reporter Source:</span>
                <b className="text-sm text-slate-900">{incident.reporterSource.replace(/_/g, " ")}</b>
              </div>
            </div>

            {/* Urgent Needs */}
            {incident.urgentNeeds.length > 0 && (
              <div>
                <span className="font-bold text-slate-900 block mb-1">Urgent Capabilities Required:</span>
                <div className="flex flex-wrap gap-1">
                  {incident.urgentNeeds.map((need) => (
                    <span key={need} className="bg-rose-50 text-rose-800 border border-rose-200 px-2 py-0.5 rounded text-[10.5px] font-medium">
                      ⚠️ {need}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Assigned Units */}
            <div className="border-t border-slate-100 pt-2.5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-bold text-slate-900">Assigned Response Units ({assignedUnits.length}):</span>
                <button
                  onClick={() => onOpenDispatch(incident.id)}
                  className="text-sky-700 hover:text-sky-900 font-bold text-[11px] cursor-pointer"
                >
                  + Dispatch Unit
                </button>
              </div>

              {assignedUnits.length === 0 ? (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-[11px] text-center">
                  No units dispatched yet. Click <b>+ Dispatch Unit</b> to assign medics, firefighters, or rescue boats.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {assignedUnits.map((unit) => (
                    <div key={unit.id} className="p-2 rounded bg-slate-50 border border-slate-200 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-slate-800 flex items-center gap-1.5">
                          <span>{unit.role.includes("Medic") ? "🚑" : unit.role.includes("Fire") ? "🚒" : "🚤"}</span>
                          {unit.callsign} — {unit.personnelName}
                        </div>
                        <div className="text-[10px] text-slate-500">{unit.vehicleType} • {unit.agency}</div>
                      </div>
                      <span className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded text-[10px] font-bold">
                        {unit.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Lifecycle Status Change Actions */}
            <div className="border-t border-slate-100 pt-2.5">
              <span className="font-bold text-slate-900 block mb-1">Update Mission Lifecycle:</span>
              <div className="grid grid-cols-2 gap-1.5">
                {incident.lifecycleStatus !== "DISPATCHED" && (
                  <button
                    onClick={() => updateIncidentStatus(incident.id, "DISPATCHED")}
                    className="p-1.5 rounded bg-amber-100 hover:bg-amber-200 text-amber-900 font-semibold cursor-pointer text-center"
                  >
                    Mark Dispatched
                  </button>
                )}
                {incident.lifecycleStatus !== "RESPONSE IN PROGRESS" && (
                  <button
                    onClick={() => updateIncidentStatus(incident.id, "RESPONSE IN PROGRESS")}
                    className="p-1.5 rounded bg-blue-100 hover:bg-blue-200 text-blue-900 font-semibold cursor-pointer text-center"
                  >
                    In Progress
                  </button>
                )}
                {incident.lifecycleStatus !== "RESOLVED" && (
                  <button
                    onClick={() => updateIncidentStatus(incident.id, "RESOLVED", "All victims secured")}
                    className="p-1.5 rounded bg-emerald-100 hover:bg-emerald-200 text-emerald-900 font-semibold cursor-pointer text-center"
                  >
                    Resolve Incident
                  </button>
                )}
                {incident.lifecycleStatus !== "CLOSED" && (
                  <button
                    onClick={() => updateIncidentStatus(incident.id, "CLOSED", "Mission closed")}
                    className="p-1.5 rounded bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold cursor-pointer text-center"
                  >
                    Close Record
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* AI Triage Tab */}
        {activeTab === "triage" && incident.aiRecommendation && (
          <div className="space-y-3">
            <div className="bg-sky-50 border border-sky-200 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sky-950 flex items-center gap-1.5 text-xs">
                  <span>🤖</span> AI Fast Triage Assessment
                </span>
                <span className="font-bold text-[11px] bg-sky-200/80 text-sky-900 px-2 py-0.5 rounded">
                  {incident.aiRecommendation.confidenceScore}% Confidence
                </span>
              </div>

              <div className="text-[11px] text-sky-900 space-y-1">
                <div><b>Proposed Severity:</b> <span className="font-bold text-red-700">{incident.aiRecommendation.proposedSeverity}</span></div>
                <div><b>Recommended Priority:</b> Level {incident.aiRecommendation.recommendedPriority}</div>
                <div><b>Evidence Synthesis:</b> {incident.aiRecommendation.evidenceSummary}</div>
              </div>
            </div>

            {/* Identified Risks */}
            <div>
              <span className="font-bold text-slate-900 block mb-1">Identified Ground Risks:</span>
              <ul className="list-disc pl-4 space-y-1 text-slate-600">
                {incident.aiRecommendation.risksIdentified.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>

            {/* Missing Information Warnings */}
            {incident.aiRecommendation.missingInformationWarnings.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-amber-900">
                <span className="font-bold block mb-0.5">⚠️ Field Information Gaps:</span>
                <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                  {incident.aiRecommendation.missingInformationWarnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* AI Review State */}
            <div className="p-2.5 rounded bg-slate-50 border border-slate-200 flex items-center justify-between text-[11px]">
              <div>
                <span className="text-slate-400 block">Triage Status:</span>
                <b className="text-slate-800">{incident.aiRecommendation.status}</b>
              </div>
              {incident.aiRecommendation.reviewedBy && (
                <div className="text-right text-slate-500">
                  Reviewed by: <b>{incident.aiRecommendation.reviewedBy}</b>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="pt-2 flex flex-col gap-1.5">
              {incident.aiRecommendation.status === "PENDING_REVIEW" && (
                <button
                  onClick={() => acceptAITriage(incident.id)}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-sm cursor-pointer"
                >
                  ✓ Accept AI Recommendation ({incident.aiRecommendation.proposedSeverity})
                </button>
              )}
              <button
                onClick={() => setShowOverrideModal(true)}
                className="w-full py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg font-semibold border border-slate-300 cursor-pointer"
              >
                ⚙️ Override Severity / Priority
              </button>
            </div>
          </div>
        )}

        {/* Timeline Tab */}
        {activeTab === "timeline" && (
          <div className="space-y-3">
            <span className="font-bold text-slate-900 block">Incident Audit & Action Timeline:</span>
            <div className="relative border-l-2 border-sky-600/40 ml-2 space-y-3.5 pl-3">
              {incident.timeline.map((evt) => (
                <div key={evt.id} className="relative">
                  <div className="absolute -left-[19px] top-0.5 w-2.5 h-2.5 rounded-full bg-sky-600" />
                  <div className="text-[10px] text-slate-400">
                    {new Date(evt.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} • {evt.actorName} ({evt.actorRole})
                  </div>
                  <div className="font-semibold text-slate-800 text-[11px]">{evt.action}</div>
                  {evt.details && <div className="text-slate-500 text-[10px] italic">{evt.details}</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tactical Chat Tab */}
        {activeTab === "comms" && (
          <div className="flex flex-col h-full space-y-2">
            <div className="bg-sky-50 p-2 rounded text-[11px] text-sky-900 border border-sky-200 flex justify-between items-center">
              <span><b>Channel:</b> {incident.id} Secure Net</span>
              <span className="text-[10px] bg-sky-200 px-1.5 py-0.5 rounded font-bold">Encrypted</span>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {incidentMessages.length === 0 ? (
                <div className="text-center py-6 text-slate-400 italic">No field transmissions recorded on this channel yet.</div>
              ) : (
                incidentMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`p-2 rounded-lg text-[11px] border ${
                      msg.isPriority
                        ? "bg-red-50 border-red-200 text-red-900"
                        : "bg-slate-50 border-slate-200 text-slate-800"
                    }`}
                  >
                    <div className="flex justify-between text-[10px] mb-1">
                      <b className="text-slate-900">{msg.senderName} ({msg.senderRole})</b>
                      <span className="text-slate-400">{new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                    <div>{msg.messageText}</div>
                    {msg.locationRef && (
                      <button
                        onClick={() => setMapFocusTarget({ lat: msg.locationRef!.lat, lon: msg.locationRef!.lon, zoom: 15, title: msg.locationRef!.label })}
                        className="text-sky-700 underline text-[10px] mt-1 block cursor-pointer font-semibold"
                      >
                        📍 Pinned Location: {msg.locationRef.label}
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleSendChat} className="pt-2 border-t border-slate-200 space-y-1.5">
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Type operational tactical update..."
                  className="flex-1 border border-slate-300 rounded p-1.5 text-xs text-slate-800"
                />
                <button
                  type="submit"
                  className="bg-sky-600 hover:bg-sky-700 text-white px-3 py-1.5 rounded font-bold text-xs cursor-pointer"
                >
                  Send
                </button>
              </div>
              <label className="flex items-center gap-1.5 text-[10.5px] text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPriorityMsg}
                  onChange={(e) => setIsPriorityMsg(e.target.checked)}
                  className="rounded text-red-600"
                />
                <span>Broadcast as High Priority Flash Message</span>
              </label>
            </form>
          </div>
        )}
      </div>

      {/* Override Severity Dialog */}
      {showOverrideModal && (
        <div className="fixed inset-0 z-[2500] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-4 shadow-2xl border border-slate-200 space-y-3">
            <h4 className="font-bold text-sm text-slate-900">Override AI Triage Recommendation</h4>
            <div>
              <label className="block text-xs font-semibold mb-1">Select New Severity:</label>
              <select
                value={overrideSeverity}
                onChange={(e) => setOverrideSeverity(e.target.value as IncidentSeverity)}
                className="w-full border border-slate-300 rounded p-1.5 text-xs font-semibold"
              >
                <option value="CRITICAL">CRITICAL (Immediate Life Threat)</option>
                <option value="HIGH">HIGH (Severe Hazard)</option>
                <option value="MODERATE">MODERATE (Controlled Localized)</option>
                <option value="LOW">LOW (Advisory / Minor)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Operational Justification (Audit Trail):</label>
              <textarea
                rows={2}
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="Ground reconnaissance confirms flood barrier intact..."
                required
                className="w-full border border-slate-300 rounded p-1.5 text-xs text-slate-800"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowOverrideModal(false)}
                className="px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleOverrideSubmit}
                className="px-3 py-1.5 rounded bg-red-600 hover:bg-red-700 text-white text-xs font-bold"
              >
                Confirm Override
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
