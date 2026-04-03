import { Download, PackagePlus, Upload } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { formatItemName } from "../constants";
import type {
  AppUser,
  Category,
  InventoryItem,
  InwardSavedEntry,
  Transaction,
} from "../types";
import { ItemNameComboOpening } from "./ItemNameCombo";

function StockOverwriteTable({
  inventory,
  setInventory,
  godowns,
  activeBusinessId,
  setTransactions,
  currentUser,
  showNotification,
}: {
  inventory: Record<string, InventoryItem>;
  setInventory: React.Dispatch<
    React.SetStateAction<Record<string, InventoryItem>>
  >;
  godowns: string[];
  activeBusinessId: string;
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
  currentUser: AppUser;
  showNotification: (m: string, t?: string) => void;
}) {
  const items = Object.values(inventory).filter(
    (item) => !item.businessId || item.businessId === activeBusinessId,
  );

  const [edits, setEdits] = useState<
    Record<string, { shop: number; godowns: Record<string, number> }>
  >(() => {
    const initial: Record<
      string,
      { shop: number; godowns: Record<string, number> }
    > = {};
    for (const item of items) {
      initial[item.sku] = {
        shop: item.shop,
        godowns: { ...item.godowns },
      };
    }
    return initial;
  });

  const handleOverwrite = (sku: string) => {
    const edit = edits[sku];
    if (!edit) return;
    const oldItem = inventory[sku];
    setInventory((prev) => ({
      ...prev,
      [sku]: {
        ...prev[sku],
        shop: edit.shop,
        godowns: { ...edit.godowns },
      },
    }));
    setTransactions((prev) => [
      ...prev,
      {
        id: Date.now(),
        type: "STOCK_OVERWRITE",
        sku,
        itemName: oldItem.itemName,
        category: oldItem.category,
        notes: `Overwrite: shop=${edit.shop}, godowns=${JSON.stringify(edit.godowns)}`,
        date: new Date().toISOString(),
        user: currentUser.username,
        businessId: activeBusinessId,
      } as Transaction,
    ]);
    showNotification(`Stock overwritten for ${oldItem.itemName}`);
  };

  const handleOverwriteAll = () => {
    const updates: Record<string, InventoryItem> = {};
    const newTxns: Transaction[] = [];
    for (const item of items) {
      const edit = edits[item.sku];
      if (!edit) return;
      updates[item.sku] = {
        ...item,
        shop: edit.shop,
        godowns: { ...edit.godowns },
      };
      newTxns.push({
        id: Date.now() + Math.random(),
        type: "STOCK_OVERWRITE",
        sku: item.sku,
        itemName: item.itemName,
        category: item.category,
        notes: `Bulk overwrite: shop=${edit.shop}, godowns=${JSON.stringify(edit.godowns)}`,
        date: new Date().toISOString(),
        user: currentUser.username,
        businessId: activeBusinessId,
      } as Transaction);
    }
    setInventory((prev) => ({ ...prev, ...updates }));
    setTransactions((prev) => [...prev, ...newTxns]);
    showNotification("All stock values overwritten");
  };

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button
          type="button"
          onClick={handleOverwriteAll}
          data-ocid="stock.overwrite_all.button"
          className="bg-orange-600 text-white font-black py-2 px-6 rounded-xl text-[10px] uppercase tracking-widest shadow-md hover:bg-orange-700 transition-colors"
        >
          Overwrite All
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs font-bold">
          <thead>
            <tr className="border-b text-gray-400 uppercase tracking-widest text-[10px]">
              <th className="text-left py-2 pr-4">Item</th>
              <th className="text-left py-2 pr-4">Shop Qty</th>
              {godowns.map((g) => (
                <th key={g} className="text-left py-2 pr-4">
                  {g}
                </th>
              ))}
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const edit = edits[item.sku] ?? {
                shop: item.shop,
                godowns: { ...item.godowns },
              };
              return (
                <tr
                  key={item.sku}
                  className="border-b hover:bg-gray-50 transition-colors"
                >
                  <td className="py-2 pr-4">
                    <div>{item.itemName}</div>
                    <div className="text-[9px] text-gray-400 font-mono">
                      {item.category}
                    </div>
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      type="number"
                      min={0}
                      value={edit.shop}
                      onChange={(e) =>
                        setEdits((prev) => ({
                          ...prev,
                          [item.sku]: {
                            ...prev[item.sku],
                            shop: Number(e.target.value),
                          },
                        }))
                      }
                      className="border rounded-lg p-1.5 w-20 outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 text-center"
                    />
                  </td>
                  {godowns.map((g) => (
                    <td key={g} className="py-2 pr-2">
                      <input
                        type="number"
                        min={0}
                        value={edit.godowns[g] ?? 0}
                        onChange={(e) =>
                          setEdits((prev) => ({
                            ...prev,
                            [item.sku]: {
                              ...prev[item.sku],
                              godowns: {
                                ...prev[item.sku].godowns,
                                [g]: Number(e.target.value),
                              },
                            },
                          }))
                        }
                        className="border rounded-lg p-1.5 w-20 outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 text-center"
                      />
                    </td>
                  ))}
                  <td className="py-2">
                    <button
                      type="button"
                      onClick={() => handleOverwrite(item.sku)}
                      data-ocid="stock.overwrite.button"
                      className="bg-blue-600 text-white font-black py-1.5 px-4 rounded-xl text-[10px] uppercase tracking-widest shadow-sm hover:bg-blue-700 transition-colors"
                    >
                      Overwrite
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ================= OPENING STOCK TAB ================= */

function OpeningStockTab({
  inventory,
  setInventory,
  categories,
  godowns,
  setTransactions,
  setInwardSaved,
  actor,
  activeBusinessId,
  currentUser,
  showNotification,
}: {
  inventory: Record<string, InventoryItem>;
  setInventory: React.Dispatch<
    React.SetStateAction<Record<string, InventoryItem>>
  >;
  categories: Category[];
  godowns: string[];
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
  setInwardSaved: React.Dispatch<React.SetStateAction<InwardSavedEntry[]>>;
  actor?: any;
  activeBusinessId: string;
  currentUser: AppUser;
  showNotification: (m: string, t?: string) => void;
}) {
  const today = new Date().toISOString().split("T")[0];
  const [refNote, setRefNote] = useState("");
  const [date, setDate] = useState(today);
  const [selectedCategory, setSelectedCategory] = useState(
    categories[0]?.name || "",
  );
  const [itemName, setItemName] = useState("");
  const [attributes, setAttributes] = useState<Record<string, string>>({});
  const [shopQty, setShopQty] = useState(0);
  const [saleRate, setSaleRate] = useState(0);
  const [purchaseRate, setPurchaseRate] = useState(0);
  const [priceSuggestions, setPriceSuggestions] = useState<
    { sale: number; purchase: number }[]
  >([]);
  const [showPriceSuggestions, setShowPriceSuggestions] = useState(false);
  const [godownQtys, setGodownQtys] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    for (const g of godowns) {
      init[g] = 0;
    }
    return init;
  });

  const currentCategory = categories.find((c) => c.name === selectedCategory);

  const resetForm = () => {
    setRefNote("");
    setDate(today);
    setItemName("");
    setAttributes({});
    setShopQty(0);
    setSaleRate(0);
    setPurchaseRate(0);
    setPriceSuggestions([]);
    const init: Record<string, number> = {};
    for (const g of godowns) {
      init[g] = 0;
    }
    setGodownQtys(init);
  };

  const handleItemNameChange = (name: string) => {
    setItemName(name);
    // Auto-suggest prices from existing inventory
    const term = name.toLowerCase().trim();
    if (term.length > 1) {
      const matches = Object.values(inventory).filter(
        (i) =>
          i.itemName?.toLowerCase().includes(term) &&
          (!i.businessId || i.businessId === activeBusinessId),
      );
      const unique: { sale: number; purchase: number }[] = [];
      for (const m of matches) {
        if (
          !unique.some(
            (u) => u.sale === m.saleRate && u.purchase === m.purchaseRate,
          )
        ) {
          unique.push({ sale: m.saleRate, purchase: m.purchaseRate });
        }
      }
      setPriceSuggestions(unique.slice(0, 5));
      setShowPriceSuggestions(unique.length > 0);
    } else {
      setPriceSuggestions([]);
      setShowPriceSuggestions(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim() || !selectedCategory) {
      showNotification("Item name and category are required", "error");
      return;
    }
    const sku = `SKU_${selectedCategory}_${itemName.trim()}_${Date.now()}`;
    // Check if similar item exists (same category + itemName + attrs)
    const existing = Object.values(inventory).find(
      (item) =>
        item.businessId === activeBusinessId &&
        item.category === selectedCategory &&
        item.itemName.toLowerCase() === itemName.trim().toLowerCase(),
    );
    if (existing) {
      // Merge quantities
      setInventory((prev) => ({
        ...prev,
        [existing.sku]: {
          ...prev[existing.sku],
          shop: (prev[existing.sku].shop || 0) + shopQty,
          godowns: Object.fromEntries(
            godowns.map((g) => [
              g,
              (prev[existing.sku].godowns?.[g] || 0) + (godownQtys[g] || 0),
            ]),
          ),
        },
      }));
      setTransactions((prev) => [
        ...prev,
        {
          id: Date.now(),
          type: "OPENING_STOCK",
          sku: existing.sku,
          itemName: existing.itemName,
          category: existing.category,
          notes: `Opening stock entry. Ref: ${refNote || "N/A"}. Date: ${date}. shop+${shopQty}, ${godowns.map((g) => `${g}+${godownQtys[g] || 0}`).join(", ")}`,
          date: new Date().toISOString(),
          user: currentUser.username,
          businessId: activeBusinessId,
        } as Transaction,
        {
          id: Date.now() + 1,
          type: "INWARD",
          sku: existing.sku,
          itemName: existing.itemName,
          category: existing.category,
          biltyNo: refNote || "OPENING",
          itemsCount:
            shopQty + godowns.reduce((sum, g) => sum + (godownQtys[g] || 0), 0),
          notes: `Opening stock entry. Ref: ${refNote || "N/A"}. Date: ${date}. shop+${shopQty}, ${godowns.map((g) => `${g}+${godownQtys[g] || 0}`).join(", ")}`,
          date: new Date().toISOString(),
          user: currentUser.username,
          businessId: activeBusinessId,
        } as Transaction,
      ]);
      showNotification(
        `Opening stock added to existing item: ${existing.itemName}`,
      );
      // Save to inwardSaved for analytics persistence
      const totalQtyExisting =
        shopQty + godowns.reduce((sum, g) => sum + (godownQtys[g] || 0), 0);
      const inwardEntryExisting: InwardSavedEntry = {
        id: Date.now() + 2,
        biltyNumber: refNote || "OPENING",
        baseNumber: refNote || "OPENING",
        packages: "1",
        items: [
          {
            category: existing.category,
            itemName: existing.itemName,
            qty: totalQtyExisting,
            godownQty: godowns.reduce(
              (sum, g) => sum + (godownQtys[g] || 0),
              0,
            ),
            godownBreakdown: { ...godownQtys },
            shopQty,
            saleRate,
            purchaseRate,
            attributes: existing.attributes || {},
          },
        ],
        savedBy: currentUser.username,
        savedAt: new Date().toISOString(),
        transporter: "",
        supplier: "",
        businessId: activeBusinessId,
      };
      setInwardSaved((prev) => [...prev, inwardEntryExisting]);
      if (actor) {
        try {
          await (actor as any).saveInward({
            id: String(inwardEntryExisting.id),
            businessId: activeBusinessId,
            biltyNumber: inwardEntryExisting.biltyNumber,
            baseNumber: inwardEntryExisting.baseNumber,
            packages: inwardEntryExisting.packages,
            savedBy: inwardEntryExisting.savedBy,
            savedAt: inwardEntryExisting.savedAt,
            transporter: "",
            supplier: "",
            items: inwardEntryExisting.items.map((item) => ({
              category: item.category,
              itemName: item.itemName,
              qty: BigInt(item.qty),
              godownQty: BigInt(item.godownQty),
              shopQty: BigInt(item.shopQty),
              saleRate: item.saleRate,
              purchaseRate: item.purchaseRate,
              attributes: JSON.stringify(item.attributes || {}),
              godownBreakdown: JSON.stringify(item.godownBreakdown || {}),
            })),
          });
        } catch (e) {
          console.error("saveInward for opening stock failed", e);
        }
      }
    } else {
      const newItem: InventoryItem = {
        sku,
        category: selectedCategory,
        itemName: itemName.trim(),
        attributes,
        shop: shopQty,
        godowns: { ...godownQtys },
        saleRate: saleRate,
        purchaseRate: purchaseRate,
        businessId: activeBusinessId,
      };
      setInventory((prev) => ({ ...prev, [sku]: newItem }));
      setTransactions((prev) => [
        ...prev,
        {
          id: Date.now(),
          type: "OPENING_STOCK",
          sku,
          itemName: itemName.trim(),
          category: selectedCategory,
          notes: `Opening stock entry. Ref: ${refNote || "N/A"}. Date: ${date}. shop=${shopQty}, ${godowns.map((g) => `${g}=${godownQtys[g] || 0}`).join(", ")}`,
          date: new Date().toISOString(),
          user: currentUser.username,
          businessId: activeBusinessId,
        } as Transaction,
        {
          id: Date.now() + 1,
          type: "INWARD",
          sku,
          itemName: itemName.trim(),
          category: selectedCategory,
          biltyNo: refNote || "OPENING",
          itemsCount:
            shopQty + godowns.reduce((sum, g) => sum + (godownQtys[g] || 0), 0),
          notes: `Opening stock entry. Ref: ${refNote || "N/A"}. Date: ${date}. shop=${shopQty}, ${godowns.map((g) => `${g}=${godownQtys[g] || 0}`).join(", ")}`,
          date: new Date().toISOString(),
          user: currentUser.username,
          businessId: activeBusinessId,
        } as Transaction,
      ]);
      showNotification(`Opening stock entered: ${itemName.trim()}`);
      // Save to inwardSaved for analytics persistence
      const totalQtyNew =
        shopQty + godowns.reduce((sum, g) => sum + (godownQtys[g] || 0), 0);
      const inwardEntryNew: InwardSavedEntry = {
        id: Date.now() + 2,
        biltyNumber: refNote || "OPENING",
        baseNumber: refNote || "OPENING",
        packages: "1",
        items: [
          {
            category: selectedCategory,
            itemName: itemName.trim(),
            qty: totalQtyNew,
            godownQty: godowns.reduce(
              (sum, g) => sum + (godownQtys[g] || 0),
              0,
            ),
            godownBreakdown: { ...godownQtys },
            shopQty,
            saleRate,
            purchaseRate,
            attributes: { ...attributes },
          },
        ],
        savedBy: currentUser.username,
        savedAt: new Date().toISOString(),
        transporter: "",
        supplier: "",
        businessId: activeBusinessId,
      };
      setInwardSaved((prev) => [...prev, inwardEntryNew]);
      if (actor) {
        try {
          await (actor as any).saveInward({
            id: String(inwardEntryNew.id),
            businessId: activeBusinessId,
            biltyNumber: inwardEntryNew.biltyNumber,
            baseNumber: inwardEntryNew.baseNumber,
            packages: inwardEntryNew.packages,
            savedBy: inwardEntryNew.savedBy,
            savedAt: inwardEntryNew.savedAt,
            transporter: "",
            supplier: "",
            items: inwardEntryNew.items.map((item) => ({
              category: item.category,
              itemName: item.itemName,
              qty: BigInt(item.qty),
              godownQty: BigInt(item.godownQty),
              shopQty: BigInt(item.shopQty),
              saleRate: item.saleRate,
              purchaseRate: item.purchaseRate,
              attributes: JSON.stringify(item.attributes || {}),
              godownBreakdown: JSON.stringify(item.godownBreakdown || {}),
            })),
          });
        } catch (e) {
          console.error("saveInward for opening stock failed", e);
        }
      }
    }
    resetForm();
  };

  return (
    <div className="space-y-6 animate-fade-in-down">
      <div className="flex items-center gap-3 mb-2">
        <PackagePlus className="text-emerald-600" size={28} />
        <div>
          <h2 className="text-2xl font-black text-gray-900">Opening Stock</h2>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
            Enter pre-existing stock without bilty number
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <button
          type="button"
          onClick={() => {
            const headers = [
              "Category",
              "ItemName",
              "RefNote",
              "Date",
              "ShopQty",
              "SaleRate",
              "PurchaseRate",
              ...godowns,
            ];
            const sample = [
              categories[0]?.name || "Safi",
              "Sample Item",
              "Opening Balance",
              new Date().toISOString().split("T")[0],
              "10",
              "100",
              "80",
              ...godowns.map(() => "5"),
            ];
            const csv = [headers.join(","), sample.join(",")].join("\n");
            const blob = new Blob([csv], { type: "text/csv" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = "opening_stock_template.csv";
            a.click();
          }}
          className="flex items-center gap-2 bg-emerald-100 text-emerald-700 border border-emerald-200 px-4 py-2 rounded-xl font-bold text-xs hover:bg-emerald-200"
        >
          <Download size={14} /> Download Template
        </button>
        <label
          htmlFor="opening-stock-csv"
          className="flex items-center gap-2 bg-blue-100 text-blue-700 border border-blue-200 px-4 py-2 rounded-xl font-bold text-xs cursor-pointer hover:bg-blue-200"
        >
          <Upload size={14} /> Upload Stock CSV
        </label>
        <input
          id="opening-stock-csv"
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
              const csv = ev.target?.result as string;
              const rows = csv.split(/\r?\n/).filter((l) => l.trim());
              // header row skipped
              let count = 0;
              for (let i = 1; i < rows.length; i++) {
                const cols = rows[i].split(",").map((c) => c.trim());
                if (!cols[0] || !cols[1]) continue;
                const cat = cols[0];
                const iName = cols[1];
                const ref = cols[2] || "";
                const dt = cols[3] || new Date().toISOString().split("T")[0];
                const shopQ = Number(cols[4] || 0);
                const sale = Number(cols[5] || 0);
                const purch = Number(cols[6] || 0);
                const gQtys: Record<string, number> = {};
                for (let j = 0; j < godowns.length; j++) {
                  gQtys[godowns[j]] = Number(cols[7 + j] || 0);
                }
                const sku = `SKU_${cat}_${iName.trim()}_${Date.now()}_${i}`;
                const existing = Object.values(inventory).find(
                  (x) =>
                    (!x.businessId || x.businessId === activeBusinessId) &&
                    x.category === cat &&
                    x.itemName.toLowerCase() === iName.trim().toLowerCase(),
                );
                if (existing) {
                  setInventory((prev) => ({
                    ...prev,
                    [existing.sku]: {
                      ...prev[existing.sku],
                      shop: (prev[existing.sku].shop || 0) + shopQ,
                      godowns: Object.fromEntries(
                        godowns.map((g) => [
                          g,
                          (prev[existing.sku].godowns?.[g] || 0) +
                            (gQtys[g] || 0),
                        ]),
                      ),
                    },
                  }));
                } else {
                  setInventory((prev) => ({
                    ...prev,
                    [sku]: {
                      sku,
                      category: cat,
                      itemName: iName.trim(),
                      attributes: {},
                      shop: shopQ,
                      godowns: { ...gQtys },
                      saleRate: sale,
                      purchaseRate: purch,
                      businessId: activeBusinessId,
                    },
                  }));
                }
                setTransactions((prev) => [
                  ...prev,
                  {
                    id: Date.now() + i,
                    type: "OPENING_STOCK",
                    sku: existing?.sku || sku,
                    itemName: iName.trim(),
                    category: cat,
                    notes: `CSV import. Ref: ${ref}. Date: ${dt}`,
                    date: new Date().toISOString(),
                    user: currentUser.username,
                    businessId: activeBusinessId,
                  } as Transaction,
                ]);
                count++;
              }
              showNotification(`Imported ${count} items`, "success");
            };
            reader.readAsText(file);
            e.target.value = "";
          }}
        />
      </div>
      <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm max-w-2xl">
        <h4 className="font-black text-xs uppercase tracking-widest text-emerald-900 mb-6">
          Add Stock Entry
        </h4>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 block mb-1">
                Reference Note (optional)
              </p>
              <input
                type="text"
                value={refNote}
                onChange={(e) => setRefNote(e.target.value)}
                placeholder="e.g. Opening balance Apr 2025"
                data-ocid="opening.ref_note.input"
                className="w-full border rounded-xl p-3 outline-none font-bold focus:ring-2 focus:ring-emerald-500 bg-gray-50 text-sm"
              />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 block mb-1">
                Date
              </p>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                data-ocid="opening.date.input"
                className="w-full border rounded-xl p-3 outline-none font-bold focus:ring-2 focus:ring-emerald-500 bg-gray-50 text-sm"
              />
            </div>
          </div>

          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 block mb-1">
              Category
            </p>
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setAttributes({});
              }}
              data-ocid="opening.category.select"
              className="w-full border rounded-xl p-3 outline-none font-bold focus:ring-2 focus:ring-emerald-500 bg-gray-50 text-sm"
            >
              {categories.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <ItemNameComboOpening
              categories={categories}
              selectedCategory={selectedCategory}
              value={itemName}
              onChange={(val) => handleItemNameChange(val)}
              inventory={inventory}
              activeBusinessId={activeBusinessId}
              showPriceSuggestions={showPriceSuggestions}
              priceSuggestions={priceSuggestions}
              onSelectPrice={(sale, purchase) => {
                setSaleRate(sale);
                setPurchaseRate(purchase);
                setShowPriceSuggestions(false);
              }}
            />
          </div>

          {currentCategory?.fields.map((field) => (
            <div key={field.name}>
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 block mb-1">
                {field.name}
              </p>
              {field.type === "select" ? (
                <select
                  value={attributes[field.name] || ""}
                  onChange={(e) =>
                    setAttributes((prev) => ({
                      ...prev,
                      [field.name]: e.target.value,
                    }))
                  }
                  className="w-full border rounded-xl p-3 outline-none font-bold focus:ring-2 focus:ring-emerald-500 bg-gray-50 text-sm"
                >
                  <option value="">-- Select --</option>
                  {field.options?.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={field.type || "text"}
                  value={attributes[field.name] || ""}
                  onChange={(e) =>
                    setAttributes((prev) => ({
                      ...prev,
                      [field.name]: e.target.value,
                    }))
                  }
                  className="w-full border rounded-xl p-3 outline-none font-bold focus:ring-2 focus:ring-emerald-500 bg-gray-50 text-sm"
                />
              )}
            </div>
          ))}

          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 block mb-2">
              Quantities
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[9px] text-gray-400 font-black uppercase tracking-widest block mb-1">
                  Shop
                </p>
                <input
                  type="number"
                  min={0}
                  value={shopQty}
                  onChange={(e) => setShopQty(Number(e.target.value))}
                  data-ocid="opening.shop_qty.input"
                  className="w-full border rounded-xl p-3 outline-none font-bold focus:ring-2 focus:ring-emerald-500 bg-gray-50 text-center"
                />
              </div>
              {godowns.map((g) => (
                <div key={g}>
                  <p className="text-[9px] text-gray-400 font-black uppercase tracking-widest block mb-1">
                    {g}
                  </p>
                  <input
                    type="number"
                    min={0}
                    value={godownQtys[g] ?? 0}
                    onChange={(e) =>
                      setGodownQtys((prev) => ({
                        ...prev,
                        [g]: Number(e.target.value),
                      }))
                    }
                    className="w-full border rounded-xl p-3 outline-none font-bold focus:ring-2 focus:ring-emerald-500 bg-gray-50 text-center"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 block mb-1">
                Sale Rate (₹)
              </p>
              <input
                type="number"
                value={saleRate}
                onChange={(e) => setSaleRate(Number(e.target.value))}
                min={0}
                className="w-full border rounded-xl p-3 outline-none font-bold focus:ring-2 focus:ring-emerald-500 bg-gray-50 text-sm"
              />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 block mb-1">
                Purchase Rate (₹)
              </p>
              <input
                type="number"
                value={purchaseRate}
                onChange={(e) => setPurchaseRate(Number(e.target.value))}
                min={0}
                className="w-full border rounded-xl p-3 outline-none font-bold focus:ring-2 focus:ring-emerald-500 bg-gray-50 text-sm"
              />
            </div>
          </div>
          <button
            type="submit"
            data-ocid="opening.submit_button"
            className="w-full bg-emerald-600 text-white font-black py-4 rounded-2xl uppercase text-[10px] tracking-widest shadow-lg hover:bg-emerald-700 transition-colors"
          >
            Add to Stock
          </button>
        </form>
      </div>
    </div>
  );
}

export { StockOverwriteTable, OpeningStockTab };
