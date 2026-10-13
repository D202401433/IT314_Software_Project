"use client";

import React, { useState } from "react";
import { useResQ } from "../context/ResQContext";
import { SystemAlertRecord } from "../types/resq";

interface AlertsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AlertsDrawer: React.FC<AlertsDrawerProps> = ({ isOpen, onClose }) => {
  const { alerts, markAlertRead, incidents, selectIncident, setMapFocusTarget } = useResQ();
  const [filterType, setFilterType] = useState<"ALL" | "UNREAD" | "PUBLIC">("ALL");

  if (!isOpen) return null;

  const filteredAlerts = alerts.filter((a) => {
    if (filterType === "UNREAD") return !a.isRead;
    if (filterType === "PUBLIC") return a.isPublic;
    return true;
  });

  const handleAlertClick = (alert: SystemAlertRecord) => {
    markAlertRead(alert.id);
    if (alert.relatedIncidentId) {
      const match = incidents.find((i) => i.id === alert.relatedIncidentId);
      if (match) {
        selectIncident(match);
        setMapFocusTarget({ lat: match.lat, lon: match.lon, zoom: 15, title: match.title });
        onClose();
      }
    }
  };

  const getSeverityBadge = (severity: SystemAlertRecord["severity"]) => {
    switch (severity) {
      case "CRITICAL":
        return "bg-red-950 text-red-400 border border-red-700/60";
      case "WARNING":
        return "bg-amber-950 text-amber-400 border border-amber-700/60";
      default:
        return "bg-blue-950 text-blue-400 border border-blue-700/60";
    }
  };

  return (
    <div className="fixed inset-0 z-[1200] flex justify-end bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-[#0f172a] border-l border-slate-800 text-slate-100 h-full flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🔔</span>
            <h2 className="font-bold text-sm text-white tracking-wide">
              EMERGENCY ALERTS & NOTIFICATIONS
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 hover:bg-slate-800 rounded text-sm"
          >
            ✕
          </button>
        </div>

        {/* Filter Pills */}
        <div className="px-4 py-2.5 bg-slate-950 border-b border-slate-800/80 flex gap-2 text-xs">
          {(["ALL", "UNREAD", "PUBLIC"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilterType(tab)}
              className={`px-3 py-1 rounded-full text-[11px] font-medium transition ${
                filterType === tab
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-slate-900 text-slate-400 hover:text-slate-200"
              }`}
            >
              {tab === "ALL" && `All (${alerts.length})`}
              {tab === "UNREAD" && `Unread (${alerts.filter((a) => !a.isRead).length})`}
              {tab === "PUBLIC" && `Public Warnings (${alerts.filter((a) => a.isPublic).length})`}
            </button>
          ))}
        </div>

        {/* Alert List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filteredAlerts.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs">
              No notifications matching current filter.
            </div>
          ) : (
            filteredAlerts.map((alert) => (
              <div
                key={alert.id}
                onClick={() => handleAlertClick(alert)}
                className={`p-3.5 rounded-lg border cursor-pointer transition relative ${
                  !alert.isRead
                    ? "bg-slate-900/90 border-blue-500/50 shadow-md ring-1 ring-blue-500/20"
                    : "bg-slate-900/40 border-slate-800/80 opacity-85 hover:bg-slate-900"
                }`}
              >
                {!alert.isRead && (
                  <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                )}

                <div className="flex items-center gap-2 mb-1.5 pr-4">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded font-mono ${getSeverityBadge(alert.severity)}`}>
                    {alert.severity}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {alert.timestamp}
                  </span>
                  {alert.isPublic && (
                    <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800 px-1.5 py-0.2 rounded font-semibold">
                      PUBLIC
                    </span>
                  )}
                </div>

                <h4 className="text-xs font-bold text-slate-100 mb-1">
                  {alert.title}
                </h4>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  {alert.description}
                </p>

                {alert.relatedIncidentId && (
                  <div className="mt-2 text-[10px] text-blue-400 hover:text-blue-300 font-mono flex items-center gap-1">
                    <span>📍 View Related Incident ({alert.relatedIncidentId}) →</span>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-900 border-t border-slate-800 text-right">
          <button
            onClick={() => {
              alerts.forEach((a) => markAlertRead(a.id));
            }}
            className="text-xs text-slate-400 hover:text-white transition"
          >
            Mark all as read
          </button>
        </div>
      </div>
    </div>
  );
};
