import { ShoppingCart, Trash2 } from "lucide-react";
import type React from "react";
import { useState } from "react";
import type { AppUser, Category, InventoryItem, Transaction } from "../types";
import { ItemNameCombo } from "./ItemNameCombo";

function SalesTab({
  inventory,
  updateStock,
  setTransactions,
  showNotification,
  currentUser,
  godowns: _godowns,
  activeBusinessId,
  categories,
  requiredFields,
}: {
  inventory: Record<string, InventoryItem>;
  updateStock: (
    sku: string,
    details: Partial<InventoryItem>,
    shopDelta: number,
    godownDelta: number,
    targetGodown?: string,
  ) => void;
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
  showNotification: (m: string, t?: string) => void;
  currentUser: AppUser;
  godowns: string[];
  activeBusinessId: string;
  categories: Category[];
  actor?: any;
  requiredFields?: Record<string, Record<string, boolean>>;
}) {
  const [saleLines, setSaleLines] = useState<
    { sku: string; itemName: string; category: string; qty: number }[]
  >([]);
  const [saleDate, setSaleDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [saleRef, setSaleRef] = useState("");
  const [lineCategory, setLineCategory] = useState(categories[0]?.name || "");
  const [lineItemName, setLineItemName] = useState("");
  const [lineQty, setLineQty] = useState("");

  const addLine = () => {
    if (!lineItemName || !lineQty) return;
    const salesReq = requiredFields?.sales || {};
    if (salesReq.category && !lineCategory.trim()) {
      showNotification("Category is required", "error");
      return;
    }
    if (salesReq.itemName && !lineItemName.trim()) {
      showNotification("Item Name is required", "error");
      return;
    }
    if (salesReq.qty && !lineQty.trim()) {
      showNotification("Qty is required", "error");
      return;
    }
    const sku = Object.keys(inventory).find(
      (s) =>
        (!inventory[s].businessId ||
          inventory[s].businessId === activeBusinessId) &&
        inventory[s].itemName.toLowerCase() === lineItemName.toLowerCase() &&
        inventory[s].category === lineCategory,
    );
    if (!sku) {
      showNotification("Item not found in inventory", "error");
      return;
    }
    const item = inventory[sku];
    const qty = Number(lineQty);
    if ((item.shop || 0) < qty) {
      showNotification(`Only ${item.shop || 0} available in Shop`, "error");
      return;
    }
    setSaleLines((prev) => [
      ...prev,
      { sku, itemName: item.itemName, category: lineCategory, qty },
    ]);
    setLineItemName("");
    setLineQty("");
  };

  const confirmSale = async () => {
    if (saleLines.length === 0) return;

    // Immediate local UI update
    for (const line of saleLines) {
      updateStock(line.sku, inventory[line.sku], -line.qty, 0, "Main Godown");
      setTransactions((prev) => [
        {
          id: Date.now() + Math.random(),
          type: "SALE",
          sku: line.sku,
          itemName: line.itemName,
          category: line.category,
          itemsCount: line.qty,
          fromLocation: "Shop",
          toLocation: "Customer",
          date: saleDate,
          user: currentUser.username,
          notes: `₹${inventory[line.sku]?.saleRate || 0} | Sale Ref: ${saleRef || "N/A"}`,
          businessId: activeBusinessId,
        },
        ...prev,
      ]);
    }
    showNotification(`Sale of ${saleLines.length} item(s) recorded`, "success");
    setSaleLines([]);
    setSaleRef("");
  };

  return (
    <div className="space-y-6 animate-fade-in-down max-w-2xl mx-auto">
      <div className="flex items-center gap-3 border-b pb-4">
        <ShoppingCart className="text-rose-600" size={28} />
        <div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tighter uppercase">
            Sales
          </h2>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
            Record sales from shop stock
          </p>
        </div>
      </div>
      <div className="bg-white p-6 rounded-[2rem] border shadow-sm space-y-4">
        <h3 className="font-black text-xs uppercase tracking-widest text-rose-900">
          Add Sale Item
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <p className="text-[10px] font-black uppercase text-gray-400 ml-1 mb-1">
              Category
            </p>
            <select
              value={lineCategory}
              onChange={(e) => {
                setLineCategory(e.target.value);
                setLineItemName("");
              }}
              className="w-full border rounded-xl p-2.5 font-bold bg-gray-50 outline-none"
            >
              {categories.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <ItemNameCombo
              category={lineCategory}
              value={lineItemName}
              onChange={setLineItemName}
              inventory={inventory}
              activeBusinessId={activeBusinessId}
            />
            {lineItemName &&
              (() => {
                const sku = Object.keys(inventory).find(
                  (s) =>
                    (!inventory[s].businessId ||
                      inventory[s].businessId === activeBusinessId) &&
                    inventory[s].itemName.toLowerCase() ===
                      lineItemName.toLowerCase() &&
                    inventory[s].category === lineCategory,
                );
                const shopQty = sku ? inventory[sku].shop || 0 : null;
                if (shopQty === null) return null;
                return (
                  <p
                    className={`text-[10px] font-black mt-1 ml-1 ${shopQty === 0 ? "text-red-600" : "text-green-700"}`}
                  >
                    Shop stock: <span className="text-sm">{shopQty}</span> pcs
                    available
                  </p>
                );
              })()}
          </div>
          <div>
            <p className="text-[10px] font-black uppercase text-gray-400 ml-1 mb-1">
              Qty (from Shop)
            </p>
            <input
              type="number"
              min="1"
              value={lineQty}
              onChange={(e) => setLineQty(e.target.value)}
              className="w-full border rounded-xl p-2.5 font-bold bg-gray-50 outline-none"
              placeholder="0"
            />
          </div>
        </div>
        <button
          type="button"
          onClick={addLine}
          className="bg-rose-600 text-white font-black px-6 py-3 rounded-2xl text-xs uppercase tracking-widest shadow-md"
        >
          Add to Sale
        </button>
      </div>
      {saleLines.length > 0 && (
        <div className="bg-white rounded-[2rem] border overflow-hidden shadow-xl animate-fade-in-down">
          <div className="bg-rose-700 text-white px-6 py-4 flex justify-between items-center">
            <h3 className="font-black uppercase tracking-widest text-xs">
              Pending Sale Items
            </h3>
            <span className="bg-white/20 px-3 py-1 rounded-full text-[10px] font-bold">
              {saleLines.length} ITEMS
            </span>
          </div>
          <table className="w-full text-sm">
            <tbody className="divide-y">
              {saleLines.map((line, idx) => (
                <tr key={`${line.sku}-${idx}`}>
                  <td className="px-6 py-4 font-bold">
                    {line.itemName}
                    <span className="ml-2 text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded uppercase">
                      {line.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center font-black text-rose-700">
                    {line.qty} pcs
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      type="button"
                      onClick={() =>
                        setSaleLines((prev) => prev.filter((_, i) => i !== idx))
                      }
                      className="text-red-400 p-2 bg-red-50 rounded-xl"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="p-6 bg-gray-50 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] font-black uppercase text-gray-400 ml-1">
                  Date of Sale
                </p>
                <input
                  type="date"
                  value={saleDate}
                  onChange={(e) => setSaleDate(e.target.value)}
                  className="w-full border rounded-xl p-2.5 font-bold outline-none focus:ring-2 focus:ring-rose-500 bg-white"
                />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase text-gray-400 ml-1">
                  Sale Reference
                </p>
                <input
                  type="text"
                  value={saleRef}
                  onChange={(e) => setSaleRef(e.target.value)}
                  placeholder="e.g. Invoice #001"
                  className="w-full border rounded-xl p-2.5 font-bold outline-none focus:ring-2 focus:ring-rose-500 bg-white"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={confirmSale}
              className="w-full bg-rose-700 text-white font-black py-5 rounded-2xl uppercase tracking-[0.3em] shadow-xl hover:bg-rose-800 transition-transform active:scale-95 text-sm"
            >
              Confirm Sale
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ================= ITEM HISTORY PANEL ================= */

export { SalesTab };
