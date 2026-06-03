import {
  AlertCircle,
  ArrowRightLeft,
  BarChart2,
  CheckCircle,
  History,
  LayoutDashboard,
  LogOut,
  Navigation,
  Package,
  PackagePlus,
  PlusCircle,
  Receipt,
  Settings,
  ShoppingCart,
  Truck,
  User,
  UserCheck,
  Warehouse,
} from "lucide-react";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  CategoryV2 as BackendCategory,
  Godown as BackendGodown,
  SubCategory as BackendSubCategory,
  User as BackendUser,
  Role,
} from "./backend";
import { TxType as BackendTxType, Role as RoleEnum } from "./backend";
import { AnalyticsTab } from "./components/AnalyticsTab";
import { DashboardTab, ItemHistoryPanel } from "./components/DashboardTab";
import { DeliveryTab } from "./components/DeliveryTab";
import { GodownStockTab } from "./components/GodownStockTab";
import { HistoryTab } from "./components/HistoryTab";
import { InwardSavedTab } from "./components/InwardSavedTab";
import { InwardTab } from "./components/InwardTab";
import {
  LoginScreen,
  NavButton,
  SidebarButton,
} from "./components/LoginScreen";
import { OpeningStockTab } from "./components/OpeningStockTab";
import { SalesRecordTab } from "./components/SalesRecordTab";
import { SalesTab } from "./components/SalesTab";
import { SettingsTab } from "./components/SettingsTab";
import { TransferTab } from "./components/TransferTab";
import { TransitTab } from "./components/TransitTab";
import { WarehouseTab } from "./components/WarehouseTab";
import { INITIAL_CATEGORIES, formatItemName } from "./constants";
import type {
  InventoryItem as BackendInventoryItem,
  InwardSavedEntry as BackendInwardSavedEntry,
  QueueEntry as BackendQueueEntry,
  TransitEntry as BackendTransitEntry,
  DeliveryEntry,
  GodownQty,
  InwardItem,
  QueueBale,
  SaleEntry,
  TransferEntry,
  TxRecord,
} from "./declarations/backend.did";
import { useActor } from "./hooks/useActor";
import type {
  AppUser,
  Business,
  Category,
  CustomColumns,
  DeliveryRecord,
  InventoryItem,
  InwardRecord,
  InwardSavedEntry,
  PendingParcel,
  Transaction,
  TransitRecord,
} from "./types";
// ---- Type converters ----
function fromBackendRole(
  r: Role,
): "superadmin" | "admin" | "staff" | "supplier" {
  if (r === RoleEnum.admin) return "admin";
  if (r === RoleEnum.supplier) return "supplier";
  return "staff";
}
function toBackendRole(s: string): Role {
  if (s === "superadmin") return RoleEnum.admin;
  if (s === "admin") return RoleEnum.admin;
  if (s === "supplier") return RoleEnum.supplier;
  return RoleEnum.staff;
}

/** Returns true for both admin and superadmin roles */
function isAdmin(role: string): boolean {
  return role === "admin" || role === "superadmin";
}

/** Returns true for superadmin only (bypasses business scoping) */
function isSuperAdmin(role: string): boolean {
  return role === "superadmin";
}

/** Returns allowed businesses for a user */
// biome-ignore lint/correctness/noUnusedVariables: utility helper kept for future use
function getAllowedBusinessIds(
  user: { role: string; assignedBusinessIds?: string[] },
  allBusinesses: { id: string }[],
): string[] {
  if (isSuperAdmin(user.role)) return allBusinesses.map((b) => b.id);
  if (!user.assignedBusinessIds || user.assignedBusinessIds.length === 0)
    return allBusinesses.map((b) => b.id);
  return user.assignedBusinessIds;
}
function fromBackendUser(u: BackendUser): AppUser & { _backendId: string } {
  // superadmin is stored as backend #admin with "__superadmin__" marker in businessIds
  const isSuperAdminMarker = u.businessIds.includes("__superadmin__");
  const role: AppUser["role"] = isSuperAdminMarker
    ? "superadmin"
    : fromBackendRole(u.role);
  const assignedBusinessIds = u.businessIds.filter(
    (id) => id !== "__superadmin__",
  );
  return {
    _backendId: u.id,
    username: u.username,
    password: u.password,
    role,
    assignedBusinessIds,
  } as AppUser & { _backendId: string };
}
function fromBackendCategory(c: BackendCategory): Category {
  return {
    name: c.name,
    fields: c.subCategories.map((sc: BackendSubCategory) => ({
      name: sc.name,
      type: sc.fieldType as "text" | "select",
      options: sc.options.length > 0 ? sc.options : undefined,
    })),
  };
}
// ---- Transactional converters ----
function toBackendTransit(t: TransitRecord): BackendTransitEntry {
  return {
    id: String(t.id),
    biltyNumber: t.biltyNo ?? "",
    transport: t.transportName ?? "",
    supplier: t.supplierName ?? "",
    category: t.category || t.itemCategory || "",
    itemName: t.itemName ?? "",
    packages: BigInt(Number.parseInt(t.packages) || 1),
    biltyDate: t.date ?? "",
    businessId: t.businessId ?? "b1",
    enteredBy: t.addedBy ?? "",
    createdAt: t.date ? BigInt(new Date(t.date).getTime()) : BigInt(Date.now()),
  };
}
function fromBackendTransit(e: BackendTransitEntry): TransitRecord {
  return {
    id: Number.parseInt(e.id) || 0,
    biltyNo: e.biltyNumber,
    transportName: e.transport,
    supplierName: e.supplier,
    category: e.category,
    itemCategory: e.category,
    itemName: e.itemName,
    packages: String(e.packages),
    date: e.biltyDate,
    addedBy: e.enteredBy,
    businessId: e.businessId,
    customData: {},
  };
}
function toBackendQueue(p: PendingParcel): BackendQueueEntry {
  const meta = JSON.stringify({
    packages: p.packages,
    dateReceived: p.dateReceived,
    arrivalDate: p.arrivalDate,
    customData: p.customData,
    itemName: p.itemName,
    category: p.category,
    itemCategory: p.itemCategory,
    addedBy: (p as any).addedBy,
  });
  return {
    id: String(p.id),
    biltyNumber: p.biltyNo,
    transport: p.transportName,
    supplier: p.supplier || "",
    enteredBy: (p as any).addedBy || "",
    businessId: p.businessId,
    delivered: false,
    createdAt: BigInt(Date.now()),
    bales: [
      { status: "meta", baleLabel: "__meta__", itemName: meta, category: "" },
    ],
  };
}
function fromBackendQueue(e: BackendQueueEntry): PendingParcel {
  const metaBale = e.bales.find((b: QueueBale) => b.baleLabel === "__meta__");
  let meta: Record<string, any> = {};
  if (metaBale) {
    try {
      meta = JSON.parse(metaBale.itemName);
    } catch {
      /* */
    }
  }
  return {
    id: Number.parseInt(e.id) || 0,
    biltyNo: e.biltyNumber,
    transportName: e.transport,
    supplier: e.supplier,
    packages: meta.packages || "1",
    dateReceived:
      meta.dateReceived ||
      new Date(Number(e.createdAt)).toISOString().split("T")[0],
    arrivalDate: meta.arrivalDate,
    businessId: e.businessId,
    customData: meta.customData || {},
    itemName: meta.itemName,
    category: meta.category,
    itemCategory: meta.itemCategory,
  } as PendingParcel;
}
function toBackendInwardSaved(
  entry: InwardSavedEntry,
): BackendInwardSavedEntry {
  return {
    id: String(entry.id),
    biltyNumber: entry.biltyNumber,
    businessId: entry.businessId,
    supplier: entry.supplier,
    transport: entry.transporter,
    savedBy: entry.savedBy,
    savedAt: BigInt(new Date(entry.savedAt).getTime()),
    items: entry.items.map((item) => ({
      category: item.category,
      itemName: item.itemName,
      subCategory: JSON.stringify({
        attributes: item.attributes,
        godownQty: item.godownQty,
        godownBreakdown:
          item.godownBreakdown && Object.keys(item.godownBreakdown).length > 0
            ? item.godownBreakdown
            : (item as any).godownQuants &&
                Object.keys((item as any).godownQuants).length > 0
              ? (item as any).godownQuants
              : null,
      }),
      totalQty: BigInt(Math.round(item.qty || 0)),
      shopQty: BigInt(Math.round(item.shopQty || 0)),
      purchaseRate: item.purchaseRate,
      saleRate: item.saleRate,
      godownQtys: (() => {
        const breakdown =
          item.godownBreakdown && Object.keys(item.godownBreakdown).length > 0
            ? item.godownBreakdown
            : (item as any).godownQuants &&
                Object.keys((item as any).godownQuants).length > 0
              ? (item as any).godownQuants
              : null;
        if (breakdown) {
          return Object.entries(breakdown).map(([godownId, qty]) => ({
            godownId,
            qty: BigInt(Math.round(Number(qty) || 0)),
          }));
        }
        return [
          {
            godownId: "Main Godown",
            qty: BigInt(Math.round(item.godownQty || 0)),
          },
        ];
      })(),
    })),
  };
}
function fromBackendInwardSaved(e: BackendInwardSavedEntry): InwardSavedEntry {
  return {
    id: Number.parseInt(e.id) || 0,
    biltyNumber: e.biltyNumber,
    baseNumber: e.biltyNumber.replace(/X\d+\(\d+\)$/i, ""),
    packages: String(e.items.length),
    businessId: e.businessId,
    supplier: e.supplier,
    transporter: e.transport,
    savedBy: e.savedBy,
    savedAt: new Date(Number(e.savedAt)).toISOString(),
    items: e.items.map((item: InwardItem) => {
      let attrs: Record<string, string> = {};
      let godownQty = Number(item.godownQtys[0]?.qty || 0n);
      let savedGodownBreakdown: Record<string, number> | null = null;
      try {
        const m = JSON.parse(item.subCategory);
        if (m.attributes) attrs = m.attributes;
        if (m.godownQty != null) godownQty = Number(m.godownQty);
        if (m.godownBreakdown && typeof m.godownBreakdown === "object") {
          savedGodownBreakdown = m.godownBreakdown as Record<string, number>;
        }
      } catch {
        /* */
      }
      // Build godownBreakdown from godownQtys first
      const godownBreakdownFromQtys: Record<string, number> = {};
      for (const gq of item.godownQtys || []) {
        godownBreakdownFromQtys[gq.godownId] = Number(gq.qty);
      }
      // If godownQtys only has "Main Godown" (collapsed fallback) but subCategory has
      // the real multi-godown breakdown, prefer the one from subCategory
      const godownQtysKeys = Object.keys(godownBreakdownFromQtys);
      const isCollapsed =
        godownQtysKeys.length === 1 && godownQtysKeys[0] === "Main Godown";
      const godownBreakdown: Record<string, number> =
        isCollapsed &&
        savedGodownBreakdown &&
        Object.keys(savedGodownBreakdown).length > 1
          ? savedGodownBreakdown
          : godownBreakdownFromQtys;
      return {
        category: item.category,
        itemName: item.itemName,
        qty: Number(item.totalQty),
        godownQty:
          Object.values(godownBreakdown).reduce((a, b) => a + b, 0) ||
          godownQty,
        shopQty: Number(item.shopQty),
        saleRate: item.saleRate,
        purchaseRate: item.purchaseRate,
        attributes: attrs,
        godownBreakdown,
      };
    }),
  };
}
function toBackendInventory(
  item: InventoryItem,
  businessId = "",
): BackendInventoryItem {
  return {
    id: item.sku || (item as any).id || "",
    businessId: item.businessId || businessId,
    category: item.category,
    itemName: item.itemName,
    subCategory: JSON.stringify({
      ...(item.attributes || {}),
      godownBreakdown: item.godowns || {},
    }),
    shopQty: BigInt(Math.round(item.shop || 0)),
    godownQtys: Object.entries(item.godowns || {}).map(([godownId, qty]) => ({
      godownId,
      qty: BigInt(Math.round(qty || 0)),
    })),
    saleRate: item.saleRate || 0,
    purchaseRate: item.purchaseRate || 0,
  };
}
function fromBackendInventory(
  e: BackendInventoryItem,
): [string, InventoryItem] {
  let attrs: Record<string, any> = {};
  let savedGodownBreakdown: Record<string, number> | null = null;
  try {
    const parsed = JSON.parse(e.subCategory);
    const { godownBreakdown, ...rest } = parsed;
    attrs = rest;
    if (godownBreakdown && typeof godownBreakdown === "object") {
      savedGodownBreakdown = godownBreakdown as Record<string, number>;
    }
  } catch {
    /* */
  }

  // Build godowns from godownQtys
  const godownsFromQtys: Record<string, number> = Object.fromEntries(
    (e.godownQtys || []).map((g: GodownQty) => [g.godownId, Number(g.qty)]),
  );

  // Recovery: if godownQtys only has "Main Godown" but subCategory has richer breakdown, use it
  const qtysKeys = Object.keys(godownsFromQtys);
  const isCollapsed = qtysKeys.length === 1 && qtysKeys[0] === "Main Godown";
  const godowns: Record<string, number> =
    isCollapsed &&
    savedGodownBreakdown &&
    Object.keys(savedGodownBreakdown).length > 1
      ? savedGodownBreakdown
      : godownsFromQtys;

  const item: InventoryItem = {
    sku: e.id,
    category: e.category,
    itemName: e.itemName,
    attributes: attrs,
    shop: Number(e.shopQty),
    godowns,
    saleRate: e.saleRate,
    purchaseRate: e.purchaseRate,
    businessId: e.businessId,
  };
  return [e.id, item];
}
function fromBackendDelivery(e: DeliveryEntry): DeliveryRecord {
  return {
    id: e.id,
    type: e.deliveryType === "QUEUE" ? "QUEUE" : "GODOWN",
    sourceGodown: e.items[0]?.godownId || "",
    biltyNo: e.biltyNumber || undefined,
    items: e.items.map((i) => ({
      category: i.category,
      itemName: i.itemName,
      qty: Number(i.qty),
      subCategory: i.subCategory || undefined,
    })),
    customerName: e.customerName,
    customerPhone: e.customerPhone || undefined,
    deliveredBy: e.deliveredBy,
    deliveredAt: new Date(Number(e.createdAt)).toISOString(),
    businessId: e.businessId,
  };
}
function fromBackendTxRecord(e: TxRecord): Transaction {
  // e.txType from backend.ts is a TxType enum string (e.g. "sale", "inward")
  // Handle both string and object forms safely
  const txTypeRaw = e.txType as unknown;
  let txTypeName: string;
  if (typeof txTypeRaw === "string") {
    txTypeName = txTypeRaw; // enum string from backend.ts decoder
  } else if (txTypeRaw && typeof txTypeRaw === "object") {
    txTypeName = Object.keys(txTypeRaw)[0] || "inward";
  } else {
    txTypeName = "inward";
  }
  // Map camelCase variant names to UPPER_CASE used in the app
  const typeMap: Record<string, string> = {
    directStock: "DIRECT_STOCK",
    directstock: "DIRECT_STOCK",
    inward: "INWARD",
    sale: "SALE",
    transfer: "TRANSFER",
    delivery: "DELIVERY",
  };
  const resolvedType =
    typeMap[txTypeName] ??
    typeMap[txTypeName.toLowerCase()] ??
    txTypeName.toUpperCase();
  // Restore baleItemsList from subCategory JSON if present
  let baleItemsList: any[] | undefined;
  let cleanSubCategory: string | undefined = e.subCategory || undefined;
  if (e.subCategory) {
    try {
      const parsed = JSON.parse(e.subCategory);
      if (parsed._baleItems) {
        baleItemsList = parsed._baleItems;
        // Re-serialize without _baleItems for display
        const { _baleItems: _, ...rest } = parsed;
        cleanSubCategory =
          Object.keys(rest).length > 0 ? JSON.stringify(rest) : undefined;
      }
    } catch {
      /* not JSON, keep as-is */
    }
  }

  return {
    id: Number.parseInt(e.id) || Math.floor(Math.random() * 1_000_000),
    type: resolvedType,
    biltyNo: e.biltyNumber || undefined,
    businessId: e.businessId,
    date: new Date(Number(e.createdAt)).toISOString(),
    user: e.enteredBy,
    transportName: e.transport || undefined,
    itemName: e.itemName || undefined,
    category: e.category || undefined,
    notes: e.notes || undefined,
    fromLocation: e.fromLocation || undefined,
    toLocation: e.toLocation || undefined,
    subCategory: cleanSubCategory,
    itemsCount: Number(e.qty) || undefined,
    baleItemsList,
  };
}
function toBackendTxRecord(t: Transaction): TxRecord {
  const txTypeFromString = (s: string): TxRecord["txType"] => {
    const u = (s || "").toUpperCase();
    if (u === "TRANSFER") return { transfer: null };
    if (u === "DELIVERY") return { delivery: null };
    if (u === "SALE") return { sale: null };
    if (u === "DIRECTSTOCK") return { directStock: null };
    return { inward: null };
  };
  // Encode baleItemsList into subCategory JSON so it survives backend round-trip
  let subCategoryStr = t.subCategory || "";
  if ((t as any).baleItemsList && (t as any).baleItemsList.length > 0) {
    try {
      const existing = subCategoryStr ? JSON.parse(subCategoryStr) : {};
      subCategoryStr = JSON.stringify({
        ...existing,
        _baleItems: (t as any).baleItemsList,
      });
    } catch {
      subCategoryStr = JSON.stringify({ _baleItems: (t as any).baleItemsList });
    }
  }
  return {
    id: String(t.id),
    businessId: t.businessId ?? "b1",
    txType: txTypeFromString(t.type),
    biltyNumber: t.biltyNo || "",
    category: t.category || "",
    itemName: t.itemName || "",
    subCategory: subCategoryStr,
    fromLocation: t.fromLocation || "",
    toLocation: t.toLocation || "",
    transport: t.transportName || "",
    qty: BigInt((t as any).itemsCount || 0),
    rate: 0,
    enteredBy: t.user || "",
    notes: t.notes || "",
    createdAt: BigInt(new Date(t.date || Date.now()).getTime()),
  };
}
// localStorage cache helpers for offline resilience
const saveBizCache = (key: string, businessId: string, data: unknown) => {
  try {
    localStorage.setItem(`sf-${key}-${businessId}`, JSON.stringify(data));
  } catch {}
};
const loadBizCache = <T,>(key: string, businessId: string): T | null => {
  try {
    const raw = localStorage.getItem(`sf-${key}-${businessId}`);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};
class TabErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: "" };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message };
  }
  componentDidCatch(error: Error) {
    console.error("Tab render error:", error);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
          <p className="text-red-600 font-bold text-lg">
            Something went wrong loading this tab.
          </p>
          <p className="text-gray-500 text-sm">{this.state.error}</p>
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded-xl font-bold text-sm"
            type="button"
            onClick={() => this.setState({ hasError: false, error: "" })}
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const { actor } = useActor();
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [settingsSubTab, setSettingsSubTab] = useState<string | undefined>(
    undefined,
  );
  const [notification, setNotification] = useState<{
    message: string;
    type: string;
  } | null>(null);
  const [minStockThreshold, setMinStockThreshold] = useState(10);
  const [confirmDialog, setConfirmDialog] = useState<{
    message: string;
    onConfirm: () => void;
  } | null>(null);
  const [promptDialog, setPromptDialog] = useState<{
    message: string;
    defaultValue?: string;
    onConfirm: (v: string) => void;
  } | null>(null);
  const [businesses, setBusinesses] = useState<Business[]>([
    { id: "default", name: "StockFlow Default" },
  ]);
  const [activeBusinessId, setActiveBusinessId] = useState("b1");
  const [dataLoadVersion, setDataLoadVersion] = useState(0);
  const [inventory, setInventory] = useState<Record<string, InventoryItem>>({});
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [pendingParcels, setPendingParcels] = useState<PendingParcel[]>([]);
  const [transitGoods, setTransitGoods] = useState<TransitRecord[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryUnits, setCategoryUnits] = useState<
    Record<string, "pcs" | "dozen">
  >(() => {
    try {
      return JSON.parse(localStorage.getItem("categoryUnits") || "{}");
    } catch {
      return {};
    }
  });
  const [itemUnitOverrides, setItemUnitOverrides] = useState<
    Record<string, "pcs" | "dozen">
  >(() => {
    try {
      return JSON.parse(localStorage.getItem("itemUnitOverrides") || "{}");
    } catch {
      return {};
    }
  });
  useEffect(() => {
    localStorage.setItem("categoryUnits", JSON.stringify(categoryUnits));
  }, [categoryUnits]);
  useEffect(() => {
    localStorage.setItem(
      "itemUnitOverrides",
      JSON.stringify(itemUnitOverrides),
    );
  }, [itemUnitOverrides]);
  const [godowns, setGodowns] = useState<string[]>([]);
  const [biltyPrefixes, setBiltyPrefixes] = useState<string[]>([
    "sola",
    "erob",
    "cheb",
    "0",
  ]);
  const [customColumns, setCustomColumns] = useState<CustomColumns>({
    transit: [],
    warehouse: [],
    inward: [],
  });
  const [users, setUsers] = useState<AppUser[]>([
    { username: "admin", password: "password", role: "superadmin" },
    { username: "staff", password: "password", role: "staff" },
    { username: "supplier", password: "password", role: "supplier" },
  ]);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => {
    try {
      const saved = localStorage.getItem("stockflow_user");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [openingParcel, setOpeningParcel] = useState<PendingParcel | null>(
    null,
  );
  const [transportTracking, setTransportTracking] = useState<
    Record<string, string>
  >({});
  const [fieldLabels, setFieldLabels] = useState<
    Record<string, Record<string, string>>
  >({});
  const [requiredFields, setRequiredFields] = useState<
    Record<string, Record<string, boolean>>
  >({});
  const [fieldOrder, setFieldOrder] = useState<Record<string, string[]>>({});
  const [fieldTypes, setFieldTypes] = useState<
    Record<string, Record<string, "text" | "combo" | "drop">>
  >({});
  const [fieldComboOptions, setFieldComboOptions] = useState<
    Record<string, Record<string, string[]>>
  >({});
  const [customTabFields, setCustomTabFields] = useState<
    Record<string, { key: string; label: string }[]>
  >({});
  const [tabNames, setTabNames] = useState<Record<string, string>>({
    dashboard: "Inventory Hub",
    transit: "Transit Ledger",
    warehouse: "Arrival Queue",
    inward: "Inward Processing",
    opening: "Opening Stock",
    transfer: "Transfers",
    sales: "Sales",
    history: "History Log",
    inwardSaved: "Inward Saved",
    godownStock: "Godown Stock",
    analytics: "Analytics",
    delivery: "Delivery",
    salesRecord: "Sales Record",
    settings: "Admin Settings",
  });
  const [_inwardRecords, _setInwardRecords] = useState<InwardRecord[]>([]);
  const [inwardSaved, setInwardSaved] = useState<InwardSavedEntry[]>([]);
  const [thresholdExcludedItems, setThresholdExcludedItems] = useState<
    string[]
  >([]);
  const [deliveryRecords, setDeliveryRecords] = useState<DeliveryRecord[]>([]);
  const [_transfers, setTransfers] = useState<TransferEntry[]>([]);
  const [deliveredBilties, setDeliveredBilties] = useState<string[]>([]);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<string | null>(
    null,
  );
  const transactionsRef = useRef<Transaction[]>([]);
  useEffect(() => {
    transactionsRef.current = transactions;
  }, [transactions]);
  const setTransactionsWithBackend = (updaterOrArray: any) => {
    const prev = transactionsRef.current;
    const next =
      typeof updaterOrArray === "function"
        ? updaterOrArray(prev)
        : updaterOrArray;
    transactionsRef.current = next;
    setTransactions(next);
    if (!actor) return;
    const added = next.filter(
      (n: Transaction) => !prev.find((p: Transaction) => p.id === n.id),
    );
    const deleted = prev.filter(
      (p: Transaction) => !next.find((n: Transaction) => n.id === p.id),
    );
    for (const t of added)
      backendSave(
        (actor as any).addTxRecord(toBackendTxRecord(t)),
        "addTxRecord",
      );
    for (const t of deleted)
      backendSave(
        (actor as any).deleteTxRecord(String(t.id)),
        "deleteTxRecord",
      );
    const updated = next.filter((n: Transaction) => {
      const old = prev.find((p: Transaction) => p.id === n.id);
      return old && JSON.stringify(old) !== JSON.stringify(n);
    });
    for (const t of updated)
      backendSave(
        (actor as any).addTxRecord(toBackendTxRecord(t)),
        "addTxRecord",
      );
  };
  const refreshInventory = async () => {
    if (!actor) return;
    const freshInv = await (actor as any).getInventory(activeBusinessId);
    const invMap: Record<string, InventoryItem> = {};
    for (const e of freshInv as BackendInventoryItem[]) {
      const [k, v] = fromBackendInventory(e);
      invMap[k] = v;
    }
    setInventory(invMap);
  };
  const [moveToQueueData, setMoveToQueueData] = useState<TransitRecord | null>(
    null,
  );
  // Refs for tracking current state in synced setters
  const usersRef = useRef(users);
  useEffect(() => {
    usersRef.current = users;
  }, [users]);
  const businessesRef = useRef(businesses);
  useEffect(() => {
    businessesRef.current = businesses;
  }, [businesses]);
  const godownsRef = useRef(godowns);
  useEffect(() => {
    godownsRef.current = godowns;
  }, [godowns]);
  const categoriesRef = useRef(categories);
  useEffect(() => {
    categoriesRef.current = categories;
  }, [categories]);
  const biltyPrefixesRef = useRef(biltyPrefixes);
  useEffect(() => {
    biltyPrefixesRef.current = biltyPrefixes;
  }, [biltyPrefixes]);
  const transportTrackingRef = useRef(transportTracking);
  useEffect(() => {
    transportTrackingRef.current = transportTracking;
  }, [transportTracking]);
  const transitGoodsRef = useRef(transitGoods);
  useEffect(() => {
    transitGoodsRef.current = transitGoods;
  }, [transitGoods]);
  const pendingParcelsRef = useRef(pendingParcels);
  useEffect(() => {
    pendingParcelsRef.current = pendingParcels;
  }, [pendingParcels]);
  const inwardSavedRef = useRef(inwardSaved);
  useEffect(() => {
    inwardSavedRef.current = inwardSaved;
  }, [inwardSaved]);
  const inventoryRef = useRef(inventory);
  useEffect(() => {
    inventoryRef.current = inventory;
  }, [inventory]);
  const currentUserRef = useRef(currentUser);
  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);
  // Maps for backend IDs
  const godownMapRef = useRef<
    Record<string, { id: string; businessId: string }>
  >({});
  const categoryMapRef = useRef<
    Record<string, { id: string; subCategories: BackendSubCategory[] }>
  >({});
  const businessMapRef = useRef<Record<string, string>>({}); // name -> id (businesses already have id)
  const biltyPrefixIdMapRef = useRef<Record<string, string>>({}); // prefix -> id
  const transportTrackerIdMapRef = useRef<Record<string, string>>({}); // transport key -> id
  const isInitialLoadDoneRef = useRef(false);
  const activeBusinessIdRef = useRef("b1"); // always current, avoids stale closure
  const prevBusinessIdRef = useRef("b1"); // tracks last successfully loaded business
  // Shared loader: fetches all 9 business-specific data sources and sets state
  const loadBusinessData = useCallback(
    async (bizId: string): Promise<void> => {
      if (!actor) return;
      setCategories([]);
      setGodowns([]);
      let step = "fetching";
      try {
        const [
          bizGodowns,
          bizCats,
          backendTransit,
          backendQueue,
          backendInwardSaved,
          backendInventory,
          backendDeliveries,
          backendTxHistory,
          backendTransfers,
        ] = await Promise.all([
          (actor as any).getGodownsByBusiness(bizId),
          (actor as any).getCategoriesByBusiness(bizId),
          (actor as any).getTransitEntries(bizId),
          (actor as any).getQueueEntries(bizId),
          (actor as any).getInwardSaved(bizId),
          (actor as any).getInventory(bizId),
          (actor as any).getDeliveries(bizId),
          (actor as any).getTxHistory(bizId),
          (actor as any).getTransfers(bizId),
        ]);
        step = "godowns";
        godownMapRef.current = {};
        const godownNames = (bizGodowns as any[]).map((g: any) => g.name);
        setGodowns(godownNames);
        saveBizCache("godowns", bizId, godownNames);
        for (const g of bizGodowns as any[]) {
          godownMapRef.current[g.name] = { id: g.id, businessId: g.businessId };
        }
        step = "categories";
        if ((bizCats as unknown[]).length > 0) {
          const mappedCats = (bizCats as unknown[]).map(
            fromBackendCategory as (c: unknown) => Category,
          );
          setCategories(mappedCats);
          saveBizCache("categories", bizId, mappedCats);
          const newMap: Record<
            string,
            { id: string; subCategories: BackendSubCategory[] }
          > = {};
          for (const c of bizCats as BackendCategory[]) {
            newMap[c.name] = { id: c.id, subCategories: c.subCategories };
          }
          categoryMapRef.current = newMap;
        } else {
          setCategories([]);
          saveBizCache("categories", bizId, []);
          categoryMapRef.current = {};
        }
        step = "transit";
        const transitGoodsData = (
          backendTransit as BackendTransitEntry[]
        ).flatMap((e) => {
          try {
            return [fromBackendTransit(e)];
          } catch {
            return [];
          }
        });
        setTransitGoods(transitGoodsData);
        transitGoodsRef.current = transitGoodsData;
        step = "queue";
        const pendingParcelsData = (backendQueue as BackendQueueEntry[])
          .filter((e) => !e.delivered)
          .flatMap((e) => {
            try {
              return [fromBackendQueue(e)];
            } catch {
              return [];
            }
          });
        setPendingParcels(pendingParcelsData);
        pendingParcelsRef.current = pendingParcelsData;
        step = "inwardSaved";
        const inwardSavedData = (
          backendInwardSaved as BackendInwardSavedEntry[]
        ).flatMap((e) => {
          try {
            return [fromBackendInwardSaved(e)];
          } catch {
            return [];
          }
        });
        setInwardSaved(inwardSavedData);
        inwardSavedRef.current = inwardSavedData;
        step = "inventory";
        const invMap: Record<string, InventoryItem> = {};
        for (const e of backendInventory as BackendInventoryItem[]) {
          try {
            const [k, v] = fromBackendInventory(e);
            invMap[k] = v;
          } catch {
            /* skip bad record */
          }
        }
        setInventory(invMap);
        inventoryRef.current = invMap;
        step = "deliveries";
        const deliveries = (backendDeliveries as DeliveryEntry[]).flatMap(
          (e) => {
            try {
              return [fromBackendDelivery(e)];
            } catch {
              return [];
            }
          },
        );
        setDeliveryRecords(deliveries);
        setDeliveredBilties(
          deliveries
            .filter((d) => d.type === "QUEUE" && d.biltyNo)
            .map((d) => d.biltyNo as string),
        );
        step = "transactions";
        const transactionsData = (backendTxHistory as TxRecord[]).flatMap(
          (e) => {
            try {
              return [fromBackendTxRecord(e)];
            } catch {
              return [];
            }
          },
        );
        setTransactions(transactionsData);
        transactionsRef.current = transactionsData;
        step = "transfers";
        setTransfers(backendTransfers as TransferEntry[]);
        prevBusinessIdRef.current = bizId;
      } catch (e) {
        console.error("loadBusinessData failed at step:", step, e);
        const cachedCats = loadBizCache<Category[]>("categories", bizId);
        if (cachedCats && cachedCats.length > 0) {
          setCategories(cachedCats);
          categoryMapRef.current = {};
          for (const c of cachedCats) {
            categoryMapRef.current[c.name] = {
              id: (c as any).id || c.name.toLowerCase(),
              subCategories: [],
            };
          }
        } else {
          setCategories([]);
          categoryMapRef.current = {};
        }
        const cachedGodowns = loadBizCache<string[]>("godowns", bizId);
        if (cachedGodowns && cachedGodowns.length > 0) {
          setGodowns(cachedGodowns);
        } else {
          setGodowns([]);
          godownMapRef.current = {};
        }
        setNotification({
          message:
            "Could not load all data for this business. Some data shown from cache. Retry when connection improves.",
          type: "error",
        });
      }
    },
    [actor],
  );

  // Load all data from backend on actor ready (config + transactional in one pass)
  useEffect(() => {
    if (!actor) return;
    void dataLoadVersion; // trigger reload after login seeds canister
    setIsDataLoading(true);
    (async () => {
      try {
        const [backendUsers, backendBusinesses, backendTrackers] =
          await Promise.all([
            actor.getUsers(),
            actor.getBusinesses(),
            actor.getTransportTrackers(),
          ]);
        if (backendUsers.length > 0) {
          setUsers(backendUsers.map(fromBackendUser) as AppUser[]);
        }
        let resolvedBusinessId = "b1";
        if (backendBusinesses.length > 0) {
          setBusinesses(backendBusinesses);
          resolvedBusinessId = backendBusinesses[0].id;
          // For staff/admin (non-superadmin) with assigned businesses, land on their first assigned business
          const loggedInUser = currentUserRef.current;
          if (
            loggedInUser &&
            !isSuperAdmin(loggedInUser.role) &&
            loggedInUser.assignedBusinessIds &&
            loggedInUser.assignedBusinessIds.length > 0
          ) {
            const firstAssigned = backendBusinesses.find((b) =>
              loggedInUser.assignedBusinessIds!.includes(b.id),
            );
            if (firstAssigned) resolvedBusinessId = firstAssigned.id;
          }
          for (const b of backendBusinesses) {
            businessMapRef.current[b.name] = b.id;
          }
        }
        setActiveBusinessId(resolvedBusinessId);
        // Load bilty prefixes scoped to the resolved business
        try {
          const backendPrefixes =
            await actor.getBiltyPrefixesByBusiness(resolvedBusinessId);
          if (backendPrefixes.length > 0) {
            setBiltyPrefixes(backendPrefixes.map((p) => p.prefix));
            for (const p of backendPrefixes) {
              biltyPrefixIdMapRef.current[p.prefix] = p.id;
            }
          }
        } catch (_prefixErr) {
          // prefix load failure is non-critical
        }
        if (backendTrackers.length > 0) {
          setTransportTracking(
            Object.fromEntries(
              backendTrackers.map((t) => [t.transport, t.trackingUrl]),
            ),
          );
          for (const t of backendTrackers) {
            transportTrackerIdMapRef.current[t.transport] = t.id;
          }
        }
        // Load app settings (fieldLabels, requiredFields, etc.) from Motoko
        try {
          const settingsJson = await (actor as any).getAppSettings();
          if (settingsJson && settingsJson !== "{}") {
            const settings = JSON.parse(settingsJson);
            if (settings.fieldLabels) setFieldLabels(settings.fieldLabels);
            if (settings.requiredFields)
              setRequiredFields(settings.requiredFields);
            if (settings.fieldOrder) setFieldOrder(settings.fieldOrder);
            if (settings.fieldTypes) setFieldTypes(settings.fieldTypes);
            if (settings.fieldComboOptions)
              setFieldComboOptions(settings.fieldComboOptions);
          }
        } catch (_e) {
          // settings load failure is non-critical
        }
        // Load all business-specific data (godowns, categories, transactions, etc.)
        await loadBusinessData(resolvedBusinessId);
        isInitialLoadDoneRef.current = true;
        prevBusinessIdRef.current = resolvedBusinessId;
        setIsDataLoading(false);
      } catch (e) {
        isInitialLoadDoneRef.current = true;
        prevBusinessIdRef.current = "b1";
        console.error("Failed to load data from backend:", e);
        showNotification(
          `Failed to load data: ${e instanceof Error ? e.message : String(e)}`,
          "error",
        );
        setIsDataLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actor, dataLoadVersion, loadBusinessData]);
  // Reload ALL business-specific data when active business changes (after initial load)
  useEffect(() => {
    if (!actor || !activeBusinessId || !isInitialLoadDoneRef.current) return;
    loadBusinessData(activeBusinessId);
  }, [activeBusinessId, actor, loadBusinessData]);
  // Reload bilty prefixes when active business changes (after initial load)
  useEffect(() => {
    if (!actor || !activeBusinessId || !isInitialLoadDoneRef.current) return;
    actor
      .getBiltyPrefixesByBusiness(activeBusinessId)
      .then((prefixes) => {
        setBiltyPrefixes(prefixes.map((p) => p.prefix));
        for (const p of prefixes) {
          biltyPrefixIdMapRef.current[p.prefix] = p.id;
        }
      })
      .catch(() => {
        // non-critical — keep existing prefixes on failure
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBusinessId, actor]);
  // Keep ref in sync with state so setters always use current business
  useEffect(() => {
    activeBusinessIdRef.current = activeBusinessId;
  }, [activeBusinessId]);
  // Synced setters
  const setUsersWithBackend: React.Dispatch<React.SetStateAction<AppUser[]>> = (
    updater,
  ) => {
    const prev = usersRef.current;
    const next =
      typeof updater === "function"
        ? (updater as (p: AppUser[]) => AppUser[])(prev)
        : updater;
    setUsers(next);
    if (!actor) return;
    const added = next.filter(
      (u: AppUser) => !prev.find((p) => p.username === u.username),
    );
    const deleted = prev.filter(
      (p) => !next.find((u: AppUser) => u.username === p.username),
    );
    const updated = next.filter((u: AppUser) => {
      const old = prev.find((p) => p.username === u.username);
      return old && JSON.stringify(old) !== JSON.stringify(u);
    });
    for (const u of added) {
      const id = (u as any)._backendId || u.username;
      const bizIdsForAdd =
        u.role === "superadmin"
          ? [...(u.assignedBusinessIds || []), "__superadmin__"]
          : u.assignedBusinessIds || [];
      actor
        .addUser(
          id,
          u.username,
          u.password,
          toBackendRole(u.role),
          bizIdsForAdd,
        )
        .catch((_e) =>
          showNotification("Backend error: addUser failed", "error"),
        );
    }
    for (const u of deleted) {
      const backendId = (u as any)._backendId || u.username;
      backendSave(actor.deleteUser(backendId), "deleteUser");
    }
    for (const u of updated) {
      const backendId = (u as any)._backendId || u.username;
      const bizIdsForUpdate =
        u.role === "superadmin"
          ? [...(u.assignedBusinessIds || []), "__superadmin__"]
          : u.assignedBusinessIds || [];
      actor
        .updateUser(
          backendId,
          u.username,
          u.password,
          toBackendRole(u.role),
          bizIdsForUpdate,
        )
        .catch((_e) =>
          showNotification("Backend error: updateUser failed", "error"),
        );
    }
  };
  const setBusinessesWithBackend: React.Dispatch<
    React.SetStateAction<Business[]>
  > = (updater) => {
    const prev = businessesRef.current;
    const next =
      typeof updater === "function"
        ? (updater as (p: Business[]) => Business[])(prev)
        : updater;
    setBusinesses(next);
    if (!actor) return;
    const added = next.filter(
      (b: Business) => !prev.find((p) => p.id === b.id),
    );
    const deleted = prev.filter(
      (p) => !next.find((b: Business) => b.id === p.id),
    );
    const updated = next.filter((b: Business) => {
      const old = prev.find((p) => p.id === b.id);
      return old && old.name !== b.name;
    });
    for (const b of added)
      backendSave(actor.addBusiness(b.id, b.name), "addBusiness");
    for (const b of deleted)
      backendSave(actor.deleteBusiness(b.id), "deleteBusiness");
    for (const b of updated)
      backendSave(actor.updateBusiness(b.id, b.name), "updateBusiness");
  };
  const setGodownsWithBackend: React.Dispatch<
    React.SetStateAction<string[]>
  > = (updater) => {
    const prev = godownsRef.current;
    const next =
      typeof updater === "function"
        ? (updater as (p: string[]) => string[])(prev)
        : updater;
    setGodowns(next);
    saveBizCache("godowns", activeBusinessIdRef.current, next);
    if (!actor) return;
    const added = next.filter((name: string) => !prev.includes(name));
    const deleted = prev.filter((name) => !next.includes(name));
    for (const name of added) {
      const id = `${name.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`;
      godownMapRef.current[name] = {
        id,
        businessId: activeBusinessIdRef.current,
      };
      backendSave(
        actor.addGodown(id, name, activeBusinessIdRef.current),
        "addGodown",
      );
    }
    for (const name of deleted) {
      const mapping = godownMapRef.current[name];
      if (mapping) backendSave(actor.deleteGodown(mapping.id), "deleteGodown");
    }
  };
  const setCategoriesWithBackend: React.Dispatch<
    React.SetStateAction<Category[]>
  > = (updater) => {
    const prev = categoriesRef.current;
    const next =
      typeof updater === "function"
        ? (updater as (p: Category[]) => Category[])(prev)
        : updater;
    setCategories(next);
    saveBizCache("categories", activeBusinessIdRef.current, next);
    if (!actor) return;
    const added = next.filter(
      (c: Category) => !prev.find((p) => p.name === c.name),
    );
    const deleted = prev.filter(
      (p) => !next.find((c: Category) => c.name === p.name),
    );
    const updated = next.filter((c: Category) => {
      const old = prev.find((p) => p.name === c.name);
      return old && JSON.stringify(old) !== JSON.stringify(c);
    });
    for (const c of added) {
      const id = `${activeBusinessIdRef.current}-${c.name.toLowerCase().replace(/\s+/g, "-")}`;
      backendSave(
        (actor as any).addCategory(id, c.name, activeBusinessIdRef.current),
        "addCategory",
      );
      categoryMapRef.current[c.name] = { id, subCategories: [] };
      for (const f of c.fields) {
        const sc: BackendSubCategory = {
          id: f.name.toLowerCase().replace(/\s+/g, "-"),
          name: f.name,
          fieldType: f.type,
          options: f.options || [],
        };
        backendSave(actor.addSubCategory(id, sc), "addSubCategory");
      }
    }
    for (const c of deleted) {
      const mapping = categoryMapRef.current[c.name];
      // Always use business-prefixed fallback ID to prevent cross-business deletion
      const catId =
        mapping?.id ||
        `${activeBusinessIdRef.current}-${c.name.toLowerCase().replace(/\s+/g, "-")}`;
      backendSave(
        (actor as any).deleteCategory(catId, activeBusinessIdRef.current),
        "deleteCategory",
      );
    }
    for (const c of updated) {
      const mapping = categoryMapRef.current[c.name];
      const catId = mapping?.id || c.name.toLowerCase().replace(/\s+/g, "-");
      const oldSubs = mapping?.subCategories || [];
      const newSubs = c.fields.map(
        (f) =>
          ({
            id: f.name.toLowerCase().replace(/\s+/g, "-"),
            name: f.name,
            fieldType: f.type,
            options: f.options || [],
          }) as BackendSubCategory,
      );
      for (const s of oldSubs)
        backendSave(actor.deleteSubCategory(catId, s.id), "deleteSubCategory");
      for (const s of newSubs)
        backendSave(actor.addSubCategory(catId, s), "addSubCategory");
    }
  };
  const setBiltyPrefixesWithBackend: React.Dispatch<
    React.SetStateAction<string[]>
  > = (updater) => {
    const prev = biltyPrefixesRef.current;
    const next =
      typeof updater === "function"
        ? (updater as (p: string[]) => string[])(prev)
        : updater;
    setBiltyPrefixes(next);
    if (!actor) return;
    const added = next.filter((p: string) => !prev.includes(p));
    const deleted = prev.filter((p) => !next.includes(p));
    for (const p of added) {
      const id =
        biltyPrefixIdMapRef.current[p] ||
        `${activeBusinessIdRef.current}-${p}-${Date.now()}`;
      biltyPrefixIdMapRef.current[p] = id;
      backendSave(
        actor.addBiltyPrefix(id, p, activeBusinessIdRef.current),
        "addBiltyPrefix",
      );
    }
    for (const p of deleted) {
      const id = biltyPrefixIdMapRef.current[p] || p;
      backendSave(actor.deleteBiltyPrefix(id), "deleteBiltyPrefix");
    }
  };
  const setTransportTrackingWithBackend: React.Dispatch<
    React.SetStateAction<Record<string, string>>
  > = (updater) => {
    const prev = transportTrackingRef.current;
    const next =
      typeof updater === "function"
        ? (updater as (p: Record<string, string>) => Record<string, string>)(
            prev,
          )
        : updater;
    setTransportTracking(next);
    if (!actor) return;
    const prevKeys = Object.keys(prev);
    const nextKeys = Object.keys(next);
    const added = nextKeys.filter((k) => !prevKeys.includes(k));
    const deleted = prevKeys.filter((k) => !nextKeys.includes(k));
    const updated = nextKeys.filter(
      (k) => prevKeys.includes(k) && prev[k] !== next[k],
    );
    for (const k of added) {
      const id = transportTrackerIdMapRef.current[k] || k;
      backendSave(
        actor.addTransportTracker(id, k, next[k]),
        "addTransportTracker",
      );
    }
    for (const k of deleted) {
      const id = transportTrackerIdMapRef.current[k] || k;
      backendSave(actor.deleteTransportTracker(id), "deleteTransportTracker");
    }
    for (const k of updated) {
      const id = transportTrackerIdMapRef.current[k] || k;
      backendSave(
        actor.updateTransportTracker(id, k, next[k]),
        "updateTransportTracker",
      );
    }
  };
  // Backend login helper
  const loginViaBackend = actor
    ? async (username: string, password: string): Promise<AppUser | null> => {
        try {
          const result = await actor.login(username, password);
          if ("ok" in result) {
            setDataLoadVersion((v) => v + 1);
            return fromBackendUser(result.ok) as AppUser;
          }
          return null;
        } catch {
          return null;
        }
      }
    : undefined;
  useEffect(() => {
    const style = document.createElement("style");
    style.innerHTML = `
      @keyframes fadeInDown { 0% { opacity: 0; transform: translateY(-10px); } 100% { opacity: 1; transform: translateY(0); } }
      .animate-fade-in-down { animation: fadeInDown 0.3s ease-out forwards; }
      .scrollbar-hide::-webkit-scrollbar { display: none; }
      .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);
  useEffect(() => {
    if (currentUser?.role === "supplier" && activeTab !== "transit")
      setActiveTab("transit");
  }, [currentUser, activeTab]);
  // Save app settings to Motoko whenever they change
  useEffect(() => {
    if (!actor) return;
    const timer = setTimeout(() => {
      const settings = {
        fieldLabels,
        requiredFields,
        fieldOrder,
        fieldTypes,
        fieldComboOptions,
      };
      (actor as any)
        .saveAppSettings(JSON.stringify(settings))
        .catch((_e: unknown) => {
          console.warn("[StockFlow] saveAppSettings failed:", _e);
        });
    }, 1500);
    return () => clearTimeout(timer);
  }, [
    actor,
    fieldLabels,
    requiredFields,
    fieldOrder,
    fieldTypes,
    fieldComboOptions,
  ]);
  // Morning backup reminder for admin
  useEffect(() => {
    if (currentUser && isAdmin(currentUser.role)) {
      const today = new Date().toDateString();
      const lastReminder = localStorage.getItem("stockflow_backup_reminder");
      if (lastReminder !== today) {
        localStorage.setItem("stockflow_backup_reminder", today);
        setTimeout(() => {
          setNotification({
            message: "Reminder: Please download a data backup today!",
            type: "warning",
          });
          setTimeout(() => setNotification(null), 6000);
        }, 1500);
      }
    }
  }, [currentUser]);
  const showNotification = (message: string, type = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3500);
  };
  // Wrapper for backend saves — shows a persistent error notification on failure
  const backendSave = (promise: Promise<unknown>, label = "Save") => {
    promise.catch((_e) => {
      console.error(`[StockFlow] Backend ${label} failed:`, _e);
      showNotification(
        `Backend error: ${label} failed. Data may not be saved.`,
        "error",
      );
    });
  };
  const generateSku = (
    category: string,
    itemName: string,
    attributes: Record<string, string>,
    saleRate: string,
    businessId: string,
  ) => {
    const attrStr = Object.entries(attributes || {})
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([k, v]) => `${k}:${v}`)
      .join("|");
    const baseSku = btoa(
      encodeURIComponent(
        `${category}|${formatItemName(itemName)}|${attrStr}|${saleRate || 0}`,
      ),
    );
    return businessId ? `${businessId}_${baseSku}` : baseSku;
  };
  const setTransitGoodsWithBackend: React.Dispatch<
    React.SetStateAction<TransitRecord[]>
  > = (updater) => {
    const prev = transitGoodsRef.current;
    const next =
      typeof updater === "function"
        ? (updater as (p: TransitRecord[]) => TransitRecord[])(prev)
        : updater;
    transitGoodsRef.current = next;
    setTransitGoods(next);
    if (!actor) return;
    const added = next.filter((n) => !prev.find((p) => p.id === n.id));
    const deleted = prev.filter((p) => !next.find((n) => n.id === p.id));
    const updated = next.filter((n) => {
      const old = prev.find((p) => p.id === n.id);
      return old && JSON.stringify(old) !== JSON.stringify(n);
    });
    for (const t of added)
      backendSave(
        (actor as any).addTransitEntry(toBackendTransit(t)),
        "addTransitEntry",
      );
    for (const t of deleted)
      backendSave(
        (actor as any).deleteTransitEntry(String(t.id)),
        "deleteTransitEntry",
      );
    for (const t of updated)
      backendSave(
        (actor as any).updateTransitEntry(toBackendTransit(t)),
        "updateTransitEntry",
      );
  };
  const setPendingParcelsWithBackend: React.Dispatch<
    React.SetStateAction<PendingParcel[]>
  > = (updater) => {
    const prev = pendingParcelsRef.current;
    const next =
      typeof updater === "function"
        ? (updater as (p: PendingParcel[]) => PendingParcel[])(prev)
        : updater;
    pendingParcelsRef.current = next;
    setPendingParcels(next);
    if (!actor) return;
    const added = next.filter((n) => !prev.find((p) => p.id === n.id));
    const deleted = prev.filter((p) => !next.find((n) => n.id === p.id));
    const updated = next.filter((n) => {
      const old = prev.find((p) => p.id === n.id);
      return old && JSON.stringify(old) !== JSON.stringify(n);
    });
    for (const p of added)
      backendSave(
        (actor as any).addQueueEntry(toBackendQueue(p)),
        "addQueueEntry",
      );
    for (const p of deleted)
      backendSave(
        (actor as any).deleteQueueEntry(String(p.id)),
        "deleteQueueEntry",
      );
    for (const p of updated)
      backendSave(
        (actor as any).updateQueueEntry(toBackendQueue(p)),
        "updateQueueEntry",
      );
  };
  const setInwardSavedWithBackend: React.Dispatch<
    React.SetStateAction<InwardSavedEntry[]>
  > = (updater) => {
    const prev = inwardSavedRef.current;
    const next =
      typeof updater === "function"
        ? (updater as (p: InwardSavedEntry[]) => InwardSavedEntry[])(prev)
        : updater;
    inwardSavedRef.current = next;
    setInwardSaved(next);
    if (!actor) return;
    const added = next.filter((n) => !prev.find((p) => p.id === n.id));
    const deleted = prev.filter((p) => !next.find((n) => n.id === p.id));
    const updated = next.filter((n) => {
      const old = prev.find((p) => p.id === n.id);
      return old && JSON.stringify(old) !== JSON.stringify(n);
    });
    for (const e of added)
      backendSave(
        (actor as any).saveInward(toBackendInwardSaved(e)),
        "saveInward",
      );
    for (const e of deleted)
      backendSave(
        (actor as any).deleteInwardSaved(String(e.id)),
        "deleteInwardSaved",
      );
    for (const e of updated)
      backendSave(
        (actor as any).updateInwardSaved(toBackendInwardSaved(e)),
        "updateInwardSaved",
      );
  };
  const setInventoryWithBackend: React.Dispatch<
    React.SetStateAction<Record<string, InventoryItem>>
  > = (updater) => {
    const prev = inventoryRef.current;
    const next =
      typeof updater === "function"
        ? (
            updater as (
              p: Record<string, InventoryItem>,
            ) => Record<string, InventoryItem>
          )(prev)
        : updater;
    inventoryRef.current = next;
    setInventory(next);
    if (!actor) return;
    const prevKeys = Object.keys(prev);
    const nextKeys = Object.keys(next);
    const added = nextKeys.filter((k) => !prevKeys.includes(k));
    const deleted = prevKeys.filter((k) => !nextKeys.includes(k));
    const updated = nextKeys.filter(
      (k) =>
        prevKeys.includes(k) &&
        JSON.stringify(prev[k]) !== JSON.stringify(next[k]),
    );
    if (added.length === 1) {
      backendSave(
        (actor as any).addInventoryItem(
          toBackendInventory(next[added[0]], activeBusinessId),
        ),
        "addInventoryItem",
      );
    } else if (added.length > 1) {
      backendSave(
        (actor as any).batchAddInventoryItems(
          added.map((k) => toBackendInventory(next[k], activeBusinessId)),
        ),
        "batchAddInventoryItems",
      );
    }
    for (const k of deleted)
      backendSave((actor as any).deleteInventoryItem(k), "deleteInventoryItem");
    for (const k of updated)
      backendSave(
        (actor as any).updateInventoryItem(
          toBackendInventory(next[k], activeBusinessId),
        ),
        "updateInventoryItem",
      );
  };
  const updateStock = (
    sku: string,
    details: Partial<InventoryItem>,
    shopDelta: number,
    godownDelta: number,
    targetGodown = "Main Godown",
  ) => {
    setInventoryWithBackend((prev) => {
      const current: InventoryItem = prev[sku] || {
        sku,
        category: details.category || "",
        itemName: formatItemName(details.itemName || ""),
        attributes: details.attributes || {},
        shop: 0,
        godowns: {},
        saleRate: details.saleRate || 0,
        purchaseRate: details.purchaseRate || 0,
        businessId: activeBusinessId,
      };
      const nextGodowns = { ...current.godowns };
      nextGodowns[targetGodown] =
        (Number(nextGodowns[targetGodown]) || 0) + Number(godownDelta);
      return {
        ...prev,
        [sku]: {
          ...current,
          businessId: current.businessId || activeBusinessId,
          shop: (Number(current.shop) || 0) + Number(shopDelta),
          godowns: nextGodowns,
          saleRate: details.saleRate ?? current.saleRate,
          purchaseRate: details.purchaseRate ?? current.purchaseRate,
        },
      };
    });
  };
  // Batch inventory update for inward save — applies ALL items in one backend call
  // with ONE index rebuild instead of N separate calls. Used only by InwardTab.doFinalSave.
  // React state is updated in one pass; backend gets a single batchSaveInwardItems call.
  const batchUpdateStockForInward = (baleItems: any[]) => {
    if (!baleItems || baleItems.length === 0) return;
    setInventory((prev) => {
      const next = { ...prev };
      const backendItems: InwardItem[] = [];
      for (const item of baleItems) {
        const shopQty = Number(item.shopQty) || 0;
        const godownEntries = Object.entries(item.godownQuants || {}) as [
          string,
          string | number,
        ][];
        const sku = item.sku;
        const current: InventoryItem = prev[sku] || {
          sku,
          category: item.category || "",
          itemName: formatItemName(item.itemName || ""),
          attributes: item.attributes || {},
          shop: 0,
          godowns: {},
          saleRate: Number(item.saleRate) || 0,
          purchaseRate: Number(item.purchaseRate) || 0,
          businessId: activeBusinessId,
        };
        const nextGodowns = { ...current.godowns };
        for (const [g, q] of godownEntries) {
          nextGodowns[g] = (Number(nextGodowns[g]) || 0) + (Number(q) || 0);
        }
        next[sku] = {
          ...current,
          businessId: current.businessId || activeBusinessId,
          shop: (Number(current.shop) || 0) + shopQty,
          godowns: nextGodowns,
          saleRate: Number(item.saleRate) ?? current.saleRate,
          purchaseRate: Number(item.purchaseRate) ?? current.purchaseRate,
        };
        // Build backend InwardItem for batchSaveInwardItems
        backendItems.push({
          category: item.category || "",
          itemName: item.itemName || "",
          subCategory: JSON.stringify({
            ...(item.attributes || {}),
            godownBreakdown: Object.fromEntries(
              godownEntries.map(([g, q]) => [g, Number(q) || 0]),
            ),
          }),
          totalQty: BigInt(
            Math.round(
              shopQty +
                godownEntries.reduce((a, [, q]) => a + (Number(q) || 0), 0),
            ),
          ),
          shopQty: BigInt(Math.round(shopQty)),
          godownQtys: godownEntries.map(([godownId, qty]) => ({
            godownId,
            qty: BigInt(Math.round(Number(qty) || 0)),
          })),
          purchaseRate: Number(item.purchaseRate) || 0,
          saleRate: Number(item.saleRate) || 0,
        } as InwardItem);
      }
      // Fire one backend call for all items — one index rebuild total
      if (actor && backendItems.length > 0) {
        (actor as any)
          .batchSaveInwardItems(activeBusinessId, backendItems)
          .catch((e: any) => {
            console.warn("[batchUpdateStockForInward] backend error:", e);
          });
      }
      return next;
    });
  };
  const exportDatabase = async () => {
    showNotification("Preparing backup — fetching latest data...", "info");
    let freshInventory = inventory;
    let freshTransactions = transactions;
    let freshTransitGoods = transitGoods;
    let freshCategories = categories;
    let freshGodowns: Array<{ name: string; businessId: string }> | string[] =
      godowns.map((name) => ({ name, businessId: activeBusinessId }));
    let freshUsers = users;
    let freshBusinesses = businesses;
    let freshBiltyPrefixes = biltyPrefixes;
    let freshInwardSaved: InwardSavedEntry[] = inwardSaved;
    let freshPendingParcels: PendingParcel[] = pendingParcels;
    let freshDeliveryRecords: DeliveryRecord[] = deliveryRecords;
    if (actor) {
      try {
        // Backup is scoped to the active business for transactional data.
        // Admin/global data (users, businesses, godowns, categories) is still exported in full
        // so the backup is self-contained and can restore correctly.
        const allBusinessIds = [activeBusinessId];
        const [
          backendUsers,
          backendBusinessesFresh,
          backendGodowns,
          backendPrefixes,
          ...perBusinessResults
        ] = await Promise.all([
          actor.getUsers(),
          actor.getBusinesses(),
          actor.getGodowns(),
          actor.getBiltyPrefixes(),
          ...allBusinessIds.flatMap((bId) => [
            (actor as any).getInventory(bId),
            (actor as any).getTxHistory(bId),
            (actor as any).getTransitEntries(bId),
          ]),
        ]);
        freshUsers = backendUsers.map(fromBackendUser) as AppUser[];
        freshBusinesses = backendBusinessesFresh.map((b: any) => ({
          id: b.id,
          name: b.name,
          description: b.description ?? "",
        }));
        freshGodowns = backendGodowns.map((g: any) => ({
          id: g.id,
          name: g.name,
          businessId: g.businessId || "b1",
        }));
        freshBiltyPrefixes = backendPrefixes.map((p: any) => p.prefix);
        // Fetch categories per business to preserve businessId
        const allCatsPerBusiness = await Promise.all(
          allBusinessIds.map((bId) =>
            (actor as any).getCategoriesByBusiness(bId),
          ),
        );
        freshCategories = allCatsPerBusiness.flatMap((cats: any[], i) =>
          (cats as BackendCategory[]).map((c) => ({
            ...fromBackendCategory(c),
            businessId: allBusinessIds[i],
          })),
        );
        const invMap: Record<string, InventoryItem> = {};
        freshTransactions = [];
        freshTransitGoods = [];
        for (let i = 0; i < allBusinessIds.length; i++) {
          const inv = perBusinessResults[i * 3] as any[];
          const txs = perBusinessResults[i * 3 + 1] as any[];
          const transit = perBusinessResults[i * 3 + 2] as any[];
          for (const item of inv) {
            const [ik, iv] = fromBackendInventory(item as BackendInventoryItem);
            invMap[ik] = iv;
          }
          freshTransactions = [
            ...freshTransactions,
            ...txs.map(fromBackendTxRecord),
          ];
          freshTransitGoods = [
            ...freshTransitGoods,
            ...transit.map(fromBackendTransit),
          ];
        }
        freshInventory = invMap;
        // Fetch inwardSaved from backend
        freshInwardSaved = [];
        const inwardSavedResults = await Promise.all(
          allBusinessIds.map((bId) => (actor as any).getInwardSaved(bId)),
        );
        for (const result of inwardSavedResults) {
          freshInwardSaved = [
            ...freshInwardSaved,
            ...(result as BackendInwardSavedEntry[]).map(
              fromBackendInwardSaved,
            ),
          ];
        }
        // FIX: Fetch pendingParcels (queue entries) from backend — not from React state
        // which could be stale if the user loaded the page on a different business.
        freshPendingParcels = [];
        const queueResults = await Promise.all(
          allBusinessIds.map((bId) => (actor as any).getQueueEntries(bId)),
        );
        for (const result of queueResults) {
          freshPendingParcels = [
            ...freshPendingParcels,
            ...(result as any[])
              .filter((e) => !e.delivered)
              .flatMap((e) => {
                try {
                  return [fromBackendQueue(e)];
                } catch {
                  return [];
                }
              }),
          ];
        }
        // Fetch deliveryRecords from backend (avoids stale React state)
        freshDeliveryRecords = [];
        const deliveryResults = await Promise.all(
          allBusinessIds.map((bId) => (actor as any).getDeliveries(bId)),
        );
        for (const result of deliveryResults) {
          freshDeliveryRecords = [
            ...freshDeliveryRecords,
            ...(result as DeliveryEntry[]).flatMap((e) => {
              try {
                return [fromBackendDelivery(e)];
              } catch {
                return [];
              }
            }),
          ];
        }
      } catch (_err) {
        showNotification(
          "Could not fetch latest backend data — using cached state for backup",
          "error",
        );
      }
    }
    const data = {
      inventory: freshInventory,
      transactions: freshTransactions,
      pendingParcels: freshPendingParcels,
      transitGoods: freshTransitGoods,
      fieldLabels,
      requiredFields,
      fieldOrder,
      fieldTypes,
      fieldComboOptions,
      categories: freshCategories,
      godowns: freshGodowns,
      biltyPrefixes: freshBiltyPrefixes,
      customColumns,
      users: freshUsers,
      minStockThreshold,
      businesses: freshBusinesses,
      activeBusinessId,
      deliveryRecords: freshDeliveryRecords,
      exportedAt: new Date().toISOString(),
      appVersion: "StockFlow Pro",
      inwardSaved: freshInwardSaved,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    const activeBizName =
      businesses.find((b) => b.id === activeBusinessId)?.name ||
      activeBusinessId;
    link.download = `StockFlow_Backup_${activeBizName.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    showNotification("Backup downloaded successfully");
  };
  const onResetAllData = async () => {
    if (!actor) return;
    // Fix: scope reset to active business ONLY — do not touch other businesses
    const bizId = activeBusinessId;
    const [transit, queue, inward, deliveries, txs, sales, inv] =
      await Promise.all([
        (actor as any).getTransitEntries(bizId) as Promise<any[]>,
        (actor as any).getQueueEntries(bizId) as Promise<any[]>,
        (actor as any).getInwardSaved(bizId) as Promise<any[]>,
        (actor as any).getDeliveries(bizId) as Promise<any[]>,
        (actor as any).getTxHistory(bizId) as Promise<any[]>,
        (actor as any).getSales(bizId) as Promise<any[]>,
        (actor as any).getInventory(bizId) as Promise<any[]>,
      ]);
    // Sequential deletes — avoids IC ingress rate-limit rejections from simultaneous calls
    for (const e of transit)
      await (actor as any).deleteTransitEntry(e.id).catch(() => {});
    for (const e of queue)
      await (actor as any).deleteQueueEntry(String(e.id)).catch(() => {});
    for (const e of inward)
      await (actor as any).deleteInwardSaved(e.id).catch(() => {});
    for (const e of deliveries)
      await (actor as any).deleteDelivery(e.id).catch(() => {});
    for (const e of txs)
      await (actor as any).deleteTxRecord(e.id).catch(() => {});
    for (const e of sales)
      await (actor as any).deleteSale(e.id).catch(() => {});
    for (const e of inv)
      await (actor as any).deleteInventoryItem(e.id).catch(() => {});
  };

  const importDatabase = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = JSON.parse(evt.target?.result as string);
        // 1. Restore local state immediately
        if (data.inventory) setInventory(data.inventory);
        if (data.transactions) setTransactions(data.transactions);
        if (data.pendingParcels) setPendingParcels(data.pendingParcels);
        if (data.transitGoods) setTransitGoods(data.transitGoods);
        if (data.fieldLabels) setFieldLabels(data.fieldLabels);
        if (data.requiredFields) setRequiredFields(data.requiredFields);
        if (data.fieldOrder) setFieldOrder(data.fieldOrder);
        if (data.fieldTypes) setFieldTypes(data.fieldTypes);
        if (data.fieldComboOptions)
          setFieldComboOptions(data.fieldComboOptions);
        if (data.customColumns) setCustomColumns(data.customColumns);
        if (data.categories) setCategories(data.categories);
        if (data.users) setUsers(data.users);
        if (data.businesses) setBusinesses(data.businesses);
        if (data.biltyPrefixes)
          setBiltyPrefixes(data.biltyPrefixes as string[]);
        if (data.activeBusinessId) setActiveBusinessId(data.activeBusinessId);
        if (data.deliveryRecords) setDeliveryRecords(data.deliveryRecords);
        if (data.inwardSaved)
          setInwardSaved(data.inwardSaved as InwardSavedEntry[]);
        if (!actor) {
          showNotification(
            "System Restore Complete (local only — reconnect to sync backend)",
          );
          return;
        }
        showNotification("Syncing restore to backend — please wait...", "info");
        const restoreBizId =
          (data.activeBusinessId as string) || activeBusinessId;

        // 2. Save app settings (non-critical)
        try {
          const settings = {
            fieldLabels: data.fieldLabels || {},
            requiredFields: data.requiredFields || {},
            fieldOrder: data.fieldOrder || {},
            fieldTypes: data.fieldTypes || {},
            fieldComboOptions: data.fieldComboOptions || {},
          };
          await (actor as any).saveAppSettings(JSON.stringify(settings));
        } catch (settErr) {
          console.warn("Settings restore failed (non-critical):", settErr);
        }

        // 2b. Restore users sequentially (non-critical)
        try {
          if (data.users && Array.isArray(data.users)) {
            // Only upsert users from the backup — do NOT delete other users
            for (const u of data.users as AppUser[]) {
              const uid = (u as any)._backendId || u.username;
              const bizIdsForRestore =
                u.role === "superadmin"
                  ? [...(u.assignedBusinessIds || []), "__superadmin__"]
                  : u.assignedBusinessIds || [];
              await actor
                .addUser(
                  uid,
                  u.username,
                  u.password,
                  toBackendRole(u.role),
                  bizIdsForRestore,
                )
                .catch(() => {});
            }
          }
        } catch (usrErr) {
          console.warn("Users restore failed (non-critical):", usrErr);
        }

        // 2c. Restore businesses sequentially (non-critical)
        try {
          if (data.businesses && Array.isArray(data.businesses)) {
            // Only upsert businesses from the backup — do NOT delete other businesses
            for (const b of data.businesses as Business[]) {
              await actor.addBusiness(b.id, b.name).catch(() => {});
            }
          }
        } catch (bizErr) {
          console.warn("Businesses restore failed (non-critical):", bizErr);
        }

        // 2d. Restore bilty prefixes sequentially (non-critical)
        try {
          if (data.biltyPrefixes && Array.isArray(data.biltyPrefixes)) {
            // Only add prefixes from the backup — do NOT delete existing prefixes
            // Pass businessId from backup record if available, otherwise use restoreBizId
            for (const prefix of data.biltyPrefixes as (
              | string
              | { id?: string; prefix?: string; businessId?: string }
            )[]) {
              const prefixStr =
                typeof prefix === "string"
                  ? prefix
                  : prefix.prefix || (prefix as unknown as string);
              const prefixId =
                typeof prefix === "object" && prefix.id ? prefix.id : prefixStr;
              const prefixBizId =
                typeof prefix === "object" && prefix.businessId
                  ? prefix.businessId
                  : restoreBizId;
              await actor
                .addBiltyPrefix(prefixId, prefixStr, prefixBizId)
                .catch(() => {});
            }
          }
        } catch (prefErr) {
          console.warn(
            "Bilty prefixes restore failed (non-critical):",
            prefErr,
          );
        }

        // bizIds: business IDs from the backup file — used for scoped delete + write
        const bizIds: string[] = (data.businesses || businesses).map(
          (b: any) => b.id || b,
        );

        // 3. Clear & restore categories sequentially (non-critical)
        try {
          // Only delete categories belonging to the backup's business IDs
          const existingCats = (
            await Promise.all(
              bizIds.map((bId: string) =>
                (actor as any).getCategoriesByBusiness(bId),
              ),
            )
          ).flat();
          for (const c of existingCats) {
            await (actor as any).deleteCategoryGlobal(c.id).catch(() => {});
          }
          if (data.categories) {
            for (const cat of data.categories as Category[]) {
              const catBizId = (cat as any).businessId || restoreBizId;
              const catId = `${catBizId}-${cat.name.toLowerCase().replace(/\s+/g, "-")}`;
              await (actor as any)
                .addCategory(catId, cat.name, catBizId)
                .catch(() => {});
              for (const f of cat.fields) {
                await (actor as any)
                  .addSubCategory(catId, {
                    id: f.name.toLowerCase().replace(/\s+/g, "-"),
                    name: f.name,
                    fieldType: f.type,
                    options: f.options || [],
                  })
                  .catch(() => {});
              }
            }
          }
        } catch (catErr) {
          console.warn(
            "Categories restore partial failure (non-critical):",
            catErr,
          );
        }

        // 4. Clear & restore inventory sequentially
        try {
          const allBizIdsForInv: string[] =
            data.businesses && Array.isArray(data.businesses)
              ? (data.businesses as any[]).map((b: any) => b.id || b)
              : businesses.map((b) => b.id);
          // Reads can stay parallel — queries are not rate-limited
          const existingInvItems = (
            await Promise.all(
              allBizIdsForInv.map((bId: string) =>
                (actor as any).getInventory(bId),
              ),
            )
          ).flat();
          // Writes must be sequential
          for (const item of existingInvItems) {
            await (actor as any)
              .deleteInventoryItem((item as any).id)
              .catch(() => {});
          }
          if (data.inventory) {
            for (const item of Object.values(
              data.inventory as Record<string, InventoryItem>,
            )) {
              await (actor as any)
                .addInventoryItem(toBackendInventory(item, restoreBizId))
                .catch(() => {});
            }
          }
        } catch (invErr) {
          console.warn("Inventory restore partial failure:", invErr);
        }

        // 5. Clear & restore transit entries sequentially
        try {
          const existingTransit = (
            await Promise.all(
              bizIds.map((bId: string) =>
                (actor as any).getTransitEntries(bId),
              ),
            )
          ).flat();
          for (const e of existingTransit) {
            await (actor as any)
              .deleteTransitEntry((e as any).id)
              .catch(() => {});
          }
          if (data.transitGoods) {
            for (const t of data.transitGoods as TransitRecord[]) {
              await (actor as any)
                .addTransitEntry(toBackendTransit(t))
                .catch(() => {});
            }
          }
        } catch (transitErr) {
          console.warn("Transit restore partial failure:", transitErr);
        }

        // 6. Clear & restore transaction history sequentially
        try {
          const existingTxs = (
            await Promise.all(
              bizIds.map((bId: string) => (actor as any).getTxHistory(bId)),
            )
          ).flat();
          for (const t of existingTxs) {
            await (actor as any).deleteTxRecord((t as any).id).catch(() => {});
          }
          if (data.transactions) {
            for (const t of data.transactions as Transaction[]) {
              await (actor as any)
                .addTxRecord(toBackendTxRecord(t))
                .catch(() => {});
            }
          }
        } catch (txErr) {
          console.warn("Transaction history restore partial failure:", txErr);
        }

        // 7. Clear & restore queue entries sequentially
        try {
          const existingQueue = (
            await Promise.all(
              bizIds.map((bId: string) => (actor as any).getQueueEntries(bId)),
            )
          ).flat();
          for (const e of existingQueue) {
            await (actor as any)
              .deleteQueueEntry(String((e as any).id))
              .catch(() => {});
          }
          if (data.pendingParcels) {
            for (const p of data.pendingParcels as PendingParcel[]) {
              // Use restoreQueueEntry (not addQueueEntry) to avoid the side effect
              // in addQueueEntry that deletes transit entries with matching biltyNumber
              await (actor as any)
                .restoreQueueEntry(toBackendQueue(p))
                .catch(() => {});
            }
          }
        } catch (queueErr) {
          console.warn("Queue restore partial failure:", queueErr);
        }

        // 7b. Clear & restore inward saved sequentially
        try {
          const existingInward = (
            await Promise.all(
              bizIds.map((bId: string) => (actor as any).getInwardSaved(bId)),
            )
          ).flat();
          for (const e of existingInward) {
            await (actor as any)
              .deleteInwardSaved((e as any).id)
              .catch(() => {});
          }
          if (
            data.inwardSaved &&
            (data.inwardSaved as InwardSavedEntry[]).length > 0
          ) {
            for (const e of data.inwardSaved as InwardSavedEntry[]) {
              await (actor as any)
                .restoreInward(toBackendInwardSaved(e))
                .catch(() => {});
            }
          }
        } catch (inwardErr) {
          console.warn("Inward saved restore partial failure:", inwardErr);
        }

        // 8. Restore godowns sequentially (non-critical)
        try {
          if (
            data.godowns &&
            Array.isArray(data.godowns) &&
            (data.godowns as any[]).length > 0
          ) {
            // Only delete godowns belonging to the backup's business IDs
            const allGodownsRaw = await (actor as any).getGodowns();
            const existingGodownsAll = (allGodownsRaw as any[]).filter(
              (g: any) => bizIds.includes(g.businessId || ""),
            );
            for (const g of existingGodownsAll) {
              await (actor as any).deleteGodown((g as any).id).catch(() => {});
            }
            let gIdx = 0;
            for (const godown of data.godowns as any[]) {
              const name = typeof godown === "string" ? godown : godown.name;
              const bizId =
                typeof godown === "string"
                  ? restoreBizId
                  : godown.businessId || restoreBizId;
              const id =
                (godown as any).id ||
                `${name.toLowerCase().replace(/\s+/g, "-")}-${bizId}-${gIdx}`;
              await (actor as any).addGodown(id, name, bizId).catch(() => {});
              gIdx++;
            }
          }
        } catch (gdErr) {
          console.warn(
            "Godowns restore partial failure (non-critical):",
            gdErr,
          );
        }

        // 9. Clear & restore delivery records sequentially (non-critical)
        try {
          // Use bizIds (ALL biz IDs in canister) for deletion so orphaned
          // deliveries from previous restores with different biz IDs are also cleared.
          const existingDeliveries = (
            await Promise.all(
              bizIds.map((bId: string) => (actor as any).getDeliveries(bId)),
            )
          ).flat();
          for (const d of existingDeliveries) {
            await (actor as any).deleteDelivery((d as any).id).catch(() => {});
          }
          if (
            data.deliveryRecords &&
            (data.deliveryRecords as any[]).length > 0
          ) {
            for (const r of data.deliveryRecords as any[]) {
              await (actor as any)
                .restoreDelivery({
                  id: r.id || `del-${Date.now()}-${Math.random()}`,
                  deliveryType: r.type === "QUEUE" ? "QUEUE" : "GODOWN",
                  biltyNumber: r.biltyNo || "",
                  items: (r.items || []).map((i: any) => ({
                    category: i.category || "",
                    itemName: i.itemName || "",
                    qty: BigInt(i.qty || 0),
                    subCategory: i.subCategory || "",
                    godownId: r.sourceGodown || i.godownId || "",
                  })),
                  customerName: r.customerName || "",
                  customerPhone: r.customerPhone || "",
                  deliveredBy: r.deliveredBy || "",
                  createdAt: r.deliveredAt
                    ? BigInt(new Date(r.deliveredAt).getTime())
                    : BigInt(Date.now()),
                  businessId: r.businessId || restoreBizId,
                })
                .catch(() => {});
            }
          }
        } catch (delErr) {
          console.warn(
            "Deliveries restore partial failure (non-critical):",
            delErr,
          );
        }

        // 10. Clear & restore sales records sequentially (non-critical)
        try {
          // Use bizIds (ALL biz IDs in canister) for deletion so orphaned
          // sales from previous restores with different biz IDs are also cleared.
          const existingSalesForRestore = (
            await Promise.all(
              bizIds.map((bId: string) => (actor as any).getSales(bId)),
            )
          ).flat();
          for (const s of existingSalesForRestore) {
            await (actor as any).deleteSale((s as any).id).catch(() => {});
          }
          if (data.transactions && Array.isArray(data.transactions)) {
            const saleTxns = (data.transactions as Transaction[]).filter(
              (t) => t.type === "SALE",
            );
            for (const t of saleTxns) {
              await (actor as any)
                .restoreSale({
                  id:
                    t.id != null
                      ? String(t.id)
                      : `sale-${Date.now()}-${Math.random()}`,
                  businessId: (t as any).businessId || restoreBizId,
                  items: [
                    {
                      category: t.category || "",
                      itemName: t.itemName || "",
                      subCategory: (t as any).subCategory || "",
                      qty: BigInt(t.itemsCount ?? 0),
                      rate: Number((t as any).rate ?? 0),
                    },
                  ],
                  recordedBy: t.user || "",
                  createdAt: t.date
                    ? BigInt(new Date(t.date).getTime())
                    : BigInt(Date.now()),
                })
                .catch(() => {});
            }
          }
        } catch (salesErr) {
          console.warn(
            "Sales restore partial failure (non-critical):",
            salesErr,
          );
        }

        showNotification(
          "System Restore Complete — all data synced to backend",
        );
        activeBusinessIdRef.current = restoreBizId;
        try {
          await loadBusinessData(restoreBizId);
        } catch (_) {
          // non-critical — data was restored but re-fetch failed
        }
      } catch (err) {
        console.error("Restore error:", err);
        showNotification(
          `Restore failed: ${err instanceof Error ? err.message : String(err)}`,
          "error",
        );
      }
    };
    reader.readAsText(file);
  };
  const allSuppliers = useMemo(() => {
    const fromTransit = transitGoods
      .filter((r) => r.businessId === activeBusinessId)
      .map((r) => r.supplierName);
    const fromQueue = pendingParcels
      .filter((r) => !r.businessId || r.businessId === activeBusinessId)
      .map((r) => r.supplier);
    const fromTxns = transactions
      .filter((r) => r.businessId === activeBusinessId)
      .map((r) => (r as any).supplier || (r as any).supplierName || "")
      .filter(Boolean);
    const all = [...new Set([...fromTransit, ...fromQueue, ...fromTxns])]
      .filter(Boolean)
      .sort();
    if (currentUser?.role === "supplier") {
      const mine = new Set(
        [
          ...transitGoods
            .filter(
              (r) =>
                r.addedBy === currentUser.username &&
                r.businessId === activeBusinessId,
            )
            .map((r) => r.supplierName),
          ...pendingParcels
            .filter(
              (r) =>
                (r as any).addedBy === currentUser.username &&
                (!r.businessId || r.businessId === activeBusinessId),
            )
            .map((r) => r.supplier),
        ].filter(Boolean) as string[],
      );
      return all.filter((s) => mine.has(s));
    }
    return all;
  }, [
    transitGoods,
    pendingParcels,
    transactions,
    activeBusinessId,
    currentUser,
  ]);
  const allTransporters = useMemo(() => {
    const fromTransit = transitGoods
      .filter((r) => r.businessId === activeBusinessId)
      .map((r) => r.transportName);
    const fromQueue = pendingParcels
      .filter((r) => !r.businessId || r.businessId === activeBusinessId)
      .map((r) => r.transportName);
    const fromTxns = transactions
      .filter((r) => r.businessId === activeBusinessId)
      .map((r) => (r as any).transportName || "")
      .filter(Boolean);
    const all = [...new Set([...fromTransit, ...fromQueue, ...fromTxns])]
      .filter(Boolean)
      .sort();
    if (currentUser?.role === "supplier") {
      const mine = new Set(
        [
          ...transitGoods
            .filter(
              (r) =>
                r.addedBy === currentUser.username &&
                r.businessId === activeBusinessId,
            )
            .map((r) => r.transportName),
          ...pendingParcels
            .filter(
              (r) =>
                (r as any).addedBy === currentUser.username &&
                (!r.businessId || r.businessId === activeBusinessId),
            )
            .map((r) => r.transportName),
        ].filter(Boolean) as string[],
      );
      return all.filter((t) => mine.has(t));
    }
    return all;
  }, [
    transitGoods,
    pendingParcels,
    transactions,
    activeBusinessId,
    currentUser,
  ]);
  if (
    (!currentUser && !actor) ||
    (currentUser && !actor) ||
    (currentUser && isDataLoading)
  )
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 font-bold text-sm uppercase tracking-widest">
            {isDataLoading ? "Loading data..." : "Connecting..."}
          </p>
        </div>
      </div>
    );
  if (!currentUser)
    return (
      <>
        <LoginScreen
          users={users}
          onLogin={setCurrentUser}
          showNotification={showNotification}
          loginViaBackend={loginViaBackend}
        />
        {notification && (
          <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-2 px-6 py-4 rounded-3xl shadow-2xl animate-fade-in-down w-[90%] max-w-sm text-white font-black uppercase text-[10px] tracking-widest bg-gray-900 border border-gray-700">
            {notification.type === "success" ? (
              <CheckCircle className="text-green-400" />
            ) : (
              <AlertCircle className="text-red-400" />
            )}
            {notification.message}
          </div>
        )}
      </>
    );
  const activeBusiness =
    businesses.find((b) => b.id === activeBusinessId) || businesses[0];
  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 font-sans pb-24 md:pb-0 md:pl-64 flex flex-col">
      {/* Mobile Header */}
      <header className="md:hidden bg-white border-b p-4 flex justify-between items-center sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="bg-blue-600 p-1.5 rounded-lg text-white shadow-md">
            <Package size={18} />
          </div>
          <div className="flex flex-col">
            <h1 className="font-black uppercase tracking-tighter text-sm leading-none">
              StockFlow
            </h1>
            <span className="text-[8px] font-bold text-gray-500 uppercase tracking-widest">
              {activeBusiness?.name}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {businesses.filter((b) => {
            if (isSuperAdmin(currentUser.role)) return true;
            if (
              !currentUser.assignedBusinessIds ||
              currentUser.assignedBusinessIds.length === 0
            )
              return true;
            return currentUser.assignedBusinessIds.includes(b.id);
          }).length > 1 && (
            <select
              value={activeBusinessId}
              onChange={(e) => setActiveBusinessId(e.target.value)}
              className="border rounded-lg p-1.5 text-[10px] font-bold bg-white outline-none focus:ring-2 focus:ring-blue-500 max-w-[110px]"
            >
              {businesses
                .filter((b) => {
                  if (isSuperAdmin(currentUser.role)) return true;
                  if (
                    !currentUser.assignedBusinessIds ||
                    currentUser.assignedBusinessIds.length === 0
                  )
                    return true;
                  return currentUser.assignedBusinessIds.includes(b.id);
                })
                .map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
            </select>
          )}
          <button
            type="button"
            onClick={() => {
              localStorage.removeItem("stockflow_user");
              setCurrentUser(null);
            }}
            className="text-gray-400 hover:text-red-500 transition-colors"
          >
            <LogOut size={20} />
          </button>
        </div>
      </header>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r h-screen fixed left-0 top-0 shadow-sm z-20">
        <div className="p-8 border-b">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-2xl text-white shadow-xl shadow-blue-100">
              <Package size={24} />
            </div>
            <h1 className="font-black uppercase tracking-tighter text-lg leading-none">
              Stock
              <br />
              <span className="text-blue-600">Flow</span>
            </h1>
          </div>
        </div>
        <div className="px-6 py-4 border-b bg-gray-50/50">
          <p className="text-[9px] font-black uppercase text-gray-400 tracking-widest block mb-1">
            Business Profile
          </p>
          <select
            value={activeBusinessId}
            onChange={(e) => setActiveBusinessId(e.target.value)}
            className="w-full border rounded-xl p-2 text-xs font-bold bg-white outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
          >
            {businesses
              .filter((b) => {
                if (isSuperAdmin(currentUser.role)) return true;
                if (
                  !currentUser.assignedBusinessIds ||
                  currentUser.assignedBusinessIds.length === 0
                )
                  return true;
                return currentUser.assignedBusinessIds.includes(b.id);
              })
              .map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
          </select>
        </div>
        <nav className="flex-1 p-5 space-y-2 overflow-y-auto scrollbar-hide">
          {currentUser.role !== "supplier" && (
            <SidebarButton
              active={activeTab === "dashboard"}
              onClick={() => setActiveTab("dashboard")}
              icon={LayoutDashboard}
              label={tabNames.dashboard}
            />
          )}
          <SidebarButton
            active={activeTab === "transit"}
            onClick={() => setActiveTab("transit")}
            icon={Navigation}
            label={tabNames.transit}
          />
          {currentUser.role !== "supplier" && (
            <>
              <SidebarButton
                active={activeTab === "warehouse"}
                onClick={() => setActiveTab("warehouse")}
                icon={Warehouse}
                label={tabNames.warehouse}
              />
              <SidebarButton
                active={activeTab === "inward"}
                onClick={() => setActiveTab("inward")}
                icon={PlusCircle}
                label={tabNames.inward}
              />
              {isAdmin(currentUser.role) && (
                <SidebarButton
                  active={activeTab === "opening"}
                  onClick={() => setActiveTab("opening")}
                  icon={PackagePlus}
                  label={tabNames.opening}
                />
              )}
              <SidebarButton
                active={activeTab === "transfer"}
                onClick={() => setActiveTab("transfer")}
                icon={ArrowRightLeft}
                label={tabNames.transfer}
              />
              {isAdmin(currentUser.role) && (
                <SidebarButton
                  active={activeTab === "sales"}
                  onClick={() => setActiveTab("sales")}
                  icon={ShoppingCart}
                  label={tabNames.sales}
                />
              )}
              {isAdmin(currentUser.role) && (
                <SidebarButton
                  active={activeTab === "salesRecord"}
                  onClick={() => setActiveTab("salesRecord")}
                  icon={Receipt}
                  label={tabNames.salesRecord || "Sales Record"}
                />
              )}
              <SidebarButton
                active={activeTab === "delivery"}
                onClick={() => setActiveTab("delivery")}
                icon={Truck}
                label={tabNames.delivery || "Delivery"}
              />
              <SidebarButton
                active={activeTab === "history"}
                onClick={() => setActiveTab("history")}
                icon={History}
                label={tabNames.history}
              />
              <SidebarButton
                active={activeTab === "inwardSaved"}
                onClick={() => setActiveTab("inwardSaved")}
                icon={CheckCircle}
                label={tabNames.inwardSaved}
              />
              <SidebarButton
                active={activeTab === "godownStock"}
                onClick={() => setActiveTab("godownStock")}
                icon={Warehouse}
                label={tabNames.godownStock}
              />
              {isAdmin(currentUser.role) && (
                <SidebarButton
                  active={activeTab === "analytics"}
                  onClick={() => setActiveTab("analytics")}
                  icon={BarChart2}
                  label={tabNames.analytics}
                />
              )}
            </>
          )}
          {isAdmin(currentUser.role) && (
            <>
              <SidebarButton
                active={activeTab === "settings" && settingsSubTab === "users"}
                onClick={() => {
                  setActiveTab("settings");
                  setSettingsSubTab("users");
                }}
                icon={UserCheck}
                label="Manage Users"
              />
              <SidebarButton
                active={activeTab === "settings" && settingsSubTab !== "users"}
                onClick={() => {
                  setActiveTab("settings");
                  setSettingsSubTab(undefined);
                }}
                icon={Settings}
                label={tabNames.settings}
              />
            </>
          )}
        </nav>
        <div className="p-6 border-t bg-gray-50/50">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-gray-200 p-2 rounded-full text-gray-500">
              <User size={18} />
            </div>
            <div>
              <p className="text-sm font-black text-gray-900 leading-none truncate w-24">
                {currentUser.username}
              </p>
              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                {currentUser.role}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              localStorage.removeItem("stockflow_user");
              setCurrentUser(null);
            }}
            className="w-full bg-white border border-red-100 text-red-500 font-bold py-2 rounded-xl text-[10px] uppercase tracking-widest hover:bg-red-50 transition-colors"
          >
            Sign Out
          </button>
        </div>
        <div className="p-3 border-t bg-gray-100/50 text-center">
          <p className="text-[9px] font-black uppercase text-gray-400 tracking-widest">
            Powered by JPS
          </p>
        </div>
      </aside>
      {/* Main Content */}
      <main className="p-4 md:p-10 max-w-6xl mx-auto flex-1 w-full relative">
        <TabErrorBoundary>
          {activeTab === "dashboard" && currentUser.role !== "supplier" && (
            <DashboardTab
              inventory={inventory}
              minStockThreshold={minStockThreshold}
              activeBusinessId={activeBusinessId}
              transactions={transactions}
              onItemClick={(sku) => setSelectedHistoryItem(sku)}
              thresholdExcludedItems={thresholdExcludedItems}
              categoryUnits={categoryUnits}
              itemUnitOverrides={itemUnitOverrides}
              inwardSaved={inwardSaved}
              currentUser={currentUser}
              setInventoryWithBackend={setInventoryWithBackend as any}
            />
          )}
          {activeTab === "transit" && (
            <TransitTab
              transitGoods={transitGoods}
              setTransitGoods={setTransitGoodsWithBackend}
              biltyPrefixes={biltyPrefixes}
              showNotification={showNotification}
              currentUser={currentUser}
              customColumns={customColumns.transit}
              setConfirmDialog={setConfirmDialog}
              activeBusinessId={activeBusinessId}
              allTransitGoods={transitGoods}
              categories={categories}
              transportTracking={transportTracking}
              setMoveToQueueData={setMoveToQueueData}
              setActiveTabFromTransit={setActiveTab}
              pendingParcels={pendingParcels}
              transactions={transactions}
              inwardSaved={inwardSaved}
              fieldLabels={fieldLabels}
              requiredFields={requiredFields}
              supplierOptions={allSuppliers}
              transportOptions={allTransporters}
            />
          )}
          {activeTab === "warehouse" && currentUser.role !== "supplier" && (
            <WarehouseTab
              pendingParcels={pendingParcels}
              setPendingParcels={setPendingParcelsWithBackend}
              setOpeningParcel={setOpeningParcel}
              setActiveTab={setActiveTab}
              setTransitGoods={setTransitGoodsWithBackend}
              inventory={inventory}
              biltyPrefixes={biltyPrefixes}
              customColumns={customColumns.warehouse}
              showNotification={showNotification}
              setConfirmDialog={setConfirmDialog}
              activeBusinessId={activeBusinessId}
              transportTracking={transportTracking}
              categories={categories}
              transitGoods={transitGoods}
              moveToQueueData={moveToQueueData}
              clearMoveToQueueData={() => setMoveToQueueData(null)}
              existingQueueBiltyNos={pendingParcels
                .filter(
                  (p) => !p.businessId || p.businessId === activeBusinessId,
                )
                .map((p) => p.biltyNo)}
              transactions={transactions}
              inwardSaved={inwardSaved}
              fieldLabels={fieldLabels}
              supplierOptions={allSuppliers}
              transportOptions={allTransporters}
              currentUser={currentUser}
            />
          )}
          {activeTab === "inward" && currentUser.role !== "supplier" && (
            <InwardTab
              inventory={inventory}
              categories={categories}
              updateStock={updateStock}
              setTransactions={setTransactionsWithBackend as any}
              showNotification={showNotification}
              currentUser={currentUser}
              generateSku={generateSku}
              openingParcel={openingParcel}
              setOpeningParcel={setOpeningParcel}
              pendingParcels={pendingParcels}
              setPendingParcels={setPendingParcelsWithBackend}
              transitGoods={transitGoods}
              setTransitGoods={setTransitGoodsWithBackend}
              godowns={godowns}
              biltyPrefixes={biltyPrefixes}
              customColumns={customColumns.inward}
              activeBusinessId={activeBusinessId}
              transactions={transactions}
              setInventory={setInventoryWithBackend}
              setConfirmDialog={setConfirmDialog}
              setInwardSaved={setInwardSavedWithBackend}
              inwardSaved={inwardSaved}
              fieldLabels={fieldLabels}
              requiredFields={requiredFields}
              deliveredBilties={deliveredBilties}
              batchUpdateStockForInward={batchUpdateStockForInward}
            />
          )}
          {activeTab === "opening" && isAdmin(currentUser.role) && (
            <OpeningStockTab
              inventory={inventory}
              setInventory={setInventoryWithBackend}
              categories={categories}
              godowns={godowns}
              setTransactions={setTransactionsWithBackend as any}
              setInwardSaved={setInwardSavedWithBackend as any}
              actor={actor}
              activeBusinessId={activeBusinessId}
              currentUser={currentUser}
              showNotification={showNotification}
            />
          )}
          {activeTab === "transfer" && currentUser.role !== "supplier" && (
            <TransferTab
              inventory={inventory}
              updateStock={updateStock}
              showNotification={showNotification}
              godowns={godowns}
              activeBusinessId={activeBusinessId}
              setTransactions={setTransactionsWithBackend as any}
              currentUser={currentUser}
              actor={actor}
              transfers={_transfers}
              setTransfers={setTransfers}
              onInventoryRefresh={refreshInventory}
              requiredFields={requiredFields}
              users={users}
            />
          )}
          {activeTab === "sales" && isAdmin(currentUser.role) && (
            <SalesTab
              inventory={inventory}
              updateStock={updateStock}
              setTransactions={setTransactionsWithBackend as any}
              showNotification={showNotification}
              currentUser={currentUser}
              godowns={godowns}
              activeBusinessId={activeBusinessId}
              categories={categories}
              actor={actor}
              requiredFields={requiredFields}
            />
          )}
          {activeTab === "history" && currentUser.role !== "supplier" && (
            <HistoryTab
              transactions={transactions}
              setConfirmDialog={setConfirmDialog}
              setTransactions={setTransactionsWithBackend as any}
              activeBusinessId={activeBusinessId}
              currentUser={currentUser}
              inventory={inventory}
              transitGoods={transitGoods}
              pendingParcels={pendingParcels}
              categories={categories}
              godowns={godowns}
              showNotification={showNotification}
              inwardSaved={inwardSaved}
              updateStock={updateStock}
              setInwardSaved={setInwardSavedWithBackend as any}
            />
          )}
          {activeTab === "inwardSaved" && currentUser.role !== "supplier" && (
            <InwardSavedTab
              inwardSaved={inwardSaved}
              setInwardSaved={setInwardSavedWithBackend}
              currentUser={currentUser}
              transactions={transactions}
              activeBusinessId={activeBusinessId}
              showNotification={showNotification}
              godowns={godowns}
              inventory={inventory}
              setInventory={setInventoryWithBackend as any}
              setInventoryWithBackend={setInventoryWithBackend as any}
              setTransactions={setTransactionsWithBackend as any}
            />
          )}
          {activeTab === "godownStock" && currentUser.role !== "supplier" && (
            <GodownStockTab
              inventory={inventory}
              godowns={godowns}
              activeBusinessId={activeBusinessId}
              setInventoryWithBackend={setInventoryWithBackend as any}
              currentUser={currentUser}
            />
          )}
          {activeTab === "delivery" && currentUser.role !== "supplier" && (
            <DeliveryTab
              inventory={inventory}
              setInventory={setInventoryWithBackend}
              pendingParcels={pendingParcels}
              setPendingParcels={setPendingParcelsWithBackend}
              godowns={godowns}
              categories={categories}
              currentUser={currentUser}
              activeBusinessId={activeBusinessId}
              deliveryRecords={deliveryRecords}
              setDeliveryRecords={setDeliveryRecords}
              transactions={transactions}
              setTransactions={setTransactionsWithBackend as any}
              setInwardSaved={setInwardSavedWithBackend}
              updateStock={updateStock}
              showNotification={showNotification}
              actor={actor}
              onInventoryRefresh={refreshInventory}
              onDeliveredBilty={(biltyNo) =>
                setDeliveredBilties((prev) => [...new Set([...prev, biltyNo])])
              }
              requiredFields={requiredFields}
              generateSku={generateSku}
            />
          )}
          {activeTab === "analytics" && isAdmin(currentUser.role) && (
            <AnalyticsTab
              transactions={transactions}
              inwardSaved={inwardSaved}
              activeBusinessId={activeBusinessId}
              godowns={godowns}
            />
          )}
          {activeTab === "salesRecord" && isAdmin(currentUser.role) && (
            <SalesRecordTab
              transactions={transactions}
              activeBusinessId={activeBusinessId}
              isAdmin={true}
              onEditTransaction={(updated) =>
                setTransactionsWithBackend((prev: Transaction[]) =>
                  prev.map((t: Transaction) =>
                    t.id === updated.id ? updated : t,
                  ),
                )
              }
            />
          )}
          {activeTab === "settings" && isAdmin(currentUser.role) && (
            <SettingsTab
              initialSubTab={settingsSubTab}
              users={users}
              setUsers={setUsersWithBackend}
              categories={categories}
              setCategories={setCategoriesWithBackend}
              customColumns={customColumns}
              setCustomColumns={setCustomColumns}
              exportDatabase={exportDatabase}
              importDatabase={importDatabase}
              showNotification={showNotification}
              setPromptDialog={setPromptDialog}
              setConfirmDialog={setConfirmDialog}
              businesses={businesses}
              setBusinesses={setBusinessesWithBackend}
              activeBusinessId={activeBusinessId}
              setActiveBusinessId={setActiveBusinessId}
              inventory={inventory}
              setInventory={setInventoryWithBackend}
              godowns={godowns}
              setGodowns={setGodownsWithBackend}
              minStockThreshold={minStockThreshold}
              setMinStockThreshold={setMinStockThreshold}
              setTransactions={setTransactionsWithBackend as any}
              currentUser={currentUser}
              transportTracking={transportTracking}
              setTransportTracking={setTransportTrackingWithBackend}
              tabNames={tabNames}
              setTabNames={setTabNames}
              fieldLabels={fieldLabels}
              setFieldLabels={setFieldLabels}
              requiredFields={requiredFields}
              setRequiredFields={setRequiredFields}
              fieldOrder={fieldOrder}
              setFieldOrder={setFieldOrder}
              thresholdExcludedItems={thresholdExcludedItems}
              setThresholdExcludedItems={setThresholdExcludedItems}
              setTransitGoods={setTransitGoodsWithBackend}
              setPendingParcels={setPendingParcelsWithBackend}
              setInwardSaved={setInwardSavedWithBackend}
              setDeliveryRecords={setDeliveryRecords}
              setDeliveredBilties={setDeliveredBilties}
              onResetAllData={onResetAllData}
              biltyPrefixes={biltyPrefixes}
              setBiltyPrefixes={setBiltyPrefixesWithBackend}
              fieldTypes={fieldTypes}
              setFieldTypes={setFieldTypes}
              fieldComboOptions={fieldComboOptions}
              setFieldComboOptions={setFieldComboOptions}
              customTabFields={customTabFields}
              setCustomTabFields={setCustomTabFields}
              categoryUnits={categoryUnits}
              setCategoryUnits={setCategoryUnits}
              itemUnitOverrides={itemUnitOverrides}
              setItemUnitOverrides={setItemUnitOverrides}
            />
          )}
          {/* Item History Panel */}
          <ItemHistoryPanel
            sku={selectedHistoryItem}
            inventory={inventory}
            transactions={transactions}
            activeBusinessId={activeBusinessId}
            onClose={() => setSelectedHistoryItem(null)}
            inwardSaved={inwardSaved}
            currentUser={currentUser}
          />
          {/* Confirm Dialog */}
          {confirmDialog && (
            <div className="fixed inset-0 bg-gray-900/60 z-[100] flex items-center justify-center p-4">
              <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl max-w-sm w-full animate-fade-in-down">
                <h3 className="text-xl font-black text-gray-800 mb-4">
                  Confirm Action
                </h3>
                <p className="text-sm font-bold text-gray-500 mb-6">
                  {confirmDialog.message}
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setConfirmDialog(null)}
                    className="flex-1 bg-gray-100 text-gray-700 font-black py-4 rounded-2xl uppercase text-[10px] tracking-widest"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      confirmDialog.onConfirm();
                      setConfirmDialog(null);
                    }}
                    className="flex-1 bg-red-600 text-white font-black py-4 rounded-2xl uppercase text-[10px] tracking-widest shadow-lg"
                  >
                    Confirm
                  </button>
                </div>
              </div>
            </div>
          )}
          {/* Prompt Dialog */}
          {promptDialog && (
            <div className="fixed inset-0 bg-gray-900/60 z-[100] flex items-center justify-center p-4">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const val = (e.target as HTMLFormElement).promptInput.value;
                  promptDialog.onConfirm(val);
                  setPromptDialog(null);
                }}
                className="bg-white p-8 rounded-[2.5rem] shadow-2xl max-w-sm w-full animate-fade-in-down"
              >
                <h3 className="text-xl font-black text-gray-800 mb-2">
                  Input Required
                </h3>
                <p className="text-xs font-bold text-gray-500 mb-4">
                  {promptDialog.message}
                </p>
                <input
                  name="promptInput"
                  type="text"
                  defaultValue={promptDialog.defaultValue || ""}
                  className="w-full border rounded-xl p-4 outline-none font-bold focus:ring-2 focus:ring-blue-500 mb-6 bg-gray-50"
                />
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setPromptDialog(null)}
                    className="flex-1 bg-gray-100 text-gray-700 font-black py-4 rounded-2xl uppercase text-[10px] tracking-widest"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-blue-600 text-white font-black py-4 rounded-2xl uppercase text-[10px] tracking-widest shadow-lg"
                  >
                    Save
                  </button>
                </div>
              </form>
            </div>
          )}
        </TabErrorBoundary>
      </main>
      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full bg-white border-t flex overflow-x-auto scrollbar-hide items-center p-2 z-10 gap-0.5">
        {currentUser.role !== "supplier" && (
          <NavButton
            active={activeTab === "dashboard"}
            onClick={() => setActiveTab("dashboard")}
            icon={LayoutDashboard}
            label={tabNames.dashboard}
          />
        )}
        <NavButton
          active={activeTab === "transit"}
          onClick={() => setActiveTab("transit")}
          icon={Navigation}
          label={tabNames.transit}
        />
        {currentUser.role !== "supplier" && (
          <>
            <NavButton
              active={activeTab === "warehouse"}
              onClick={() => setActiveTab("warehouse")}
              icon={Warehouse}
              label="Queue"
            />
            <NavButton
              active={activeTab === "inward"}
              onClick={() => setActiveTab("inward")}
              icon={PlusCircle}
              label="Inward"
            />
            <NavButton
              active={activeTab === "opening"}
              onClick={() => setActiveTab("opening")}
              icon={PackagePlus}
              label="Opening"
            />
            <NavButton
              active={activeTab === "transfer"}
              onClick={() => setActiveTab("transfer")}
              icon={ArrowRightLeft}
              label="Move"
            />
            {isAdmin(currentUser.role) && (
              <NavButton
                active={activeTab === "sales"}
                onClick={() => setActiveTab("sales")}
                icon={ShoppingCart}
                label="Sales"
              />
            )}
            {isAdmin(currentUser.role) && (
              <NavButton
                active={activeTab === "salesRecord"}
                onClick={() => setActiveTab("salesRecord")}
                icon={Receipt}
                label="Rec"
              />
            )}
            <NavButton
              active={activeTab === "delivery"}
              onClick={() => setActiveTab("delivery")}
              icon={Truck}
              label="Delivery"
            />
            <NavButton
              active={activeTab === "history"}
              onClick={() => setActiveTab("history")}
              icon={History}
              label="History"
            />
            <NavButton
              active={activeTab === "inwardSaved"}
              onClick={() => setActiveTab("inwardSaved")}
              icon={CheckCircle}
              label="Saved"
            />
            <NavButton
              active={activeTab === "godownStock"}
              onClick={() => setActiveTab("godownStock")}
              icon={Warehouse}
              label="Stock"
            />
            {isAdmin(currentUser.role) && (
              <NavButton
                active={activeTab === "analytics"}
                onClick={() => setActiveTab("analytics")}
                icon={BarChart2}
                label="Analytics"
              />
            )}
          </>
        )}
        {isAdmin(currentUser.role) && (
          <>
            <NavButton
              active={activeTab === "settings" && settingsSubTab === "users"}
              onClick={() => {
                setActiveTab("settings");
                setSettingsSubTab("users");
              }}
              icon={UserCheck}
              label="Users"
            />
            <NavButton
              active={activeTab === "settings" && settingsSubTab !== "users"}
              onClick={() => {
                setActiveTab("settings");
                setSettingsSubTab(undefined);
              }}
              icon={Settings}
              label="Admin"
            />
          </>
        )}
      </nav>
      {/* Notification */}
      {notification && (
        <div className="fixed top-20 md:top-6 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-2 px-6 py-4 rounded-3xl shadow-2xl animate-fade-in-down w-[90%] max-w-sm text-white font-black uppercase text-[10px] tracking-widest bg-gray-900 border border-gray-700">
          {notification.type === "success" ? (
            <CheckCircle className="text-green-400" />
          ) : (
            <AlertCircle className="text-red-400" />
          )}
          {notification.message}
        </div>
      )}
    </div>
  );
}
