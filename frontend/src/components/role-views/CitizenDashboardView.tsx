"use client";

import React, { useState } from "react";
import { useResQ } from "../../context/ResQContext";

interface CitizenDashboardViewProps {
  onOpenCitizenReport: () => void;
  onClose?: () => void;
}

export const CitizenDashboardView: React.FC<CitizenDashboardViewProps> = ({
  onOpenCitizenReport,
  onClose,
}) => {
  const {
    currentUser,
    reports,
    infrastructure,
    dispatches,
    responders,
    setMapFocusTarget,
  } = useResQ();

  const [activeTab, setActiveTab] = useState<"reports" | "shelters" | "guide">("reports");
  const [isMinimized, setIsMinimized] = useState(false);

  // Filter reports submitted by this user (or show all user reports if demo)
  const myReports = reports.filter(
    (r) =>
      r.reporterName.toLowerCase() === currentUser.name.toLowerCase() ||
      r.reporterPhone === currentUser.phone ||
      r.source === "CITIZEN_APP"
  );

  const activeShelters = infrastructure.filter(
    (inf) => inf.type === "SHELTER" || inf.type === "HOSPITAL"
  );

  return (
    <div className="fixed bottom-4 left-4 z-[900] max-w-md w-full animate-fadeIn font-sans">
      <div className="bg-[#0b1222]/95 backdrop-blur-md border border-sky-500/40 rounded-2xl shadow-2xl overflow-hidden text-white transition-all duration-300 ring-1 ring-sky-500/30">
        {/* Banner Top Bar */}
        <div className="px-4 py-2.5 bg-gradient-to-r from-sky-950 via-[#075985] to-slate-900 border-b border-sky-600/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base">👤</span>
            <div>
              <div className="text-xs font-bold tracking-wide text-white flex items-center gap-1.5">
                <span>Citizen Safety Console</span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.2 rounded font-normal">
                  Online
                </span>
              </div>
              <div className="text-[10px] text-sky-200">
                User: <span className="font-semibold text-white">{currentUser.name}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={onOpenCitizenReport}
              className="bg-red-600 hover:bg-red-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow animate-pulse cursor-pointer transition"
              title="Report Emergency SOS"
            >
              🚨 SOS
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
                title="Hide Console"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {!isMinimized && (
          <div className="p-3.5 space-y-3">
            {/* View Navigation Tabs */}
            <div className="flex bg-slate-900/90 p-1 rounded-xl border border-slate-800 text-xs">
              <button
                onClick={() => setActiveTab("reports")}
                className={`flex-1 py-1.5 rounded-lg font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeTab === "reports"
                    ? "bg-sky-600 text-white shadow"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <span>📋</span> My SOS Reports ({myReports.length})
              </button>
              <button
                onClick={() => setActiveTab("shelters")}
                className={`flex-1 py-1.5 rounded-lg font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeTab === "shelters"
                    ? "bg-sky-600 text-white shadow"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <span>🏥</span> Shelters & ER
              </button>
              <button
                onClick={() => setActiveTab("guide")}
                className={`flex-1 py-1.5 rounded-lg font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeTab === "guide"
                    ? "bg-sky-600 text-white shadow"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <span>⚠️</span> Guidelines
              </button>
            </div>

            {/* TAB 1: My SOS Reports */}
            {activeTab === "reports" && (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {myReports.length === 0 ? (
                  <div className="text-center py-4 bg-slate-900/60 rounded-xl border border-slate-800 p-3">
                    <p className="text-xs text-slate-300">No distress reports filed by you yet.</p>
                    <button
                      onClick={onOpenCitizenReport}
                      className="mt-2 text-xs bg-red-600 hover:bg-red-500 text-white font-bold px-3 py-1.5 rounded-lg shadow cursor-pointer transition"
                    >
                      File an Emergency Report Now
                    </button>
                  </div>
                ) : (
                  myReports.map((rep) => {
                    // Check if linked to an active dispatch
                    const activeDispatch = rep.linkedIncidentId
                      ? dispatches.find((d) => d.incidentId === rep.linkedIncidentId)
                      : undefined;
                    const assignedUnit = activeDispatch
                      ? responders.find((r) => r.id === activeDispatch.unitId)
                      : undefined;

                    return (
                      <div
                        key={rep.id}
                        className="bg-slate-900/90 border border-slate-800 hover:border-sky-500/50 p-2.5 rounded-xl space-y-1.5 transition"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-mono font-bold text-sky-400">
                            {rep.id}
                          </span>
                          <span
                            className={`text-[9.5px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                              rep.verificationStatus === "VERIFIED" || rep.verificationStatus === "LINKED_TO_INCIDENT"
                                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                                : rep.verificationStatus === "PENDING"
                                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                                : "bg-red-500/20 text-red-300 border border-red-500/40"
                            }`}
                          >
                            {rep.verificationStatus === "LINKED_TO_INCIDENT"
                              ? "DISPATCHED / HELP ACTIVE"
                              : rep.verificationStatus}
                          </span>
                        </div>

                        <div className="text-xs font-semibold text-slate-200">
                          {rep.category} — {rep.locationName}
                        </div>

                        <div className="text-[10.5px] text-slate-400 line-clamp-2">
                          {rep.description}
                        </div>

                        {/* Status tracker bar */}
                        <div className="bg-slate-950 p-2 rounded-lg border border-slate-800/80 text-[10px] space-y-1">
                          <div className="flex items-center justify-between text-slate-400">
                            <span>Response Progress:</span>
                            <span className="text-emerald-400 font-semibold">
                              {rep.verificationStatus === "PENDING"
                                ? "Under EOC Review"
                                : assignedUnit
                                ? `${assignedUnit.callsign} (${assignedUnit.agency}) Dispatched`
                                : "Team Assigned"}
                            </span>
                          </div>

                          {assignedUnit && (
                            <div className="text-sky-300 flex items-center justify-between pt-0.5">
                              <span>Estimated Arrival:</span>
                              <span className="font-bold text-white">~{activeDispatch?.etaMinutes || 10} mins</span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          <button
                            onClick={() =>
                              setMapFocusTarget({
                                lat: rep.lat,
                                lon: rep.lon,
                                zoom: 16,
                                title: `My Report: ${rep.category}`,
                              })
                            }
                            className="text-[10px] text-sky-400 hover:text-sky-300 underline cursor-pointer flex items-center gap-1"
                          >
                            <span>📍</span> Locate on Map
                          </button>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {new Date(rep.submittedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* TAB 2: Shelters & ER */}
            {activeTab === "shelters" && (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {activeShelters.map((shelter) => (
                  <div
                    key={shelter.id}
                    className="bg-slate-900/90 border border-slate-800 hover:border-emerald-500/50 p-2.5 rounded-xl space-y-1 transition"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        <span>{shelter.type === "HOSPITAL" ? "🏥" : "⛺"}</span>
                        <span>{shelter.name}</span>
                      </span>
                      <span className="text-[9.5px] font-bold bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-500/40">
                        {shelter.status}
                      </span>
                    </div>

                    <div className="text-[10.5px] text-slate-400">
                      {shelter.address} • Contact: <b className="text-sky-300">{shelter.contactNumber}</b>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-300 pt-1">
                      <span>
                        Available Beds / Space: <b className="text-white">{shelter.availableBeds ?? 120}</b>
                      </span>
                      <button
                        onClick={() =>
                          setMapFocusTarget({
                            lat: shelter.lat,
                            lon: shelter.lon,
                            zoom: 16,
                            title: shelter.name,
                          })
                        }
                        className="text-sky-400 hover:text-sky-300 underline cursor-pointer"
                      >
                        Show on Map →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* TAB 3: Safety Guidelines */}
            {activeTab === "guide" && (
              <div className="space-y-2 max-h-56 overflow-y-auto text-xs text-slate-300 pr-1">
                <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800 space-y-1">
                  <div className="font-bold text-sky-400">🌊 Flash Flood / Heavy Rain:</div>
                  <ul className="text-[11px] text-slate-400 list-disc list-inside space-y-0.5">
                    <li>Move immediately to upper floors or designated relief camps.</li>
                    <li>Avoid walking or driving through moving water.</li>
                    <li>Turn off main electrical breaker if water enters premises.</li>
                  </ul>
                </div>

                <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800 space-y-1">
                  <div className="font-bold text-amber-400">🔥 Building Fire Safety:</div>
                  <ul className="text-[11px] text-slate-400 list-disc list-inside space-y-0.5">
                    <li>Crawl low under smoke towards emergency exits.</li>
                    <li>Never use elevators during structural alarms.</li>
                    <li>Signal rescuers from balconies using bright cloth or torch.</li>
                  </ul>
                </div>
              </div>
            )}

            {/* Action Bar Footer */}
            <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px]">
              <button
                onClick={onOpenCitizenReport}
                className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-2 rounded-xl text-xs shadow-md shadow-red-600/30 cursor-pointer transition flex items-center justify-center gap-1.5"
              >
                <span>🚨</span>
                <span>SUBMIT EMERGENCY DISTRESS SOS</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
