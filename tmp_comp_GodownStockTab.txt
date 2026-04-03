import { Warehouse } from "lucide-react";
import { useEffect, useState } from "react";
import type { InventoryItem } from "../types";

function GodownStockTab({
  inventory,
  godowns,
  activeBusinessId,
}: {
  inventory: Record<string, InventoryItem>;
  godowns: string[];
  activeBusinessId: string;
}) {
  const [selectedGodown, setSelectedGodown] = useState(godowns[0] || "");

  // biome-ignore lint/correctness/useExhaustiveDependencies: only sync when godowns list changes
  useEffect(() => {
    if (
      godowns.length > 0 &&
      (!selectedGodown || !godowns.includes(selectedGodown))
    ) {
      setSelectedGodown(godowns[0]);
    }
  }, [godowns]);

  const items = Object.values(inventory).filter(
    (item) =>
      (!item.businessId || item.businessId === activeBusinessId) &&
      (item.godowns?.[selectedGodown] || 0) > 0,
  );

  const grouped = items.reduce<Record<string, InventoryItem[]>>((acc, item) => {
    const cat = item.category || "Other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  return (
    <div className="space-y-6 animate-fade-in-down">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
        <h2 className="text-2xl font-black text-gray-800 tracking-tighter uppercase">
          Godown Stock
        </h2>
        <select
          value={selectedGodown}
          onChange={(e) => setSelectedGodown(e.target.value)}
          className="border rounded-xl p-2.5 font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          {godowns.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </div>
      {Object.keys(grouped).length === 0 ? (
        <div className="text-center text-gray-400 font-bold py-16">
          No stock in {selectedGodown}
        </div>
      ) : (
        Object.entries(grouped).map(([cat, catItems]) => (
          <div
            key={cat}
            className="bg-white rounded-3xl border shadow-sm overflow-hidden"
          >
            <div className="bg-blue-50 px-6 py-3 border-b">
              <h3 className="font-black text-blue-800 text-xs uppercase tracking-widest">
                {cat}
              </h3>
            </div>
            <div className="divide-y">
              {catItems.map((item) => {
                const attrStr = Object.entries(item.attributes || {})
                  .map(([k, v]) => `${k}: ${v}`)
                  .join(", ");
                return (
                  <div
                    key={item.sku}
                    className="px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-2"
                  >
                    <div>
                      <p className="font-black text-gray-800">
                        {item.itemName}
                      </p>
                      {attrStr && (
                        <p className="text-xs text-gray-500 font-bold mt-0.5">
                          {attrStr}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-[10px] font-black uppercase text-gray-400">
                          Sale Rate
                        </p>
                        <p className="font-black text-gray-800">
                          ₹{item.saleRate}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-black uppercase text-gray-400">
                          Qty in Godown
                        </p>
                        <p className="font-black text-green-700 text-lg">
                          {item.godowns?.[selectedGodown] || 0}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

/* ================= SALES RECORD TAB ================= */

export { GodownStockTab };
