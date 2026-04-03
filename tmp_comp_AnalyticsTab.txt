import { BarChart2 } from "lucide-react";
import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { InwardSavedEntry, Transaction } from "../types";

function AnalyticsTab({
  transactions,
  inwardSaved,
  activeBusinessId,
  godowns,
}: {
  transactions: Transaction[];
  inwardSaved?: InwardSavedEntry[];
  activeBusinessId: string;
  godowns: string[];
}) {
  const [viewMode, setViewMode] = useState<"chart" | "leaderboard">(
    "leaderboard",
  );
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [movementType, setMovementType] = useState<
    "inward" | "outward" | "both"
  >("inward");
  const [selectedGodown, setSelectedGodown] = useState("all");

  // Always compute both inward and outward maps
  const inwardFiltered = transactions.filter((t) => {
    if (!(!t.businessId || t.businessId === activeBusinessId)) return false;
    if (t.type !== "INWARD" && t.type !== "OPENING_STOCK") return false;
    if (dateFrom && t.date < dateFrom) return false;
    if (dateTo && t.date > dateTo) return false;
    return true;
  });

  const outwardFiltered = transactions.filter((t) => {
    if (!(!t.businessId || t.businessId === activeBusinessId)) return false;
    if (t.type !== "TRANSFER" && t.type !== "transfer" && t.type !== "DELIVERY")
      return false;
    if (dateFrom && t.date < dateFrom) return false;
    if (dateTo && t.date > dateTo) return false;
    if (selectedGodown !== "all" && t.fromLocation !== selectedGodown)
      return false;
    return true;
  });

  const buildInwardMap = () => {
    const map: Record<
      string,
      {
        itemName: string;
        category: string;
        subCategory: string;
        inwardQty: number;
        outwardQty: number;
      }
    > = {};
    // Primary: inwardSaved is persisted to backend and survives page reload
    if (inwardSaved && inwardSaved.length > 0) {
      for (const entry of inwardSaved) {
        if (entry.businessId && entry.businessId !== activeBusinessId) continue;
        if (dateFrom && entry.savedAt < dateFrom) continue;
        if (dateTo && entry.savedAt > dateTo) continue;
        for (const item of entry.items) {
          const attrs = (item as any).attributes || {};
          const sub = Object.entries(attrs)
            .map(([k, v]) => `${k}:${v}`)
            .join(", ");
          const key = `${item.category}||${item.itemName}||${sub}`;
          if (!map[key])
            map[key] = {
              itemName: item.itemName,
              category: item.category,
              subCategory: sub,
              inwardQty: 0,
              outwardQty: 0,
            };
          map[key].inwardQty += Number(item.qty) || 0;
        }
      }
      return map;
    }
    // Fallback: in-memory baleItemsList (only present before page reload)
    for (const t of inwardFiltered) {
      if (t.baleItemsList) {
        for (const item of t.baleItemsList) {
          if (selectedGodown !== "all") {
            const godownQty = item.godownQuants?.[selectedGodown] || 0;
            if (godownQty <= 0) continue;
          }
          const sub = Object.entries(item.attributes || {})
            .map(([k, v]) => `${k}:${v}`)
            .join(", ");
          const key = `${item.category}||${item.itemName}||${sub}`;
          if (!map[key])
            map[key] = {
              itemName: item.itemName,
              category: item.category,
              subCategory: sub,
              inwardQty: 0,
              outwardQty: 0,
            };
          map[key].inwardQty += item.qty || 0;
        }
      }
    }
    return map;
  };

  const buildOutwardMap = () => {
    const map: Record<
      string,
      {
        itemName: string;
        category: string;
        subCategory: string;
        inwardQty: number;
        outwardQty: number;
      }
    > = {};
    for (const t of outwardFiltered) {
      if (t.baleItemsList && t.baleItemsList.length > 0) {
        // Use per-item breakdown when available (DELIVERY + TRANSFER with items)
        for (const item of t.baleItemsList) {
          const sub = Object.entries(item.attributes || {})
            .map(([k, v]) => `${k}:${v}`)
            .join(", ");
          const key = `${item.category}||${item.itemName}||${sub}`;
          if (!map[key])
            map[key] = {
              itemName: item.itemName,
              category: item.category,
              subCategory: sub,
              inwardQty: 0,
              outwardQty: 0,
            };
          const qty = item.qty || (item as { qty?: number }).qty || 0;
          map[key].outwardQty += qty;
        }
      } else if (t.itemName) {
        const key = `${t.category || ""}||${t.itemName || ""}||`;
        if (!map[key])
          map[key] = {
            itemName: t.itemName || "",
            category: t.category || "",
            subCategory: "",
            inwardQty: 0,
            outwardQty: 0,
          };
        map[key].outwardQty += t.itemsCount || 0;
      }
    }
    return map;
  };

  const mergedMap = () => {
    const inMap = buildInwardMap();
    const outMap = buildOutwardMap();
    const combined: Record<
      string,
      {
        itemName: string;
        category: string;
        subCategory: string;
        inwardQty: number;
        outwardQty: number;
      }
    > = {};
    for (const [k, v] of Object.entries(inMap)) {
      combined[k] = { ...v };
    }
    for (const [k, v] of Object.entries(outMap)) {
      if (combined[k]) {
        combined[k].outwardQty = v.outwardQty;
      } else {
        combined[k] = { ...v };
      }
    }
    return combined;
  };

  let itemMap: Record<
    string,
    {
      itemName: string;
      category: string;
      subCategory: string;
      inwardQty: number;
      outwardQty: number;
    }
  > = {};
  if (movementType === "inward") {
    itemMap = buildInwardMap();
  } else if (movementType === "outward") {
    itemMap = buildOutwardMap();
  } else {
    itemMap = mergedMap();
  }

  const sortFn = (
    a: { inwardQty: number; outwardQty: number },
    b: { inwardQty: number; outwardQty: number },
  ) => {
    if (movementType === "inward") return b.inwardQty - a.inwardQty;
    if (movementType === "outward") return b.outwardQty - a.outwardQty;
    return b.inwardQty + b.outwardQty - (a.inwardQty + a.outwardQty);
  };

  const sorted = Object.values(itemMap).sort(sortFn);
  const _top20 = sorted.slice(0, 20);

  // Group by category for display
  const categoryGroups: Record<string, typeof sorted> = {};
  for (const item of sorted) {
    const cat = item.category || "Uncategorized";
    if (!categoryGroups[cat]) categoryGroups[cat] = [];
    categoryGroups[cat].push(item);
  }
  const categoryOrder = Object.keys(categoryGroups).sort((a, b) => {
    const sumA = categoryGroups[a].reduce(
      (s, i) => s + i.inwardQty + i.outwardQty,
      0,
    );
    const sumB = categoryGroups[b].reduce(
      (s, i) => s + i.inwardQty + i.outwardQty,
      0,
    );
    return sumB - sumA;
  });

  return (
    <div className="space-y-6 animate-fade-in-down">
      <div className="flex flex-col gap-4 border-b pb-4">
        <h2 className="text-2xl font-black text-gray-800 tracking-tighter uppercase">
          Analytics
        </h2>
        <div className="flex flex-wrap gap-3">
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setMovementType("inward")}
              className={`px-4 py-2 rounded-xl font-black text-xs uppercase ${movementType === "inward" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600"}`}
            >
              Inward
            </button>
            <button
              type="button"
              onClick={() => setMovementType("outward")}
              className={`px-4 py-2 rounded-xl font-black text-xs uppercase ${movementType === "outward" ? "bg-purple-600 text-white" : "bg-gray-100 text-gray-600"}`}
            >
              Outward (to Shop)
            </button>
            <button
              type="button"
              onClick={() => setMovementType("both")}
              className={`px-4 py-2 rounded-xl font-black text-xs uppercase ${movementType === "both" ? "bg-emerald-600 text-white" : "bg-gray-100 text-gray-600"}`}
            >
              Both
            </button>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setViewMode("leaderboard")}
              className={`px-4 py-2 rounded-xl font-black text-xs uppercase ${viewMode === "leaderboard" ? "bg-green-600 text-white" : "bg-gray-100 text-gray-600"}`}
            >
              Leaderboard
            </button>
            <button
              type="button"
              onClick={() => setViewMode("chart")}
              className={`px-4 py-2 rounded-xl font-black text-xs uppercase ${viewMode === "chart" ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-600"}`}
            >
              Chart
            </button>
          </div>
          <select
            value={selectedGodown}
            onChange={(e) => setSelectedGodown(e.target.value)}
            className="border rounded-xl p-2 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="all">All Godowns</option>
            {godowns.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="border rounded-xl p-2 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="border rounded-xl p-2 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="text-center text-gray-400 font-bold py-16">
          No movement data for selected filters
        </div>
      ) : viewMode === "leaderboard" ? (
        <div className="bg-white rounded-3xl border shadow-sm overflow-hidden">
          <div className="overflow-y-auto" style={{ maxHeight: "55vh" }}>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase text-gray-500">
                    #
                  </th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase text-gray-500">
                    Category
                  </th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase text-gray-500">
                    Item
                  </th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase text-gray-500">
                    Sub-Cat
                  </th>
                  {(movementType === "inward" || movementType === "both") && (
                    <th className="px-4 py-3 text-right text-[10px] font-black uppercase text-blue-600">
                      Inward
                    </th>
                  )}
                  {(movementType === "outward" || movementType === "both") && (
                    <th className="px-4 py-3 text-right text-[10px] font-black uppercase text-red-500">
                      Outward
                    </th>
                  )}
                  {movementType === "both" && (
                    <th className="px-4 py-3 text-right text-[10px] font-black uppercase text-gray-500">
                      Total
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y">
                {categoryOrder.map((cat) => {
                  const catItems = categoryGroups[cat].sort(sortFn);
                  const catInward = catItems.reduce(
                    (s, i) => s + i.inwardQty,
                    0,
                  );
                  const catOutward = catItems.reduce(
                    (s, i) => s + i.outwardQty,
                    0,
                  );
                  const _globalRank = sorted.findIndex(
                    (i) => i === catItems[0],
                  );
                  return (
                    <>
                      <tr key={`cat-${cat}`} className="bg-blue-50">
                        <td
                          className="px-4 py-2 font-black text-blue-700 text-xs"
                          colSpan={2}
                        >
                          📦 {cat}
                        </td>
                        <td
                          className="px-4 py-2 text-xs text-gray-400 font-bold"
                          colSpan={2}
                        >
                          {catItems.length} items
                        </td>
                        {(movementType === "inward" ||
                          movementType === "both") && (
                          <td className="px-4 py-2 text-right font-black text-blue-700 text-xs">
                            {catInward}
                          </td>
                        )}
                        {(movementType === "outward" ||
                          movementType === "both") && (
                          <td className="px-4 py-2 text-right font-black text-red-600 text-xs">
                            {catOutward}
                          </td>
                        )}
                        {movementType === "both" && (
                          <td className="px-4 py-2 text-right font-black text-gray-700 text-xs">
                            {catInward + catOutward}
                          </td>
                        )}
                      </tr>
                      {catItems.map((item, i) => {
                        const rank = sorted.indexOf(item);
                        return (
                          <tr
                            key={`${item.category}-${item.itemName}-${item.subCategory}-${i}`}
                            className="hover:bg-gray-50"
                          >
                            <td className="px-4 py-3 font-black text-gray-400">
                              #{rank + 1}
                            </td>
                            <td className="px-4 py-3 font-bold text-gray-600">
                              {item.category}
                            </td>
                            <td className="px-4 py-3 font-black text-gray-800">
                              {item.itemName}
                            </td>
                            <td className="px-4 py-3 text-xs font-bold text-gray-500">
                              {item.subCategory || "-"}
                            </td>
                            {(movementType === "inward" ||
                              movementType === "both") && (
                              <td className="px-4 py-3 text-right font-black text-blue-700">
                                {item.inwardQty}
                              </td>
                            )}
                            {(movementType === "outward" ||
                              movementType === "both") && (
                              <td className="px-4 py-3 text-right font-black text-red-600">
                                {item.outwardQty}
                              </td>
                            )}
                            {movementType === "both" && (
                              <td className="px-4 py-3 text-right font-black text-gray-700">
                                {item.inwardQty + item.outwardQty}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border shadow-sm p-6 overflow-x-auto">
          {(() => {
            const ITEM_COLORS = [
              "#2563eb",
              "#dc2626",
              "#16a34a",
              "#d97706",
              "#7c3aed",
              "#0891b2",
              "#db2777",
              "#65a30d",
              "#ea580c",
              "#0f766e",
              "#4f46e5",
              "#be185d",
              "#15803d",
              "#b45309",
              "#1d4ed8",
            ];
            // Build per-category chart data: one bar per category, colored segments per item
            const chartCats = categoryOrder.map((cat) => {
              const catItems = categoryGroups[cat];
              const row: Record<string, string | number> = { category: cat };
              for (const item of catItems) {
                const key = `${item.itemName}||${item.subCategory}`;
                const qty =
                  movementType === "inward"
                    ? item.inwardQty
                    : movementType === "outward"
                      ? item.outwardQty
                      : item.inwardQty + item.outwardQty;
                row[key] = (Number(row[key]) || 0) + qty;
              }
              return row;
            });
            // Collect all unique item keys across all categories for legend
            const allItemKeys: string[] = [];
            for (const cat of categoryOrder) {
              for (const item of categoryGroups[cat]) {
                const key = `${item.itemName}||${item.subCategory}`;
                if (!allItemKeys.includes(key)) allItemKeys.push(key);
              }
            }
            return (
              <>
                <div
                  style={{
                    minWidth: `${Math.max(400, chartCats.length * 80)}px`,
                  }}
                >
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart
                      data={chartCats}
                      margin={{ top: 10, right: 10, left: 0, bottom: 80 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="category"
                        angle={-45}
                        textAnchor="end"
                        tick={{ fontSize: 10, fontWeight: 700 }}
                      />
                      <YAxis tick={{ fontSize: 10, fontWeight: 700 }} />
                      <Tooltip />
                      {allItemKeys.map((key, idx) => (
                        <Bar
                          key={key}
                          dataKey={key}
                          name={key.split("||")[0]}
                          stackId="a"
                          fill={ITEM_COLORS[idx % ITEM_COLORS.length]}
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                {allItemKeys.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {allItemKeys.map((key, idx) => {
                      const [itemName, sub] = key.split("||");
                      return (
                        <div
                          key={key}
                          className="flex items-center gap-1.5 text-[10px] font-bold text-gray-600"
                        >
                          <div
                            className="w-3 h-3 rounded-sm shrink-0"
                            style={{
                              backgroundColor:
                                ITEM_COLORS[idx % ITEM_COLORS.length],
                            }}
                          />
                          {itemName}
                          {sub ? ` (${sub})` : ""}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}

/* ================= DELIVERY TAB ================= */

export { AnalyticsTab };
