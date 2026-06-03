import { Trash2, Warehouse } from "lucide-react";
import { useEffect, useState } from "react";
import type { AppUser, InventoryItem } from "../types";

function GodownStockTab({
  inventory,
  godowns,
  activeBusinessId,
  setInventoryWithBackend,
  currentUser,
}: {
  inventory: Record<string, InventoryItem>;
  godowns: string[];
  activeBusinessId: string;
  setInventoryWithBackend?: React.Dispatch<
    React.SetStateAction<Record<string, InventoryItem>>
  >;
  currentUser?: AppUser;
}) {
  const [selectedGodown, setSelectedGodown] = useState(godowns[0] || "");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

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

  const deleteItem = (sku: string) => {
    if (!setInventoryWithBackend) return;
    setInventoryWithBackend((prev) => {
      const next = { ...prev };
      delete next[sku];
      return next;
    });
    setDeleteConfirm(null);
  };

  const deletingItem = deleteConfirm ? inventory[deleteConfirm] : null;

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
                    <div className="flex items-center gap-4">
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
                      {setInventoryWithBackend &&
                        (currentUser?.role === "admin" ||
                          currentUser?.role === "superadmin") && (
                          <button
                            type="button"
                            onClick={() => setDeleteConfirm(item.sku || "")}
                            className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                            title="Remove inventory item"
                            data-ocid="godown.delete_button"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}

      {/* Delete Inventory Item Confirmation */}
      {deleteConfirm && deletingItem && (
        <div className="fixed inset-0 bg-gray-900/60 z-[300] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="bg-red-100 p-2.5 rounded-2xl">
                <Trash2 size={18} className="text-red-600" />
              </div>
              <h3 className="font-black text-gray-900 text-lg">Remove Item?</h3>
            </div>
            <p className="text-sm text-gray-600">
              Are you sure you want to remove{" "}
              <b className="text-gray-900">{deletingItem.itemName}</b> from
              inventory? This will permanently delete all stock records for this
              item across all godowns.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => deleteItem(deleteConfirm)}
                className="flex-1 bg-red-600 text-white font-black py-3 rounded-2xl text-xs uppercase"
                data-ocid="godown.confirm_button"
              >
                Remove
              </button>
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 border font-black py-3 rounded-2xl text-xs uppercase"
                data-ocid="godown.cancel_button"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ================= SALES RECORD TAB ================= */

export { GodownStockTab };
