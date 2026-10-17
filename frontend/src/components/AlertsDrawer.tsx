"use client";

import React, { useState } from "react";
import { useResQ } from "../context/ResQContext";
import { SystemAlertRecord } from "../types/resq";

interface AlertsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectIncident?: (incidentId: string) => void;
}

export const AlertsDrawer: React.FC<AlertsDrawerProps> = ({ isOpen, onClose, onSelectIncident }) => {
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
        if (onSelectIncident) {
          onSelectIncident(match.id);
        }
        onClose();
      }
    }
  };

  const getSeverityBadge = (severity: SystemAlertRecord["severity"]) => {
    switch (severity) {
      case "CRITICAL":
        return "bg-red-50 text-red-700 border border-red-200";
      case "WARNING":
        return "bg-amber-50 text-amber-800 border border-amber-200";
      default:
        return "bg-sky-50 text-sky-800 border border-sky-200";
    }
  };

  return (
    <div className="fixed inset-0 z-[1200] flex justify-end bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white border-l border-slate-200 text-slate-800 h-full flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="grid size-8 place-items-center rounded-lg bg-sky-100 text-base text-[#07569c]" aria-hidden>
              🔔
            </div>
            <div>
              <h2 className="font-bold text-sm text-slate-900 tracking-tight">
                Emergency Alerts &amp; Notifications
              </h2>
              <p className="text-[11px] text-slate-500">Live operational dispatches and advisories</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close notification drawer"
            className="text-slate-400 hover:text-slate-700 p-1.5 hover:bg-slate-200/70 rounded-lg text-sm transition"
          >
            ✕
          </button>
        </div>

        {/* Filter Pills */}
        <div className="px-4 py-2.5 bg-white border-b border-slate-200 flex gap-2 text-xs">
          {(["ALL", "UNREAD", "PUBLIC"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilterType(tab)}
              className={`px-3 py-1 rounded-full text-[11px] font-semibold transition cursor-pointer ${
                filterType === tab
                  ? "bg-[#075cab] text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
              }`}
            >
              {tab === "ALL" && `All (${alerts.length})`}
              {tab === "UNREAD" && `Unread (${alerts.filter((a) => !a.isRead).length})`}
              {tab === "PUBLIC" && `Public Warnings (${alerts.filter((a) => a.isPublic).length})`}
            </button>
          ))}
        </div>

        {/* Alert List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 bg-[#f8fafc]">
          {filteredAlerts.length === 0 ? (
            <div className="text-center py-16 text-slate-400 text-xs">
              <span className="block text-2xl mb-1">📭</span>
              No notifications matching current filter.
            </div>
          ) : (
            filteredAlerts.map((alert) => (
              <div
                key={alert.id}
                onClick={() => handleAlertClick(alert)}
                className={`p-3.5 rounded-xl border cursor-pointer transition relative ${
                  !alert.isRead
                    ? "bg-white border-sky-300 shadow-sm ring-1 ring-sky-200/70 hover:shadow-md"
                    : "bg-white/80 border-slate-200 hover:bg-white hover:border-slate-300"
                }`}
              >
                {!alert.isRead && (
                  <span className="absolute top-3.5 right-3.5 size-2 rounded-full bg-[#075cab] ring-4 ring-sky-100" />
                )}

                <div className="flex items-center gap-2 mb-1.5 pr-4 flex-wrap">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded font-mono ${getSeverityBadge(alert.severity)}`}>
                    {alert.severity}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">
                    {alert.timestamp}
                  </span>
                  {alert.isPublic && (
                    <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded font-semibold">
                      PUBLIC
                    </span>
                  )}
                </div>

                <h4 className="text-xs font-bold text-slate-900 mb-1 leading-snug">
                  {alert.title}
                </h4>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  {alert.description}
                </p>

                {alert.relatedIncidentId && (
                  <div className="mt-2 text-[11px] text-[#075cab] font-semibold hover:underline flex items-center gap-1">
                    <span>📍 View Related Incident ({alert.relatedIncidentId}) →</span>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            {alerts.filter((a) => !a.isRead).length} unread alerts
          </span>
          <button
            onClick={() => {
              alerts.forEach((a) => markAlertRead(a.id));
            }}
            className="text-xs font-semibold text-[#075cab] hover:text-[#064a85] hover:underline transition cursor-pointer"
          >
            Mark all as read
          </button>
        </div>
      </div>
    </div>
  );
};

