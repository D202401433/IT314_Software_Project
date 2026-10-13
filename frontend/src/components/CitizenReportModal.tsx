"use client";

import React, { useState } from "react";
import { useResQ } from "../context/ResQContext";
import { DisasterCategory } from "../types/resq";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  pickedCoords?: { lat: number; lon: number; name?: string };
}

export default function CitizenReportModal({ isOpen, onClose, pickedCoords }: Props) {
  const { submitCitizenReport, reports } = useResQ();

  const [activeTab, setActiveTab] = useState<"new" | "track">("new");
  const [category, setCategory] = useState<DisasterCategory>("Flood / Urban Flood");
  const [description, setDescription] = useState("");
  const [locationName, setLocationName] = useState(pickedCoords?.name || "Wayanad, Kerala");
  const [lat, setLat] = useState(pickedCoords?.lat || 11.5542);
  const [lon, setLon] = useState(pickedCoords?.lon || 76.1264);
  const [affectedCount, setAffectedCount] = useState(5);
  const [selectedNeeds, setSelectedNeeds] = useState<string[]>(["Rescue Boats"]);
  const [reporterName, setReporterName] = useState("");
  const [reporterPhone, setReporterPhone] = useState("");
  const [submittedReportId, setSubmittedReportId] = useState<string | null>(null);
  const [trackSearchId, setTrackSearchId] = useState("");

  if (!isOpen) return null;

  const urgentNeedsOptions = [
    "Rescue Boats",
    "Medical Evacuation",
    "Drinking Water",
    "Temporary Shelter",
    "Water Tenders (Fire)",
    "Power Grid Cutoff",
  ];

  const handleNeedToggle = (need: string) => {
    if (selectedNeeds.includes(need)) {
      setSelectedNeeds(selectedNeeds.filter((n) => n !== need));
    } else {
      setSelectedNeeds([...selectedNeeds, need]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      alert("Please provide a description of the emergency situation.");
      return;
    }

    const report = submitCitizenReport({
      source: "CITIZEN_APP",
      lat: Number(lat),
      lon: Number(lon),
      locationName: locationName || "Reported Location",
      category,
      description,
      affectedPeopleCount: Number(affectedCount) || 1,
      urgentNeeds: selectedNeeds,
      photoUrls: [],
      reporterName: reporterName || "Anonymous Resident",
      reporterPhone: reporterPhone || "+91 90000 00000",
    });

    setSubmittedReportId(report.id);
  };

  const trackedReport = reports.find((r) => r.id.toLowerCase() === trackSearchId.trim().toLowerCase());

  return (
    <div className="fixed inset-0 z-[2500] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-[#0c4a75] px-5 py-3.5 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">🚨</span>
            <div>
              <h3 className="font-bold text-base leading-tight">Public Emergency Dispatch & Report</h3>
              <p className="text-[11px] text-sky-200">NDMA / ERSS 112 Rapid Triage Channel</p>
            </div>
          </div>
          <button
            onClick={() => {
              setSubmittedReportId(null);
              onClose();
            }}
            className="text-white/80 hover:text-white text-lg font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-200 bg-slate-50 text-xs font-semibold">
          <button
            onClick={() => {
              setActiveTab("new");
              setSubmittedReportId(null);
            }}
            className={`flex-1 py-2.5 text-center transition-colors cursor-pointer ${
              activeTab === "new"
                ? "border-b-2 border-sky-600 text-sky-800 bg-white"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            ➕ Submit Emergency Report
          </button>
          <button
            onClick={() => setActiveTab("track")}
            className={`flex-1 py-2.5 text-center transition-colors cursor-pointer ${
              activeTab === "track"
                ? "border-b-2 border-sky-600 text-sky-800 bg-white"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            🔍 Track Submission Status
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs text-slate-700">
          {activeTab === "new" ? (
            submittedReportId ? (
              <div className="text-center py-6 space-y-3">
                <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-3xl mx-auto shadow-inner">
                  ✓
                </div>
                <h4 className="text-base font-bold text-slate-900">Emergency Report Dispatched</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Your distress report has been queued in the ResQ Operations Center. Response units and AI triage have been notified.
                </p>
                <div className="bg-sky-50 border border-sky-200 rounded-lg p-3 max-w-xs mx-auto text-sky-900 font-mono text-sm font-bold">
                  Reference ID: {submittedReportId}
                </div>
                <p className="text-[11px] text-slate-400">Save this Reference ID to track real-time verification and ambulance/rescue progress.</p>
                <div className="pt-2 flex justify-center gap-2">
                  <button
                    onClick={() => {
                      setTrackSearchId(submittedReportId);
                      setActiveTab("track");
                    }}
                    className="bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-lg font-semibold cursor-pointer"
                  >
                    Track Status Now
                  </button>
                  <button
                    onClick={() => {
                      setSubmittedReportId(null);
                      onClose();
                    }}
                    className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded-lg font-semibold cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3.5">
                {/* Disaster Category */}
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Select Disaster Type <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { type: "Flood / Urban Flood", icon: "🌊" },
                      { type: "Cyclone / Coastal Flooding", icon: "🌀" },
                      { type: "Major Urban / Building Fire", icon: "🔥" },
                    ].map((item) => (
                      <button
                        type="button"
                        key={item.type}
                        onClick={() => setCategory(item.type as DisasterCategory)}
                        className={`p-2.5 rounded-lg border text-left flex flex-col items-center justify-center text-center gap-1 transition-all cursor-pointer ${
                          category === item.type
                            ? "bg-sky-50 border-sky-600 text-sky-900 ring-2 ring-sky-500/20 font-bold"
                            : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        <span className="text-xl">{item.icon}</span>
                        <span className="text-[11px] leading-tight">{item.type}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Situation Description <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe trapped people, water height, fire intensity, floor level, landmarks..."
                    required
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-sky-600 bg-slate-50/50"
                  />
                </div>

                {/* Location and Coords */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-bold text-slate-800 mb-1">Location Name / Landmark</label>
                    <input
                      type="text"
                      value={locationName}
                      onChange={(e) => setLocationName(e.target.value)}
                      placeholder="e.g. Ward 4, Meppadi"
                      className="w-full border border-slate-300 rounded-lg p-2 text-xs text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-800 mb-1">Approx. Affected People</label>
                    <input
                      type="number"
                      min={1}
                      max={1000}
                      value={affectedCount}
                      onChange={(e) => setAffectedCount(Number(e.target.value))}
                      className="w-full border border-slate-300 rounded-lg p-2 text-xs text-slate-800"
                    />
                  </div>
                </div>

                {/* Urgent Needs Pills */}
                <div>
                  <label className="block font-bold text-slate-800 mb-1">Immediate Urgent Needs</label>
                  <div className="flex flex-wrap gap-1.5">
                    {urgentNeedsOptions.map((need) => (
                      <button
                        type="button"
                        key={need}
                        onClick={() => handleNeedToggle(need)}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors cursor-pointer ${
                          selectedNeeds.includes(need)
                            ? "bg-red-600 text-white border-red-700"
                            : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
                        }`}
                      >
                        {selectedNeeds.includes(need) ? "✓ " : "+ "}
                        {need}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Contact Information */}
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                  <div>
                    <label className="block font-medium text-slate-600 mb-0.5">Your Name (Optional)</label>
                    <input
                      type="text"
                      value={reporterName}
                      onChange={(e) => setReporterName(e.target.value)}
                      placeholder="Ananya Verma"
                      className="w-full border border-slate-200 rounded p-1.5 text-xs text-slate-700"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-600 mb-0.5">Contact Phone (For First Responders)</label>
                    <input
                      type="tel"
                      value={reporterPhone}
                      onChange={(e) => setReporterPhone(e.target.value)}
                      placeholder="+91 98765 00000"
                      className="w-full border border-slate-200 rounded p-1.5 text-xs text-slate-700"
                    />
                  </div>
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold shadow-md cursor-pointer flex items-center gap-1.5"
                  >
                    <span>🚨</span> Submit Emergency Report
                  </button>
                </div>
              </form>
            )
          ) : (
            /* Track Submission Tab */
            <div className="space-y-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={trackSearchId}
                  onChange={(e) => setTrackSearchId(e.target.value)}
                  placeholder="Enter Reference ID (e.g. REP-2026-101)"
                  className="flex-1 border border-slate-300 rounded-lg p-2 text-xs font-mono uppercase"
                />
                <button
                  type="button"
                  onClick={() => {}}
                  className="bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-lg font-semibold cursor-pointer"
                >
                  Search
                </button>
              </div>

              {trackedReport ? (
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-2.5">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <div>
                      <span className="font-mono font-bold text-sky-900 text-sm">{trackedReport.id}</span>
                      <span className="text-[11px] text-slate-500 ml-2">{trackedReport.category}</span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        trackedReport.verificationStatus === "VERIFIED"
                          ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                          : trackedReport.verificationStatus === "PENDING"
                          ? "bg-amber-100 text-amber-800 border border-amber-300"
                          : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      {trackedReport.verificationStatus}
                    </span>
                  </div>

                  <p className="text-xs text-slate-700">{trackedReport.description}</p>
                  <div className="text-[11px] text-slate-500">
                    <b>Location:</b> {trackedReport.locationName} • <b>Affected:</b> ~{trackedReport.affectedPeopleCount} people
                  </div>

                  {trackedReport.linkedIncidentId && (
                    <div className="bg-sky-100/70 border border-sky-300 rounded p-2 text-[11px] text-sky-900">
                      <b>Active Mission:</b> Linked to unified operational incident <b>{trackedReport.linkedIncidentId}</b>. First responders assigned.
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-6 text-slate-400">
                  <p>Enter your Reference ID above or select from recent reports:</p>
                  <div className="mt-3 space-y-1.5 text-left max-w-sm mx-auto">
                    {reports.slice(0, 3).map((r) => (
                      <button
                        key={r.id}
                        onClick={() => setTrackSearchId(r.id)}
                        className="w-full text-left p-2 rounded bg-white hover:bg-slate-100 border border-slate-200 text-xs flex justify-between cursor-pointer"
                      >
                        <span className="font-mono font-bold text-sky-800">{r.id}</span>
                        <span className="text-slate-500 truncate max-w-[150px]">{r.locationName}</span>
                        <span className="text-slate-400">({r.verificationStatus})</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
