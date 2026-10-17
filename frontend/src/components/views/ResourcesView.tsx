"use client";

import React, { useState } from "react";
import { useResQ } from "../../context/ResQContext";

export const ResourcesView: React.FC = () => {
  const { resources, allocateResource, incidents } = useResQ();
  const [allocationAmount, setAllocationAmount] = useState<Record<string, number>>({});
  const [selectedIncidents, setSelectedIncidents] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 3500);
  };

  const totalStock = resources.reduce((acc, r) => acc + r.totalStock, 0);
  const allocatedStock = resources.reduce((acc, r) => acc + r.allocatedStock, 0);
  const utilization = totalStock > 0 ? Math.round((allocatedStock / totalStock) * 100) : 0;

  const handleAllocate = (resourceId: string, resourceName: string, available: number) => {
    const qty = allocationAmount[resourceId] || 1;
    const targetIncId = selectedIncidents[resourceId] || (incidents[0]?.id ?? "inc-1");

    if (qty <= 0) {
      showNotification("Please specify a valid quantity to allocate.");
      return;
    }
    if (qty > available) {
      showNotification(`Insufficient stock: Only ${available} available.`);
      return;
    }

    allocateResource(resourceId, qty, targetIncId);
    showNotification(`Successfully allocated ${qty} units of ${resourceName} to ${targetIncId}!`);
    setAllocationAmount((prev) => ({ ...prev, [resourceId]: 1 }));
  };

  const getCategoryColor = (cat: string) => {
    switch (cat.toLowerCase()) {
      case "ambulance":
        return "bg-sky-50 text-sky-700 border-sky-200";
      case "fire engine":
        return "bg-orange-50 text-orange-700 border-orange-200";
      case "rescue equipment":
        return "bg-cyan-50 text-cyan-700 border-cyan-200";
      case "medical supplies":
        return "bg-rose-50 text-rose-700 border-rose-200";
      case "food and water":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "drones":
        return "bg-indigo-50 text-indigo-700 border-indigo-200";
      case "fuel":
        return "bg-amber-50 text-amber-700 border-amber-200";
      default:
        return "bg-slate-50 text-slate-700 border-slate-200";
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Logistics Command • Central Relief Reserve
          </p>
          <h2 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">
            Disaster Relief Supply Inventory &amp; Allocation
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Real-time warehouse inventory, emergency provisioning, and multi-disaster supply chains.
          </p>
        </div>
      </div>

      {feedback && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-800 flex items-center justify-between shadow-xs animate-in fade-in">
          <span>✓ {feedback}</span>
          <button onClick={() => setFeedback(null)} className="hover:opacity-75">✕</button>
        </div>
      )}

      {/* Metrics Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Reserve Stock</p>
          <p className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">{totalStock.toLocaleString()}</p>
          <p className="mt-1 text-xs text-slate-500">Units across national depots</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Available Stock</p>
          <p className="mt-2 text-2xl font-bold text-emerald-800 sm:text-3xl">
            {(totalStock - allocatedStock).toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-emerald-700/80">Ready for instant dispatch</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 shadow-xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700">Allocated Units</p>
          <p className="mt-2 text-2xl font-bold text-amber-800 sm:text-3xl">{allocatedStock.toLocaleString()}</p>
          <p className="mt-1 text-xs text-amber-700/80">Dispatched to active zones</p>
        </div>
        <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-4 shadow-xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#07569c]">Stock Utilization</p>
          <p className="mt-2 text-2xl font-bold text-[#07569c] sm:text-3xl">{utilization}%</p>
          <p className="mt-1 text-xs text-sky-700/80">Global inventory usage</p>
        </div>
      </div>

      {/* Resources Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {resources.map((res) => {
          const available = res.totalStock - res.allocatedStock;
          const qty = allocationAmount[res.id] || 1;
          const pct = res.totalStock > 0 ? Math.round((available / res.totalStock) * 100) : 0;
          const targetInc = selectedIncidents[res.id] || incidents[0]?.id;

          return (
            <div
              key={res.id}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs transition hover:border-slate-300 hover:shadow-sm flex flex-col justify-between space-y-4"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm leading-snug">
                      {res.name}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Warehouse: <span className="text-slate-700 font-medium">{res.warehouseLocation}</span>
                    </p>
                  </div>
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase shrink-0 ${getCategoryColor(
                      res.category
                    )}`}
                  >
                    {res.category}
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500 font-medium">Available Inventory:</span>
                    <span className="font-mono font-bold text-slate-900">
                      {available} / {res.totalStock} {res.unit}
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        pct > 50
                          ? "bg-emerald-500"
                          : pct > 20
                          ? "bg-amber-500"
                          : "bg-red-500"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Allocation Action Controls */}
              <div className="pt-3 border-t border-slate-100 space-y-2">
                <div className="flex items-center gap-2">
                  <select
                    value={targetInc}
                    onChange={(e) =>
                      setSelectedIncidents((prev) => ({ ...prev, [res.id]: e.target.value }))
                    }
                    className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700 outline-none cursor-pointer"
                  >
                    {incidents.map((inc) => (
                      <option key={inc.id} value={inc.id}>
                        Target: {inc.id} - {inc.title}
                      </option>
                    ))}
                  </select>

                  <div className="flex items-center gap-1 shrink-0">
                    <input
                      type="number"
                      min={1}
                      max={available}
                      value={qty}
                      onChange={(e) =>
                        setAllocationAmount((prev) => ({
                          ...prev,
                          [res.id]: Math.max(1, parseInt(e.target.value) || 1),
                        }))
                      }
                      className="w-16 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-center text-xs font-mono font-semibold text-slate-800 outline-none focus:border-[#075cab]"
                    />
                  </div>
                </div>

                <button
                  onClick={() => handleAllocate(res.id, res.name, available)}
                  disabled={available <= 0}
                  className={`w-full rounded-lg py-2 text-xs font-semibold shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    available > 0
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                      : "bg-slate-200 text-slate-400 cursor-not-allowed"
                  }`}
                >
                  <span>✓</span> Allocate to Incident →
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
