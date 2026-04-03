import {
  AlertTriangle,
  Box,
  CheckCircle,
  Search,
  Share2,
  X,
} from "lucide-react";
import type React from "react";
import { useState } from "react";
import {
  formatQtyWithUnit,
  getTotalGodownStock,
  resolveItemUnit,
} from "../constants";
import type { InventoryItem, InwardSavedEntry, Transaction } from "../types";

function DashboardTab({
  inventory,
  minStockThreshold,
  activeBusinessId,
  transactions,
  onItemClick,
  thresholdExcludedItems = [],
  categoryUnits = {},
  itemUnitOverrides = {},
  inwardSaved = [],
}: {
  inventory: Record<string, InventoryItem>;
  minStockThreshold: number;
  activeBusinessId: string;
  transactions: Transaction[];
  onItemClick?: (sku: string) => void;
  thresholdExcludedItems?: string[];
  categoryUnits?: Record<string, "pcs" | "dozen">;
  itemUnitOverrides?: Record<string, "pcs" | "dozen">;
  inwardSaved?: InwardSavedEntry[];
}) {
  const [searchTerm, setSearchTerm] = useState("");

  const skus = Object.keys(inventory || {});
  const filteredSkus = skus.filter((sku) => {
    const item = inventory[sku];
    const matchesBusiness =
      !item.businessId || item.businessId === activeBusinessId;
    return (
      matchesBusiness &&
      `${item.itemName} ${item.category}`
        .toLowerCase()
        .includes(searchTerm.toLowerCase())
    );
  });

  const grouped = filteredSkus.reduce<
    Record<string, (InventoryItem & { sku: string })[]>
  >((acc, sku) => {
    const item = inventory[sku];
    const cat = item.category || "Other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push({ ...item, sku });
    return acc;
  }, {});

  const lowStock = filteredSkus.filter((sku) => {
    if (thresholdExcludedItems.includes(sku)) return false;
    const item = inventory[sku];
    const threshold = item.minThreshold ?? minStockThreshold;
    return getTotalGodownStock(item) < threshold;
  });

  const shareWhatsApp = (item: InventoryItem) => {
    const text = `*Stock Update: ${item.category} - ${item.itemName}*\nShop: ${item.shop}\nGodown: ${getTotalGodownStock(item)}\nRate: ₹${item.saleRate}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  return (
    <div className="space-y-6 animate-fade-in-down">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
        <h2 className="text-2xl font-black text-gray-800 tracking-tighter uppercase">
          Stock Ledger
        </h2>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-72">
            <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search product..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm font-bold text-sm"
            />
          </div>
        </div>
      </div>

      {lowStock.length > 0 && !searchTerm && (
        <div className="bg-red-50 border-2 border-red-200 p-5 rounded-3xl">
          <h3 className="text-red-800 font-black text-xs uppercase flex items-center gap-2 mb-4">
            <AlertTriangle size={16} /> Critical Stock Alerts ({lowStock.length}{" "}
            items)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {lowStock.map((sku) => {
              const item = inventory[sku];
              const threshold = item.minThreshold ?? minStockThreshold;
              const godownStock = getTotalGodownStock(item);
              const godownEntries = Object.entries(item.godowns || {}).filter(
                ([, v]) => Number(v) > 0,
              );
              return (
                <div
                  key={sku}
                  className="bg-white border-2 border-red-200 rounded-2xl p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <p className="font-black text-red-800 text-sm">
                        {item.itemName}
                      </p>
                      <p className="text-[10px] font-black text-red-500 uppercase tracking-widest">
                        {item.category}
                      </p>
                    </div>
                    <span className="bg-red-100 text-red-800 px-2 py-1 rounded-lg text-[10px] font-black shrink-0">
                      {godownStock} LEFT
                    </span>
                  </div>
                  {Object.keys(item.attributes || {}).length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {Object.entries(item.attributes).map(([k, v]) => (
                        <span
                          key={k}
                          className="text-[9px] bg-red-50 text-red-600 border border-red-100 px-1.5 py-0.5 rounded uppercase font-bold"
                        >
                          {k}: {v}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="text-[10px] font-bold text-gray-500 space-y-0.5">
                    <p>
                      Threshold:{" "}
                      <span className="text-red-700 font-black">
                        {threshold}
                      </span>{" "}
                      | Godown:{" "}
                      <span className="text-red-700 font-black">
                        {godownStock}
                      </span>
                    </p>
                    {godownEntries.length > 0 && (
                      <p className="text-gray-400">
                        {godownEntries
                          .map(([g, v]) => `${g}: ${v}`)
                          .join(" · ")}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {Object.keys(grouped).length === 0 ? (
        <div className="text-center py-20 bg-white rounded-[3rem] border border-dashed text-gray-400">
          <Box className="w-12 h-12 mx-auto mb-4 opacity-20" />
          <p className="font-bold">No matching stock found</p>
        </div>
      ) : (
        Object.keys(grouped)
          .sort()
          .map((cat) => (
            <div
              key={cat}
              className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden mb-6"
            >
              <div className="bg-blue-600 px-6 py-3 flex justify-between items-center text-white">
                <h3 className="font-black uppercase text-xs tracking-widest">
                  {cat}
                </h3>
                <span className="text-[10px] font-black bg-white/20 px-3 py-1 rounded-full">
                  {grouped[cat].length} Variants
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-gray-50/50 text-[9px] font-black uppercase text-gray-400 border-b">
                    <tr>
                      <th className="px-6 py-3">Product Description</th>
                      <th className="px-6 py-3 text-center">Shop</th>
                      <th className="px-6 py-3 text-center">Godowns</th>
                      <th className="px-6 py-3 text-right">Rate (₹)</th>
                      <th className="px-6 py-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-sm">
                    {grouped[cat].map((item) => {
                      const itemThreshold =
                        item.minThreshold ?? minStockThreshold;
                      const godownStock = getTotalGodownStock(item);
                      const isCritical = godownStock < itemThreshold;
                      return (
                        <tr
                          key={item.sku}
                          onClick={() => onItemClick?.(item.sku)}
                          onKeyUp={(e) =>
                            e.key === "Enter" && onItemClick?.(item.sku)
                          }
                          tabIndex={0}
                          className={`transition-colors cursor-pointer ${isCritical ? "bg-red-50 hover:bg-red-100/60" : "hover:bg-blue-50/30"}`}
                        >
                          <td className="px-6 py-4">
                            <div className="font-bold text-gray-900">
                              {item.itemName}
                            </div>
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {Object.entries(item.attributes || {}).map(
                                ([k, v]) => (
                                  <span
                                    key={k}
                                    className="text-[9px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded border uppercase font-bold"
                                  >
                                    {String(v)}
                                  </span>
                                ),
                              )}
                            </div>
                            {(() => {
                              // Bilty linkage: use inwardSaved as primary source (persists after refresh)
                              const savedEntries = inwardSaved
                                .filter(
                                  (s) =>
                                    (!s.businessId ||
                                      s.businessId === activeBusinessId) &&
                                    s.items?.some(
                                      (si) =>
                                        si.itemName?.toLowerCase() ===
                                          item.itemName?.toLowerCase() &&
                                        si.category === item.category,
                                    ),
                                )
                                .sort((a, b) =>
                                  (a.savedAt || "").localeCompare(
                                    b.savedAt || "",
                                  ),
                                );
                              // Also collect bilty numbers from transactions (for in-memory entries)
                              const txBiltyNos = transactions
                                .filter(
                                  (tx) =>
                                    (!tx.businessId ||
                                      tx.businessId === activeBusinessId) &&
                                    (tx.type === "INWARD" ||
                                      tx.type === "DIRECT_STOCK") &&
                                    tx.biltyNo &&
                                    (tx.sku === item.sku ||
                                      (tx.itemName?.toLowerCase() ===
                                        item.itemName?.toLowerCase() &&
                                        tx.category === item.category)),
                                )
                                .map((tx) => tx.biltyNo as string);
                              const savedBiltyNos = savedEntries
                                .map((s) => s.biltyNumber)
                                .filter(Boolean) as string[];
                              const uniqueBiltyNos = [
                                ...new Set([...savedBiltyNos, ...txBiltyNos]),
                              ];
                              const firstEntry = savedEntries[0];
                              if (uniqueBiltyNos.length === 0 && !firstEntry)
                                return null;
                              return (
                                <div className="mt-1.5 space-y-0.5">
                                  <div className="flex flex-wrap gap-1">
                                    {uniqueBiltyNos.map((bn) => (
                                      <span
                                        key={bn}
                                        className="inline-flex items-center gap-1 text-[9px] font-bold bg-green-50 text-green-700 px-1.5 py-0.5 rounded border border-green-100"
                                      >
                                        📦 {bn}
                                      </span>
                                    ))}
                                  </div>
                                  {firstEntry && (
                                    <p className="text-[9px] text-gray-400 font-bold">
                                      First added{" "}
                                      {firstEntry.savedAt?.split("T")[0] ||
                                        firstEntry.savedAt}{" "}
                                      · {firstEntry.savedBy || "?"}
                                    </p>
                                  )}
                                </div>
                              );
                            })()}
                          </td>
                          <td className="px-6 py-4 text-center font-black text-green-700 text-lg">
                            {(() => {
                              const unit = resolveItemUnit(
                                item.sku,
                                item.category,
                                categoryUnits,
                                itemUnitOverrides,
                              );
                              return formatQtyWithUnit(
                                Number(item.shop || 0),
                                unit,
                                true,
                              );
                            })()}
                          </td>
                          <td className="px-6 py-4 text-center font-black text-amber-700">
                            <div className="text-lg">
                              {(() => {
                                const unit = resolveItemUnit(
                                  item.sku,
                                  item.category,
                                  categoryUnits,
                                  itemUnitOverrides,
                                );
                                return formatQtyWithUnit(
                                  getTotalGodownStock(item),
                                  unit,
                                  true,
                                );
                              })()}
                            </div>
                            <div className="text-[9px] text-gray-400 font-bold mt-0.5 text-left">
                              {Object.entries(item.godowns || {})
                                .filter(([, v]) => Number(v) > 0)
                                .map(([g, v]) => {
                                  const unit = resolveItemUnit(
                                    item.sku,
                                    item.category,
                                    categoryUnits,
                                    itemUnitOverrides,
                                  );
                                  return (
                                    <span key={g} className="block">
                                      {g}: {formatQtyWithUnit(Number(v), unit)}
                                    </span>
                                  );
                                })}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right font-black text-blue-700 text-lg">
                            {Number(item.saleRate || 0)}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <button
                              type="button"
                              onClick={() => shareWhatsApp(item)}
                              className="p-2 bg-green-50 text-green-600 rounded-xl hover:bg-green-100 transition-colors"
                            >
                              <Share2 size={16} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))
      )}
    </div>
  );
}

/* ================= TRANSIT TAB ================= */

function ItemHistoryPanel({
  sku,
  inventory,
  transactions,
  activeBusinessId,
  onClose,
  inwardSaved = [],
}: {
  sku: string | null;
  inventory: Record<string, InventoryItem>;
  transactions: Transaction[];
  activeBusinessId: string;
  onClose: () => void;
  inwardSaved?: InwardSavedEntry[];
}) {
  if (!sku) return null;
  const item = inventory[sku];
  if (!item) return null;

  const itemTxs = transactions
    .filter((tx) => {
      if (!(!tx.businessId || tx.businessId === activeBusinessId)) return false;
      if (tx.sku === sku) return true;
      if (
        tx.itemName?.toLowerCase() === item.itemName?.toLowerCase() &&
        (!tx.category || tx.category === item.category)
      )
        return true;
      // Also catch transactions where baleItemsList contains this item
      if (
        tx.baleItemsList?.some(
          (bi: { itemName?: string; category?: string }) =>
            bi.itemName?.toLowerCase() === item.itemName?.toLowerCase() &&
            (!bi.category || bi.category === item.category),
        )
      )
        return true;
      return false;
    })
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""));

  // Build inward entries from inwardSaved (persists after refresh, primary source for bilty)
  const savedInwardEntries = inwardSaved
    .filter(
      (s) =>
        (!s.businessId || s.businessId === activeBusinessId) &&
        s.items?.some(
          (si) =>
            si.itemName?.toLowerCase() === item.itemName?.toLowerCase() &&
            si.category === item.category,
        ),
    )
    .sort((a, b) => (a.savedAt || "").localeCompare(b.savedAt || ""));

  // Deduplicate: avoid showing both a saved entry and a transaction for the same bilty
  const savedBiltyNos = new Set(
    savedInwardEntries.map((s) => s.biltyNumber?.toLowerCase()),
  );
  const nonInwardTxs = itemTxs.filter(
    (tx) => tx.type !== "INWARD" && tx.type !== "DIRECT_STOCK",
  );
  // Keep inward transactions only if they have a biltyNo NOT already covered by inwardSaved
  const extraInwardTxs = itemTxs.filter(
    (tx) =>
      (tx.type === "INWARD" || tx.type === "DIRECT_STOCK") &&
      tx.biltyNo &&
      !savedBiltyNos.has(tx.biltyNo.toLowerCase()),
  );

  const dotColor = (type: string) => {
    if (
      type === "INWARD" ||
      type === "OPENING_STOCK" ||
      type === "DIRECT_STOCK"
    )
      return "bg-green-500";
    if (type === "transfer") return "bg-purple-500";
    if (type === "SALE") return "bg-red-500";
    return "bg-gray-400";
  };

  return (
    <div className="fixed inset-0 bg-gray-900/60 z-[200] flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="bg-white w-full md:max-w-xl md:rounded-[2.5rem] rounded-t-[2rem] shadow-2xl max-h-[90vh] overflow-y-auto animate-fade-in-down">
        <div className="sticky top-0 bg-white border-b px-6 py-5 flex justify-between items-start z-10 rounded-t-[2rem]">
          <div>
            <h3 className="font-black text-xl text-gray-900">
              {item.itemName}
            </h3>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-0.5">
              {item.category}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 bg-gray-100 rounded-full"
          >
            <X size={20} />
          </button>
        </div>
        <div className="p-6 space-y-5">
          {/* WhatsApp Share Button */}
          <button
            type="button"
            onClick={() => {
              let msg = `📦 *${item.itemName}* (${item.category})\n`;
              const attrs = Object.entries(item.attributes || {})
                .filter(([, v]) => v)
                .map(([k, v]) => `${k}: ${v}`)
                .join(", ");
              if (attrs) msg += `📝 ${attrs}\n`;
              msg += "\n📊 *Current Stock*\n";
              msg += `🏪 Shop: ${item.shop || 0} pcs\n`;
              for (const [g, v] of Object.entries(item.godowns || {})) {
                msg += `🏭 ${g}: ${v || 0} pcs\n`;
              }
              msg += "\n📅 *Transaction Timeline*\n";
              for (const tx of itemTxs) {
                const d = tx.date?.includes("T")
                  ? new Date(tx.date).toLocaleString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: true,
                    })
                  : tx.date;
                if (
                  tx.type === "INWARD" ||
                  tx.type === "OPENING_STOCK" ||
                  tx.type === "DIRECT_STOCK"
                ) {
                  msg += `✅ Added ${tx.itemsCount ?? "?"} pcs on ${d}`;
                  if (tx.biltyNo) msg += ` (Bilty: ${tx.biltyNo})`;
                  msg += ` by ${tx.user || "?"}\n`;
                  if (tx.baleItemsList) {
                    for (const bi of tx.baleItemsList) {
                      if ((bi.shopQty || 0) > 0)
                        msg += `   🏪 Shop: ${bi.shopQty} pcs\n`;
                      for (const [g2, v2] of Object.entries(
                        bi.godownQuants || {},
                      ).filter(([, val]) => val > 0)) {
                        msg += `   🏭 ${g2}: ${v2} pcs\n`;
                      }
                    }
                  }
                } else if (tx.type === "transfer") {
                  msg += `🔄 Transferred ${tx.itemsCount ?? "?"} pcs: ${tx.fromLocation} → ${tx.toLocation} on ${d} by ${tx.transferredBy || tx.user || "?"}\n`;
                } else if (tx.type === "SALE") {
                  msg += `💰 Sold ${tx.itemsCount ?? "?"} pcs on ${d} by ${tx.user || "?"}\n`;
                }
              }
              msg += "\n_Shared from StockFlow_";
              window.open(
                `https://wa.me/?text=${encodeURIComponent(msg)}`,
                "_blank",
              );
            }}
            className="w-full flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white font-black py-3 rounded-2xl text-xs uppercase tracking-widest shadow-md transition-colors"
          >
            <Share2 size={16} />
            Share on WhatsApp
          </button>
          {/* Sell & Purchase Price */}
          <div className="flex gap-3 flex-wrap">
            {item.saleRate > 0 && (
              <div className="bg-blue-50 border border-blue-200 px-4 py-2 rounded-2xl">
                <p className="text-[10px] font-black uppercase text-blue-500">
                  Sell Price
                </p>
                <p className="text-lg font-black text-blue-700">
                  ₹{item.saleRate}
                </p>
              </div>
            )}
            {item.purchaseRate > 0 && (
              <div className="bg-purple-50 border border-purple-200 px-4 py-2 rounded-2xl">
                <p className="text-[10px] font-black uppercase text-purple-500">
                  Purchase Price
                </p>
                <p className="text-lg font-black text-purple-700">
                  ₹{item.purchaseRate}
                </p>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="bg-green-50 border border-green-100 p-4 rounded-2xl text-center">
              <p className="text-[10px] font-black uppercase text-green-600">
                Shop
              </p>
              <p className="text-2xl font-black text-green-700">
                {Number(item.shop || 0)}
              </p>
            </div>
            {Object.entries(item.godowns || {}).map(([g, v]) => (
              <div
                key={g}
                className="bg-amber-50 border border-amber-100 p-4 rounded-2xl text-center"
              >
                <p className="text-[10px] font-black uppercase text-amber-600 truncate">
                  {g}
                </p>
                <p className="text-2xl font-black text-amber-700">
                  {Number(v || 0)}
                </p>
              </div>
            ))}
          </div>
          <div>
            <h4 className="font-black text-xs uppercase tracking-widest text-gray-500 mb-4">
              Transaction Timeline
            </h4>
            {itemTxs.length === 0 && savedInwardEntries.length === 0 ? (
              <p className="text-gray-400 font-bold text-xs text-center py-8">
                No transactions recorded yet
              </p>
            ) : (
              <div className="space-y-4">
                {/* Group inward entries by bilty — use inwardSaved as primary source */}
                {(() => {
                  const openingTxs = itemTxs.filter(
                    (tx) => tx.type === "OPENING_STOCK",
                  );
                  const transferTxs = nonInwardTxs.filter(
                    (tx) => tx.type === "transfer",
                  );
                  const otherTxs = nonInwardTxs.filter(
                    (tx) =>
                      tx.type !== "OPENING_STOCK" && tx.type !== "transfer",
                  );
                  return (
                    <>
                      {(savedInwardEntries.length > 0 ||
                        extraInwardTxs.length > 0) && (
                        <div>
                          <p className="text-[9px] font-black uppercase text-green-600 tracking-widest mb-2">
                            Stock Receipts by Bilty
                          </p>
                          <div className="space-y-3">
                            {/* Render from inwardSaved (persists after refresh) */}
                            {savedInwardEntries.map((saved) => {
                              const thisItem = saved.items?.find(
                                (si) =>
                                  si.itemName?.toLowerCase() ===
                                    item.itemName?.toLowerCase() &&
                                  si.category === item.category,
                              );
                              const totalQty = thisItem ? thisItem.qty : 0;
                              return (
                                <div
                                  key={`saved-${saved.id}-${saved.biltyNumber}`}
                                  className="flex gap-4"
                                >
                                  <div className="flex flex-col items-center">
                                    <div className="w-3 h-3 rounded-full mt-1.5 shrink-0 bg-green-500" />
                                    <div className="w-0.5 bg-gray-200 flex-1 mt-1" />
                                  </div>
                                  <div className="pb-4 flex-1">
                                    <div className="bg-green-50 border border-green-100 rounded-2xl p-3 space-y-2">
                                      <div className="flex items-center justify-between flex-wrap gap-2">
                                        <div>
                                          <p className="font-black text-sm text-green-700">
                                            ✅ {totalQty ?? "?"} pcs added
                                          </p>
                                          <p className="text-[10px] font-bold text-gray-400 mt-0.5">
                                            By{" "}
                                            <b className="text-gray-600">
                                              {saved.savedBy || "?"}
                                            </b>{" "}
                                            ·{" "}
                                            {saved.savedAt?.split("T")[0] ||
                                              saved.savedAt}
                                          </p>
                                        </div>
                                        {saved.biltyNumber && (
                                          <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-green-100 text-green-800 px-2.5 py-1 rounded-full border border-green-200">
                                            📦 {saved.biltyNumber}
                                          </span>
                                        )}
                                      </div>
                                      {thisItem && (
                                        <div className="space-y-1 pt-1 border-t border-green-200">
                                          <div className="text-[10px] font-bold text-gray-700">
                                            <span className="text-gray-900">
                                              {thisItem.itemName}
                                            </span>
                                            <span className="text-gray-400 ml-1">
                                              ({thisItem.category})
                                            </span>
                                            <span className="ml-2 text-green-700">
                                              Qty: {thisItem.qty}
                                            </span>
                                            <div className="flex gap-1 flex-wrap mt-1">
                                              {(thisItem.shopQty || 0) > 0 && (
                                                <span className="text-[9px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-md border border-blue-100">
                                                  🏪 Shop: {thisItem.shopQty}
                                                </span>
                                              )}
                                              {(thisItem.godownQty || 0) >
                                                0 && (
                                                <span className="text-[9px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded-md border border-amber-100">
                                                  🏭 Godown:{" "}
                                                  {thisItem.godownQty}
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                            {/* Extra inward transactions not in inwardSaved */}
                            {extraInwardTxs.map((tx) => (
                              <div key={tx.id} className="flex gap-4">
                                <div className="flex flex-col items-center">
                                  <div className="w-3 h-3 rounded-full mt-1.5 shrink-0 bg-green-500" />
                                  <div className="w-0.5 bg-gray-200 flex-1 mt-1" />
                                </div>
                                <div className="pb-4 flex-1">
                                  <div className="bg-green-50 border border-green-100 rounded-2xl p-3 space-y-2">
                                    <div className="flex items-center justify-between flex-wrap gap-2">
                                      <div>
                                        <p className="font-black text-sm text-green-700">
                                          ✅ {tx.itemsCount ?? "?"} pcs added
                                        </p>
                                        <p className="text-[10px] font-bold text-gray-400 mt-0.5">
                                          By{" "}
                                          <b className="text-gray-600">
                                            {tx.user || "?"}
                                          </b>{" "}
                                          ·{" "}
                                          {tx.date?.includes("T")
                                            ? new Date(tx.date).toLocaleString(
                                                "en-IN",
                                                {
                                                  day: "2-digit",
                                                  month: "short",
                                                  year: "numeric",
                                                  hour: "2-digit",
                                                  minute: "2-digit",
                                                  hour12: true,
                                                },
                                              )
                                            : tx.date}
                                        </p>
                                      </div>
                                      {tx.biltyNo && (
                                        <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-green-100 text-green-800 px-2.5 py-1 rounded-full border border-green-200">
                                          📦 {tx.biltyNo}
                                        </span>
                                      )}
                                    </div>
                                    {(() => {
                                      const effectiveItems =
                                        tx.baleItemsList &&
                                        tx.baleItemsList.length > 0
                                          ? tx.baleItemsList
                                          : [];
                                      return (
                                        effectiveItems.length > 0 && (
                                          <div className="space-y-1 pt-1 border-t border-green-200">
                                            {effectiveItems.map(
                                              (
                                                bi: {
                                                  itemName?: string;
                                                  category?: string;
                                                  qty?: number;
                                                  shopQty?: number;
                                                  godownQuants?: Record<
                                                    string,
                                                    number
                                                  >;
                                                },
                                                biIdx: number,
                                              ) => (
                                                <div
                                                  key={`${bi.itemName}-${biIdx}`}
                                                  className="text-[10px] font-bold text-gray-700"
                                                >
                                                  <span className="text-gray-900">
                                                    {bi.itemName}
                                                  </span>
                                                  <span className="text-gray-400 ml-1">
                                                    ({bi.category})
                                                  </span>
                                                  <span className="ml-2 text-green-700">
                                                    Qty: {bi.qty}
                                                  </span>
                                                  <div className="flex gap-1 flex-wrap mt-1">
                                                    {(bi.shopQty || 0) > 0 && (
                                                      <span className="text-[9px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-md border border-blue-100">
                                                        🏪 Shop: {bi.shopQty}
                                                      </span>
                                                    )}
                                                    {Object.entries(
                                                      bi.godownQuants || {},
                                                    )
                                                      .filter(
                                                        ([, v]) => (v || 0) > 0,
                                                      )
                                                      .map(([g, v]) => (
                                                        <span
                                                          key={g}
                                                          className="text-[9px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded-md border border-amber-100"
                                                        >
                                                          🏭 {g}: {v}
                                                        </span>
                                                      ))}
                                                  </div>
                                                </div>
                                              ),
                                            )}
                                          </div>
                                        )
                                      );
                                    })()}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {transferTxs.length > 0 && (
                        <div>
                          <p className="text-[9px] font-black uppercase text-purple-600 tracking-widest mb-2">
                            Transfers
                          </p>
                          <div className="space-y-3">
                            {transferTxs.map((tx) => (
                              <div key={tx.id} className="flex gap-4">
                                <div className="flex flex-col items-center">
                                  <div className="w-3 h-3 rounded-full mt-1.5 shrink-0 bg-purple-500" />
                                  <div className="w-0.5 bg-gray-200 flex-1 mt-1" />
                                </div>
                                <div className="pb-4 flex-1">
                                  <div className="bg-purple-50 border border-purple-100 rounded-2xl p-3">
                                    <p className="font-black text-sm text-purple-700">
                                      🔄 {tx.itemsCount ?? "?"} pcs transferred
                                    </p>
                                    <p className="text-[11px] font-bold text-purple-600">
                                      {tx.fromLocation} → {tx.toLocation}
                                    </p>
                                    <p className="text-[10px] font-bold text-gray-400 mt-0.5">
                                      By{" "}
                                      <b className="text-gray-600">
                                        {tx.transferredBy || tx.user || "?"}
                                      </b>{" "}
                                      ·{" "}
                                      {tx.date?.includes("T")
                                        ? new Date(tx.date).toLocaleString(
                                            "en-IN",
                                            {
                                              day: "2-digit",
                                              month: "short",
                                              year: "numeric",
                                              hour: "2-digit",
                                              minute: "2-digit",
                                              hour12: true,
                                            },
                                          )
                                        : tx.date}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {openingTxs.length > 0 && (
                        <div>
                          <p className="text-[9px] font-black uppercase text-blue-600 tracking-widest mb-2">
                            Opening Stock
                          </p>
                          <div className="space-y-3">
                            {openingTxs.map((tx) => (
                              <div key={tx.id} className="flex gap-4">
                                <div className="flex flex-col items-center">
                                  <div className="w-3 h-3 rounded-full mt-1.5 shrink-0 bg-blue-500" />
                                  <div className="w-0.5 bg-gray-200 flex-1 mt-1" />
                                </div>
                                <div className="pb-4 flex-1">
                                  <div className="bg-blue-50 border border-blue-100 rounded-2xl p-3">
                                    <p className="font-black text-sm text-blue-700">
                                      📋 {tx.itemsCount ?? "?"} pcs opening
                                      stock
                                    </p>
                                    <p className="text-[10px] font-bold text-gray-400 mt-0.5">
                                      By{" "}
                                      <b className="text-gray-600">
                                        {tx.user || "?"}
                                      </b>{" "}
                                      ·{" "}
                                      {tx.date?.includes("T")
                                        ? new Date(tx.date).toLocaleString(
                                            "en-IN",
                                            {
                                              day: "2-digit",
                                              month: "short",
                                              year: "numeric",
                                              hour: "2-digit",
                                              minute: "2-digit",
                                              hour12: true,
                                            },
                                          )
                                        : tx.date}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {otherTxs.map((tx) => (
                        <div key={tx.id} className="flex gap-4">
                          <div className="flex flex-col items-center">
                            <div
                              className={`w-3 h-3 rounded-full mt-1.5 shrink-0 ${dotColor(tx.type)}`}
                            />
                            <div className="w-0.5 bg-gray-200 flex-1 mt-1" />
                          </div>
                          <div className="pb-4 flex-1">
                            {tx.type === "SALE" && (
                              <p className="font-black text-sm text-red-700">
                                💰 Sold {tx.itemsCount ?? "?"} pcs from Shop
                              </p>
                            )}
                            {tx.type === "STOCK_OVERWRITE" && (
                              <p className="font-black text-sm text-gray-600">
                                ⚙️ Stock adjusted
                              </p>
                            )}
                            <p className="text-[10px] font-bold text-gray-400 mt-1">
                              By{" "}
                              <b className="text-gray-600">
                                {tx.transferredBy || tx.user || "?"}
                              </b>{" "}
                              ·{" "}
                              {tx.date?.includes("T")
                                ? new Date(tx.date).toLocaleString("en-IN", {
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    hour12: true,
                                  })
                                : tx.date}
                            </p>
                          </div>
                        </div>
                      ))}
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================= SIDEBAR / NAV ================= */
/* ================= INWARD SAVED TAB ================= */

export { DashboardTab, ItemHistoryPanel };
