import type { Category, InventoryItem } from "./types";

/* ================= CONSTANTS ================= */
const INITIAL_CATEGORIES: Category[] = [
  {
    name: "Safi",
    fields: [
      { name: "Size", type: "text" },
      { name: "Color", type: "select", options: ["black", "tiranga", "mix"] },
    ],
  },
  {
    name: "Lungi",
    fields: [
      {
        name: "Size",
        type: "select",
        options: ["2 mtr", "2.25 mtr", "2.5 mtr"],
      },
      {
        name: "Color",
        type: "select",
        options: ["plain white", "plain colour", "mix"],
      },
    ],
  },
  {
    name: "Napkin",
    fields: [
      { name: "Size", type: "select", options: ["14x21", "12x18", "16x24"] },
    ],
  },
];

/* ================= UTILITIES ================= */
const formatItemName = (name: string) => {
  if (!name) return "";
  const str = String(name).trim();
  if (str.length === 0) return "";
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

const getTotalGodownStock = (item: InventoryItem) => {
  if (!item || !item.godowns) return 0;
  return Object.values(item.godowns).reduce((a, b) => a + Number(b || 0), 0);
};

export { INITIAL_CATEGORIES, formatItemName, getTotalGodownStock };

export function resolveItemUnit(
  sku: string,
  category: string,
  categoryUnits: Record<string, "pcs" | "dozen">,
  itemUnitOverrides: Record<string, "pcs" | "dozen">,
): "pcs" | "dozen" {
  if (itemUnitOverrides[sku]) return itemUnitOverrides[sku];
  return categoryUnits[category] || "pcs";
}

export function formatQtyWithUnit(
  qty: number,
  unit: "pcs" | "dozen",
  showDual = false,
): string {
  if (unit === "dozen") {
    return showDual ? `${qty} dz (${qty * 12} pcs)` : `${qty} dz`;
  }
  return `${qty} pcs`;
}
