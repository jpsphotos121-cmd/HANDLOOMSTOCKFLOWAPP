import { Pencil, Receipt, Truck, X } from "lucide-react";
import { useState } from "react";
import type { Transaction } from "../types";

function SalesRecordTab({
  transactions,
  activeBusinessId,
  onEditTransaction,
  isAdmin,
}: {
  transactions: Transaction[];
  activeBusinessId: string;
  onEditTransaction?: (updated: Transaction) => void;
  isAdmin?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);

  const salesTxns = transactions.filter((t) => {
    if (!(!t.businessId || t.businessId === activeBusinessId)) return false;
    if (t.type !== "SALE") return false;
    if (dateFrom && t.date < dateFrom) return false;
    if (dateTo && t.date > dateTo) return false;
    if (
      search &&
      !(
        (t.itemName || "").toLowerCase().includes(search.toLowerCase()) ||
        (t.category || "").toLowerCase().includes(search.toLowerCase())
      )
    )
      return false;
    return true;
  });

  const handleSaveEdit = () => {
    if (!editingTx || !onEditTransaction) return;
    onEditTransaction(editingTx);
    setEditingTx(null);
  };

  return (
    <div className="space-y-6 animate-fade-in-down">
      <div className="border-b pb-4 flex items-center justify-between">
        <h2 className="text-2xl font-black text-gray-800 tracking-tighter uppercase flex items-center gap-2">
          <Receipt className="text-green-600" /> Sales Record
        </h2>
        <span className="bg-green-100 text-green-700 text-xs font-black px-3 py-1 rounded-full uppercase">
          {salesTxns.length} entries
        </span>
      </div>
      <div className="bg-white border rounded-[2rem] p-5 shadow-sm flex flex-wrap gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search item or category..."
          className="flex-1 min-w-[180px] border rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-green-400 bg-gray-50"
        />
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="border rounded-xl p-3 text-sm font-bold outline-none bg-gray-50"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="border rounded-xl p-3 text-sm font-bold outline-none bg-gray-50"
        />
        {(search || dateFrom || dateTo) && (
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setDateFrom("");
              setDateTo("");
            }}
            className="px-4 py-2 bg-gray-100 text-gray-600 rounded-xl text-xs font-black uppercase"
          >
            Clear
          </button>
        )}
      </div>
      {salesTxns.length === 0 ? (
        <div
          className="text-center py-16 text-gray-400 font-bold"
          data-ocid="salesrecord.empty_state"
        >
          No sales records found.
        </div>
      ) : (
        <div className="bg-white border rounded-[2rem] overflow-hidden shadow-sm">
          <div className="hidden md:grid grid-cols-7 gap-2 bg-green-50 px-6 py-3 text-[10px] font-black uppercase text-green-700">
            <span>Date</span>
            <span>Category</span>
            <span>Item</span>
            <span>Qty</span>
            <span className="flex items-center gap-1">
              Bilty / Rate
              <span className="flex items-center gap-0.5 bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full text-[9px] font-black normal-case ml-1">
                <Truck size={8} /> Direct
              </span>
            </span>
            <span>By</span>
            {isAdmin && <span>Edit</span>}
          </div>
          <div className="divide-y">
            {salesTxns.map((t, idx) => (
              <div
                key={t.id}
                data-ocid={`salesrecord.item.${idx + 1}`}
                className="px-4 md:px-6 py-4 grid grid-cols-2 md:grid-cols-7 gap-2 items-center hover:bg-green-50/30 transition-colors"
              >
                <span className="text-xs font-bold text-gray-500">
                  {t.date}
                </span>
                <span className="text-xs font-black text-gray-500 uppercase">
                  {t.category || "—"}
                </span>
                <span className="text-sm font-black text-gray-900 col-span-2 md:col-span-1 flex items-center gap-1 flex-wrap">
                  {t.itemName || t.notes || "Sale"}
                  {(t.isDirectDelivery ||
                    (t.notes || "").includes("Direct Delivery")) && (
                    <span className="inline-flex items-center gap-1 bg-orange-100 text-orange-700 text-[9px] font-black px-1.5 py-0.5 rounded-full whitespace-nowrap">
                      <Truck size={9} /> Direct Delivery
                    </span>
                  )}
                </span>
                <span className="text-xs font-black text-green-700">
                  {t.itemsCount ?? "—"}
                </span>
                <span className="text-xs font-bold text-gray-500">
                  {t.biltyNo ? (
                    <span className="text-blue-600 font-black">
                      {t.biltyNo}
                    </span>
                  ) : t.notes?.includes("₹") ? (
                    t.notes.match(/₹[\d.]+/)?.[0] || "—"
                  ) : (
                    "—"
                  )}
                </span>
                <span className="text-[10px] font-bold text-gray-400">
                  {t.user}
                </span>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => setEditingTx({ ...t })}
                    className="p-1.5 rounded-lg hover:bg-green-100 text-green-600 transition-colors w-fit"
                    title="Edit sale"
                  >
                    <Pencil size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingTx && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-gray-800 uppercase">
                Edit Sale Entry
              </h3>
              <button
                type="button"
                onClick={() => setEditingTx(null)}
                className="p-1.5 hover:bg-gray-100 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>
            {(editingTx.isDirectDelivery ||
              (editingTx.notes || "").includes("Direct Delivery")) && (
              <div className="flex items-center gap-1.5 bg-orange-50 border border-orange-200 rounded-xl px-3 py-2 text-orange-700 text-xs font-black">
                <Truck size={13} /> Direct Delivery to Customer
              </div>
            )}
            <div className="space-y-3">
              <div>
                <p className="text-xs font-black text-gray-500 uppercase">
                  Date
                </p>
                <input
                  type="date"
                  value={editingTx.date}
                  onChange={(e) =>
                    setEditingTx({ ...editingTx, date: e.target.value })
                  }
                  className="w-full border rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-green-400 mt-1"
                />
              </div>
              <div>
                <p className="text-xs font-black text-gray-500 uppercase">
                  Category
                </p>
                <input
                  type="text"
                  value={editingTx.category || ""}
                  onChange={(e) =>
                    setEditingTx({ ...editingTx, category: e.target.value })
                  }
                  className="w-full border rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-green-400 mt-1"
                />
              </div>
              <div>
                <p className="text-xs font-black text-gray-500 uppercase">
                  Item Name
                </p>
                <input
                  type="text"
                  value={editingTx.itemName || ""}
                  onChange={(e) =>
                    setEditingTx({ ...editingTx, itemName: e.target.value })
                  }
                  className="w-full border rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-green-400 mt-1"
                />
              </div>
              <div>
                <p className="text-xs font-black text-gray-500 uppercase">
                  Qty
                </p>
                <input
                  type="number"
                  value={editingTx.itemsCount ?? ""}
                  onChange={(e) =>
                    setEditingTx({
                      ...editingTx,
                      itemsCount: Number(e.target.value),
                    })
                  }
                  className="w-full border rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-green-400 mt-1"
                />
              </div>
              <div>
                <p className="text-xs font-black text-gray-500 uppercase">
                  Bilty No
                </p>
                <input
                  type="text"
                  value={editingTx.biltyNo || ""}
                  onChange={(e) =>
                    setEditingTx({ ...editingTx, biltyNo: e.target.value })
                  }
                  className="w-full border rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-green-400 mt-1"
                />
              </div>
              <div>
                <p className="text-xs font-black text-gray-500 uppercase">
                  Notes
                </p>
                <input
                  type="text"
                  value={editingTx.notes || ""}
                  onChange={(e) =>
                    setEditingTx({ ...editingTx, notes: e.target.value })
                  }
                  className="w-full border rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-green-400 mt-1"
                />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setEditingTx(null)}
                className="flex-1 py-3 border rounded-xl text-sm font-black text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="flex-1 py-3 bg-green-600 text-white rounded-xl text-sm font-black hover:bg-green-700"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export { SalesRecordTab };
