import {
  ChevronDown,
  ChevronUp,
  Edit,
  History as HistoryIcon,
  Pencil,
  Search,
  Trash2,
  X,
} from "lucide-react";
import type React from "react";
import { useState } from "react";
import type {
  AppUser,
  Category,
  InventoryItem,
  InwardSavedEntry,
  PendingParcel,
  Transaction,
  TransitRecord,
} from "../types";
import { ItemNameCombo } from "./ItemNameCombo";

function HistoryTab({
  transactions,
  setConfirmDialog,
  setTransactions,
  activeBusinessId,
  currentUser,
  inventory,
  transitGoods,
  pendingParcels,
  categories,
  godowns,
  showNotification,
  inwardSaved = [],
  updateStock,
  setInwardSaved,
}: {
  transactions: Transaction[];
  setConfirmDialog: (
    d: { message: string; onConfirm: () => void } | null,
  ) => void;
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
  activeBusinessId: string;
  currentUser: AppUser;
  inventory: Record<string, InventoryItem>;
  transitGoods?: TransitRecord[];
  pendingParcels?: PendingParcel[];
  categories: Category[];
  godowns: string[];
  showNotification: (m: string, t?: string) => void;
  inwardSaved?: InwardSavedEntry[];
  updateStock?: (
    sku: string,
    details: Partial<InventoryItem>,
    shopDelta: number,
    godownDelta: number,
    targetGodown?: string,
  ) => void;
  setInwardSaved?: React.Dispatch<React.SetStateAction<InwardSavedEntry[]>>;
}) {
  const [search, setSearch] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [selectedBiltyForHistory, setSelectedBiltyForHistory] = useState<
    string | null
  >(null);

  const toggleRow = (id: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Aggregate all bilties (from transactions, transit, queue)
  const allBiltyNos = Array.from(
    new Set([
      ...transactions
        .filter((t) => !t.businessId || t.businessId === activeBusinessId)
        .filter((t) => t.biltyNo)
        .map((t) => t.biltyNo as string),
      ...(transitGoods || [])
        .filter((g) => !g.businessId || g.businessId === activeBusinessId)
        .map((g) => g.biltyNo),
      ...(pendingParcels || [])
        .filter((p) => !p.businessId || p.businessId === activeBusinessId)
        .map((p) => p.biltyNo),
    ]),
  );

  let filtered = transactions.filter((t) => {
    if (!(!t.businessId || t.businessId === activeBusinessId)) return false;
    if (
      search &&
      !t.biltyNo?.toLowerCase().includes(search.toLowerCase()) &&
      !t.type?.toLowerCase().includes(search.toLowerCase()) &&
      !t.itemName?.toLowerCase().includes(search.toLowerCase())
    )
      return false;
    const tDate = t.date?.split("T")[0] || "";
    if (filterDateFrom && tDate < filterDateFrom) return false;
    if (filterDateTo && tDate > filterDateTo) return false;
    return true;
  });
  filtered = [...filtered].sort((a, b) => {
    const da = a.date?.split("T")[0] || "";
    const db = b.date?.split("T")[0] || "";
    return sortOrder === "desc" ? db.localeCompare(da) : da.localeCompare(db);
  });

  const handleDelete = (id: number) => {
    setConfirmDialog({
      message: "Delete this record?",
      onConfirm: () =>
        setTransactions((prev) => prev.filter((t) => t.id !== id)),
    });
  };

  return (
    <div className="space-y-6 animate-fade-in-down">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b pb-4">
        <h2 className="text-2xl font-black text-gray-800 tracking-tighter uppercase flex items-center gap-2">
          <HistoryIcon className="w-6 h-6 text-blue-600" /> Tracking Log
        </h2>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search Bilty..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 text-sm font-bold bg-white shadow-sm"
            />
          </div>
        </div>
      </div>
      {/* All-Source Bilty Status Panel */}
      {search.length > 2 && (
        <div className="bg-white border rounded-[2rem] overflow-hidden shadow-sm animate-fade-in-down">
          <div className="bg-gray-800 text-white px-6 py-3 flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest">
              Bilty Tracker
            </span>
            <span className="text-gray-400 text-[10px]">Across all tabs</span>
          </div>
          <div className="divide-y max-h-64 overflow-y-auto">
            {allBiltyNos
              .filter((b) => b.toLowerCase().includes(search.toLowerCase()))
              .map((bNo) => {
                const inTransit = (transitGoods || []).some(
                  (g) =>
                    g.biltyNo?.toLowerCase() === bNo.toLowerCase() &&
                    (!g.businessId || g.businessId === activeBusinessId),
                );
                const inQueue = (pendingParcels || []).some(
                  (p) =>
                    p.biltyNo?.toLowerCase() === bNo.toLowerCase() &&
                    (!p.businessId || p.businessId === activeBusinessId),
                );
                const processed = transactions.some(
                  (t) =>
                    t.biltyNo?.toLowerCase() === bNo.toLowerCase() &&
                    (!t.businessId || t.businessId === activeBusinessId),
                );
                let statusLabel = "Unknown";
                let statusColor = "bg-gray-100 text-gray-600";
                if (inTransit) {
                  statusLabel = "In Transit";
                  statusColor = "bg-indigo-100 text-indigo-700";
                } else if (inQueue) {
                  statusLabel = "In Queue";
                  statusColor = "bg-amber-100 text-amber-700";
                } else if (processed) {
                  statusLabel = "Processed";
                  statusColor = "bg-green-100 text-green-700";
                }
                return (
                  <button
                    key={bNo}
                    type="button"
                    onClick={() => setSelectedBiltyForHistory(bNo)}
                    className="w-full text-left px-6 py-3 hover:bg-gray-50 flex items-center justify-between"
                  >
                    <span className="font-black text-sm text-gray-900">
                      {bNo}
                    </span>
                    <span
                      className={`text-[9px] font-black px-2 py-1 rounded-full uppercase ${statusColor}`}
                    >
                      {statusLabel}
                    </span>
                  </button>
                );
              })}
            {allBiltyNos.filter((b) =>
              b.toLowerCase().includes(search.toLowerCase()),
            ).length === 0 && (
              <p className="px-6 py-4 text-xs text-gray-400 font-bold">
                No bilty found matching "{search}"
              </p>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="date"
          value={filterDateFrom}
          onChange={(e) => setFilterDateFrom(e.target.value)}
          className="border rounded-xl p-2.5 text-xs font-bold bg-white outline-none"
        />
        <span className="text-gray-400 text-xs">–</span>
        <input
          type="date"
          value={filterDateTo}
          onChange={(e) => setFilterDateTo(e.target.value)}
          className="border rounded-xl p-2.5 text-xs font-bold bg-white outline-none"
        />
        <select
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value as "asc" | "desc")}
          className="border rounded-xl p-2.5 text-xs font-bold bg-white outline-none"
        >
          <option value="desc">Newest First</option>
          <option value="asc">Oldest First</option>
        </select>
        {(filterDateFrom || filterDateTo) && (
          <button
            type="button"
            onClick={() => {
              setFilterDateFrom("");
              setFilterDateTo("");
            }}
            className="text-xs text-red-500 font-bold bg-red-50 px-3 py-2 rounded-xl"
          >
            Clear
          </button>
        )}
      </div>
      <div className="space-y-4">
        {filtered.length === 0 ? (
          <div className="text-center py-20 bg-white border border-dashed rounded-[3rem]">
            <HistoryIcon className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">
              No Records Found
            </p>
          </div>
        ) : (
          filtered.map((t) => {
            const isTransfer = t.type === "transfer";
            const isExpanded = expandedRows.has(t.id);
            return (
              <div
                key={t.id}
                className={`bg-white rounded-[2rem] border shadow-sm hover:shadow-md transition-shadow ${isTransfer ? "border-purple-100" : "border-gray-100"}`}
              >
                <div className="p-6 flex flex-col md:flex-row justify-between md:items-start gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className={`text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest shadow-sm ${isTransfer ? "bg-purple-600 text-white" : "bg-blue-600 text-white"}`}
                      >
                        {isTransfer ? "Transfer" : t.type}
                      </span>
                      {t.biltyNo && (
                        <button
                          type="button"
                          className="font-black text-gray-900 uppercase text-lg tracking-tight cursor-pointer hover:text-blue-600 hover:underline transition-colors bg-transparent border-0 p-0"
                          title="Click to view bilty journey"
                          onClick={() =>
                            setSelectedBiltyForHistory(t.biltyNo || null)
                          }
                        >
                          {t.biltyNo}
                        </button>
                      )}
                      {isTransfer && t.itemName && (
                        <span className="font-black text-gray-800 text-sm tracking-tight">
                          {t.itemName}
                        </span>
                      )}
                    </div>
                    {isTransfer ? (
                      <div className="text-[10px] font-bold text-gray-500 uppercase flex flex-wrap gap-x-4 gap-y-1 mt-1">
                        <span>
                          By:{" "}
                          <b className="text-gray-800">
                            {t.transferredBy || t.user || "-"}
                          </b>
                        </span>
                        {t.fromLocation && t.toLocation && (
                          <span>
                            Route:{" "}
                            <b className="text-purple-700">
                              {t.fromLocation} → {t.toLocation}
                            </b>
                          </span>
                        )}
                        {t.subCategory && (
                          <span>
                            Specs:{" "}
                            <b className="text-gray-800">{t.subCategory}</b>
                          </span>
                        )}
                        {(t.itemsCount ?? 0) > 0 && (
                          <span>
                            Qty:{" "}
                            <b className="text-gray-800">{t.itemsCount} pcs</b>
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="text-[10px] font-bold text-gray-500 uppercase flex flex-wrap gap-x-4 gap-y-1 mt-1">
                        <span>
                          By: <b className="text-gray-800">{t.user || "-"}</b>
                        </span>
                        <span>
                          Transport:{" "}
                          <b className="text-gray-800">
                            {t.transportName || "-"}
                          </b>
                        </span>
                      </div>
                    )}
                  </div>
                  {/* Right section - date + actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <div
                      className={`text-right p-3 rounded-2xl border ${isTransfer ? "bg-purple-50 border-purple-100" : "bg-gray-50 border-gray-100"}`}
                    >
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        {t.date?.includes("T")
                          ? new Date(t.date).toLocaleString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: true,
                            })
                          : t.date}
                      </p>
                      {!isTransfer && (t.itemsCount ?? 0) > 0 && (
                        <p className="text-xs font-black text-blue-600 mt-1">
                          {t.itemsCount} Items
                        </p>
                      )}
                      {isTransfer && (t.itemsCount ?? 0) > 0 && (
                        <p className="text-xs font-black text-purple-600 mt-1">
                          {t.itemsCount} pcs
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleRow(t.id)}
                      className="p-2 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors text-gray-500"
                      title={isExpanded ? "Collapse" : "Expand details"}
                    >
                      {isExpanded ? (
                        <ChevronUp size={16} />
                      ) : (
                        <ChevronDown size={16} />
                      )}
                    </button>
                    {currentUser.role === "admin" &&
                      (t.type === "INWARD" || t.type === "DIRECT_STOCK") && (
                        <button
                          type="button"
                          onClick={() => setEditingTx({ ...t })}
                          className="p-2 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors text-blue-500"
                        >
                          <Pencil size={16} />
                        </button>
                      )}
                    <button
                      type="button"
                      onClick={() => handleDelete(t.id)}
                      className="text-red-400 p-2 hover:bg-red-50 rounded-xl transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                {isExpanded && (
                  <div className="px-6 pb-6 border-t border-gray-100 pt-4 bg-gray-50/60 rounded-b-[2rem]">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-[10px] font-bold uppercase">
                      {t.biltyNo && (
                        <div>
                          <p className="text-gray-400">Bilty No</p>
                          <p className="text-gray-800 font-black text-sm normal-case">
                            {t.biltyNo}
                          </p>
                        </div>
                      )}
                      {t.itemName && (
                        <div>
                          <p className="text-gray-400">Item</p>
                          <p className="text-gray-800 font-black text-sm normal-case">
                            {t.itemName}
                          </p>
                        </div>
                      )}
                      {t.category && (
                        <div>
                          <p className="text-gray-400">Category</p>
                          <p className="text-gray-800 font-black text-sm normal-case">
                            {t.category}
                          </p>
                        </div>
                      )}
                      {t.subCategory && (
                        <div>
                          <p className="text-gray-400">Sub-Category</p>
                          <p className="text-gray-800 font-black text-sm normal-case">
                            {t.subCategory}
                          </p>
                        </div>
                      )}
                      {t.fromLocation && (
                        <div>
                          <p className="text-gray-400">From</p>
                          <p className="text-gray-800 font-black text-sm normal-case">
                            {t.fromLocation}
                          </p>
                        </div>
                      )}
                      {t.toLocation && (
                        <div>
                          <p className="text-gray-400">To</p>
                          <p className="text-gray-800 font-black text-sm normal-case">
                            {t.toLocation}
                          </p>
                        </div>
                      )}
                      {t.transportName && (
                        <div>
                          <p className="text-gray-400">Transport</p>
                          <p className="text-gray-800 font-black text-sm normal-case">
                            {t.transportName}
                          </p>
                        </div>
                      )}
                      {t.itemsCount !== undefined && (
                        <div>
                          <p className="text-gray-400">Qty</p>
                          <p className="text-gray-800 font-black text-sm">
                            {t.itemsCount}
                          </p>
                        </div>
                      )}
                      {(t.transferredBy || t.user) && (
                        <div>
                          <p className="text-gray-400">By</p>
                          <p className="text-gray-800 font-black text-sm normal-case">
                            {t.transferredBy || t.user}
                          </p>
                        </div>
                      )}
                      {t.notes && (
                        <div className="col-span-2 sm:col-span-3">
                          <p className="text-gray-400">Notes</p>
                          <p className="text-gray-700 font-bold text-xs normal-case mt-1">
                            {t.notes}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {editingTx && (
        <div className="fixed inset-0 bg-gray-900/60 z-[100] flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-fade-in-down">
            <div className="flex justify-between items-center mb-6">
              <div>
                <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">
                  Edit Inward Entry
                </p>
                <h3 className="font-black text-gray-900 text-lg uppercase tracking-tight">
                  {editingTx.biltyNo}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingTx(null)}
                className="p-2 bg-gray-100 rounded-full"
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4">
              {/* Header fields */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase text-gray-400 ml-1 mb-1">
                    Bilty No <span className="text-gray-300">(locked)</span>
                  </p>
                  <input
                    type="text"
                    value={editingTx.biltyNo || ""}
                    readOnly
                    className="w-full border rounded-xl p-3 font-bold bg-gray-100 text-gray-500 cursor-not-allowed"
                  />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-gray-400 ml-1 mb-1">
                    Transport
                  </p>
                  <input
                    type="text"
                    value={editingTx.transportName || ""}
                    onChange={(e) =>
                      setEditingTx({
                        ...editingTx,
                        transportName: e.target.value,
                      } as Transaction)
                    }
                    className="w-full border rounded-xl p-3 font-bold bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-gray-400 ml-1 mb-1">
                    Opened By
                  </p>
                  <input
                    type="text"
                    value={editingTx.user || ""}
                    onChange={(e) =>
                      setEditingTx({
                        ...editingTx,
                        user: e.target.value,
                      } as Transaction)
                    }
                    className="w-full border rounded-xl p-3 font-bold bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-gray-400 ml-1 mb-1">
                    Date
                  </p>
                  <input
                    type="date"
                    value={editingTx.date?.split("T")[0] || ""}
                    onChange={(e) =>
                      setEditingTx({
                        ...editingTx,
                        date: e.target.value,
                      } as Transaction)
                    }
                    className="w-full border rounded-xl p-3 font-bold bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="col-span-2">
                  <p className="text-[10px] font-black uppercase text-gray-400 ml-1 mb-1">
                    Total Qty in Bale
                  </p>
                  <input
                    type="number"
                    value={editingTx.totalQtyInBale ?? ""}
                    onChange={(e) =>
                      setEditingTx({
                        ...editingTx,
                        totalQtyInBale:
                          e.target.value === ""
                            ? undefined
                            : Number(e.target.value),
                      } as Transaction)
                    }
                    className="w-full border rounded-xl p-3 font-bold bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              {/* Bale Items */}
              <div>
                <p className="text-[10px] font-black uppercase text-gray-500 mb-3 mt-2">
                  Items in Bale
                </p>
                {(editingTx.baleItemsList || []).map((bi, idx) => (
                  <div
                    // biome-ignore lint/suspicious/noArrayIndexKey: stable index key needed for input stability
                    key={`bale-item-${idx}`}
                    className="border border-blue-100 rounded-2xl p-4 mb-3 bg-blue-50/40 space-y-3"
                  >
                    <div className="flex justify-between items-center">
                      <p className="text-[10px] font-black uppercase text-blue-700">
                        Item {idx + 1}
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          setEditingTx({
                            ...editingTx,
                            baleItemsList: (
                              editingTx.baleItemsList || []
                            ).filter((_, i) => i !== idx),
                          } as Transaction)
                        }
                        className="text-red-400 hover:text-red-600 text-[10px] font-black uppercase"
                      >
                        Remove
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-[10px] font-black uppercase text-gray-400 mb-1">
                          Category
                        </p>
                        <select
                          value={bi.category}
                          onChange={(e) => {
                            const updated = [
                              ...(editingTx.baleItemsList || []),
                            ];
                            updated[idx] = {
                              ...updated[idx],
                              category: e.target.value,
                              itemName: "",
                            };
                            setEditingTx({
                              ...editingTx,
                              baleItemsList: updated,
                            } as Transaction);
                          }}
                          className="w-full border rounded-xl p-3 font-bold bg-white focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                        >
                          <option value="">Select</option>
                          {categories.map((c) => (
                            <option key={c.name} value={c.name}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase text-gray-400 mb-1">
                          Item Name
                        </p>
                        <ItemNameCombo
                          category={bi.category}
                          value={bi.itemName}
                          onChange={(val) => {
                            const updated = [
                              ...(editingTx.baleItemsList || []),
                            ];
                            updated[idx] = { ...updated[idx], itemName: val };
                            setEditingTx({
                              ...editingTx,
                              baleItemsList: updated,
                            } as Transaction);
                          }}
                          inventory={inventory}
                          activeBusinessId={activeBusinessId}
                        />
                      </div>
                    </div>
                    {/* Attributes */}
                    {(() => {
                      const cat = categories.find(
                        (c) => c.name === bi.category,
                      );
                      if (!cat || !cat.fields.length) return null;
                      return (
                        <div className="grid grid-cols-2 gap-3">
                          {cat.fields.map((f) => (
                            <div key={f.name}>
                              <p className="text-[10px] font-black uppercase text-gray-400 mb-1">
                                {f.name}
                              </p>
                              {f.type === "select" ? (
                                <select
                                  value={bi.attributes?.[f.name] || ""}
                                  onChange={(e) => {
                                    const updated = [
                                      ...(editingTx.baleItemsList || []),
                                    ];
                                    updated[idx] = {
                                      ...updated[idx],
                                      attributes: {
                                        ...(updated[idx].attributes || {}),
                                        [f.name]: e.target.value,
                                      },
                                    };
                                    setEditingTx({
                                      ...editingTx,
                                      baleItemsList: updated,
                                    } as Transaction);
                                  }}
                                  className="w-full border rounded-xl p-3 font-bold bg-white focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                >
                                  <option value="">Select</option>
                                  {(f.options || []).map((o) => (
                                    <option key={o} value={o}>
                                      {o}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <input
                                  type="text"
                                  value={bi.attributes?.[f.name] || ""}
                                  onChange={(e) => {
                                    const updated = [
                                      ...(editingTx.baleItemsList || []),
                                    ];
                                    updated[idx] = {
                                      ...updated[idx],
                                      attributes: {
                                        ...(updated[idx].attributes || {}),
                                        [f.name]: e.target.value,
                                      },
                                    };
                                    setEditingTx({
                                      ...editingTx,
                                      baleItemsList: updated,
                                    } as Transaction);
                                  }}
                                  className="w-full border rounded-xl p-3 font-bold bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-blue-500"
                                />
                              )}
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                    {/* Shop Qty */}
                    <div>
                      <p className="text-[10px] font-black uppercase text-gray-400 mb-1">
                        Shop Qty
                      </p>
                      <input
                        type="number"
                        value={bi.shopQty ?? ""}
                        onChange={(e) => {
                          const updated = [...(editingTx.baleItemsList || [])];
                          updated[idx] = {
                            ...updated[idx],
                            shopQty: Number(e.target.value) || 0,
                          };
                          setEditingTx({
                            ...editingTx,
                            baleItemsList: updated,
                          } as Transaction);
                        }}
                        className="w-full border rounded-xl p-3 font-bold bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    {/* Godown Qtys */}
                    {godowns.map((g) => (
                      <div key={g}>
                        <p className="text-[10px] font-black uppercase text-gray-400 mb-1">
                          {g}
                        </p>
                        <input
                          type="number"
                          value={bi.godownQuants?.[g] ?? ""}
                          onChange={(e) => {
                            const updated = [
                              ...(editingTx.baleItemsList || []),
                            ];
                            updated[idx] = {
                              ...updated[idx],
                              godownQuants: {
                                ...(updated[idx].godownQuants || {}),
                                [g]: Number(e.target.value) || 0,
                              },
                            };
                            setEditingTx({
                              ...editingTx,
                              baleItemsList: updated,
                            } as Transaction);
                          }}
                          className="w-full border rounded-xl p-3 font-bold bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    ))}
                    {/* Per-item total */}
                    <p className="text-[10px] font-black text-blue-700">
                      Item Total:{" "}
                      {(bi.shopQty || 0) +
                        Object.values(bi.godownQuants || {}).reduce(
                          (a, b) => a + (b || 0),
                          0,
                        )}{" "}
                      pcs
                    </p>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setEditingTx({
                      ...editingTx,
                      baleItemsList: [
                        ...(editingTx.baleItemsList || []),
                        {
                          itemName: "",
                          category: "",
                          attributes: {},
                          qty: 0,
                          shopQty: 0,
                          godownQuants: {},
                        },
                      ],
                    } as Transaction)
                  }
                  className="w-full border-2 border-dashed border-blue-300 text-blue-600 font-black text-[10px] uppercase py-3 rounded-2xl hover:bg-blue-50 transition-colors"
                >
                  + Add Item
                </button>
              </div>
              {/* Qty validation */}
              {editingTx.totalQtyInBale &&
                editingTx.baleItemsList &&
                editingTx.baleItemsList.length > 0 &&
                (() => {
                  const distributed = (editingTx.baleItemsList || []).reduce(
                    (sum, bi) =>
                      sum +
                      (bi.shopQty || 0) +
                      Object.values(bi.godownQuants || {}).reduce(
                        (a, b) => a + (b || 0),
                        0,
                      ),
                    0,
                  );
                  const expected = editingTx.totalQtyInBale;
                  return distributed === expected ? (
                    <p className="text-[10px] font-black text-green-700 bg-green-50 border border-green-200 px-3 py-2 rounded-xl">
                      ✓ Qty matches: {distributed}/{expected}
                    </p>
                  ) : (
                    <p className="text-[10px] font-black text-orange-700 bg-orange-50 border border-orange-200 px-3 py-2 rounded-xl">
                      ⚠ Qty mismatch: {distributed}/{expected}
                    </p>
                  );
                })()}
              <div>
                <p className="text-[10px] font-black uppercase text-gray-400 ml-1 mb-1">
                  Notes
                </p>
                <input
                  type="text"
                  value={editingTx.notes || ""}
                  onChange={(e) =>
                    setEditingTx({
                      ...editingTx,
                      notes: e.target.value,
                    } as Transaction)
                  }
                  className="w-full border rounded-xl p-3 font-bold bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setEditingTx(null)}
                className="flex-1 bg-gray-100 text-gray-600 font-black py-3 rounded-2xl uppercase text-[10px] tracking-widest"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const oldTx = transactions.find(
                    (tx) => tx.id === editingTx.id,
                  );
                  const updatedTx = {
                    ...editingTx,
                    itemsCount:
                      editingTx.totalQtyInBale ??
                      (editingTx.baleItemsList || []).reduce(
                        (sum, bi) =>
                          sum +
                          (bi.shopQty || 0) +
                          Object.values(bi.godownQuants || {}).reduce(
                            (a, b) => a + (b || 0),
                            0,
                          ),
                        0,
                      ),
                  };
                  setTransactions((prev) =>
                    prev.map((tx) => (tx.id === editingTx.id ? updatedTx : tx)),
                  );

                  // Apply stock delta for inward-type entries
                  if (
                    updateStock &&
                    oldTx &&
                    (editingTx.type === "INWARD" ||
                      editingTx.type === "DIRECT_STOCK" ||
                      editingTx.type === "inward")
                  ) {
                    const oldItems = oldTx.baleItemsList || [];
                    const newItems = editingTx.baleItemsList || [];
                    const deltaMap: Record<
                      string,
                      {
                        shopDelta: number;
                        godownDeltas: Record<string, number>;
                        details: Partial<InventoryItem>;
                      }
                    > = {};
                    for (const bi of oldItems) {
                      const sku = [bi.category, bi.itemName]
                        .filter(Boolean)
                        .join("-")
                        .toLowerCase()
                        .replace(/\s+/g, "-");
                      if (!deltaMap[sku])
                        deltaMap[sku] = {
                          shopDelta: 0,
                          godownDeltas: {},
                          details: {
                            category: bi.category,
                            itemName: bi.itemName,
                          },
                        };
                      deltaMap[sku].shopDelta -= bi.shopQty || 0;
                      for (const [gdown, qty] of Object.entries(
                        bi.godownQuants || {},
                      )) {
                        deltaMap[sku].godownDeltas[gdown] =
                          (deltaMap[sku].godownDeltas[gdown] || 0) - (qty || 0);
                      }
                    }
                    for (const bi of newItems) {
                      const sku = [bi.category, bi.itemName]
                        .filter(Boolean)
                        .join("-")
                        .toLowerCase()
                        .replace(/\s+/g, "-");
                      if (!deltaMap[sku])
                        deltaMap[sku] = {
                          shopDelta: 0,
                          godownDeltas: {},
                          details: {
                            category: bi.category,
                            itemName: bi.itemName,
                          },
                        };
                      deltaMap[sku].shopDelta += bi.shopQty || 0;
                      for (const [gdown, qty] of Object.entries(
                        bi.godownQuants || {},
                      )) {
                        deltaMap[sku].godownDeltas[gdown] =
                          (deltaMap[sku].godownDeltas[gdown] || 0) + (qty || 0);
                      }
                    }
                    for (const [sku, delta] of Object.entries(deltaMap)) {
                      const mainGodownDelta = Object.values(
                        delta.godownDeltas,
                      ).reduce((a, b) => a + b, 0);
                      if (delta.shopDelta !== 0 || mainGodownDelta !== 0) {
                        for (const [gdown, gDelta] of Object.entries(
                          delta.godownDeltas,
                        )) {
                          if (gDelta !== 0)
                            updateStock(sku, delta.details, 0, gDelta, gdown);
                        }
                        if (delta.shopDelta !== 0)
                          updateStock(sku, delta.details, delta.shopDelta, 0);
                      }
                    }
                  }

                  // Update inwardSaved record if editing an inward entry
                  if (
                    setInwardSaved &&
                    oldTx &&
                    (editingTx.type === "INWARD" ||
                      editingTx.type === "DIRECT_STOCK" ||
                      editingTx.type === "inward")
                  ) {
                    setInwardSaved((prev: InwardSavedEntry[]) =>
                      prev.map((entry: InwardSavedEntry) =>
                        entry.biltyNumber === editingTx.biltyNo
                          ? {
                              ...entry,
                              items:
                                (editingTx.baleItemsList as typeof entry.items) ||
                                entry.items,
                            }
                          : entry,
                      ),
                    );
                  }

                  setEditingTx(null);
                  showNotification("Entry updated successfully", "success");
                }}
                className="flex-1 bg-blue-600 text-white font-black py-3 rounded-2xl uppercase text-[10px] tracking-widest shadow-lg"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bilty Journey Modal - Enhanced Timeline */}
      {selectedBiltyForHistory &&
        (() => {
          const bNo = selectedBiltyForHistory;
          const baseBno = bNo.replace(/X\d+\(\d+\)$/i, "").toLowerCase();
          const transitEntry = (transitGoods || []).find(
            (g) =>
              (g.biltyNo?.toLowerCase() === bNo.toLowerCase() ||
                g.biltyNo?.toLowerCase() === baseBno) &&
              (!g.businessId || g.businessId === activeBusinessId),
          );
          const queueEntry = (pendingParcels || []).find(
            (p) =>
              (p.biltyNo?.toLowerCase() === bNo.toLowerCase() ||
                p.biltyNo?.toLowerCase() === baseBno) &&
              (!p.businessId || p.businessId === activeBusinessId),
          );
          // All inward transactions for this bilty (multi-bale each gets its own tx)
          const inwardEntries = transactions.filter(
            (t) =>
              t.biltyNo?.toLowerCase() === bNo.toLowerCase() &&
              (t.type === "INWARD" ||
                t.type === "inward" ||
                t.type === "DIRECT_STOCK") &&
              (!t.businessId || t.businessId === activeBusinessId),
          );
          const inwardEntry = inwardEntries[0] || null;
          // Cross-reference inwardSaved for baleItemsList when missing from transaction
          const savedRecord = inwardSaved.find(
            (s) =>
              s.biltyNumber?.toLowerCase() === bNo.toLowerCase() &&
              (!s.businessId || s.businessId === activeBusinessId),
          );
          type BaleItem = {
            itemName?: string;
            category?: string;
            qty?: number;
            godownQty?: number;
            shopQty?: number;
            godownBreakdown?: Record<string, number>;
            godownQuants?: Record<string, number>;
            saleRate?: number;
            purchaseRate?: number;
            attributes?: Record<string, string>;
          };
          const effectiveBaleItems: BaleItem[] =
            inwardEntry?.baleItemsList && inwardEntry.baleItemsList.length > 0
              ? (inwardEntry.baleItemsList as BaleItem[])
              : ((savedRecord?.items || []) as BaleItem[]);
          return (
            <div className="fixed inset-0 bg-gray-900/60 z-[100] flex items-center justify-center p-4">
              <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto animate-fade-in-down">
                {/* Header */}
                <div className="sticky top-0 bg-white border-b px-6 py-5 flex justify-between items-center rounded-t-[2.5rem] z-10">
                  <div>
                    <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">
                      Bilty Journey
                    </p>
                    <h3 className="font-black text-gray-900 text-xl uppercase tracking-tight">
                      {bNo}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedBiltyForHistory(null)}
                    className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>
                {/* Timeline */}
                <div className="p-6 space-y-0">
                  {/* --- TRANSIT CHECKPOINT --- */}
                  <div className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-black text-xs shadow-md ${transitEntry ? "bg-indigo-600 text-white" : "bg-gray-200 text-gray-400"}`}
                      >
                        1
                      </div>
                      <div className="w-0.5 bg-gray-200 flex-1 mt-1 mb-1 min-h-[32px]" />
                    </div>
                    <div
                      className={`flex-1 mb-4 p-4 rounded-2xl border ${transitEntry ? "bg-indigo-50 border-indigo-200" : "bg-gray-50 border-dashed border-gray-200 opacity-60"}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span
                          className={`text-[9px] font-black px-2 py-1 rounded-full uppercase tracking-widest ${transitEntry ? "bg-indigo-600 text-white" : "bg-gray-300 text-gray-500"}`}
                        >
                          Transit
                        </span>
                        {transitEntry?.date && (
                          <span className="text-[10px] font-bold text-indigo-600">
                            {transitEntry.date}
                          </span>
                        )}
                      </div>
                      {transitEntry ? (
                        <div className="text-[10px] font-bold text-gray-700 space-y-1">
                          <p>
                            Added by:{" "}
                            <b className="text-gray-900">
                              {transitEntry.addedBy || "—"}
                            </b>
                          </p>
                          {transitEntry.transportName && (
                            <p>
                              Transport:{" "}
                              <b className="text-gray-900">
                                {transitEntry.transportName}
                              </b>
                            </p>
                          )}
                          {transitEntry.supplierName && (
                            <p>
                              Supplier:{" "}
                              <b className="text-gray-900">
                                {transitEntry.supplierName}
                              </b>
                            </p>
                          )}
                          {transitEntry.itemCategory && (
                            <p>
                              Category:{" "}
                              <b className="text-gray-900">
                                {transitEntry.itemCategory}
                              </b>
                            </p>
                          )}
                          {transitEntry.itemName && (
                            <p>
                              Item:{" "}
                              <b className="text-gray-900">
                                {transitEntry.itemName}
                              </b>
                            </p>
                          )}
                          {transitEntry.packages &&
                            Number(transitEntry.packages) > 1 && (
                              <p>
                                Packages:{" "}
                                <b className="text-indigo-700">
                                  {transitEntry.packages}
                                </b>
                              </p>
                            )}
                        </div>
                      ) : (
                        <p className="text-[10px] text-gray-400 font-bold">
                          Not in Transit
                        </p>
                      )}
                    </div>
                  </div>
                  {/* --- QUEUE CHECKPOINT --- */}
                  <div className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-black text-xs shadow-md ${queueEntry ? "bg-amber-500 text-white" : "bg-gray-200 text-gray-400"}`}
                      >
                        2
                      </div>
                      <div className="w-0.5 bg-gray-200 flex-1 mt-1 mb-1 min-h-[32px]" />
                    </div>
                    <div
                      className={`flex-1 mb-4 p-4 rounded-2xl border ${queueEntry ? "bg-amber-50 border-amber-200" : "bg-gray-50 border-dashed border-gray-200 opacity-60"}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span
                          className={`text-[9px] font-black px-2 py-1 rounded-full uppercase tracking-widest ${queueEntry ? "bg-amber-500 text-white" : "bg-gray-300 text-gray-500"}`}
                        >
                          Arrived / Queue
                        </span>
                        {(queueEntry?.arrivalDate ||
                          queueEntry?.dateReceived) && (
                          <span className="text-[10px] font-bold text-amber-600">
                            {queueEntry.arrivalDate || queueEntry.dateReceived}
                          </span>
                        )}
                      </div>
                      {queueEntry ? (
                        <div className="text-[10px] font-bold text-gray-700 space-y-1">
                          {queueEntry.supplier && (
                            <p>
                              Supplier:{" "}
                              <b className="text-gray-900">
                                {queueEntry.supplier}
                              </b>
                            </p>
                          )}
                          {queueEntry.transportName && (
                            <p>
                              Transport:{" "}
                              <b className="text-gray-900">
                                {queueEntry.transportName}
                              </b>
                            </p>
                          )}
                          {queueEntry.itemCategory && (
                            <p>
                              Category:{" "}
                              <b className="text-gray-900">
                                {queueEntry.itemCategory}
                              </b>
                            </p>
                          )}
                          {queueEntry.itemName && (
                            <p>
                              Item:{" "}
                              <b className="text-gray-900">
                                {queueEntry.itemName}
                              </b>
                            </p>
                          )}
                          {queueEntry.packages &&
                            Number(queueEntry.packages) > 1 && (
                              <p>
                                Packages:{" "}
                                <b className="text-amber-700">
                                  {queueEntry.packages}
                                </b>
                              </p>
                            )}
                        </div>
                      ) : (
                        <p className="text-[10px] text-gray-400 font-bold">
                          Not in Queue
                        </p>
                      )}
                    </div>
                  </div>
                  {/* --- INWARD CHECKPOINT --- */}
                  <div className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-black text-xs shadow-md ${inwardEntry ? "bg-green-600 text-white" : "bg-gray-200 text-gray-400"}`}
                      >
                        3
                      </div>
                    </div>
                    <div
                      className={`flex-1 mb-4 p-4 rounded-2xl border ${inwardEntry ? "bg-green-50 border-green-200" : "bg-gray-50 border-dashed border-gray-200 opacity-60"}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span
                          className={`text-[9px] font-black px-2 py-1 rounded-full uppercase tracking-widest ${inwardEntry ? "bg-green-600 text-white" : "bg-gray-300 text-gray-500"}`}
                        >
                          Inward / Opened
                        </span>
                        {inwardEntry?.date && (
                          <span className="text-[10px] font-bold text-green-600">
                            {inwardEntry.date?.split("T")[0] ||
                              inwardEntry.date}
                          </span>
                        )}
                      </div>
                      {inwardEntry ? (
                        <div className="text-[10px] font-bold text-gray-700 space-y-2">
                          <p>
                            Opened by:{" "}
                            <b className="text-gray-900">{inwardEntry.user}</b>
                          </p>
                          {inwardEntry.transportName && (
                            <p>
                              Transport:{" "}
                              <b className="text-gray-900">
                                {inwardEntry.transportName}
                              </b>
                            </p>
                          )}
                          {(inwardEntry.itemsCount ?? 0) > 0 && (
                            <p>
                              Total Qty in Bale:{" "}
                              <b className="text-green-700">
                                {inwardEntry.itemsCount} pcs
                              </b>
                            </p>
                          )}
                          {/* Bale Items with storage distribution */}
                          {effectiveBaleItems.length > 0 && (
                            <div className="mt-3 space-y-2">
                              <p className="text-[10px] font-black uppercase text-green-800 tracking-widest">
                                Items Received
                              </p>
                              {effectiveBaleItems.map((bi, biIdx) => (
                                <div
                                  key={`${bi.itemName}-${bi.category}-${biIdx}`}
                                  className="bg-white border border-green-200 rounded-xl p-3 space-y-1"
                                >
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-black text-gray-900">
                                      {bi.itemName}
                                    </span>
                                    <span className="text-[9px] font-black bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                                      {bi.category}
                                    </span>
                                    <span className="text-[9px] font-black bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                                      Qty: {bi.qty}
                                    </span>
                                  </div>
                                  {Object.entries(bi.attributes || {})
                                    .filter(([, v]) => v)
                                    .map(([k, v]) => (
                                      <span
                                        key={k}
                                        className="inline-block mr-2 text-[9px] text-indigo-600 font-bold bg-indigo-50 px-1.5 py-0.5 rounded-full"
                                      >
                                        {k}: {v}
                                      </span>
                                    ))}
                                  {/* Storage distribution */}
                                  <div className="flex gap-2 flex-wrap mt-1">
                                    {(bi.shopQty || 0) > 0 && (
                                      <span className="text-[9px] font-black bg-blue-50 text-blue-700 border border-blue-200 px-2 py-1 rounded-lg">
                                        🏪 Shop: {bi.shopQty}
                                      </span>
                                    )}
                                    {Object.entries(bi.godownQuants || {})
                                      .filter(([, v]) => (v || 0) > 0)
                                      .map(([g, v]) => (
                                        <span
                                          key={g}
                                          className="text-[9px] font-black bg-amber-50 text-amber-700 border border-amber-200 px-2 py-1 rounded-lg"
                                        >
                                          🏭 {g}: {v}
                                        </span>
                                      ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-[10px] text-gray-400 font-bold">
                          Not yet opened in Inward
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                <div className="px-6 pb-6">
                  <button
                    type="button"
                    onClick={() => setSelectedBiltyForHistory(null)}
                    className="w-full bg-gray-100 text-gray-700 font-black py-3 rounded-2xl uppercase text-[10px] tracking-widest hover:bg-gray-200 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
    </div>
  );
}

export { HistoryTab };
