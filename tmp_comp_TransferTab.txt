import { ArrowRightLeft, Pencil, RefreshCw, Trash2, X } from "lucide-react";
import type React from "react";
import { useRef, useState } from "react";
import { getTotalGodownStock } from "../constants";
import type { AppUser, InventoryItem, Transaction } from "../types";

function TransferTab({
  inventory,
  updateStock: _updateStock,
  showNotification,
  godowns,
  activeBusinessId,
  setTransactions,
  currentUser,
  actor,
  setTransfers,
  transfers,
  onInventoryRefresh,
  requiredFields,
  users,
}: {
  inventory: Record<string, InventoryItem>;
  updateStock?: (
    sku: string,
    details: Partial<InventoryItem>,
    shopDelta: number,
    godownDelta: number,
    targetGodown?: string,
  ) => void;
  showNotification: (m: string, t?: string) => void;
  godowns: string[];
  activeBusinessId: string;
  setTransactions?: React.Dispatch<React.SetStateAction<Transaction[]>>;
  currentUser?: AppUser;
  transfers?: any[];
  setTransfers?: React.Dispatch<React.SetStateAction<any[]>>;
  actor?: any;
  onInventoryRefresh?: () => Promise<void>;
  requiredFields?: Record<string, Record<string, boolean>>;
  users?: AppUser[];
}) {
  const [mode, setMode] = useState("G2S");
  const [targetG, setTargetG] = useState(godowns?.[0] || "Main Godown");
  const [search, setSearch] = useState("");
  const [selectedSku, setSelectedSku] = useState<string | null>(null);
  const [qty, setQty] = useState("");
  const [pendingTransfers, setPendingTransfers] = useState<
    Array<{
      id: number;
      sku: string;
      itemName: string;
      category: string;
      qty: number;
      mode: string;
      targetG: string;
      fromLoc: string;
      toLoc: string;
      saleRate?: number;
      staffName?: string;
    }>
  >([]);

  const [staffName, setStaffName] = useState("");
  const [showStaffDropdown, setShowStaffDropdown] = useState(false);
  const staffInputRef = useRef<HTMLDivElement>(null);

  // View mode
  const [viewMode, setViewMode] = useState<"new" | "timeline">("new");

  // Timeline filters
  const [filterItem, setFilterItem] = useState("");
  const [filterStaff, setFilterStaff] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  // Edit transfer modal
  const [editingTransfer, setEditingTransfer] = useState<any | null>(null);
  const [editItemName, setEditItemName] = useState("");
  const [editQty, setEditQty] = useState("");
  const [editFrom, setEditFrom] = useState("");
  const [editTo, setEditTo] = useState("");
  const [editStaff, setEditStaff] = useState("");
  const [editDate, setEditDate] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const filteredStaff = (users || []).filter(
    (u) =>
      (u.role === "staff" || u.role === "admin") &&
      u.username.toLowerCase().includes(staffName.toLowerCase()),
  );

  const filteredSkus = Object.keys(inventory || {})
    .filter((s) => {
      const matchesBusiness =
        !inventory[s].businessId ||
        inventory[s].businessId === activeBusinessId;
      return (
        matchesBusiness &&
        inventory[s].itemName?.toLowerCase().includes(search.toLowerCase())
      );
    })
    .slice(0, 10);

  const handleAddToTransferList = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSku || !qty) return;
    const transferReq = requiredFields?.transfer || {};
    if (transferReq.qty && !qty.trim()) {
      showNotification("Qty is required", "error");
      return;
    }
    if (transferReq.item && !selectedSku) {
      showNotification("Item is required", "error");
      return;
    }
    const item = inventory[selectedSku];
    const qVal = Number(qty);
    let fromLoc = "";
    let toLoc = "";
    if (mode === "G2S") {
      if ((item.godowns?.[targetG] || 0) < qVal)
        return showNotification(`Not enough stock in ${targetG}`, "error");
      fromLoc = targetG;
      toLoc = "Shop";
    } else {
      if ((item.shop || 0) < qVal)
        return showNotification("Not enough stock in Shop", "error");
      fromLoc = "Shop";
      toLoc = targetG;
    }
    setPendingTransfers((prev) => [
      ...prev,
      {
        id: Date.now(),
        sku: selectedSku,
        itemName: item.itemName,
        category: item.category,
        qty: qVal,
        mode,
        targetG,
        fromLoc,
        toLoc,
        saleRate: item.saleRate,
        staffName: staffName || undefined,
      },
    ]);
    showNotification("Added to transfer list", "success");
    setQty("");
    setSelectedSku(null);
    setSearch("");
    setStaffName("");
  };

  const handleTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    handleAddToTransferList(e);
  };

  const handlePostAllTransfers = async () => {
    if (pendingTransfers.length === 0) return;
    for (const pt of pendingTransfers) {
      const item = inventory[pt.sku];
      if (!item) continue;
      if (setTransactions && currentUser) {
        const attrStr = Object.entries(item.attributes || {})
          .map(([k, v]) => `${k}: ${v}`)
          .join(", ");
        setTransactions((prev) => [
          {
            id: Date.now() + Math.random(),
            type: "transfer",
            biltyNo: undefined,
            businessId: activeBusinessId,
            date: new Date().toISOString().split("T")[0],
            user: currentUser.username,
            itemName: item.itemName,
            category: item.category,
            itemsCount: pt.qty,
            fromLocation: pt.fromLoc,
            toLocation: pt.toLoc,
            transferredBy: pt.staffName || currentUser.username,
            subCategory: attrStr || undefined,
            notes: `${item.itemName} · ${pt.qty} pcs · ${pt.fromLoc} → ${pt.toLoc}`,
          },
          ...prev,
        ]);
      }
      if (actor) {
        try {
          const transferEntry = {
            id: String(Date.now() + Math.random()),
            businessId: activeBusinessId,
            createdAt: BigInt(Date.now()),
            itemName: item.itemName,
            category: item.category,
            subCategory: JSON.stringify(item.attributes || {}),
            qty: BigInt(pt.qty),
            rate: item.saleRate || 0,
            fromId: pt.fromLoc,
            fromType: pt.mode === "G2S" ? "godown" : "shop",
            toId: pt.toLoc,
            toType: pt.mode === "G2S" ? "shop" : "godown",
            transferredBy: pt.staffName || currentUser?.username || "",
          };
          const result = await actor.postTransfer(transferEntry);
          if (result !== "ok") {
            showNotification(`Transfer failed: ${result}`, "error");
            continue;
          }
          if (setTransfers)
            setTransfers((prev: any[]) => [...prev, transferEntry]);
          if (onInventoryRefresh) await onInventoryRefresh();
        } catch (e) {
          console.error(e);
        }
      }
    }
    showNotification(
      `${pendingTransfers.length} transfer(s) posted!`,
      "success",
    );
    setPendingTransfers([]);
  };

  // Timeline filtered transfers
  const timelineTransfers = (transfers || [])
    .filter((t) => !t.businessId || t.businessId === activeBusinessId)
    .filter(
      (t) =>
        !filterItem ||
        t.itemName?.toLowerCase().includes(filterItem.toLowerCase()),
    )
    .filter(
      (t) =>
        !filterStaff ||
        t.transferredBy?.toLowerCase().includes(filterStaff.toLowerCase()),
    )
    .filter((t) => {
      if (!filterDateFrom) return true;
      const d = new Date(Number(t.createdAt)).toISOString().split("T")[0];
      return d >= filterDateFrom;
    })
    .filter((t) => {
      if (!filterDateTo) return true;
      const d = new Date(Number(t.createdAt)).toISOString().split("T")[0];
      return d <= filterDateTo;
    })
    .sort((a: any, b: any) => Number(b.createdAt) - Number(a.createdAt));

  const openEditTransfer = (t: any) => {
    setEditingTransfer(t);
    setEditItemName(t.itemName || "");
    setEditQty(String(Number(t.qty)));
    setEditFrom(t.fromId || "");
    setEditTo(t.toId || "");
    setEditStaff(t.transferredBy || "");
    const d = new Date(Number(t.createdAt));
    setEditDate(d.toISOString().split("T")[0]);
  };

  const handleSaveEditTransfer = async () => {
    if (!editingTransfer || isSavingEdit) return;
    setIsSavingEdit(true);
    try {
      const updatedEntry = {
        ...editingTransfer,
        itemName: editItemName,
        qty: BigInt(Number(editQty)),
        fromId: editFrom,
        toId: editTo,
        transferredBy: editStaff,
        createdAt: BigInt(new Date(editDate).getTime()),
      };
      if (actor) {
        const result = await actor.postTransfer(updatedEntry);
        if (result !== "ok") {
          showNotification(`Update failed: ${result}`, "error");
          return;
        }
      }
      if (setTransfers) {
        setTransfers((prev: any[]) =>
          prev.map((t) => (t.id === editingTransfer.id ? updatedEntry : t)),
        );
      }
      showNotification("Transfer updated successfully!", "success");
      setEditingTransfer(null);
    } catch (e) {
      console.error(e);
      showNotification("Update failed: backend error", "error");
    } finally {
      setIsSavingEdit(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in-down">
      {/* Header */}
      <div className="flex justify-between items-center border-b pb-4">
        <h2 className="text-2xl font-black text-gray-800 tracking-tighter uppercase flex items-center gap-2">
          <ArrowRightLeft className="text-purple-600" /> Internal Transfers
        </h2>
        <div className="flex gap-2">
          <button
            type="button"
            data-ocid="transfer.new.tab"
            onClick={() => setViewMode("new")}
            className={`px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-colors ${
              viewMode === "new"
                ? "bg-purple-600 text-white shadow-lg"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            New Transfer
          </button>
          <button
            type="button"
            data-ocid="transfer.timeline.tab"
            onClick={() => setViewMode("timeline")}
            className={`px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-colors ${
              viewMode === "timeline"
                ? "bg-purple-600 text-white shadow-lg"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            Timeline
          </button>
        </div>
      </div>

      {viewMode === "new" && (
        <>
          <div className="flex bg-gray-100 p-1.5 rounded-[1.5rem] font-black uppercase text-[10px] tracking-widest shadow-inner">
            <button
              type="button"
              onClick={() => setMode("G2S")}
              className={`flex-1 py-4 rounded-2xl transition-all ${mode === "G2S" ? "bg-purple-600 text-white shadow-lg" : "text-gray-500"}`}
            >
              Godown ➡️ Shop
            </button>
            <button
              type="button"
              onClick={() => setMode("S2G")}
              className={`flex-1 py-4 rounded-2xl transition-all ${mode === "S2G" ? "bg-blue-600 text-white shadow-lg" : "text-gray-500"}`}
            >
              Shop ➡️ Godown
            </button>
          </div>
          <div className="bg-white p-8 rounded-[2.5rem] border shadow-xl space-y-6">
            <div className="relative">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] font-black uppercase text-gray-400 ml-1">
                  Search Product
                </p>
                <button
                  type="button"
                  title="Reset selection"
                  onClick={() => {
                    setSelectedSku(null);
                    setSearch("");
                    setQty("");
                  }}
                  className="p-1.5 bg-gray-100 hover:bg-purple-100 text-gray-400 hover:text-purple-600 rounded-lg transition-colors"
                >
                  <RefreshCw size={13} />
                </button>
              </div>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full border rounded-2xl p-4 font-bold text-sm outline-none focus:ring-2 focus:ring-purple-400 bg-gray-50"
                placeholder="Search item name..."
                data-ocid="transfer.search_input"
              />
              {search && !selectedSku && (
                <div className="absolute z-10 w-full bg-white border border-purple-100 mt-1 rounded-2xl shadow-2xl overflow-hidden">
                  {filteredSkus.length === 0 ? (
                    <p className="p-4 text-xs text-gray-400 font-bold">
                      No items found
                    </p>
                  ) : (
                    filteredSkus.map((s) => {
                      const it = inventory[s];
                      const totalGodown = getTotalGodownStock(it);
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => {
                            setSelectedSku(s);
                            setSearch(it.itemName);
                          }}
                          className="w-full text-left px-5 py-3.5 hover:bg-purple-50 transition-colors border-b last:border-b-0 group"
                        >
                          <p className="font-black text-sm text-gray-900 group-hover:text-purple-700">
                            {it.itemName}
                          </p>
                          <p className="text-[10px] font-bold text-gray-400 uppercase mt-0.5">
                            {it.category} · Shop: {it.shop || 0} · Godown:{" "}
                            {totalGodown}
                          </p>
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            {selectedSku && (
              <div className="animate-fade-in-down space-y-4">
                {Object.keys(inventory[selectedSku]?.attributes || {}).length >
                  0 && (
                  <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
                    <p className="text-[10px] font-black uppercase text-blue-700 mb-2">
                      Item Sub-Categories
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(inventory[selectedSku].attributes).map(
                        ([k, v]) => (
                          <span
                            key={k}
                            className="bg-white border border-blue-200 text-blue-800 px-3 py-1 rounded-full text-xs font-bold uppercase"
                          >
                            {k}: {v}
                          </span>
                        ),
                      )}
                    </div>
                  </div>
                )}
                {(() => {
                  const godownEntries = Object.entries(
                    inventory[selectedSku]?.godowns || {},
                  ).filter(([, v]) => Number(v) > 0);
                  if (godownEntries.length === 0) return null;
                  return (
                    <div className="bg-amber-50/60 p-4 rounded-2xl border border-amber-100">
                      <p className="text-[10px] font-black uppercase text-amber-800 mb-2">
                        Stock by Godown
                      </p>
                      <div className="flex flex-wrap gap-3">
                        {godownEntries.map(([g, v]) => (
                          <span
                            key={g}
                            className="bg-white border border-amber-200 text-amber-800 px-3 py-1.5 rounded-xl text-xs font-black"
                          >
                            {g}: <span className="text-amber-600">{v}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })()}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-purple-50/50 p-6 rounded-3xl border border-purple-100">
                  <div>
                    <p className="text-[10px] font-black uppercase text-purple-900 ml-1">
                      Location
                    </p>
                    <select
                      value={targetG}
                      onChange={(e) => setTargetG(e.target.value)}
                      className="w-full border border-purple-200 rounded-2xl p-4 font-bold outline-none bg-white shadow-sm"
                    >
                      {godowns.map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase text-purple-900 ml-1">
                      Quantity
                    </p>
                    <input
                      type="number"
                      value={qty}
                      onChange={(e) => setQty(e.target.value)}
                      className="w-full border border-purple-200 rounded-2xl p-4 font-black text-lg outline-none bg-white shadow-sm text-purple-700"
                      placeholder="0"
                    />
                  </div>
                  <div className="sm:col-span-2" ref={staffInputRef}>
                    <p className="text-[10px] font-black uppercase text-purple-900 ml-1 mb-1">
                      Staff Name (Who is taking goods?)
                    </p>
                    <div className="relative">
                      <input
                        type="text"
                        value={staffName}
                        onChange={(e) => {
                          setStaffName(e.target.value);
                          setShowStaffDropdown(true);
                        }}
                        onFocus={() => setShowStaffDropdown(true)}
                        onBlur={() =>
                          setTimeout(() => setShowStaffDropdown(false), 150)
                        }
                        className="w-full border border-purple-200 rounded-2xl p-4 font-bold outline-none bg-white shadow-sm focus:ring-2 focus:ring-purple-400 transition-all"
                        placeholder="Type name or select from list..."
                        data-ocid="transfer.staff_input"
                      />
                      {showStaffDropdown && filteredStaff.length > 0 && (
                        <div className="absolute z-20 w-full bg-white border border-purple-100 mt-1 rounded-2xl shadow-2xl overflow-hidden">
                          {filteredStaff.map((u) => (
                            <button
                              key={u.username}
                              type="button"
                              onMouseDown={() => {
                                setStaffName(u.username);
                                setShowStaffDropdown(false);
                              }}
                              className="w-full text-left px-5 py-3 hover:bg-purple-50 transition-colors font-bold text-sm text-gray-800 flex items-center gap-2"
                            >
                              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                                {u.role}
                              </span>
                              {u.username}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleTransfer}
                    className="sm:col-span-2 bg-purple-600 text-white font-black py-5 rounded-2xl uppercase tracking-widest text-xs shadow-xl shadow-purple-200 active:scale-95 transition-transform"
                    data-ocid="transfer.add_button"
                  >
                    ＋ Add to Transfer List
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Pending Transfer List */}
          {pendingTransfers.length > 0 && (
            <div className="bg-white rounded-[2rem] border border-purple-200 shadow-lg overflow-hidden animate-fade-in-down">
              <div className="bg-purple-600 text-white px-6 py-4 flex items-center justify-between">
                <h3 className="font-black uppercase tracking-widest text-xs">
                  Transfer Queue ({pendingTransfers.length} items)
                </h3>
                <button
                  type="button"
                  onClick={handlePostAllTransfers}
                  className="bg-white text-purple-700 font-black text-[10px] uppercase px-4 py-2 rounded-xl hover:bg-purple-50 transition-colors"
                >
                  Post All Transfers
                </button>
              </div>
              <div className="divide-y">
                {pendingTransfers.map((pt) => (
                  <div
                    key={pt.id}
                    className="px-6 py-4 flex items-center justify-between gap-3"
                  >
                    <div className="flex-1">
                      <p className="font-black text-sm text-gray-900">
                        {pt.itemName}
                      </p>
                      <p className="text-[10px] font-bold text-gray-500 uppercase">
                        {pt.category}
                      </p>
                      <p className="text-[10px] font-black text-purple-700 mt-0.5">
                        {pt.fromLoc} → {pt.toLoc} · {pt.qty} pcs
                      </p>
                      {pt.staffName && (
                        <p className="text-[10px] font-black text-indigo-600 mt-0.5">
                          👤 {pt.staffName}
                        </p>
                      )}
                      {pt.saleRate ? (
                        <p className="text-[10px] font-black text-green-600 mt-0.5">
                          ₹{pt.saleRate}/unit
                        </p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setPendingTransfers((prev) =>
                          prev.filter((x) => x.id !== pt.id),
                        )
                      }
                      className="p-2 bg-red-50 text-red-400 rounded-xl hover:bg-red-100 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {viewMode === "timeline" && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="bg-white border rounded-[2rem] p-5 shadow-sm grid grid-cols-2 md:grid-cols-4 gap-3">
            <input
              type="text"
              value={filterItem}
              onChange={(e) => setFilterItem(e.target.value)}
              placeholder="Search item..."
              data-ocid="transfer.timeline.search_input"
              className="border rounded-xl p-2.5 text-xs font-bold outline-none"
            />
            <input
              type="text"
              value={filterStaff}
              onChange={(e) => setFilterStaff(e.target.value)}
              placeholder="Search staff..."
              data-ocid="transfer.timeline.staff_input"
              className="border rounded-xl p-2.5 text-xs font-bold outline-none"
            />
            <input
              type="date"
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
              className="border rounded-xl p-2.5 text-xs font-bold outline-none"
            />
            <input
              type="date"
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
              className="border rounded-xl p-2.5 text-xs font-bold outline-none"
            />
          </div>

          {timelineTransfers.length === 0 ? (
            <div
              data-ocid="transfer.empty_state"
              className="text-center py-16 text-gray-400"
            >
              <ArrowRightLeft size={48} className="mx-auto mb-4 opacity-30" />
              <p className="font-black text-sm uppercase tracking-widest">
                No transfers found
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {timelineTransfers.map((t: any, idx: number) => {
                const transferMode =
                  t.fromType === "godown" ? "Godown → Shop" : "Shop → Godown";
                const dateStr = new Date(Number(t.createdAt)).toLocaleString(
                  "en-IN",
                  {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: true,
                  },
                );
                return (
                  <div
                    key={t.id}
                    data-ocid={`transfer.item.${idx + 1}`}
                    className="bg-white border rounded-[2rem] p-5 shadow-sm"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-purple-100 text-purple-700">
                          {transferMode}
                        </span>
                        <span className="font-black text-gray-800">
                          {t.itemName}
                        </span>
                        {t.category && (
                          <span className="text-[10px] text-gray-400 font-bold">
                            {t.category}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] font-bold text-gray-400">
                          {dateStr}
                        </span>
                        {currentUser?.role === "admin" && (
                          <button
                            type="button"
                            data-ocid={`transfer.item.${idx + 1}.edit_button`}
                            onClick={() => openEditTransfer(t)}
                            className="p-2 bg-purple-50 hover:bg-purple-100 rounded-xl transition-colors text-purple-500"
                          >
                            <Pencil size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[10px] font-bold text-gray-500 mb-2">
                      <span>
                        📦 {t.fromId} → {t.toId}
                      </span>
                      <span>👤 {t.transferredBy || "—"}</span>
                      <span>🔢 Qty: {String(Number(t.qty))}</span>
                      {t.rate ? <span>₹{t.rate}/unit</span> : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Edit Transfer Modal */}
      {editingTransfer && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-black text-lg text-gray-800 uppercase tracking-tight">
                Edit Transfer
              </h3>
              <button
                type="button"
                onClick={() => setEditingTransfer(null)}
                data-ocid="transfer.edit.close_button"
                className="p-2 bg-gray-100 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-xl transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-[10px] font-black uppercase text-gray-400 mb-1">
                  Item Name
                </p>
                <input
                  type="text"
                  value={editItemName}
                  onChange={(e) => setEditItemName(e.target.value)}
                  data-ocid="transfer.edit.input"
                  className="w-full border rounded-xl p-3 font-bold text-sm outline-none focus:ring-2 focus:ring-purple-400 bg-gray-50"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase text-gray-400 mb-1">
                    Qty
                  </p>
                  <input
                    type="number"
                    value={editQty}
                    onChange={(e) => setEditQty(e.target.value)}
                    className="w-full border rounded-xl p-3 font-bold text-sm outline-none focus:ring-2 focus:ring-purple-400 bg-gray-50"
                  />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-gray-400 mb-1">
                    Date
                  </p>
                  <input
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full border rounded-xl p-3 font-bold text-sm outline-none focus:ring-2 focus:ring-purple-400 bg-gray-50"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase text-gray-400 mb-1">
                    From
                  </p>
                  <input
                    type="text"
                    value={editFrom}
                    onChange={(e) => setEditFrom(e.target.value)}
                    className="w-full border rounded-xl p-3 font-bold text-sm outline-none focus:ring-2 focus:ring-purple-400 bg-gray-50"
                  />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-gray-400 mb-1">
                    To
                  </p>
                  <input
                    type="text"
                    value={editTo}
                    onChange={(e) => setEditTo(e.target.value)}
                    className="w-full border rounded-xl p-3 font-bold text-sm outline-none focus:ring-2 focus:ring-purple-400 bg-gray-50"
                  />
                </div>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase text-gray-400 mb-1">
                  Staff Name
                </p>
                <input
                  type="text"
                  value={editStaff}
                  onChange={(e) => setEditStaff(e.target.value)}
                  className="w-full border rounded-xl p-3 font-bold text-sm outline-none focus:ring-2 focus:ring-purple-400 bg-gray-50"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setEditingTransfer(null)}
                data-ocid="transfer.edit.cancel_button"
                className="flex-1 py-3 border-2 border-gray-200 rounded-xl font-black text-[10px] uppercase tracking-widest text-gray-500 hover:border-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEditTransfer}
                disabled={isSavingEdit}
                data-ocid="transfer.edit.save_button"
                className="flex-1 py-3 bg-purple-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-purple-700 transition-colors disabled:opacity-50"
              >
                {isSavingEdit ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ================= HISTORY TAB ================= */

export { TransferTab };
