import { useEffect, useState } from "react";
import type { Category, InventoryItem } from "../types";

function ItemNameCombo({
  category,
  value,
  onChange,
  inventory,
  activeBusinessId,
  onSelectItem,
}: {
  category: string;
  value: string;
  onChange: (val: string) => void;
  inventory: Record<string, InventoryItem>;
  activeBusinessId: string;
  onSelectItem?: (item: InventoryItem) => void;
}) {
  const [open, setOpen] = useState(false);
  const [inputVal, setInputVal] = useState(value);

  useEffect(() => {
    setInputVal(value);
  }, [value]);

  useEffect(() => {
    if (category) setOpen(true);
  }, [category]);

  // Build rich suggestion list with subcategory+price per inventory item
  const _inventoryItems = Object.values(inventory).filter(
    (i) =>
      (!category || i.category === category) &&
      (!i.businessId || i.businessId === activeBusinessId) &&
      (!inputVal || i.itemName.toLowerCase().includes(inputVal.toLowerCase())),
  );

  // Deduplicate by itemName so same item doesn't appear multiple times
  const _seen = new Set<string>();
  const suggestions = _inventoryItems.filter((inv) => {
    if (_seen.has(inv.itemName)) return false;
    _seen.add(inv.itemName);
    return true;
  });

  return (
    <div className="relative">
      <p className="text-[10px] font-black uppercase text-gray-400 ml-1">
        Item Name *
      </p>
      <input
        required
        type="text"
        value={inputVal}
        onChange={(e) => {
          setInputVal(e.target.value);
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        placeholder={category ? "Type or select item name" : "Type item name"}
        className="w-full border rounded-xl p-3 font-bold bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
      />
      {open && suggestions.length > 0 && (
        <div className="absolute z-30 left-0 right-0 bg-white border rounded-xl shadow-2xl mt-1 max-h-52 overflow-y-auto">
          {suggestions.map((inv) => {
            const attrStr = Object.values(inv.attributes || {})
              .filter(Boolean)
              .join(" -- ");
            const _label = attrStr
              ? `${inv.itemName} -- ${attrStr} -- ₹${inv.saleRate}`
              : `${inv.itemName} -- ₹${inv.saleRate}`;
            return (
              <button
                type="button"
                key={inv.sku}
                onMouseDown={() => {
                  onChange(inv.itemName);
                  setInputVal(inv.itemName);
                  setOpen(false);
                  if (onSelectItem) onSelectItem(inv);
                }}
                className="w-full text-left px-3 py-2.5 hover:bg-blue-50 text-xs font-bold border-b last:border-0"
              >
                <span className="text-gray-800">{inv.itemName}</span>
                {attrStr && (
                  <span className="text-gray-500 ml-1">— {attrStr}</span>
                )}
                <span className="text-blue-600 ml-1">— ₹{inv.saleRate}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ================= INWARD TAB ================= */

function ItemNameComboOpening({
  categories: _categories,
  selectedCategory,
  value,
  onChange,
  inventory,
  activeBusinessId,
  showPriceSuggestions,
  priceSuggestions,
  onSelectPrice,
}: {
  categories: Category[];
  selectedCategory: string;
  value: string;
  onChange: (val: string) => void;
  inventory: Record<string, InventoryItem>;
  activeBusinessId: string;
  showPriceSuggestions: boolean;
  priceSuggestions: { sale: number; purchase: number }[];
  onSelectPrice: (sale: number, purchase: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [inputVal, setInputVal] = useState(value);

  useEffect(() => {
    setInputVal(value);
  }, [value]);

  const suggestions = Array.from(
    new Set(
      Object.values(inventory)
        .filter(
          (i) =>
            (!selectedCategory || i.category === selectedCategory) &&
            (!i.businessId || i.businessId === activeBusinessId) &&
            (!inputVal ||
              i.itemName.toLowerCase().includes(inputVal.toLowerCase())),
        )
        .map((i) => i.itemName),
    ),
  );

  return (
    <div className="relative">
      <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 block mb-1">
        Item Name *
      </p>
      <input
        required
        type="text"
        value={inputVal}
        onChange={(e) => {
          setInputVal(e.target.value);
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Type or select item name"
        data-ocid="opening.item_name.input"
        className="w-full border rounded-xl p-3 outline-none font-bold focus:ring-2 focus:ring-emerald-500 bg-gray-50 text-sm"
      />
      {open && suggestions.length > 0 && (
        <div className="absolute z-30 left-0 right-0 bg-white border rounded-xl shadow-2xl mt-1 max-h-40 overflow-y-auto">
          {suggestions.map((name) => (
            <button
              type="button"
              key={name}
              onMouseDown={() => {
                onChange(name);
                setInputVal(name);
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2 hover:bg-emerald-50 text-sm font-bold border-b last:border-0"
            >
              {name}
            </button>
          ))}
        </div>
      )}
      {showPriceSuggestions && priceSuggestions.length > 0 && (
        <div className="absolute z-20 left-0 right-0 bg-white border rounded-xl shadow-xl mt-1">
          <p className="text-[9px] font-black uppercase text-gray-400 px-3 pt-2">
            Known prices for this item
          </p>
          {priceSuggestions.map((s, i) => (
            <button
              type="button"
              key={`price-${s.sale}-${s.purchase}-${i}`}
              onMouseDown={() => onSelectPrice(s.sale, s.purchase)}
              className="w-full text-left px-3 py-2 hover:bg-emerald-50 text-xs font-bold border-b last:border-0"
            >
              Sale: ₹{s.sale} · Purchase: ₹{s.purchase}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ================= SALES TAB ================= */

export { ItemNameCombo, ItemNameComboOpening };
