import {
  ChevronDown,
  ChevronUp,
  PlusCircle,
  RefreshCw,
  Search,
  Trash2,
  Warehouse as WarehouseIcon,
  X,
} from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import type {
  AppUser,
  Category,
  ColumnDef,
  InventoryItem,
  InwardSavedEntry,
  PendingParcel,
  Transaction,
  TransitRecord,
} from "../types";
import { BiltyInput, DynamicFields } from "./BiltyInput";
import { ComboInput } from "./ComboInput";
import { ItemNameCombo } from "./ItemNameCombo";

function WarehouseTab({
  pendingParcels,
  setPendingParcels,
  setOpeningParcel,
  setActiveTab,
  biltyPrefixes,
  customColumns,
  showNotification,
  setConfirmDialog,
  activeBusinessId,
  transportTracking,
  existingQueueBiltyNos,
  transitGoods,
  setTransitGoods,
  categories,
  inventory,
  moveToQueueData,
  clearMoveToQueueData,
  transactions,
  inwardSaved: _inwardSavedQueue,
  fieldLabels,
  supplierOptions,
  transportOptions,
}: {
  pendingParcels: PendingParcel[];
  setPendingParcels: React.Dispatch<React.SetStateAction<PendingParcel[]>>;
  setOpeningParcel: (p: PendingParcel | null) => void;
  setActiveTab: (t: string) => void;
  biltyPrefixes: string[];
  customColumns: ColumnDef[];
  showNotification: (m: string, t?: string) => void;
  setConfirmDialog: (
    d: { message: string; onConfirm: () => void } | null,
  ) => void;
  activeBusinessId: string;
  transportTracking?: Record<string, string>;
  existingQueueBiltyNos?: string[];
  transitGoods?: TransitRecord[];
  setTransitGoods?: React.Dispatch<React.SetStateAction<TransitRecord[]>>;
  categories?: Category[];
  inventory?: Record<string, InventoryItem>;
  moveToQueueData?: TransitRecord | null;
  clearMoveToQueueData?: () => void;
  transactions?: Transaction[];
  inwardSaved?: InwardSavedEntry[];
  fieldLabels?: Record<string, Record<string, string>>;
  supplierOptions?: string[];
  transportOptions?: string[];
}) {
  const _lbl = (key: string, def: string) =>
    fieldLabels?.warehouse?.[key] || def;
  const [biltyPrefix, setBiltyPrefix] = useState(biltyPrefixes?.[0] || "0");
  const [biltyNumber, setBiltyNumber] = useState("");
  const [form, setForm] = useState({
    transportName: "",
    supplier: "",
    itemCategory: "",
    itemName: "",
    packages: "",
    dateReceived: new Date().toISOString().split("T")[0],
    arrivalDate: new Date().toISOString().split("T")[0],
    customData: {} as Record<string, string>,
  });
  const [lockedPackages, setLockedPackages] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [_searchTerm, _setSearchTerm] = useState("");
  const [_filterDateFrom, _setFilterDateFrom] = useState("");
  const [_filterDateTo, _setFilterDateTo] = useState("");
  const [_filterCategory, _setFilterCategory] = useState("");
  const [queueSearch, setQueueSearch] = useState("");
  const [_sortOrder, _setSortOrder] = useState<"asc" | "desc">("desc");
  const [_queueFilterMode, _setQueueFilterMode] = useState<
    "daterange" | "days"
  >("daterange");
  const [_queueMinDays, _setQueueMinDays] = useState("");
  const [baleRows, setBaleRows] = useState<
    {
      biltyLabel: string;
      itemCategory: string;
      itemName: string;
      status: "received" | "pending";
    }[]
  >([]);

  // Generate bale rows when biltyNumber or packages changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: only run on package/bilty change
  useEffect(() => {
    const bNo =
      biltyPrefix === "0" ? biltyNumber : `${biltyPrefix}-${biltyNumber}`;
    const pkgCount = Number(form.packages) || 0;
    if (biltyNumber && pkgCount > 1) {
      const rows = Array.from({ length: pkgCount }, (_, i) => {
        const label = `${bNo}X${pkgCount}(${i + 1})`;
        const labelLower = label.toLowerCase();
        // Skip bales already in Queue (pendingParcels)
        const inQueue = pendingParcels.some(
          (p) =>
            p.biltyNo?.toLowerCase() === labelLower &&
            (!p.businessId || p.businessId === activeBusinessId),
        );
        // Skip bales already processed in Inward (transactions)
        const inInward = (transactions || []).some(
          (t) =>
            t.type === "INWARD" &&
            t.biltyNo?.toLowerCase() === labelLower &&
            (!t.businessId || t.businessId === activeBusinessId),
        );
        if (inQueue || inInward) return null;
        return {
          biltyLabel: label,
          itemCategory: form.itemCategory,
          itemName: form.itemName,
          status: "received" as const,
        };
      }).filter(Boolean) as {
        biltyLabel: string;
        itemCategory: string;
        itemName: string;
        status: "received" | "pending";
      }[];
      setBaleRows(rows);
    } else {
      setBaleRows([]);
    }
  }, [biltyNumber, biltyPrefix, form.packages]);

  // Auto-fill from moveToQueueData when "Move to Queue" is clicked from Transit
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally only runs on moveToQueueData
  useEffect(() => {
    if (!moveToQueueData) return;
    const biltyStr = (moveToQueueData.biltyNo || "").replace(
      /X\d+\(\d+\)$/i,
      "",
    );
    const pkgFromPostfix = (() => {
      const m = (moveToQueueData.biltyNo || "").match(/X(\d+)\(\d+\)$/i);
      return m ? m[1] : null;
    })();
    const dashIdx = biltyStr.lastIndexOf("-");
    if (dashIdx > 0) {
      const prefix = biltyStr.slice(0, dashIdx);
      const num = biltyStr.slice(dashIdx + 1);
      if (biltyPrefixes.includes(prefix)) {
        setBiltyPrefix(prefix);
        setBiltyNumber(num);
      } else {
        setBiltyPrefix("0");
        setBiltyNumber(biltyStr);
      }
    } else {
      setBiltyPrefix("0");
      setBiltyNumber(biltyStr);
    }
    const pkgVal = moveToQueueData.packages || pkgFromPostfix || "";
    setLockedPackages(pkgVal || null);
    setForm((prev) => ({
      ...prev,
      transportName: moveToQueueData.transportName || prev.transportName,
      supplier: moveToQueueData.supplierName || prev.supplier,
      itemCategory:
        moveToQueueData.itemCategory ||
        moveToQueueData.category ||
        prev.itemCategory,
      itemName: moveToQueueData.itemName || prev.itemName,
      packages: pkgVal || prev.packages,
    }));
    clearMoveToQueueData?.();
  }, [moveToQueueData]);

  // Auto-fill from Transit when bilty matches (search by base bilty, extract package count from postfix)
  // biome-ignore lint/correctness/useExhaustiveDependencies: only run on bilty change
  useEffect(() => {
    if (!biltyNumber || !transitGoods) return;
    const bNo =
      biltyPrefix === "0" ? biltyNumber : `${biltyPrefix}-${biltyNumber}`;
    const transitMatch = (transitGoods || []).find(
      (g) =>
        (!g.businessId || g.businessId === activeBusinessId) &&
        // Match exact bilty OR match by stripping postfix from transit entry
        (g.biltyNo?.toLowerCase() === bNo.toLowerCase() ||
          (g.biltyNo || "").replace(/X\d+\(\d+\)$/i, "").toLowerCase() ===
            bNo.toLowerCase()),
    );
    if (transitMatch) {
      // Extract package count from postfix (e.g. sola1011X5(1) -> 5)
      const postfixMatch = (transitMatch.biltyNo || "").match(
        /X(\d+)\(\d+\)$/i,
      );
      const extractedPkg = postfixMatch
        ? postfixMatch[1]
        : transitMatch.packages || "";
      setForm((prev) => ({
        ...prev,
        transportName: transitMatch.transportName || prev.transportName,
        supplier: transitMatch.supplierName || prev.supplier,
        itemCategory:
          transitMatch.itemCategory ||
          transitMatch.category ||
          prev.itemCategory,
        itemName: transitMatch.itemName || prev.itemName,
        packages: extractedPkg || prev.packages,
      }));
      setLockedPackages(extractedPkg || null);
      showNotification("Auto-filled from Transit entry.", "success");
    }
  }, [biltyNumber, biltyPrefix]);

  const handleLog = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    try {
      if (!biltyNumber)
        return showNotification("Bilty number required", "error");
      const bNo =
        biltyPrefix === "0" ? biltyNumber : `${biltyPrefix}-${biltyNumber}`;
      const queueBiltyList = existingQueueBiltyNos ?? [];
      const pkgCount = Number(form.packages) || 1;

      // Block duplicate base bilty in Queue (covers different package counts)
      const baseBilty = bNo.replace(/X\d+\(\d+\)$/i, "").toLowerCase();
      const existsInQueue = (pendingParcels || []).some(
        (p) =>
          (!p.businessId || p.businessId === activeBusinessId) &&
          (p.biltyNo || "").replace(/X\d+\(\d+\)$/i, "").toLowerCase() ===
            baseBilty,
      );
      if (existsInQueue) {
        return showNotification(
          `Bilty ${bNo} already exists in Queue!`,
          "error",
        );
      }

      if (pkgCount > 1 && baleRows.length > 0) {
        // Save received bales to Queue, pending bales to Transit
        const receivedBales = baleRows.filter((r) => r.status === "received");
        const pendingBales = baleRows.filter((r) => r.status === "pending");
        // Check for duplicates in Queue, inwardHistory, and INWARD transactions
        const inwardTxBiltySet = new Set(
          (transactions || [])
            .filter(
              (t) =>
                t.type === "INWARD" &&
                (!t.businessId || t.businessId === activeBusinessId),
            )
            .map((t) => (t.biltyNo || "").toLowerCase()),
        );
        const inwardBiltySet = new Set([
          ...(existingQueueBiltyNos ?? []).map((b) => b.toLowerCase()),
          ...inwardTxBiltySet,
        ]);
        const dupLabels = receivedBales
          .filter((r) => inwardBiltySet.has(r.biltyLabel.toLowerCase()))
          .map((r) => r.biltyLabel);
        if (dupLabels.length > 0) {
          showNotification(
            `Duplicate bales blocked: ${dupLabels.join(", ")}`,
            "error",
          );
        }
        const safeReceivedBales = receivedBales.filter(
          (r) => !inwardBiltySet.has(r.biltyLabel.toLowerCase()),
        );
        setPendingParcels((prev) => [
          ...safeReceivedBales.map((r, i) => ({
            id: Date.now() + i,
            biltyNo: r.biltyLabel,
            businessId: activeBusinessId,
            transportName: form.transportName,
            supplier: form.supplier,
            itemCategory: r.itemCategory,
            itemName: r.itemName,
            packages: String(pkgCount),
            dateReceived: form.dateReceived,
            arrivalDate: form.arrivalDate,
            customData: form.customData,
            recordedAt: new Date().toISOString(),
          })),
          ...prev,
        ]);
        if (setTransitGoods) {
          const allBaleLabels = new Set(
            baleRows.map((r) => r.biltyLabel.toLowerCase()),
          );
          setTransitGoods((prev) => {
            // Remove ALL transit entries that match the base bilty OR any postfix variant
            const cleaned = prev.filter((g) => {
              const gLower = (g.biltyNo || "").toLowerCase();
              const gBase = gLower.replace(/x\d+\(\d+\)$/i, "");
              if (gLower === bNo.toLowerCase()) return false;
              if (gBase === bNo.toLowerCase()) return false;
              if (allBaleLabels.has(gLower)) return false;
              return true;
            });
            // Add back only the pending bales (not yet received)
            const newPendingEntries = pendingBales.map((r, i) => ({
              id: Date.now() + 1000 + i,
              biltyNo: r.biltyLabel,
              businessId: activeBusinessId,
              transportName: form.transportName,
              supplierName: form.supplier,
              itemCategory: r.itemCategory,
              itemName: r.itemName,
              packages: String(pkgCount),
              date: form.arrivalDate,
              addedBy: "Queue",
              customData: form.customData,
            }));
            return [...newPendingEntries, ...cleaned];
          });
        }
        setBaleRows([]);
        setBiltyNumber("");
        setLockedPackages(null);
        setForm({
          transportName: "",
          supplier: "",
          itemCategory: "",
          itemName: "",
          packages: "",
          dateReceived: new Date().toISOString().split("T")[0],
          arrivalDate: new Date().toISOString().split("T")[0],
          customData: {},
        });
        showNotification(
          `${safeReceivedBales.length} received, ${pendingBales.length} pending`,
          "success",
        );
        return;
      }

      if (queueBiltyList.some((b) => b.toLowerCase() === bNo.toLowerCase())) {
        return showNotification(
          `Bilty ${bNo} already exists in Queue!`,
          "error",
        );
      }
      // Strict cross-tab uniqueness check (single-package path)
      {
        const baseBilty = bNo.replace(/X\d+\(\d+\)$/i, "").toLowerCase();
        const inTransitCheck = (transitGoods || []).some(
          (g) =>
            (!g.businessId || g.businessId === activeBusinessId) &&
            (g.biltyNo?.toLowerCase() === bNo.toLowerCase() ||
              (g.biltyNo || "").replace(/X\d+\(\d+\)$/i, "").toLowerCase() ===
                baseBilty),
        );
        const inInwardCheck = (transactions || []).some(
          (t) =>
            t.type === "INWARD" &&
            (!t.businessId || t.businessId === activeBusinessId) &&
            (t.biltyNo || "").replace(/X\d+\(\d+\)$/i, "").toLowerCase() ===
              baseBilty,
        );
        const inInwardSavedCheck = (_inwardSavedQueue || []).some(
          (s) =>
            (!s.businessId || s.businessId === activeBusinessId) &&
            ((s.biltyNumber || "")
              .replace(/X\d+\(\d+\)$/i, "")
              .toLowerCase() === baseBilty ||
              (s.baseNumber || "").toLowerCase() === baseBilty),
        );
        if (inTransitCheck)
          return showNotification(
            `Bilty ${bNo} already exists in Transit!`,
            "error",
          );
        if (inInwardCheck)
          return showNotification(
            `Bilty ${bNo} has already been processed in Inward!`,
            "error",
          );
        if (inInwardSavedCheck)
          return showNotification(
            `Bilty ${bNo} is already in Inward Saved!`,
            "error",
          );
      }
      setPendingParcels((prev) => [
        {
          id: Date.now(),
          biltyNo: bNo,
          businessId: activeBusinessId,
          ...form,
          recordedAt: new Date().toISOString(),
        },
        ...prev,
      ]);
      // Remove matching bilty from transit (both exact and postfixed variants)
      if (setTransitGoods) {
        setTransitGoods((prev) =>
          prev.filter((g) => {
            const gBase = (g.biltyNo || "")
              .replace(/X\d+\(\d+\)$/i, "")
              .toLowerCase()
              .trim();
            return (
              gBase !== bNo.toLowerCase() &&
              g.biltyNo?.toLowerCase() !== bNo.toLowerCase()
            );
          }),
        );
      }
      setBiltyNumber("");
      setForm({
        transportName: "",
        supplier: "",
        itemCategory: "",
        itemName: "",
        packages: "",
        dateReceived: new Date().toISOString().split("T")[0],
        arrivalDate: new Date().toISOString().split("T")[0],
        customData: {},
      });
      showNotification("Logged to Queue", "success");
    } finally {
      setIsSaving(false);
    }
  };

  let filtered = (pendingParcels || []).filter((p) => {
    if (!(!p.businessId || p.businessId === activeBusinessId)) return false;
    if (
      queueSearch &&
      !p.itemName?.toLowerCase().includes(queueSearch.toLowerCase()) &&
      !p.supplier?.toLowerCase().includes(queueSearch.toLowerCase()) &&
      !p.transportName?.toLowerCase().includes(queueSearch.toLowerCase()) &&
      !p.biltyNo?.toLowerCase().includes(queueSearch.toLowerCase())
    )
      return false;
    return true;
  });
  filtered = [...filtered].sort((a, b) => {
    const da = a.arrivalDate || a.dateReceived || "";
    const db = b.arrivalDate || b.dateReceived || "";
    return db.localeCompare(da);
  });

  return (
    <div className="space-y-6 animate-fade-in-down">
      <h2 className="text-2xl font-black text-gray-800 tracking-tighter uppercase flex items-center gap-2 border-b pb-4">
        <WarehouseIcon className="text-amber-600" /> Queue
      </h2>
      <form
        onSubmit={handleLog}
        className="bg-white p-6 rounded-[2rem] border border-amber-100 shadow-lg space-y-4"
      >
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <BiltyInput
            prefixOptions={biltyPrefixes}
            prefix={biltyPrefix}
            setPrefix={setBiltyPrefix}
            number={biltyNumber}
            setNumber={setBiltyNumber}
          />
          <div>
            <p className="text-[10px] font-black uppercase text-gray-400 ml-1">
              Transport
            </p>
            <ComboInput
              value={form.transportName}
              onChange={(val) => setForm({ ...form, transportName: val })}
              options={transportOptions || []}
              placeholder="Type or select transport"
            />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase text-gray-400 ml-1">
              Supplier
            </p>
            <ComboInput
              value={form.supplier}
              onChange={(val) => setForm({ ...form, supplier: val })}
              options={supplierOptions || []}
              placeholder="Type or select supplier"
            />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase text-gray-400 ml-1">
              Item Category
            </p>
            <select
              value={form.itemCategory}
              onChange={(e) =>
                setForm({ ...form, itemCategory: e.target.value })
              }
              className="w-full border rounded-xl p-2.5 outline-none font-bold bg-gray-50 focus:bg-white"
            >
              <option value="">Select Category</option>
              {(categories || []).map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <ItemNameCombo
              category={form.itemCategory}
              value={form.itemName}
              onChange={(val) => setForm({ ...form, itemName: val })}
              inventory={inventory || {}}
              activeBusinessId={activeBusinessId}
            />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase text-gray-400 ml-1">
              Total Packages *
            </p>
            <input
              type="number"
              required
              value={form.packages}
              onChange={(e) => {
                if (lockedPackages) return;
                setForm({ ...form, packages: e.target.value });
              }}
              readOnly={!!lockedPackages}
              className={`w-full border rounded-xl p-2.5 outline-none font-bold ${lockedPackages ? "bg-gray-200 text-gray-500 cursor-not-allowed" : "bg-gray-50 focus:bg-white"}`}
            />
            {lockedPackages && (
              <p className="text-[10px] text-orange-600 font-bold mt-1">
                Package count locked from transit
              </p>
            )}
          </div>
          <div>
            <p className="text-[10px] font-black uppercase text-gray-400 ml-1">
              Arrival Date
            </p>
            <input
              type="date"
              value={form.arrivalDate}
              onChange={(e) =>
                setForm({ ...form, arrivalDate: e.target.value })
              }
              className="w-full border rounded-xl p-2.5 outline-none font-bold bg-gray-50 focus:bg-white"
            />
          </div>
          <DynamicFields
            fields={customColumns}
            values={form.customData}
            onChange={(k, v) =>
              setForm({ ...form, customData: { ...form.customData, [k]: v } })
            }
          />
        </div>
        <button
          type="submit"
          disabled={isSaving}
          className="w-full bg-amber-600 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-xs shadow-xl hover:bg-amber-700 transition-transform active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {baleRows.length > 0
            ? `Save ${baleRows.length} Bales`
            : "Log Arrival to Queue"}
        </button>
      </form>

      {baleRows.length > 0 && (
        <div className="bg-white rounded-[2rem] border border-amber-200 shadow-lg overflow-hidden animate-fade-in-down">
          <div className="bg-amber-600 text-white px-6 py-4 flex items-center justify-between">
            <h3 className="font-black uppercase tracking-widest text-xs">
              Bale Breakdown ({baleRows.length} bales)
            </h3>
            <span className="text-amber-200 text-[10px] font-bold">
              Mark each bale as Received or Pending
            </span>
          </div>
          <div className="divide-y">
            {baleRows.map((row, idx) => (
              <div
                key={row.biltyLabel}
                className="p-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center"
              >
                <span className="text-xs font-black text-gray-700 uppercase w-40 shrink-0">
                  {row.biltyLabel}
                </span>
                <select
                  value={row.itemCategory}
                  onChange={(e) => {
                    const updated = [...baleRows];
                    updated[idx] = {
                      ...updated[idx],
                      itemCategory: e.target.value,
                    };
                    setBaleRows(updated);
                  }}
                  className="border rounded-xl p-2 text-xs font-bold bg-gray-50 outline-none flex-1"
                >
                  <option value="">Category</option>
                  {(categories || []).map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <ItemNameCombo
                  category={row.itemCategory}
                  value={row.itemName}
                  onChange={(val) => {
                    const updated = [...baleRows];
                    updated[idx] = { ...updated[idx], itemName: val };
                    setBaleRows(updated);
                  }}
                  inventory={inventory || {}}
                  activeBusinessId={activeBusinessId}
                />
                <button
                  type="button"
                  onClick={() => {
                    const updated = [...baleRows];
                    updated[idx] = {
                      ...updated[idx],
                      status:
                        row.status === "received" ? "pending" : "received",
                    };
                    setBaleRows(updated);
                  }}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shrink-0 transition-colors ${
                    row.status === "received"
                      ? "bg-green-100 text-green-700 border border-green-300"
                      : "bg-orange-100 text-orange-700 border border-orange-300"
                  }`}
                >
                  {row.status === "received" ? "✓ Received" : "⏳ Pending"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by supplier, item, transport or bilty..."
            value={queueSearch}
            onChange={(e) => setQueueSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border rounded-2xl outline-none focus:ring-2 focus:ring-amber-500 font-bold text-sm bg-white shadow-sm"
          />
        </div>
        {queueSearch && (
          <button
            type="button"
            onClick={() => setQueueSearch("")}
            className="text-xs text-red-500 font-bold bg-red-50 px-3 py-2 rounded-xl"
          >
            Clear
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {filtered.map((p) => {
          const trackUrl =
            transportTracking && p.transportName
              ? transportTracking[p.transportName] ||
                transportTracking[p.transportName?.toLowerCase()]
              : null;
          return (
            <div
              key={p.id}
              className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm"
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <span className="text-[8px] font-black bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full uppercase tracking-widest w-fit mb-1">
                    Queue
                  </span>
                  <h3 className="font-black text-xl text-gray-900 uppercase mt-1 tracking-tight">
                    {p.biltyNo}
                  </h3>
                  <div className="text-[10px] font-bold text-gray-400 mt-1 space-y-0.5">
                    {p.transportName && (
                      <p>
                        Transport:{" "}
                        <span className="text-gray-700">{p.transportName}</span>
                      </p>
                    )}
                    {p.supplier && (
                      <p>
                        Supplier:{" "}
                        <span className="text-gray-700">{p.supplier}</span>
                      </p>
                    )}
                    {p.itemCategory && (
                      <p>
                        Category:{" "}
                        <span className="text-gray-700">{p.itemCategory}</span>
                      </p>
                    )}
                    {p.itemName && (
                      <p>
                        Item:{" "}
                        <span className="text-gray-700">{p.itemName}</span>
                      </p>
                    )}
                    {p.packages && (
                      <p>
                        Packages:{" "}
                        <span className="text-gray-700">{p.packages}</span>
                      </p>
                    )}
                    {(p.arrivalDate || p.dateReceived) && (
                      <p>
                        Arrived:{" "}
                        <span className="text-gray-700">
                          {p.arrivalDate || p.dateReceived}
                        </span>
                      </p>
                    )}
                    {p.recordedAt && (
                      <p>
                        Logged:{" "}
                        <span className="text-blue-600 font-black">
                          {new Date(p.recordedAt).toLocaleString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: true,
                          })}
                        </span>
                      </p>
                    )}
                    {(p.arrivalDate || p.dateReceived) && (
                      <p>
                        Days in Queue:{" "}
                        <span
                          className={`font-black ${Math.ceil((Date.now() - new Date(p.arrivalDate || p.dateReceived || "").getTime()) / 86400000) > 7 ? "text-orange-600" : "text-gray-700"}`}
                        >
                          {Math.ceil(
                            (Date.now() -
                              new Date(
                                p.arrivalDate || p.dateReceived || "",
                              ).getTime()) /
                              86400000,
                          )}{" "}
                          days
                        </span>
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-2 items-end">
                  <div className="flex gap-2">
                    {trackUrl && (
                      <a
                        href={trackUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-blue-100 text-blue-700 px-3 py-2 rounded-xl text-[10px] font-black uppercase"
                      >
                        Track
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setOpeningParcel(p);
                        setActiveTab("inward");
                      }}
                      className="bg-green-600 text-white px-5 py-2 rounded-xl text-xs font-black shadow-md"
                    >
                      Open Bale
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setConfirmDialog({
                          message: "Remove from Queue?",
                          onConfirm: () =>
                            setPendingParcels((prev) =>
                              prev.filter((x) => x.id !== p.id),
                            ),
                        })
                      }
                      className="text-red-400 p-2 hover:bg-red-50 rounded-full transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ================= ITEM NAME COMBO ================= */

export { WarehouseTab };
