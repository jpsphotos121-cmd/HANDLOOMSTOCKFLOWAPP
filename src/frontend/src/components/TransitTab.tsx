import {
  ChevronDown,
  ChevronUp,
  Download,
  Edit2,
  Navigation as NavIcon,
  PlusCircle,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import type React from "react";
import { useState } from "react";
import type {
  AppUser,
  Category,
  ColumnDef,
  InwardSavedEntry,
  PendingParcel,
  Transaction,
  TransitRecord,
} from "../types";
import { BiltyInput, DynamicFields } from "./BiltyInput";
import { ComboInput } from "./ComboInput";

function TransitTab({
  transitGoods,
  setTransitGoods,
  biltyPrefixes,
  showNotification,
  currentUser,
  customColumns,
  setConfirmDialog,
  activeBusinessId,
  allTransitGoods: _allTransitGoods,
  categories,
  transportTracking,
  setMoveToQueueData,
  setActiveTabFromTransit,
  pendingParcels,
  transactions,
  inwardSaved,
  fieldLabels,
  requiredFields,
  supplierOptions,
  transportOptions,
}: {
  transitGoods: TransitRecord[];
  setTransitGoods: React.Dispatch<React.SetStateAction<TransitRecord[]>>;
  biltyPrefixes: string[];
  showNotification: (m: string, t?: string) => void;
  currentUser: AppUser;
  customColumns: ColumnDef[];
  setConfirmDialog: (
    d: { message: string; onConfirm: () => void } | null,
  ) => void;
  activeBusinessId: string;
  allTransitGoods?: TransitRecord[];
  categories?: Category[];
  transportTracking?: Record<string, string>;
  setMoveToQueueData?: (d: TransitRecord | null) => void;
  setActiveTabFromTransit?: (t: string) => void;
  pendingParcels?: PendingParcel[];
  transactions?: Transaction[];
  inwardSaved?: InwardSavedEntry[];
  fieldLabels?: Record<string, Record<string, string>>;
  requiredFields?: Record<string, Record<string, boolean>>;
  supplierOptions?: string[];
  transportOptions?: string[];
}) {
  const _lbl = (key: string, def: string) => fieldLabels?.transit?.[key] || def;
  const [showForm, setShowForm] = useState(true);
  const [biltyPrefix, setBiltyPrefix] = useState(biltyPrefixes?.[0] || "0");
  const [biltyNumber, setBiltyNumber] = useState("");
  const [form, setForm] = useState({
    transportName: "",
    supplierName: "",
    itemName: "",
    itemCategory: "",
    packages: "",
    date: new Date().toISOString().split("T")[0],
    customData: {} as Record<string, string>,
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [transitFilterMode, setTransitFilterMode] = useState<
    "daterange" | "days"
  >("daterange");
  const [transitMinDays, setTransitMinDays] = useState("");

  const downloadTemplate = () => {
    const headers =
      "Prefix,BiltyNumber,Transport,Supplier,ItemName,Packages,Date";
    const customHeaders = (customColumns || []).map((c) => c.name).join(",");
    const csvContent = `${
      headers + (customHeaders ? `,${customHeaders}` : "")
    }\nsola,12345,VRL,SupplierX,ItemA,10,2024-03-21`;
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "transit_template.csv";
    a.click();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const csv = event.target?.result as string;
      const lines = csv.split(/\r?\n/).filter((l) => l.trim());
      const newEntries: TransitRecord[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(",").map((c) => c.trim());
        if (cols[1]) {
          const customData: Record<string, string> = {};
          for (const [idx, c] of (customColumns || []).entries()) {
            customData[c.name] = cols[7 + idx] || "";
          }
          newEntries.push({
            id: Date.now() + i,
            biltyNo:
              cols[0] === "0" || !cols[0] ? cols[1] : `${cols[0]}-${cols[1]}`,
            transportName: cols[2] || "",
            supplierName: cols[3] || "",
            itemName: cols[4] || "",
            packages: cols[5] || "",
            date: cols[6] || new Date().toISOString().split("T")[0],
            customData,
            addedBy: currentUser.username,
            businessId: activeBusinessId,
          });
        }
      }
      setTransitGoods((prev) => [...newEntries, ...prev]);
      showNotification(`Imported ${newEntries.length} records`, "success");
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!biltyNumber) return showNotification("Bilty number required", "error");
    const transitReq = requiredFields?.transit || {};
    if (transitReq.packages && !form.packages?.trim()) {
      return showNotification("Packages is required", "error");
    }
    if (transitReq.supplier && !form.supplierName?.trim()) {
      return showNotification("Supplier is required", "error");
    }
    if (transitReq.transporter && !(form as any).transporter?.trim()) {
      return showNotification("Transporter is required", "error");
    }
    for (const [key, isReq] of Object.entries(transitReq)) {
      if (
        isReq &&
        key !== "packages" &&
        key !== "supplier" &&
        key !== "transporter"
      ) {
        const val = (form as any)[key];
        if (!val || !String(val).trim()) {
          return showNotification(`${key} is required`, "error");
        }
      }
    }
    const bNo =
      biltyPrefix === "0" ? biltyNumber : `${biltyPrefix}-${biltyNumber}`;
    const pkgCount = Number(form.packages) || 1;
    const isDupeTransit = (transitGoods || []).some(
      (g) =>
        (!g.businessId || g.businessId === activeBusinessId) &&
        g.biltyNo?.toLowerCase() === bNo.toLowerCase(),
    );
    if (isDupeTransit)
      return showNotification(
        `Bilty ${bNo} already exists in Transit!`,
        "error",
      );
    // Check if bilty exists in Queue
    const isDupeQueue = (pendingParcels || []).some(
      (p) =>
        (!p.businessId || p.businessId === activeBusinessId) &&
        (p.biltyNo?.toLowerCase() === bNo.toLowerCase() ||
          (p.biltyNo || "").replace(/X\d+\(\d+\)$/i, "").toLowerCase() ===
            bNo.toLowerCase()),
    );
    if (isDupeQueue)
      return showNotification(`Bilty ${bNo} already exists in Queue!`, "error");
    // Check if bilty exists in Inward history
    const isDupeInward = (transactions || []).some(
      (t) =>
        t.type === "INWARD" &&
        (!t.businessId || t.businessId === activeBusinessId) &&
        (t.biltyNo?.toLowerCase() === bNo.toLowerCase() ||
          (t.biltyNo || "").replace(/X\d+\(\d+\)$/i, "").toLowerCase() ===
            bNo.toLowerCase()),
    );
    if (isDupeInward)
      return showNotification(
        `Bilty ${bNo} has already been processed in Inward!`,
        "error",
      );
    // Check if bilty exists in Inward Saved
    const isDupeInwardSaved = (inwardSaved || []).some(
      (s) =>
        (!s.businessId || s.businessId === activeBusinessId) &&
        (s.biltyNumber?.toLowerCase() === bNo.toLowerCase() ||
          (s.biltyNumber || "").replace(/X\d+\(\d+\)$/i, "").toLowerCase() ===
            bNo.toLowerCase() ||
          (s.baseNumber || "").toLowerCase() === bNo.toLowerCase()),
    );
    if (isDupeInwardSaved)
      return showNotification(
        `Bilty ${bNo} is already in Inward Saved!`,
        "error",
      );
    if (pkgCount > 1) {
      const newEntries: TransitRecord[] = [];
      for (let i = 1; i <= pkgCount; i++) {
        const label = `${bNo}X${pkgCount}(${i})`;
        const alreadyExists = (transitGoods || []).some(
          (g) =>
            (!g.businessId || g.businessId === activeBusinessId) &&
            g.biltyNo?.toLowerCase() === label.toLowerCase(),
        );
        const alreadyInQueue = (pendingParcels || []).some(
          (p) =>
            (!p.businessId || p.businessId === activeBusinessId) &&
            p.biltyNo?.toLowerCase() === label.toLowerCase(),
        );
        const alreadyInInward = (transactions || []).some(
          (t) =>
            t.type === "INWARD" &&
            (!t.businessId || t.businessId === activeBusinessId) &&
            t.biltyNo?.toLowerCase() === label.toLowerCase(),
        );
        if (!alreadyExists && !alreadyInQueue && !alreadyInInward) {
          newEntries.push({
            id: Date.now() + i,
            biltyNo: label,
            addedBy: currentUser.username,
            businessId: activeBusinessId,
            ...form,
            packages: String(pkgCount),
          });
        }
      }
      setTransitGoods((prev) => [...newEntries, ...prev]);
    } else {
      setTransitGoods((prev) => [
        {
          id: Date.now(),
          biltyNo: bNo,
          addedBy: currentUser.username,
          businessId: activeBusinessId,
          ...form,
        },
        ...prev,
      ]);
    }
    setShowForm(false);
    setBiltyNumber("");
    setForm({
      transportName: "",
      supplierName: "",
      itemName: "",
      itemCategory: "",
      packages: "",
      date: new Date().toISOString().split("T")[0],
      customData: {},
    });
    showNotification(
      pkgCount > 1
        ? `Saved ${pkgCount} bale entries to Transit`
        : "Saved Transit Entry",
      "success",
    );
  };

  let filtered = (transitGoods || []).filter((g) => {
    if (!(!g.businessId || g.businessId === activeBusinessId)) return false;
    // Supplier sees only own entries
    if (currentUser.role === "supplier" && g.addedBy !== currentUser.username)
      return false;
    if (
      searchTerm &&
      !g.biltyNo?.toLowerCase().includes(searchTerm.toLowerCase()) &&
      !g.transportName?.toLowerCase().includes(searchTerm.toLowerCase()) &&
      !g.itemName?.toLowerCase().includes(searchTerm.toLowerCase())
    )
      return false;
    if (transitFilterMode === "daterange") {
      if (filterDateFrom && g.date < filterDateFrom) return false;
      if (filterDateTo && g.date > filterDateTo) return false;
    } else if (transitFilterMode === "days" && transitMinDays) {
      const daysInTransit = g.date
        ? Math.ceil((Date.now() - new Date(g.date).getTime()) / 86400000)
        : 0;
      if (daysInTransit < Number(transitMinDays)) return false;
    }
    return true;
  });
  filtered = [...filtered].sort((a, b) =>
    sortOrder === "desc"
      ? b.date.localeCompare(a.date)
      : a.date.localeCompare(b.date),
  );

  return (
    <div className="space-y-6 animate-fade-in-down">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
        <h2 className="text-2xl font-black text-gray-800 tracking-tighter uppercase flex items-center gap-2">
          <NavIcon className="text-indigo-600" /> Transit
        </h2>
        <div className="flex flex-wrap gap-2">
          {currentUser.role !== "supplier" && (
            <>
              <button
                type="button"
                onClick={downloadTemplate}
                className="bg-white border border-gray-200 text-gray-600 px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 shadow-sm hover:bg-gray-50"
              >
                <Download size={14} /> Template
              </button>
              <label
                htmlFor="transit-csv-upload"
                className="bg-indigo-50 text-indigo-700 border border-indigo-100 px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 cursor-pointer hover:bg-indigo-100 transition-colors"
              >
                <Upload size={14} /> Import CSV
              </label>
              <input
                id="transit-csv-upload"
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileUpload}
              />
            </>
          )}
          {currentUser.role !== "staff" && (
            <button
              type="button"
              onClick={() => setShowForm(!showForm)}
              className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-black text-xs uppercase shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-transform active:scale-95"
            >
              {showForm ? "Cancel" : "Log New"}
            </button>
          )}
        </div>
      </div>

      {showForm && (
        <form
          onSubmit={handleAdd}
          className="bg-white p-6 rounded-[2rem] border border-indigo-100 shadow-xl space-y-4"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <BiltyInput
              prefixOptions={biltyPrefixes}
              prefix={biltyPrefix}
              setPrefix={setBiltyPrefix}
              number={biltyNumber}
              setNumber={setBiltyNumber}
            />
            <div>
              <p className="text-[10px] font-black uppercase text-gray-400 ml-1">
                {_lbl("transport", "Transport")}
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
                {_lbl("supplier", "Supplier")}
              </p>
              <ComboInput
                value={form.supplierName}
                onChange={(val) => setForm({ ...form, supplierName: val })}
                options={supplierOptions || []}
                placeholder="Type or select supplier"
              />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-gray-400 ml-1">
                {_lbl("itemCategory", "Item Category")}
              </p>
              <select
                value={form.itemCategory}
                onChange={(e) =>
                  setForm({ ...form, itemCategory: e.target.value })
                }
                className="w-full border rounded-xl p-2.5 font-bold bg-gray-50 focus:bg-white outline-none"
              >
                <option value="">All Categories</option>
                {(categories || []).map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-gray-400 ml-1">
                {_lbl("itemName", "Item Info")}
              </p>
              <input
                type="text"
                value={form.itemName}
                onChange={(e) => setForm({ ...form, itemName: e.target.value })}
                className="w-full border rounded-xl p-2.5 font-bold bg-gray-50 focus:bg-white outline-none"
              />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-gray-400 ml-1">
                {_lbl("packages", "Packages")}
              </p>
              <input
                type="number"
                value={form.packages}
                onChange={(e) => setForm({ ...form, packages: e.target.value })}
                className="w-full border rounded-xl p-2.5 font-bold bg-gray-50 focus:bg-white outline-none"
              />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-gray-400 ml-1">
                {_lbl("date", "Bilty Date")}
              </p>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full border rounded-xl p-2.5 font-bold bg-gray-50 focus:bg-white outline-none"
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
            className="w-full bg-indigo-600 text-white font-black py-4 rounded-2xl uppercase tracking-[0.2em] shadow-xl hover:bg-indigo-700 transition-transform active:scale-95 text-xs"
          >
            Save Transit Record
          </button>
        </form>
      )}

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Filter Bilty, Transport, Item..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-sm bg-white shadow-sm"
          />
        </div>
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setTransitFilterMode("daterange")}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-colors ${transitFilterMode === "daterange" ? "bg-white text-indigo-700 shadow-sm" : "text-gray-500"}`}
          >
            Date Range
          </button>
          <button
            type="button"
            onClick={() => setTransitFilterMode("days")}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-colors ${transitFilterMode === "days" ? "bg-white text-indigo-700 shadow-sm" : "text-gray-500"}`}
          >
            Days in Transit
          </button>
        </div>
        {transitFilterMode === "daterange" ? (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
              className="border rounded-xl p-2.5 text-xs font-bold bg-white outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <span className="text-gray-400 text-xs font-bold">–</span>
            <input
              type="date"
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
              className="border rounded-xl p-2.5 text-xs font-bold bg-white outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-500">Min Days ≥</span>
            <input
              type="number"
              min="0"
              value={transitMinDays}
              onChange={(e) => setTransitMinDays(e.target.value)}
              placeholder="e.g. 5"
              className="border rounded-xl p-2.5 text-xs font-bold bg-white outline-none focus:ring-2 focus:ring-indigo-500 w-24"
            />
          </div>
        )}
        <select
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value as "asc" | "desc")}
          className="border rounded-xl p-2.5 text-xs font-bold bg-white outline-none"
        >
          <option value="desc">Newest First</option>
          <option value="asc">Oldest First</option>
        </select>
        {(filterDateFrom || filterDateTo || transitMinDays) && (
          <button
            type="button"
            onClick={() => {
              setFilterDateFrom("");
              setFilterDateTo("");
              setTransitMinDays("");
            }}
            className="text-xs text-red-500 font-bold bg-red-50 px-3 py-2 rounded-xl"
          >
            Clear
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filtered.length === 0 ? (
          <div className="col-span-full text-center py-10 bg-white border border-dashed rounded-[2rem] text-gray-400 font-bold">
            No records found.
          </div>
        ) : (
          filtered.map((item) => (
            <div
              key={item.id}
              className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <span className="bg-indigo-100 text-indigo-700 text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest">
                    In Transit
                  </span>
                  <h3 className="font-black text-xl text-gray-900 uppercase mt-1 tracking-tight">
                    {item.biltyNo}
                  </h3>
                </div>
                <div className="flex gap-2 items-center">
                  {(() => {
                    const trackUrl =
                      transportTracking && item.transportName
                        ? transportTracking[item.transportName] ||
                          transportTracking[
                            item.transportName?.toLowerCase()
                          ] ||
                          null
                        : null;
                    return trackUrl ? (
                      <a
                        href={trackUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-blue-100 text-blue-700 px-3 py-2 rounded-xl text-[10px] font-black uppercase hover:bg-blue-200 transition-colors"
                      >
                        Track Live
                      </a>
                    ) : null;
                  })()}
                  {currentUser.role !== "supplier" && setMoveToQueueData && (
                    <button
                      type="button"
                      onClick={() => {
                        setMoveToQueueData(item);
                        setActiveTabFromTransit?.("warehouse");
                      }}
                      className="bg-amber-100 text-amber-700 px-3 py-2 rounded-xl text-[10px] font-black uppercase hover:bg-amber-200 transition-colors"
                    >
                      → Queue
                    </button>
                  )}
                  {currentUser.role !== "supplier" && (
                    <button
                      type="button"
                      onClick={() =>
                        setConfirmDialog({
                          message: "Remove from transit?",
                          onConfirm: () =>
                            setTransitGoods((prev) =>
                              prev.filter((g) => g.id !== item.id),
                            ),
                        })
                      }
                      className="text-red-400 p-2 hover:bg-red-50 rounded-xl transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-tight">
                <p>
                  From:{" "}
                  <span className="text-gray-700">
                    {item.supplierName || "-"}
                  </span>
                </p>
                <p>
                  Transport:{" "}
                  <span className="text-gray-700">
                    {item.transportName || "-"}
                  </span>
                </p>
                <p>
                  Category:{" "}
                  <span className="text-gray-700">
                    {item.category || item.itemCategory || "-"}
                  </span>
                </p>
                <p>
                  Item:{" "}
                  <span className="text-gray-700">{item.itemName || "-"}</span>
                </p>
                <p>
                  Date:{" "}
                  <span className="text-gray-700">{item.date || "-"}</span>
                </p>
              </div>
              {item.date && (
                <div className="mt-3 flex items-center gap-2">
                  <span
                    className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest ${Math.ceil((Date.now() - new Date(item.date).getTime()) / 86400000) > 7 ? "bg-orange-100 text-orange-700" : "bg-indigo-50 text-indigo-700"}`}
                  >
                    🚚{" "}
                    {Math.ceil(
                      (Date.now() - new Date(item.date).getTime()) / 86400000,
                    )}{" "}
                    days in transit
                  </span>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ================= WAREHOUSE TAB ================= */

export { TransitTab };
