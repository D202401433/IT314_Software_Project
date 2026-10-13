"use client";

import React, { useState } from "react";
import { useResQ } from "../../context/ResQContext";

interface GeneralPublicDashboardViewProps {
  onOpenAuth: () => void;
  onOpenCitizenReport: () => void;
  onClose?: () => void;
}

export const GeneralPublicDashboardView: React.FC<GeneralPublicDashboardViewProps> = ({
  onOpenAuth,
  onOpenCitizenReport,
  onClose,
}) => {
  const { incidents, responders, infrastructure, setMapFocusTarget } = useResQ();
  const [isMinimized, setIsMinimized] = useState(false);

  const activeIncidentsCount = incidents.filter((i) => i.lifecycleStatus !== "RESOLVED" && i.lifecycleStatus !== "CLOSED").length;
  const activeRespondersCount = responders.filter((r) => r.status !== "OFFLINE").length;
  const activeSheltersCount = infrastructure.filter((infra) => infra.type === "SHELTER" || infra.type === "HOSPITAL").length;

  return (
    <div className="fixed bottom-4 left-4 z-[900] max-w-md w-full animate-fadeIn font-sans">
      <div className="bg-[#0b1222]/95 backdrop-blur-md border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden text-white transition-all duration-300">
        {/* Banner Top Bar */}
        <div className="px-4 py-2.5 bg-gradient-to-r from-sky-950 via-[#0c4a75] to-slate-900 border-b border-sky-800/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-bold tracking-wide text-white uppercase flex items-center gap-1.5">
              General Public View
              <span className="text-[10px] font-normal text-sky-200 bg-sky-900/60 px-1.5 py-0.5 rounded border border-sky-700/40">
                National Portal
              </span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="text-slate-400 hover:text-white text-xs px-1.5 py-0.5 rounded hover:bg-white/10 cursor-pointer"
              title={isMinimized ? "Expand Overview" : "Minimize"}
            >
              {isMinimized ? "▲ Expand" : "▼"}
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-white text-xs px-1.5 py-0.5 rounded hover:bg-white/10 cursor-pointer font-bold"
                title="Close Overview Panel"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {!isMinimized && (
          <div className="p-4 space-y-3.5">
            {/* Live Disaster Overview Counters */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-slate-900/80 border border-red-900/40 p-2.5 rounded-xl">
                <div className="text-lg font-extrabold text-red-400">{activeIncidentsCount}</div>
                <div className="text-[10px] text-slate-300 font-medium">Critical Disasters</div>
              </div>

              <div className="bg-slate-900/80 border border-sky-900/40 p-2.5 rounded-xl">
                <div className="text-lg font-extrabold text-sky-400">{activeRespondersCount}</div>
                <div className="text-[10px] text-slate-300 font-medium">Rescue Units Active</div>
              </div>

              <div className="bg-slate-900/80 border border-emerald-900/40 p-2.5 rounded-xl">
                <div className="text-lg font-extrabold text-emerald-400">{activeSheltersCount}</div>
                <div className="text-[10px] text-slate-300 font-medium">Shelters & ERs</div>
              </div>
            </div>

            {/* Public Advisory Ticker */}
            <div className="p-2.5 bg-slate-900/90 rounded-xl border border-slate-800 text-xs flex items-center gap-2">
              <span className="text-amber-400 text-sm">⚠️</span>
              <span className="text-slate-300 text-[11px] leading-tight">
                <b>IMD Weather Advisory:</b> Torrential rain & flash flood warning active in Western Ghats. Dial <b>112</b> for immediate rescue.
              </span>
            </div>

            {/* Quick Action Buttons */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={onOpenCitizenReport}
                className="bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md shadow-red-600/30 cursor-pointer transition"
              >
                <span className="animate-ping w-1.5 h-1.5 rounded-full bg-white" />
                <span>REPORT SOS DISTRESS</span>
              </button>

              <button
                onClick={onOpenAuth}
                className="bg-sky-600 hover:bg-sky-500 text-white font-bold py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md shadow-sky-600/30 cursor-pointer transition"
              >
                <span>🔐</span>
                <span>SIGN IN / SELECT ROLE</span>
              </button>
            </div>

            {/* Safe Shelters Fast-Focus */}
            <div className="pt-2 border-t border-slate-800">
              <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
                <span>Nearby Emergency Shelters:</span>
                <span className="text-sky-400">Click to locate on map</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {infrastructure
                  .filter((inf) => inf.type === "SHELTER" || inf.type === "HOSPITAL")
                  .slice(0, 3)
                  .map((inf) => (
                    <button
                      key={inf.id}
                      onClick={() => setMapFocusTarget({ lat: inf.lat, lon: inf.lon, zoom: 15, title: inf.name })}
                      className="text-[10.5px] bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700 px-2 py-1 rounded-lg transition cursor-pointer flex items-center gap-1"
                    >
                      <span>{inf.type === "HOSPITAL" ? "🏥" : "⛺"}</span>
                      <span className="truncate max-w-[130px]">{inf.name.split(" ")[0]} {inf.name.split(" ")[1]}</span>
                    </button>
                  ))}
              </div>
            </div>

            {/* Emergency Hotline Numbers */}
            <div className="text-[10.5px] text-slate-400 flex items-center justify-between pt-1">
              <span>National Helplines:</span>
              <span className="text-sky-300 font-mono font-bold">112 (Police) • 1070 (NDMA) • 108 (EMS)</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
