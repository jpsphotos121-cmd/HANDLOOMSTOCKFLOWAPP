import {
  AlertCircle,
  CheckCircle,
  Package,
  PlusCircle,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { formatItemName } from "../constants";
import type {
  AppUser,
  BaleItem,
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

function InwardTab({
  inventory,
  categories,
  updateStock,
  setTransactions,
  showNotification,
  currentUser,
  generateSku,
  openingParcel,
  setOpeningParcel,
  pendingParcels,
  setPendingParcels,
  transitGoods,
  setTransitGoods,
  godowns,
  biltyPrefixes,
  customColumns,
  activeBusinessId,
  transactions,
  setInventory,
  setConfirmDialog,
  setInwardSaved,
  inwardSaved,
  fieldLabels,
  requiredFields,
  deliveredBilties,
}: {
  inventory: Record<string, InventoryItem>;
  categories: Category[];
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
  generateSku: (
    cat: string,
    name: string,
    attrs: Record<string, string>,
    rate: string,
    bizId: string,
  ) => string;
  openingParcel: PendingParcel | null;
  setOpeningParcel: (p: PendingParcel | null) => void;
  pendingParcels: PendingParcel[];
  setPendingParcels: React.Dispatch<React.SetStateAction<PendingParcel[]>>;
  transitGoods: TransitRecord[];
  setTransitGoods: React.Dispatch<React.SetStateAction<TransitRecord[]>>;
  godowns: string[];
  biltyPrefixes: string[];
  customColumns: ColumnDef[];
  activeBusinessId: string;
  transactions: Transaction[];
  setInventory: React.Dispatch<
    React.SetStateAction<Record<string, InventoryItem>>
  >;
  setConfirmDialog: (
    d: { message: string; onConfirm: () => void } | null,
  ) => void;
  setInwardSaved?: React.Dispatch<React.SetStateAction<InwardSavedEntry[]>>;
  inwardSaved?: InwardSavedEntry[];
  fieldLabels?: Record<string, Record<string, string>>;
  requiredFields?: Record<string, Record<string, boolean>>;
  deliveredBilties?: string[];
}) {
  const _lbl = (key: string, def: string) => fieldLabels?.inward?.[key] || def;
  const [biltyPrefix, setBiltyPrefix] = useState(biltyPrefixes?.[0] || "0");
  const [biltyNumber, setBiltyNumber] = useState("");
  const [baleItems, setBaleItems] = useState<BaleItem[]>([]);
  const [isNewItemMode, setIsNewItemMode] = useState(false);
  const [itemForm, setItemForm] = useState({
    category: "",
    itemName: "",
    attributes: {} as Record<string, string>,
    shopQty: "",
    godownQuants: {} as Record<string, string>,
    saleRate: "",
    purchaseRate: "",
    customData: {} as Record<string, string>,
  });
  const [matchedDetails, setMatchedDetails] = useState<
    TransitRecord | PendingParcel | null
  >(null);
  const [isDirectEntry, setIsDirectEntry] = useState(false);
  const [directReference, setDirectReference] = useState("");
  const [dateOpened, setDateOpened] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [openedBy, setOpenedBy] = useState(currentUser.username);
  const [totalQty, setTotalQty] = useState("");
  const [_filterDateFrom, _setFilterDateFrom] = useState("");
  const [_filterDateTo, _setFilterDateTo] = useState("");
  const [_filterName, _setFilterName] = useState("");
  const [queueBiltySearch, setQueueBiltySearch] = useState("");
  const [showQueueDropdown, setShowQueueDropdown] = useState(false);
  const [inwardPackages, setInwardPackages] = useState("1");
  const [packagesAutoLocked, setPackagesAutoLocked] = useState(false);
  const [biltyLocked, setBiltyLocked] = useState(false);
  const [saleRatePrompt, setSaleRatePrompt] = useState<{
    show: boolean;
    newRate: string;
    mode: "multi" | "single";
    baleIdx?: number;
    existingSku?: string;
  }>({ show: false, newRate: "", mode: "single" });
  const [perBaleData, setPerBaleData] = useState<
    {
      label: string;
      items: BaleItem[];
      totalQty: string;
      received: boolean;
      notReceivedTarget: "transit" | "queue";
      locked?: boolean;
      lockedBy?: string;
      lockedDate?: string;
      pendingSaved?: boolean;
      pendingSavedTarget?: string;
    }[]
  >([]);
  const [activeBaleIdx, setActiveBaleIdx] = useState(0);
  const [perBaleFormData, setPerBaleFormData] = useState<
    Record<
      number,
      {
        category: string;
        itemName: string;
        isNewItem: boolean;
        newItemName: string;
        totalQty: string;
        shopQty: string;
        godownQuants: Record<string, string>;
        saleRate: string;
        purchaseRate: string;
        attributes: Record<string, string>;
      }
    >
  >({});

  const getPerBaleForm = (idx: number) =>
    perBaleFormData[idx] || {
      category: "",
      itemName: "",
      isNewItem: false,
      newItemName: "",
      totalQty: "",
      shopQty: "",
      godownQuants: {},
      saleRate: "",
      purchaseRate: "",
      attributes: {},
    };

  const setPerBaleForm = (
    idx: number,
    patch: Partial<ReturnType<typeof getPerBaleForm>>,
  ) => {
    setPerBaleFormData((prev) => ({
      ...prev,
      [idx]: { ...getPerBaleForm(idx), ...patch },
    }));
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional - only re-run on bilty/package change
  useEffect(() => {
    const bNo =
      biltyPrefix === "0" ? biltyNumber : `${biltyPrefix}-${biltyNumber}`;
    const pkgCount = Number(inwardPackages) || 1;
    if (biltyNumber) {
      setPerBaleData(
        Array.from({ length: pkgCount }, (_, i) => {
          const label = pkgCount === 1 ? bNo : `${bNo}X${pkgCount}(${i + 1})`;
          const existingTx = transactions.find(
            (tx) =>
              tx.type === "INWARD" &&
              (!tx.businessId || tx.businessId === activeBusinessId) &&
              tx.biltyNo?.toLowerCase() === label.toLowerCase(),
          );
          const alreadyOpened = !!existingTx;
          return {
            label,
            items:
              existingTx?.baleItemsList?.map(
                (
                  bi: {
                    category?: string;
                    itemName?: string;
                    attributes?: Record<string, string>;
                    shopQty?: number;
                    godownQuants?: Record<string, number>;
                    saleRate?: number;
                    purchaseRate?: number;
                  },
                  idx: number,
                ) => ({
                  id: idx,
                  sku: "",
                  category: bi.category || "",
                  itemName: bi.itemName || "",
                  attributes: bi.attributes || {},
                  shopQty: String(bi.shopQty || 0),
                  godownQuants: Object.fromEntries(
                    Object.entries(bi.godownQuants || {}).map(([g, v]) => [
                      g,
                      String(v),
                    ]),
                  ),
                  saleRate: String(bi.saleRate || 0),
                  purchaseRate: String(bi.purchaseRate || 0),
                  customData: {},
                }),
              ) || ([] as BaleItem[]),
            totalQty: existingTx
              ? String(existingTx.totalQtyInBale || existingTx.itemsCount || "")
              : "",
            received: true,
            notReceivedTarget: "transit" as const,
            locked: alreadyOpened,
            lockedBy: existingTx?.user || "",
            lockedDate:
              existingTx?.date?.split("T")[0] || existingTx?.date || "",
          };
        }),
      );
      setActiveBaleIdx(0);
    } else {
      setPerBaleData([]);
    }
  }, [biltyNumber, biltyPrefix, inwardPackages]);

  // Reset isNewItemMode when category changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional reset on category change
  useEffect(() => {
    setIsNewItemMode(false);
  }, [itemForm.category]);

  // Auto-populate sale rate in per-bale form when item name + attributes match inventory
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional auto-populate on item change
  useEffect(() => {
    const bf = perBaleFormData[activeBaleIdx];
    if (!bf) return;
    const effectiveName = bf.isNewItem ? bf.newItemName : bf.itemName;
    if (!effectiveName) return;
    const existing = Object.values(inventory).find(
      (inv) =>
        (!inv.businessId || inv.businessId === activeBusinessId) &&
        inv.itemName.toLowerCase() === effectiveName.toLowerCase() &&
        (!bf.category || inv.category === bf.category),
    );
    if (existing && !bf.saleRate) {
      setPerBaleForm(activeBaleIdx, {
        saleRate: String(existing.saleRate || ""),
        purchaseRate: String(existing.purchaseRate || ""),
      });
    }
  }, [
    perBaleFormData[activeBaleIdx]?.itemName,
    perBaleFormData[activeBaleIdx]?.newItemName,
    activeBaleIdx,
  ]);

  const handleLookup = (pPrefix: string, pNumber: string) => {
    const bNo = pPrefix === "0" ? pNumber : `${pPrefix}-${pNumber}`;
    const searchStr = bNo.toLowerCase();
    // Check if already in Inward Saved
    const baseBiltyCheck = bNo.replace(/X\d+\(\d+\)$/i, "").toLowerCase();
    const alreadySaved = (inwardSaved || []).some(
      (s) =>
        (!s.businessId || s.businessId === activeBusinessId) &&
        ((s.biltyNumber || "").replace(/X\d+\(\d+\)$/i, "").toLowerCase() ===
          baseBiltyCheck ||
          (s.baseNumber || "").toLowerCase() === baseBiltyCheck),
    );
    if (alreadySaved) {
      showNotification(
        `Base bilty ${baseBiltyCheck} is already fully processed in Inward Saved!`,
        "error",
      );
      return;
    }
    // Check if delivered via Delivery tab
    const isDelivered =
      (deliveredBilties || []).includes(bNo.toLowerCase()) ||
      (deliveredBilties || []).some(
        (db) =>
          db.replace(/X\d+\(\d+\)$/i, "").toLowerCase() === baseBiltyCheck,
      );
    if (isDelivered) {
      showNotification(
        "This bilty was already delivered to a customer via the Delivery tab.",
        "error",
      );
      return;
    }
    // Check X-count consistency: if any bale of this base bilty exists with a different X-count, block it
    const existingInward = transactions.find(
      (t) =>
        t.type === "INWARD" &&
        (!t.businessId || t.businessId === activeBusinessId) &&
        (t.biltyNo || "").replace(/X\d+\(\d+\)$/i, "").toLowerCase() ===
          baseBiltyCheck,
    );
    if (existingInward) {
      const existingXMatch = (existingInward.biltyNo || "").match(
        /X(\d+)\(\d+\)$/i,
      );
      const newXMatch = bNo.match(/X(\d+)/i);
      if (existingXMatch && newXMatch && existingXMatch[1] !== newXMatch[1]) {
        showNotification(
          `This bilty has ${existingXMatch[1]} packages. You can only open remaining bales of ${baseBiltyCheck}X${existingXMatch[1]}.`,
          "error",
        );
        return;
      }
    }
    // Fix 4: Search by base bilty (strip postfix from entries) for Transit, Queue, and inwardHistory
    const transitMatch = transitGoods.find(
      (g) =>
        g.biltyNo?.toLowerCase() === searchStr ||
        (g.biltyNo || "").replace(/X\d+\(\d+\)$/i, "").toLowerCase() ===
          searchStr,
    );
    const queueMatch = pendingParcels.find(
      (p) =>
        p.biltyNo?.toLowerCase() === searchStr ||
        (p.biltyNo || "").replace(/X\d+\(\d+\)$/i, "").toLowerCase() ===
          searchStr,
    );
    const match = queueMatch || transitMatch;
    if (match) {
      setMatchedDetails(match);
      setBiltyLocked(true);
      // Extract package count from postfix or packages field
      const postfixMatch = ((match as TransitRecord).biltyNo || "").match(
        /X(\d+)\(\d+\)$/i,
      );
      const extractedPkg = postfixMatch
        ? postfixMatch[1]
        : (match as PendingParcel).packages ||
          (match as TransitRecord).packages ||
          "";
      setItemForm((prev) => ({
        ...prev,
        itemName: (match as TransitRecord).itemName || prev.itemName,
        category:
          (match as PendingParcel).itemCategory ||
          (match as TransitRecord).itemCategory ||
          (match as TransitRecord).category ||
          prev.category ||
          "",
      }));
      if (extractedPkg && Number(extractedPkg) > 1) {
        setInwardPackages(extractedPkg);
        setPackagesAutoLocked(true);
      }
      showNotification("Found Bilty! Data auto-filled.", "success");
    } else {
      setMatchedDetails(null);
      setBiltyLocked(false);
    }
  };

  // Auto-fill when Open Bale is clicked in Queue
  // biome-ignore lint/correctness/useExhaustiveDependencies: only run on openingParcel change
  useEffect(() => {
    if (!openingParcel) return;
    const biltyStr = openingParcel.biltyNo || "";
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
    setMatchedDetails(openingParcel as unknown as PendingParcel);
    setBiltyLocked(true);
    setItemForm((prev) => ({
      ...prev,
      itemName: (openingParcel as PendingParcel).itemName || prev.itemName,
      category:
        (openingParcel as PendingParcel).itemCategory ||
        (openingParcel as PendingParcel).category ||
        prev.category,
    }));
    setQueueBiltySearch(biltyStr);
    const pkgs = (openingParcel as PendingParcel).packages;
    if (pkgs && Number(pkgs) > 1) {
      setInwardPackages(pkgs);
      setPackagesAutoLocked(true);
    }
  }, [openingParcel]);

  useEffect(() => {
    if (!itemForm.itemName) return;
    const term = itemForm.itemName.toLowerCase().trim();
    const existing = Object.values(inventory).find(
      (i) =>
        i.itemName?.toLowerCase() === term &&
        (!i.businessId || i.businessId === activeBusinessId),
    );
    if (existing) {
      setItemForm((prev) => {
        if (
          prev.saleRate === String(existing.saleRate) &&
          prev.category === existing.category
        )
          return prev;
        return {
          ...prev,
          category: prev.category || existing.category,
          saleRate: String(existing.saleRate) || "",
          purchaseRate: String(existing.purchaseRate) || "",
        };
      });
    }
  }, [itemForm.itemName, inventory, activeBusinessId]);

  const handleFinalSave = () => {
    if (baleItems.length === 0) return;
    // Validate required fields for biltyNo and packages
    const inwardReq = requiredFields?.inward || {};
    if (inwardReq.biltyNo && !isDirectEntry && !biltyNumber.trim()) {
      showNotification("Bilty No is required", "error");
      return;
    }
    if (inwardReq.packages && !inwardPackages) {
      showNotification("Packages is required", "error");
      return;
    }

    // Check duplicate INWARD bilty
    if (!isDirectEntry) {
      const bNo =
        biltyPrefix === "0" ? biltyNumber : `${biltyPrefix}-${biltyNumber}`;
      const alreadyProcessed = transactions.some(
        (tx) =>
          tx.type === "INWARD" &&
          (!tx.businessId || tx.businessId === activeBusinessId) &&
          tx.biltyNo?.toLowerCase() === bNo.toLowerCase(),
      );
      if (alreadyProcessed) {
        showNotification(
          `Bilty ${bNo} has already been processed in Inward!`,
          "error",
        );
        return;
      }
    }
    // Validate totalQty if set
    if (totalQty) {
      const savedTotal = baleItems.reduce(
        (sum, i) =>
          sum +
          (Number(i.shopQty) || 0) +
          Object.values(i.godownQuants).reduce((a, b) => a + Number(b || 0), 0),
        0,
      );
      if (savedTotal !== Number(totalQty)) {
        showNotification(
          `Total qty mismatch: distributed ${savedTotal} but bale total is ${totalQty}. Please match before saving.`,
          "error",
        );
        return;
      }
    }
    // Items are created by updateStock; no pre-creation needed
    const newItemsToCreate = baleItems.filter((item) => {
      if (!item.itemName || !item.category) return false;
      return !Object.values(inventory).some(
        (inv) =>
          (!inv.businessId || inv.businessId === activeBusinessId) &&
          inv.category === item.category &&
          inv.itemName.toLowerCase() === item.itemName.toLowerCase(),
      );
    });
    const doFinalSave = () => {
      for (const item of baleItems) {
        if (Number(item.shopQty) > 0)
          updateStock(
            item.sku,
            {
              ...item,
              saleRate: Number(item.saleRate),
              purchaseRate: Number(item.purchaseRate),
            },
            Number(item.shopQty),
            0,
            "Main Godown",
          );
        for (const [g, q] of Object.entries(item.godownQuants)) {
          if (Number(q) > 0)
            updateStock(
              item.sku,
              {
                ...item,
                saleRate: Number(item.saleRate),
                purchaseRate: Number(item.purchaseRate),
              },
              0,
              Number(q),
              g,
            );
        }
      }
    };
    if (newItemsToCreate.length > 0) {
      const names = newItemsToCreate
        .map((i) => `${i.itemName} (${i.category})`)
        .join(", ");
      setConfirmDialog({
        message: `Create new inventory items?
${names}`,
        onConfirm: () => {
          doFinalSave();
        },
      });
    } else {
      doFinalSave();
    }
    const bNo = isDirectEntry
      ? `DIRECT-${directReference || Date.now().toString().slice(-4)}`
      : biltyPrefix === "0"
        ? biltyNumber
        : `${biltyPrefix}-${biltyNumber}`;
    const type = isDirectEntry ? "DIRECT_STOCK" : "INWARD";
    setTransactions((prev) => [
      {
        id: Date.now(),
        type,
        biltyNo: bNo,
        businessId: activeBusinessId,
        date: new Date().toISOString().split("T")[0],
        user: currentUser.username,
        transportName: isDirectEntry
          ? "Direct Entry"
          : (matchedDetails as TransitRecord)?.transportName || "",
        itemsCount: totalQty
          ? Number(totalQty)
          : baleItems.reduce(
              (sum, i) =>
                sum +
                (Number(i.shopQty) || 0) +
                Object.values(i.godownQuants).reduce(
                  (a, b) => a + Number(b || 0),
                  0,
                ),
              0,
            ),
        totalQtyInBale: totalQty ? Number(totalQty) : undefined,
        baleItemsList: baleItems.map((i) => ({
          itemName: i.itemName,
          category: i.category,
          attributes: { ...i.attributes },
          shopQty: Number(i.shopQty) || 0,
          godownQuants: Object.fromEntries(
            Object.entries(i.godownQuants).map(([g, q]) => [g, Number(q) || 0]),
          ),
          saleRate: Number(i.saleRate) || 0,
          purchaseRate: Number(i.purchaseRate) || 0,
          qty:
            (Number(i.shopQty) || 0) +
            Object.values(i.godownQuants).reduce(
              (a, b) => a + Number(b || 0),
              0,
            ),
        })),
      },
      ...prev,
    ]);
    if (!isDirectEntry) {
      if (matchedDetails) {
        setTransitGoods((prev) =>
          prev.filter((g) => g.id !== matchedDetails.id),
        );
        setPendingParcels((prev) =>
          prev.filter((p) => p.id !== matchedDetails.id),
        );
      } else {
        setTransitGoods((prev) =>
          prev.filter((g) => g.biltyNo?.toLowerCase() !== bNo.toLowerCase()),
        );
        setPendingParcels((prev) =>
          prev.filter((p) => p.biltyNo?.toLowerCase() !== bNo.toLowerCase()),
        );
      }
      // Also save to inwardSaved
      if (setInwardSaved) {
        setInwardSaved((prev) => [
          {
            id: Date.now(),
            biltyNumber: bNo,
            baseNumber: bNo.replace(/X\d+\(\d+\)$/i, ""),
            packages: "1",
            items: baleItems.map((i) => ({
              category: i.category,
              itemName: i.itemName,
              qty:
                (Number(i.shopQty) || 0) +
                Object.values(i.godownQuants).reduce(
                  (a, b) => a + Number(b || 0),
                  0,
                ),
              shopQty: Number(i.shopQty) || 0,
              godownQty: Object.values(i.godownQuants).reduce(
                (a, b) => a + Number(b || 0),
                0,
              ),
              godownBreakdown: Object.fromEntries(
                Object.entries(i.godownQuants).map(([k, v]) => [
                  k,
                  Number(v) || 0,
                ]),
              ),
              saleRate: Number(i.saleRate) || 0,
              purchaseRate: Number(i.purchaseRate) || 0,
              attributes: i.attributes || {},
            })),
            savedBy: currentUser.username,
            savedAt: new Date().toISOString(),
            transporter: (matchedDetails as TransitRecord)?.transportName || "",
            supplier:
              (matchedDetails as TransitRecord)?.supplierName ||
              (matchedDetails as PendingParcel)?.supplier ||
              "",
            businessId: activeBusinessId,
          },
          ...prev,
        ]);
      }
    }
    setBaleItems([]);
    setBiltyNumber("");
    setMatchedDetails(null);
    setBiltyLocked(false);
    setOpeningParcel(null);
    setDirectReference("");
    showNotification(
      isDirectEntry
        ? "Direct Stock Saved"
        : "Inward Processed & Removed from Queues",
    );
  };

  const addItemToBale = (e: React.FormEvent) => {
    e.preventDefault();
    // Validate required fields for inward
    const inwardRequired = requiredFields?.inward || {};
    const fieldLabelMap: Record<string, string> = {
      category: "Category",
      itemName: "Item Name",
      shopQty: "Shop Qty",
      saleRate: "Sale Rate",
      purchaseRate: "Purchase Rate",
    };
    for (const [key, label] of Object.entries(fieldLabelMap)) {
      if (inwardRequired[key] && !String((itemForm as any)[key] || "").trim()) {
        showNotification(`${label} is required`, "error");
        return;
      }
    }
    // Validate custom data fields (Size, Colour, etc.)
    const hardcodedKeys = new Set(Object.keys(fieldLabelMap));
    for (const [key, isRequired] of Object.entries(inwardRequired)) {
      if (isRequired && !hardcodedKeys.has(key)) {
        const val = itemForm.customData?.[key];
        if (!val || !String(val).trim()) {
          showNotification(`${key} is required`, "error");
          return;
        }
      }
    }

    const sku = generateSku(
      itemForm.category,
      itemForm.itemName,
      itemForm.attributes,
      itemForm.saleRate,
      activeBusinessId,
    );
    setBaleItems((prev) => [...prev, { ...itemForm, sku, id: Date.now() }]);
    setItemForm({
      ...itemForm,
      itemName: "",
      shopQty: "",
      godownQuants: {},
      customData: {},
    });
  };

  const selectedCat = categories.find((c) => c.name === itemForm.category);
  const showItemForm = biltyNumber.length > 0 || openingParcel || isDirectEntry;

  return (
    <div className="space-y-6 animate-fade-in-down">
      <div className="flex justify-between items-center border-b pb-4">
        <h2 className="text-2xl font-black text-gray-800 tracking-tighter uppercase flex items-center gap-2">
          <PlusCircle className="text-green-600" /> Process Inward
        </h2>
        <button
          type="button"
          data-ocid="inward.secondary_button"
          onClick={() => {
            setBiltyNumber("");
            setBiltyPrefix(biltyPrefixes?.[0] || "0");
            setInwardPackages("1");
            setPackagesAutoLocked(false);
            setBiltyLocked(false);
            setMatchedDetails(null);
            setIsDirectEntry(false);
            setDirectReference("");
            setPerBaleData([]);
            setPerBaleFormData({});
            setActiveBaleIdx(0);
            setBaleItems([]);
            setItemForm({
              category: "",
              itemName: "",
              attributes: {},
              shopQty: "",
              godownQuants: {},
              saleRate: "",
              purchaseRate: "",
              customData: {},
            });
            setQueueBiltySearch("");
            setTotalQty("");
            setOpeningParcel(null);
            showNotification("Form cleared", "info");
          }}
          className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
          title="Clear form / New entry"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Queue Bilty Dropdown */}
      {!isDirectEntry && (
        <div className="bg-amber-50 border border-amber-200 rounded-3xl p-4 relative">
          <p className="text-[10px] font-black uppercase text-amber-800 block mb-2">
            Pick from Arrival Queue
          </p>
          <input
            type="text"
            value={queueBiltySearch}
            onChange={(e) => {
              setQueueBiltySearch(e.target.value);
              setShowQueueDropdown(true);
            }}
            onFocus={() => setShowQueueDropdown(true)}
            placeholder="Search queue bilty..."
            className="w-full border border-amber-200 rounded-xl p-3 font-bold bg-white outline-none focus:ring-2 focus:ring-amber-400 text-sm"
          />
          {showQueueDropdown &&
            (() => {
              const queueEntries = pendingParcels
                .filter(
                  (p) =>
                    (!p.businessId || p.businessId === activeBusinessId) &&
                    (!queueBiltySearch ||
                      p.biltyNo
                        ?.toLowerCase()
                        .includes(queueBiltySearch.toLowerCase())),
                )
                .slice(0, 6);
              const transitEntries = transitGoods
                .filter(
                  (g) =>
                    (!g.businessId || g.businessId === activeBusinessId) &&
                    (!queueBiltySearch ||
                      g.biltyNo
                        ?.toLowerCase()
                        .includes(queueBiltySearch.toLowerCase())),
                )
                .slice(0, 4);
              const totalEntries = queueEntries.length + transitEntries.length;
              return (
                <div className="absolute z-20 left-0 right-0 mx-4 bg-white border rounded-2xl shadow-2xl mt-1 max-h-56 overflow-y-auto">
                  {queueEntries.map((p) => (
                    <button
                      type="button"
                      key={`q-${p.id}`}
                      onClick={() => {
                        setMatchedDetails(p);
                        setQueueBiltySearch(p.biltyNo);
                        setShowQueueDropdown(false);
                        setOpeningParcel(p);
                        const parts = p.biltyNo.split("-");
                        if (parts.length >= 2) {
                          const prefix = parts.slice(0, -1).join("-");
                          const num = parts[parts.length - 1];
                          if (biltyPrefixes.includes(prefix)) {
                            setBiltyPrefix(prefix);
                            setBiltyNumber(num);
                          } else {
                            setBiltyPrefix("0");
                            setBiltyNumber(p.biltyNo);
                          }
                        } else {
                          setBiltyPrefix("0");
                          setBiltyNumber(p.biltyNo);
                        }
                        setItemForm((prev) => ({
                          ...prev,
                          category:
                            p.itemCategory || p.category || prev.category || "",
                          itemName: p.itemName || prev.itemName || "",
                        }));
                        if (p.packages && Number(p.packages) > 1) {
                          setInwardPackages(p.packages);
                          setPackagesAutoLocked(true);
                        }
                        showNotification(
                          "Queue entry selected! Fields auto-filled.",
                          "success",
                        );
                      }}
                      className="w-full text-left p-3 hover:bg-amber-50 cursor-pointer border-b last:border-0"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[8px] font-black bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full uppercase">
                          Queue
                        </span>
                        <p className="font-black text-sm">{p.biltyNo}</p>
                      </div>
                      <p className="text-[10px] text-gray-400 font-bold uppercase mt-0.5">
                        {p.transportName} · {p.packages} pkgs ·{" "}
                        {p.arrivalDate || p.dateReceived}
                      </p>
                      {(p.supplier || p.itemCategory || p.itemName) && (
                        <p className="text-[10px] text-amber-700 font-bold mt-0.5">
                          {[p.supplier, p.itemCategory, p.itemName]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      )}
                    </button>
                  ))}
                  {transitEntries.map((g) => (
                    <button
                      type="button"
                      key={`t-${g.id}`}
                      onClick={() => {
                        const fakeParcel: PendingParcel = {
                          id: g.id,
                          biltyNo: g.biltyNo,
                          transportName: g.transportName,
                          packages: g.packages,
                          dateReceived: g.date,
                          arrivalDate: g.date,
                          businessId: g.businessId,
                          customData: g.customData || {},
                          itemName: g.itemName,
                          category: g.category || g.itemCategory,
                          supplier: g.supplierName,
                          itemCategory: g.itemCategory || g.category,
                        };
                        setMatchedDetails(fakeParcel);
                        setQueueBiltySearch(g.biltyNo);
                        setShowQueueDropdown(false);
                        const parts = g.biltyNo.split("-");
                        if (parts.length >= 2) {
                          const prefix = parts.slice(0, -1).join("-");
                          const num = parts[parts.length - 1];
                          if (biltyPrefixes.includes(prefix)) {
                            setBiltyPrefix(prefix);
                            setBiltyNumber(num);
                          } else {
                            setBiltyPrefix("0");
                            setBiltyNumber(g.biltyNo);
                          }
                        } else {
                          setBiltyPrefix("0");
                          setBiltyNumber(g.biltyNo);
                        }
                        setItemForm((prev) => ({
                          ...prev,
                          category:
                            g.itemCategory || g.category || prev.category || "",
                          itemName: g.itemName || prev.itemName || "",
                        }));
                        if (g.packages && Number(g.packages) > 1) {
                          setInwardPackages(g.packages);
                          setPackagesAutoLocked(true);
                        }
                        showNotification(
                          "Transit entry selected! Fields auto-filled.",
                          "success",
                        );
                      }}
                      className="w-full text-left p-3 hover:bg-indigo-50 cursor-pointer border-b last:border-0"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[8px] font-black bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full uppercase">
                          Transit
                        </span>
                        <p className="font-black text-sm">{g.biltyNo}</p>
                      </div>
                      <p className="text-[10px] text-gray-400 font-bold uppercase mt-0.5">
                        {g.transportName} · {g.packages} pkgs · {g.date}
                      </p>
                      {(g.supplierName || g.itemCategory || g.itemName) && (
                        <p className="text-[10px] text-indigo-700 font-bold mt-0.5">
                          {[g.supplierName, g.itemCategory, g.itemName]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      )}
                    </button>
                  ))}
                  {totalEntries === 0 && (
                    <p className="p-3 text-xs text-gray-400 font-bold">
                      No matching entries found
                    </p>
                  )}
                </div>
              );
            })()}
        </div>
      )}

      <div className="bg-white p-6 rounded-[2.5rem] border border-blue-100 shadow-xl space-y-4">
        <div className="flex justify-between items-center border-b pb-2">
          <h3 className="font-black text-gray-800 uppercase text-[10px] tracking-widest">
            Bilty Connect
          </h3>
          <button
            type="button"
            onClick={() => {
              setIsDirectEntry(!isDirectEntry);
              setBiltyNumber("");
              setMatchedDetails(null);
              setBiltyLocked(false);
            }}
            className="text-[10px] font-black text-blue-600 bg-blue-50 px-3 py-1.5 rounded-xl uppercase tracking-widest hover:bg-blue-100 transition-colors"
          >
            {isDirectEntry ? "Use Bilty Queue" : "Direct / Opening Stock"}
          </button>
        </div>
        {isDirectEntry ? (
          <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100 mt-2">
            <p className="text-[10px] font-black uppercase text-blue-800 ml-1">
              Reference Note (Optional)
            </p>
            <input
              type="text"
              placeholder="e.g. Existing Godown Stock"
              value={directReference}
              onChange={(e) => setDirectReference(e.target.value)}
              className="w-full border rounded-xl p-3 font-bold bg-white outline-none focus:ring-2 focus:ring-blue-500 mt-2"
            />
          </div>
        ) : (
          <>
            <div className="flex gap-2 items-end mt-2 flex-wrap">
              <BiltyInput
                prefixOptions={biltyPrefixes}
                prefix={biltyPrefix}
                setPrefix={setBiltyPrefix}
                number={biltyNumber}
                setNumber={setBiltyNumber}
                onSearch={handleLookup}
                disabled={biltyLocked}
              />
              <div className="min-w-[120px]">
                <p className="text-[10px] font-black uppercase text-gray-400 ml-1">
                  Packages
                </p>
                <input
                  type="number"
                  min="1"
                  value={inwardPackages}
                  disabled={
                    biltyLocked ||
                    (packagesAutoLocked && Number(inwardPackages) > 1)
                  }
                  onChange={(e) => setInwardPackages(e.target.value || "1")}
                  className={`w-full border rounded-xl p-3 font-bold outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px] ${biltyLocked || (packagesAutoLocked && Number(inwardPackages) > 1) ? "bg-gray-100 opacity-50 cursor-not-allowed" : "bg-gray-50 focus:bg-white"}`}
                />
              </div>
            </div>
            {biltyLocked && (
              <button
                type="button"
                onClick={() => {
                  setBiltyLocked(false);
                  setMatchedDetails(null);
                }}
                className="text-[10px] font-black text-orange-600 bg-orange-50 px-3 py-1.5 rounded-xl uppercase tracking-widest hover:bg-orange-100 transition-colors mt-1"
              >
                🔓 Change Bilty
              </button>
            )}
            {matchedDetails && (
              <div className="bg-green-50 text-green-700 p-3 rounded-xl border border-green-200 text-xs font-bold mt-2">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle size={16} /> Record connected.
                </div>
                <div className="grid grid-cols-2 gap-1 text-[10px] mt-1">
                  {(matchedDetails as TransitRecord).transportName && (
                    <p>
                      Transport:{" "}
                      <b>{(matchedDetails as TransitRecord).transportName}</b>
                    </p>
                  )}
                  {(matchedDetails as PendingParcel).supplier && (
                    <p>
                      Supplier:{" "}
                      <b>{(matchedDetails as PendingParcel).supplier}</b>
                    </p>
                  )}
                  {((matchedDetails as PendingParcel).itemCategory ||
                    (matchedDetails as TransitRecord).category) && (
                    <p>
                      Category:{" "}
                      <b>
                        {(matchedDetails as PendingParcel).itemCategory ||
                          (matchedDetails as TransitRecord).category}
                      </b>
                    </p>
                  )}
                  {((matchedDetails as PendingParcel).itemName ||
                    (matchedDetails as TransitRecord).itemName) && (
                    <p>
                      Item:{" "}
                      <b>
                        {(matchedDetails as PendingParcel).itemName ||
                          (matchedDetails as TransitRecord).itemName}
                      </b>
                    </p>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Multi-Bale Section when packages > 1 */}
      {Number(inwardPackages) >= 1 && perBaleData.length > 0 && (
        <div className="bg-white rounded-[2rem] border border-blue-100 shadow-xl overflow-hidden animate-fade-in-down">
          <div className="bg-blue-700 text-white px-6 py-4 flex items-center justify-between">
            <h3 className="font-black uppercase tracking-widest text-xs">
              Multi-Bale Processing ({perBaleData.length} Bales)
            </h3>
          </div>
          {/* Bale Tabs */}
          <div className="flex overflow-x-auto scrollbar-hide border-b bg-gray-50">
            {perBaleData.map((bale, idx) => (
              <button
                key={bale.label}
                type="button"
                onClick={() => {
                  setActiveBaleIdx(idx);
                  setItemForm((prev) => ({
                    ...prev,
                    itemName: "",
                    shopQty: "",
                    godownQuants: {},
                    attributes: {},
                  }));
                }}
                className={`px-4 py-3 text-[10px] font-black uppercase shrink-0 transition-colors border-r last:border-r-0 ${
                  activeBaleIdx === idx
                    ? bale.locked
                      ? "bg-gray-500 text-white"
                      : "bg-blue-600 text-white"
                    : bale.locked
                      ? "bg-gray-100 text-gray-400"
                      : bale.received
                        ? "bg-white text-gray-600 hover:bg-blue-50"
                        : "bg-orange-50 text-orange-600 hover:bg-orange-100"
                }`}
              >
                {bale.locked ? "🔒 " : ""}
                {bale.label.split("(").pop()?.replace(")", "") || idx + 1}
                {bale.items.length > 0 && (
                  <span className="ml-1 bg-white/30 px-1 rounded-full">
                    {bale.items.length}
                  </span>
                )}
              </button>
            ))}
          </div>
          {/* Active Bale */}
          {(() => {
            const bale = perBaleData[activeBaleIdx];
            if (!bale) return null;
            if (bale.locked) {
              return (
                <div className="p-6">
                  <div className="bg-gray-100 border-2 border-gray-300 rounded-2xl p-6 text-center">
                    <div className="text-4xl mb-2">🔒</div>
                    <h4 className="font-black text-lg text-gray-700">
                      {bale.label}
                    </h4>
                    <p className="text-sm font-bold text-gray-500 mt-1">
                      {bale.pendingSaved
                        ? "Saved as Not Received on"
                        : "Already opened on"}{" "}
                      <span className="text-gray-700">{bale.lockedDate}</span>{" "}
                      by{" "}
                      <span className="text-gray-700">
                        {bale.lockedBy || "unknown"}
                      </span>
                    </p>
                    <p className="text-[10px] text-gray-400 font-bold mt-2 uppercase tracking-wider">
                      {bale.pendingSaved
                        ? `Bale transferred to ${bale.pendingSavedTarget || "transit/queue"} as Not Received. Select another bale tab.`
                        : "This bale is already in inventory. Select another bale tab to continue."}
                    </p>
                    {bale.items.length > 0 && (
                      <div className="mt-4 text-left space-y-1">
                        <p className="text-[10px] font-black uppercase text-gray-400 mb-2">
                          Items in this bale:
                        </p>
                        {bale.totalQty && (
                          <div className="text-xs font-bold text-blue-700 bg-blue-50 rounded-xl px-3 py-2 border border-blue-200 mb-2">
                            Total Bale Qty: {bale.totalQty}
                          </div>
                        )}
                        {bale.items.map((it, i) => {
                          const itemQty =
                            (Number(it.shopQty) || 0) +
                            Object.values(it.godownQuants || {}).reduce(
                              (a, b) => a + Number(b || 0),
                              0,
                            );
                          return (
                            <div
                              key={`${it.itemName}-${i}`}
                              className="text-xs text-gray-600 bg-white rounded-xl px-3 py-2 border"
                            >
                              <span className="font-bold">
                                {it.category} · {it.itemName}
                              </span>
                              {itemQty > 0 && (
                                <span className="ml-2 text-green-700 font-black">
                                  Qty: {itemQty}
                                </span>
                              )}
                              {Number(it.shopQty) > 0 && (
                                <span className="ml-1 text-indigo-600">
                                  (Shop: {it.shopQty}
                                </span>
                              )}
                              {Object.entries(it.godownQuants || {})
                                .filter(([, q]) => Number(q) > 0)
                                .map(([g, q]) => (
                                  <span key={g} className="ml-1 text-gray-500">
                                    {g}: {q}
                                  </span>
                                ))}
                              {Number(it.shopQty) > 0 && <span>)</span>}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            }
            return (
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase text-gray-400">
                      Bale Label
                    </p>
                    <h4 className="font-black text-lg text-gray-900">
                      {bale.label}
                    </h4>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black uppercase text-gray-400">
                      Status:
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const updated = [...perBaleData];
                        updated[activeBaleIdx] = {
                          ...updated[activeBaleIdx],
                          received: !bale.received,
                        };
                        setPerBaleData(updated);
                      }}
                      className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors ${
                        bale.received
                          ? "bg-green-100 text-green-700 border border-green-300"
                          : "bg-orange-100 text-orange-700 border border-orange-300"
                      }`}
                    >
                      {bale.received ? "✓ Received" : "⏳ Not Received"}
                    </button>
                  </div>
                </div>
                {!bale.received && (
                  <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 space-y-2">
                    <p className="text-[10px] font-black uppercase text-orange-800">
                      Save undelivered bale to:
                    </p>
                    <div className="flex gap-3">
                      {(["transit", "queue"] as const).map((loc) => (
                        <button
                          key={loc}
                          type="button"
                          onClick={() => {
                            const updated = [...perBaleData];
                            updated[activeBaleIdx] = {
                              ...updated[activeBaleIdx],
                              notReceivedTarget: loc,
                            };
                            setPerBaleData(updated);
                          }}
                          className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase border ${
                            bale.notReceivedTarget === loc
                              ? loc === "transit"
                                ? "bg-indigo-600 text-white border-indigo-600"
                                : "bg-amber-600 text-white border-amber-600"
                              : "bg-white text-gray-600 border-gray-300"
                          }`}
                        >
                          {loc === "transit" ? "→ Transit" : "→ Queue"}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {bale.received && (
                  <>
                    <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
                      <p className="text-[10px] font-black uppercase text-blue-800 ml-1 mb-2">
                        Total Qty in this Bale
                      </p>
                      <input
                        type="number"
                        value={bale.totalQty}
                        onChange={(e) => {
                          const updated = [...perBaleData];
                          updated[activeBaleIdx] = {
                            ...updated[activeBaleIdx],
                            totalQty: e.target.value,
                          };
                          setPerBaleData(updated);
                        }}
                        placeholder="Enter total qty"
                        className="w-full border border-blue-300 rounded-xl p-3 font-bold outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      />
                      {bale.totalQty &&
                        (() => {
                          const dist = bale.items.reduce(
                            (s, i) =>
                              s +
                              (Number(i.shopQty) || 0) +
                              Object.values(i.godownQuants).reduce(
                                (a, b) => a + Number(b || 0),
                                0,
                              ),
                            0,
                          );
                          const exp = Number(bale.totalQty);
                          return (
                            <p
                              className={`text-[10px] font-black mt-2 ${dist === exp ? "text-green-700" : "text-orange-600"}`}
                            >
                              {dist === exp
                                ? `✓ ${dist}/${exp} — All qty entered`
                                : `⚠ ${dist}/${exp} — Remaining: ${exp - dist}`}
                            </p>
                          );
                        })()}
                    </div>
                    {/* Items in this bale */}
                    {bale.items.length > 0 && (
                      <div className="bg-gray-50 rounded-2xl border overflow-hidden">
                        <div className="bg-gray-800 text-white px-4 py-2 flex justify-between items-center">
                          <span className="text-[10px] font-black uppercase">
                            Items ({bale.items.length})
                          </span>
                        </div>
                        <table className="w-full text-xs">
                          <tbody className="divide-y">
                            {bale.items.map((item, iIdx) => (
                              <tr key={item.id}>
                                <td className="px-4 py-3 font-bold">
                                  {item.itemName}{" "}
                                  <span className="text-gray-400">
                                    ({item.category})
                                  </span>
                                </td>
                                <td className="px-4 py-3 font-black text-center">
                                  {(Number(item.shopQty) || 0) +
                                    Object.values(item.godownQuants).reduce(
                                      (a, b) => a + Number(b || 0),
                                      0,
                                    )}
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updated = [...perBaleData];
                                      updated[activeBaleIdx] = {
                                        ...updated[activeBaleIdx],
                                        items: updated[
                                          activeBaleIdx
                                        ].items.filter((_, i) => i !== iIdx),
                                      };
                                      setPerBaleData(updated);
                                    }}
                                    className="text-red-400 p-1.5 bg-red-50 rounded-lg"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {/* Inline per-bale item form */}
                    {(() => {
                      const bf = getPerBaleForm(activeBaleIdx);
                      const bfCat = categories.find(
                        (c) => c.name === bf.category,
                      );
                      const _effectiveItemName = bf.isNewItem
                        ? bf.newItemName
                        : bf.itemName;
                      return (
                        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 space-y-3">
                          <p className="text-[10px] font-black uppercase text-blue-800 tracking-widest">
                            Add Item to This Bale
                          </p>
                          <div className="grid grid-cols-1 gap-3">
                            <div>
                              <p className="text-[10px] font-black uppercase text-gray-500 mb-1">
                                Category *
                              </p>
                              <select
                                value={bf.category}
                                onChange={(e) =>
                                  setPerBaleForm(activeBaleIdx, {
                                    category: e.target.value,
                                    itemName: "",
                                    newItemName: "",
                                    attributes: {},
                                  })
                                }
                                className="w-full border rounded-xl p-2.5 font-bold bg-white focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                              >
                                <option value="">Select Category</option>
                                {categories.map((c) => (
                                  <option key={c.name} value={c.name}>
                                    {c.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <p className="text-[10px] font-black uppercase text-gray-500">
                                  Item Name *
                                </p>
                                <label className="flex items-center gap-1 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={bf.isNewItem}
                                    onChange={(e) =>
                                      setPerBaleForm(activeBaleIdx, {
                                        isNewItem: e.target.checked,
                                        itemName: "",
                                        newItemName: "",
                                      })
                                    }
                                    className="w-3 h-3 accent-blue-600"
                                  />
                                  <span className="text-[10px] font-black uppercase text-blue-600">
                                    ＋ New Item
                                  </span>
                                </label>
                              </div>
                              {bf.isNewItem ? (
                                <input
                                  type="text"
                                  value={bf.newItemName}
                                  onChange={(e) =>
                                    setPerBaleForm(activeBaleIdx, {
                                      newItemName: e.target.value,
                                    })
                                  }
                                  placeholder="Type new item name"
                                  className="w-full border border-blue-300 rounded-xl p-2.5 font-bold bg-yellow-50 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                />
                              ) : (
                                <ItemNameCombo
                                  category={bf.category}
                                  value={bf.itemName}
                                  onChange={(val) =>
                                    setPerBaleForm(activeBaleIdx, {
                                      itemName: val,
                                    })
                                  }
                                  inventory={inventory}
                                  activeBusinessId={activeBusinessId}
                                  onSelectItem={(inv) => {
                                    setPerBaleForm(activeBaleIdx, {
                                      itemName: inv.itemName,
                                      attributes: {
                                        ...inv.attributes,
                                      } as Record<string, string>,
                                      saleRate: String(inv.saleRate || ""),
                                      purchaseRate: String(
                                        inv.purchaseRate || "",
                                      ),
                                    });
                                  }}
                                />
                              )}
                            </div>
                            <div>
                              <p className="text-[10px] font-black uppercase text-gray-500 mb-1">
                                Total Qty in this item *
                              </p>
                              <input
                                type="number"
                                value={bf.totalQty}
                                onChange={(e) =>
                                  setPerBaleForm(activeBaleIdx, {
                                    totalQty: e.target.value,
                                  })
                                }
                                placeholder="Qty for this item"
                                className="w-full border rounded-xl p-2.5 font-bold bg-white focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                              />
                            </div>
                            {bfCat && bfCat.fields.length > 0 && (
                              <div className="grid grid-cols-2 gap-2">
                                {bfCat.fields.map((f) => (
                                  <div key={f.name}>
                                    <p className="text-[10px] font-black uppercase text-blue-800 mb-1">
                                      {f.name}
                                    </p>
                                    {f.type === "select" ? (
                                      <select
                                        value={bf.attributes[f.name] || ""}
                                        onChange={(e) =>
                                          setPerBaleForm(activeBaleIdx, {
                                            attributes: {
                                              ...bf.attributes,
                                              [f.name]: e.target.value,
                                            },
                                          })
                                        }
                                        className="w-full border rounded-xl p-2 font-bold text-sm bg-white"
                                      >
                                        <option value="">-</option>
                                        {(f.options || []).map((o) => (
                                          <option key={o} value={o}>
                                            {o}
                                          </option>
                                        ))}
                                      </select>
                                    ) : f.type === "combo" ? (
                                      <ComboInput
                                        options={f.options || []}
                                        value={bf.attributes[f.name] || ""}
                                        onChange={(v) =>
                                          setPerBaleForm(activeBaleIdx, {
                                            attributes: {
                                              ...bf.attributes,
                                              [f.name]: v,
                                            },
                                          })
                                        }
                                        className="w-full border rounded-xl p-2 font-bold text-sm bg-white"
                                      />
                                    ) : (
                                      <input
                                        type="text"
                                        value={bf.attributes[f.name] || ""}
                                        onChange={(e) =>
                                          setPerBaleForm(activeBaleIdx, {
                                            attributes: {
                                              ...bf.attributes,
                                              [f.name]: e.target.value,
                                            },
                                          })
                                        }
                                        className="w-full border rounded-xl p-2 font-bold text-sm bg-white"
                                      />
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <p className="text-[10px] font-black uppercase text-green-700 mb-1">
                                  Shop Qty
                                </p>
                                <input
                                  type="number"
                                  value={bf.shopQty}
                                  onChange={(e) =>
                                    setPerBaleForm(activeBaleIdx, {
                                      shopQty: e.target.value,
                                    })
                                  }
                                  placeholder="Shop"
                                  className="w-full border-2 border-green-200 rounded-xl p-2.5 font-black text-green-700 outline-none"
                                />
                              </div>
                              {godowns.map((g) => (
                                <div key={g}>
                                  <p className="text-[10px] font-black uppercase text-amber-700 mb-1 truncate">
                                    {g}
                                  </p>
                                  <input
                                    type="number"
                                    value={bf.godownQuants[g] || ""}
                                    onChange={(e) =>
                                      setPerBaleForm(activeBaleIdx, {
                                        godownQuants: {
                                          ...bf.godownQuants,
                                          [g]: e.target.value,
                                        },
                                      })
                                    }
                                    placeholder={g}
                                    className="w-full border-2 border-amber-200 rounded-xl p-2.5 font-black text-amber-700 outline-none"
                                  />
                                </div>
                              ))}
                            </div>
                            {/* Qty ratio display */}
                            {(() => {
                              const totalQtyNum = Number(bf.totalQty) || 0;
                              const distributed =
                                (Number(bf.shopQty) || 0) +
                                Object.values(bf.godownQuants).reduce(
                                  (a, b) => a + Number(b || 0),
                                  0,
                                );
                              const remaining = totalQtyNum - distributed;
                              if (totalQtyNum <= 0) return null;
                              const color =
                                remaining < 0
                                  ? "text-red-600 bg-red-50 border-red-200"
                                  : remaining === 0
                                    ? "text-green-700 bg-green-50 border-green-200"
                                    : "text-amber-700 bg-amber-50 border-amber-200";
                              return (
                                <div
                                  className={`text-xs font-black border rounded-xl px-3 py-2 ${color}`}
                                >
                                  {distributed}/{totalQtyNum} — Remaining:{" "}
                                  {remaining}
                                  {remaining < 0 && " ⚠ Over-allocated!"}
                                  {remaining === 0 && " ✓"}
                                </div>
                              );
                            })()}
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <p className="text-[10px] font-black uppercase text-blue-600 mb-1">
                                  {_lbl("saleRate", "Sale Rate (₹)")}
                                </p>
                                <input
                                  type="number"
                                  value={bf.saleRate}
                                  onChange={(e) => {
                                    const newVal = e.target.value;
                                    const existingItem = Object.values(
                                      inventory,
                                    ).find(
                                      (inv) =>
                                        (!inv.businessId ||
                                          inv.businessId ===
                                            activeBusinessId) &&
                                        inv.itemName.toLowerCase() ===
                                          (bf.isNewItem
                                            ? bf.newItemName
                                            : bf.itemName
                                          ).toLowerCase() &&
                                        inv.category === bf.category,
                                    );
                                    if (
                                      existingItem &&
                                      String(existingItem.saleRate) !==
                                        newVal &&
                                      newVal
                                    ) {
                                      setSaleRatePrompt({
                                        show: true,
                                        newRate: newVal,
                                        mode: "multi",
                                        baleIdx: activeBaleIdx,
                                        existingSku: existingItem.sku,
                                      });
                                    } else {
                                      setPerBaleForm(activeBaleIdx, {
                                        saleRate: newVal,
                                      });
                                    }
                                  }}
                                  className="w-full border-2 border-blue-200 rounded-xl p-2.5 font-black text-blue-700 outline-none"
                                />
                              </div>
                              {currentUser.role === "admin" && (
                                <div>
                                  <p className="text-[10px] font-black uppercase text-gray-500 mb-1">
                                    {_lbl("purchaseRate", "Pur. Rate (₹)")}
                                  </p>
                                  <input
                                    type="number"
                                    value={bf.purchaseRate}
                                    onChange={(e) =>
                                      setPerBaleForm(activeBaleIdx, {
                                        purchaseRate: e.target.value,
                                      })
                                    }
                                    className="w-full border rounded-xl p-2.5 font-black text-gray-600 outline-none"
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const bfNow = getPerBaleForm(activeBaleIdx);
                              const finalItemName = bfNow.isNewItem
                                ? bfNow.newItemName
                                : bfNow.itemName;
                              if (!finalItemName || !bfNow.category) {
                                showNotification(
                                  "Fill category and item name first",
                                  "error",
                                );
                                return;
                              }
                              const dist =
                                (Number(bfNow.shopQty) || 0) +
                                Object.values(bfNow.godownQuants).reduce(
                                  (a, b) => a + Number(b || 0),
                                  0,
                                );
                              const qty = Number(bfNow.totalQty) || 0;
                              if (qty > 0 && dist !== qty) {
                                showNotification(
                                  `Distribution (${dist}) must equal Total Qty (${qty})`,
                                  "error",
                                );
                                return;
                              }
                              const sku = generateSku(
                                bfNow.category,
                                finalItemName,
                                bfNow.attributes,
                                bfNow.saleRate,
                                activeBusinessId,
                              );
                              const newItem: BaleItem = {
                                id: Date.now(),
                                sku,
                                category: bfNow.category,
                                itemName: finalItemName,
                                attributes: bfNow.attributes,
                                shopQty: bfNow.shopQty,
                                godownQuants: bfNow.godownQuants,
                                saleRate: bfNow.saleRate,
                                purchaseRate: bfNow.purchaseRate,
                                customData: {},
                              };
                              const updated = [...perBaleData];
                              updated[activeBaleIdx] = {
                                ...updated[activeBaleIdx],
                                items: [
                                  ...updated[activeBaleIdx].items,
                                  newItem,
                                ],
                              };
                              setPerBaleData(updated);
                              setPerBaleForm(activeBaleIdx, {
                                itemName: "",
                                newItemName: "",
                                isNewItem: false,
                                shopQty: "",
                                godownQuants: {},
                                totalQty: "",
                                attributes: {},
                              });
                              showNotification("Item added to bale", "success");
                            }}
                            className="w-full bg-blue-600 text-white font-black py-2.5 rounded-xl uppercase tracking-widest text-[10px] hover:bg-blue-700"
                          >
                            ＋ Add Item to Bale {activeBaleIdx + 1}
                          </button>
                        </div>
                      );
                    })()}
                  </>
                )}
              </div>
            );
          })()}
          {/* Per-Bale Save Button */}
          {perBaleData[activeBaleIdx] && !perBaleData[activeBaleIdx].locked && (
            <div className="px-6 pt-2">
              <button
                type="button"
                onClick={() => {
                  const bale = perBaleData[activeBaleIdx];
                  if (!bale || bale.locked) return;
                  if (bale.received) {
                    if (bale.items.length === 0) {
                      showNotification(
                        "Add items to this bale before saving.",
                        "error",
                      );
                      return;
                    }
                    if (bale.totalQty) {
                      const dist = bale.items.reduce(
                        (s, i) =>
                          s +
                          (Number(i.shopQty) || 0) +
                          Object.values(i.godownQuants).reduce(
                            (a, b) => a + Number(b || 0),
                            0,
                          ),
                        0,
                      );
                      if (dist !== Number(bale.totalQty)) {
                        showNotification(
                          `Qty mismatch: ${dist} vs ${bale.totalQty}`,
                          "error",
                        );
                        return;
                      }
                    }
                    const existingTx = transactions.find(
                      (t) =>
                        t.biltyNo?.toLowerCase() === bale.label.toLowerCase() &&
                        (!t.businessId || t.businessId === activeBusinessId),
                    );
                    if (existingTx && currentUser.role !== "admin") {
                      showNotification(
                        `Bilty ${bale.label} already processed. Admin override required.`,
                        "error",
                      );
                      return;
                    }
                    // Check for new items that need to be created
                    const newItemNames = bale.items
                      .filter((itm) => {
                        if (!itm.itemName || !itm.category) return false;
                        return !Object.values(inventory).some(
                          (inv) =>
                            (!inv.businessId ||
                              inv.businessId === activeBusinessId) &&
                            inv.category === itm.category &&
                            inv.itemName.toLowerCase() ===
                              itm.itemName.toLowerCase(),
                        );
                      })
                      .map((itm) => `${itm.itemName} (${itm.category})`);
                    const doSave = () => {
                      // Update stock (updateStock handles new item creation automatically)
                      for (const itm of bale.items) {
                        if (Number(itm.shopQty) > 0)
                          updateStock(
                            itm.sku,
                            {
                              ...itm,
                              saleRate: Number(itm.saleRate),
                              purchaseRate: Number(itm.purchaseRate),
                            },
                            Number(itm.shopQty),
                            0,
                            "Main Godown",
                          );
                        for (const [g, q] of Object.entries(itm.godownQuants)) {
                          if (Number(q) > 0)
                            updateStock(
                              itm.sku,
                              {
                                ...itm,
                                saleRate: Number(itm.saleRate),
                                purchaseRate: Number(itm.purchaseRate),
                              },
                              0,
                              Number(q),
                              g,
                            );
                        }
                      }
                      // Create transaction
                      setTransactions((prev) => [
                        {
                          id: Date.now(),
                          type: "INWARD" as const,
                          biltyNo: bale.label,
                          businessId: activeBusinessId,
                          date: new Date().toISOString().split("T")[0],
                          user: currentUser.username,
                          transportName:
                            (matchedDetails as TransitRecord)?.transportName ||
                            "",
                          itemsCount: bale.totalQty
                            ? Number(bale.totalQty)
                            : bale.items.reduce(
                                (s, i) =>
                                  s +
                                  (Number(i.shopQty) || 0) +
                                  Object.values(i.godownQuants).reduce(
                                    (a, b) => a + Number(b || 0),
                                    0,
                                  ),
                                0,
                              ),
                          totalQtyInBale: bale.totalQty
                            ? Number(bale.totalQty)
                            : undefined,
                          baleItemsList: bale.items.map((i) => ({
                            itemName: i.itemName,
                            category: i.category,
                            attributes: { ...i.attributes },
                            shopQty: Number(i.shopQty) || 0,
                            godownQuants: Object.fromEntries(
                              Object.entries(i.godownQuants).map(([g, q]) => [
                                g,
                                Number(q) || 0,
                              ]),
                            ),
                            saleRate: Number(i.saleRate) || 0,
                            purchaseRate: Number(i.purchaseRate) || 0,
                            qty:
                              (Number(i.shopQty) || 0) +
                              Object.values(i.godownQuants).reduce(
                                (a, b) => a + Number(b || 0),
                                0,
                              ),
                          })),
                        },
                        ...prev,
                      ]);
                      // Remove from transit/queue
                      setTransitGoods((prev) =>
                        prev.filter(
                          (g) =>
                            g.biltyNo?.toLowerCase() !==
                            bale.label.toLowerCase(),
                        ),
                      );
                      setPendingParcels((prev) =>
                        prev.filter(
                          (p) =>
                            p.biltyNo?.toLowerCase() !==
                            bale.label.toLowerCase(),
                        ),
                      );
                      // Add to inwardSaved
                      if (setInwardSaved) {
                        setInwardSaved((prev) => [
                          {
                            id: Date.now(),
                            biltyNumber: bale.label,
                            baseNumber: bale.label.replace(/X\d+\(\d+\)$/i, ""),
                            packages: inwardPackages,
                            items: bale.items.map((i) => ({
                              category: i.category,
                              itemName: i.itemName,
                              qty:
                                (Number(i.shopQty) || 0) +
                                Object.values(i.godownQuants).reduce(
                                  (a, b) => a + Number(b || 0),
                                  0,
                                ),
                              shopQty: Number(i.shopQty) || 0,
                              godownQty: Object.values(i.godownQuants).reduce(
                                (a, b) => a + Number(b || 0),
                                0,
                              ),
                              saleRate: Number(i.saleRate) || 0,
                              purchaseRate: Number(i.purchaseRate) || 0,
                              attributes: i.attributes || {},
                            })),
                            savedBy: currentUser.username,
                            savedAt: new Date().toISOString(),
                            transporter:
                              (matchedDetails as TransitRecord)
                                ?.transportName || "",
                            supplier:
                              (matchedDetails as TransitRecord)?.supplierName ||
                              (matchedDetails as PendingParcel)?.supplier ||
                              "",
                            businessId: activeBusinessId,
                          },
                          ...prev,
                        ]);
                      }
                      // Mark bale as locked
                      const updated = [...perBaleData];
                      updated[activeBaleIdx] = {
                        ...updated[activeBaleIdx],
                        locked: true,
                        lockedBy: currentUser.username,
                        lockedDate: new Date().toISOString().split("T")[0],
                      };
                      setPerBaleData(updated);
                      showNotification(
                        `Bale ${bale.label} saved to inventory!`,
                        "success",
                      );
                    };
                    if (newItemNames.length > 0) {
                      setConfirmDialog({
                        message: `Create new inventory items?\n${newItemNames.join(", ")}`,
                        onConfirm: doSave,
                      });
                    } else {
                      doSave();
                    }
                  } else {
                    // Not received: save to transit/queue
                    const inTransit = transitGoods.some(
                      (g) =>
                        g.biltyNo?.toLowerCase() === bale.label.toLowerCase() &&
                        (!g.businessId || g.businessId === activeBusinessId),
                    );
                    const inQueue = pendingParcels.some(
                      (p) =>
                        p.biltyNo?.toLowerCase() === bale.label.toLowerCase() &&
                        (!p.businessId || p.businessId === activeBusinessId),
                    );
                    if (!inTransit && !inQueue) {
                      if (bale.notReceivedTarget === "transit") {
                        setTransitGoods((prev) => [
                          {
                            id: Date.now(),
                            biltyNo: bale.label,
                            transportName:
                              (matchedDetails as TransitRecord)
                                ?.transportName || "",
                            supplierName:
                              (matchedDetails as PendingParcel)?.supplier || "",
                            itemName: bale.items[0]?.itemName || "",
                            itemCategory: bale.items[0]?.category || "",
                            packages: "1",
                            date: new Date().toISOString().split("T")[0],
                            addedBy: currentUser.username,
                            businessId: activeBusinessId,
                            customData: {},
                          },
                          ...prev,
                        ]);
                      } else {
                        setPendingParcels((prev) => [
                          {
                            id: Date.now(),
                            biltyNo: bale.label,
                            transportName:
                              (matchedDetails as TransitRecord)
                                ?.transportName || "",
                            packages: "1",
                            dateReceived: new Date()
                              .toISOString()
                              .split("T")[0],
                            businessId: activeBusinessId,
                            itemName: bale.items[0]?.itemName || "",
                            itemCategory: bale.items[0]?.category || "",
                            customData: {},
                          },
                          ...prev,
                        ]);
                      }
                    }
                    setTransactions((prev) => [
                      {
                        id: Date.now(),
                        type: "INWARD_PENDING" as const,
                        biltyNo: bale.label,
                        businessId: activeBusinessId,
                        date: new Date().toISOString().split("T")[0],
                        user: currentUser.username,
                        notes: `Not received — saved to ${bale.notReceivedTarget}`,
                      },
                      ...prev,
                    ]);
                    const updated = [...perBaleData];
                    updated[activeBaleIdx] = {
                      ...updated[activeBaleIdx],
                      locked: true,
                      lockedBy: currentUser.username,
                      lockedDate: new Date().toISOString().split("T")[0],
                      pendingSaved: true,
                      pendingSavedTarget: bale.notReceivedTarget,
                    };
                    setPerBaleData(updated);
                    showNotification(
                      `Bale ${bale.label} transferred to ${bale.notReceivedTarget} as Not Received`,
                      "success",
                    );
                  }
                }}
                disabled={
                  !perBaleData[activeBaleIdx]?.received &&
                  !perBaleData[activeBaleIdx]?.notReceivedTarget
                }
                className="w-full bg-green-600 text-white font-black py-3 rounded-2xl uppercase tracking-widest text-xs shadow hover:bg-green-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {perBaleData[activeBaleIdx]?.received
                  ? `💾 Save Bale ${activeBaleIdx + 1} — ${perBaleData[activeBaleIdx]?.label}`
                  : `📦 Store as Not Received — ${perBaleData[activeBaleIdx]?.label}`}
              </button>
            </div>
          )}
          {/* Save All Bales Button */}
          <div className="px-6 pb-6">
            <button
              type="button"
              onClick={() => {
                // Validate all received bales (skip locked ones - already processed)
                for (const bale of perBaleData) {
                  if (bale.locked) continue;
                  if (!bale.received) continue;
                  if (bale.items.length === 0) {
                    showNotification(
                      `Bale ${bale.label} has no items. Add items or mark as not received.`,
                      "error",
                    );
                    return;
                  }
                  if (bale.totalQty) {
                    const dist = bale.items.reduce(
                      (s, i) =>
                        s +
                        (Number(i.shopQty) || 0) +
                        Object.values(i.godownQuants).reduce(
                          (a, b) => a + Number(b || 0),
                          0,
                        ),
                      0,
                    );
                    if (dist !== Number(bale.totalQty)) {
                      showNotification(
                        `Bale ${bale.label}: qty mismatch (${dist} vs ${bale.totalQty})`,
                        "error",
                      );
                      return;
                    }
                  }
                }
                // Check for duplicate bilties (skip locked ones)
                for (const bale of perBaleData) {
                  if (bale.locked) continue;
                  if (!bale.received) continue;
                  const existing = transactions.find(
                    (t) =>
                      t.biltyNo?.toLowerCase() === bale.label.toLowerCase() &&
                      (!t.businessId || t.businessId === activeBusinessId),
                  );
                  if (existing && currentUser.role !== "admin") {
                    showNotification(
                      `Bilty ${bale.label} already processed. Admin override required.`,
                      "error",
                    );
                    return;
                  }
                }
                // Process each bale (skip locked ones - already in inventory)
                // Collect all new transactions for a single batched state update
                const batchedInwardTxns: Transaction[] = [];
                const batchedPendingTxns: Transaction[] = [];
                const labelsToRemoveFromTransit: string[] = [];
                const labelsToRemoveFromQueue: string[] = [];
                for (const bale of perBaleData) {
                  if (bale.locked) continue;
                  if (bale.received) {
                    // Fix 6: Only create inventory items after posting (no pre-creation)
                    for (const itm of bale.items) {
                      if (itm.itemName && itm.category) {
                        const exists = Object.values(inventory).some(
                          (inv) =>
                            (!inv.businessId ||
                              inv.businessId === activeBusinessId) &&
                            inv.category === itm.category &&
                            inv.itemName.toLowerCase() ===
                              itm.itemName.toLowerCase(),
                        );
                        if (!exists) {
                          const newSku = generateSku(
                            itm.category,
                            itm.itemName,
                            {},
                            "0",
                            activeBusinessId,
                          );
                          setInventory((prev) => ({
                            ...prev,
                            [newSku]: {
                              sku: newSku,
                              category: itm.category,
                              itemName: itm.itemName,
                              attributes: {},
                              shop: 0,
                              godowns: {},
                              saleRate: 0,
                              purchaseRate: 0,
                              businessId: activeBusinessId,
                            },
                          }));
                        }
                      }
                    }
                    // Update stock
                    for (const itm of bale.items) {
                      if (Number(itm.shopQty) > 0)
                        updateStock(
                          itm.sku,
                          {
                            ...itm,
                            saleRate: Number(itm.saleRate),
                            purchaseRate: Number(itm.purchaseRate),
                          },
                          Number(itm.shopQty),
                          0,
                          "Main Godown",
                        );
                      for (const [g, q] of Object.entries(itm.godownQuants)) {
                        if (Number(q) > 0)
                          updateStock(
                            itm.sku,
                            {
                              ...itm,
                              saleRate: Number(itm.saleRate),
                              purchaseRate: Number(itm.purchaseRate),
                            },
                            0,
                            Number(q),
                            g,
                          );
                      }
                    }
                    // Collect for batch transaction update
                    batchedInwardTxns.push({
                      id: Date.now() + Math.random(),
                      type: "INWARD",
                      biltyNo: bale.label,
                      businessId: activeBusinessId,
                      date: new Date().toISOString().split("T")[0],
                      user: currentUser.username,
                      transportName:
                        (matchedDetails as TransitRecord)?.transportName || "",
                      itemsCount: bale.totalQty
                        ? Number(bale.totalQty)
                        : bale.items.reduce(
                            (s, i) =>
                              s +
                              (Number(i.shopQty) || 0) +
                              Object.values(i.godownQuants).reduce(
                                (a, b) => a + Number(b || 0),
                                0,
                              ),
                            0,
                          ),
                      totalQtyInBale: bale.totalQty
                        ? Number(bale.totalQty)
                        : undefined,
                      baleItemsList: bale.items.map((i) => ({
                        itemName: i.itemName,
                        category: i.category,
                        attributes: { ...i.attributes },
                        shopQty: Number(i.shopQty) || 0,
                        godownQuants: Object.fromEntries(
                          Object.entries(i.godownQuants).map(([g, q]) => [
                            g,
                            Number(q) || 0,
                          ]),
                        ),
                        saleRate: Number(i.saleRate) || 0,
                        purchaseRate: Number(i.purchaseRate) || 0,
                        qty:
                          (Number(i.shopQty) || 0) +
                          Object.values(i.godownQuants).reduce(
                            (a, b) => a + Number(b || 0),
                            0,
                          ),
                      })),
                    });
                    labelsToRemoveFromTransit.push(bale.label.toLowerCase());
                    labelsToRemoveFromQueue.push(bale.label.toLowerCase());
                  } else {
                    // Not received: check if already in transit or queue
                    const inTransit = transitGoods.some(
                      (g) =>
                        g.biltyNo?.toLowerCase() === bale.label.toLowerCase() &&
                        (!g.businessId || g.businessId === activeBusinessId),
                    );
                    const inQueue = pendingParcels.some(
                      (p) =>
                        p.biltyNo?.toLowerCase() === bale.label.toLowerCase() &&
                        (!p.businessId || p.businessId === activeBusinessId),
                    );
                    if (!inTransit && !inQueue) {
                      if (bale.notReceivedTarget === "transit") {
                        setTransitGoods((prev) => [
                          {
                            id: Date.now() + Math.random(),
                            biltyNo: bale.label,
                            transportName:
                              (matchedDetails as TransitRecord)
                                ?.transportName || "",
                            supplierName:
                              (matchedDetails as PendingParcel)?.supplier || "",
                            itemName: bale.items[0]?.itemName || "",
                            itemCategory: bale.items[0]?.category || "",
                            packages: "1",
                            date: new Date().toISOString().split("T")[0],
                            addedBy: currentUser.username,
                            businessId: activeBusinessId,
                            customData: {},
                          },
                          ...prev,
                        ]);
                      } else {
                        setPendingParcels((prev) => [
                          {
                            id: Date.now() + Math.random(),
                            biltyNo: bale.label,
                            transportName:
                              (matchedDetails as TransitRecord)
                                ?.transportName || "",
                            supplier:
                              (matchedDetails as PendingParcel)?.supplier || "",
                            packages: "1",
                            dateReceived: new Date()
                              .toISOString()
                              .split("T")[0],
                            businessId: activeBusinessId,
                            itemName: bale.items[0]?.itemName || "",
                            itemCategory: bale.items[0]?.category || "",
                            customData: {},
                          },
                          ...prev,
                        ]);
                      }
                    }
                    // Collect pending in history for batch update
                    batchedPendingTxns.push({
                      id: Date.now() + Math.random(),
                      type: "INWARD_PENDING",
                      biltyNo: bale.label,
                      businessId: activeBusinessId,
                      date: new Date().toISOString().split("T")[0],
                      user: currentUser.username,
                      notes: `Not received — saved to ${bale.notReceivedTarget}`,
                    });
                  }
                }
                // Single batched state update for all transactions
                if (
                  batchedInwardTxns.length > 0 ||
                  batchedPendingTxns.length > 0
                ) {
                  setTransactions((prev) => [
                    ...batchedInwardTxns,
                    ...batchedPendingTxns,
                    ...prev,
                  ]);
                }
                // Single batched removal from transit and queue
                if (labelsToRemoveFromTransit.length > 0) {
                  setTransitGoods((prev) =>
                    prev.filter(
                      (g) =>
                        !labelsToRemoveFromTransit.includes(
                          g.biltyNo?.toLowerCase() ?? "",
                        ),
                    ),
                  );
                }
                if (labelsToRemoveFromQueue.length > 0) {
                  setPendingParcels((prev) =>
                    prev.filter(
                      (p) =>
                        !labelsToRemoveFromQueue.includes(
                          p.biltyNo?.toLowerCase() ?? "",
                        ),
                    ),
                  );
                }
                // Add received bales to inwardSaved
                if (setInwardSaved && batchedInwardTxns.length > 0) {
                  const newSavedEntries: InwardSavedEntry[] = perBaleData
                    .filter((b) => !b.locked && b.received)
                    .map((bale) => ({
                      id: Date.now() + Math.random(),
                      biltyNumber: bale.label,
                      baseNumber: bale.label.replace(/X\d+\(\d+\)$/i, ""),
                      packages: inwardPackages,
                      items: bale.items.map((i) => ({
                        category: i.category,
                        itemName: i.itemName,
                        qty:
                          (Number(i.shopQty) || 0) +
                          Object.values(i.godownQuants).reduce(
                            (a, b) => a + Number(b || 0),
                            0,
                          ),
                        shopQty: Number(i.shopQty) || 0,
                        godownQty: Object.values(i.godownQuants).reduce(
                          (a, b) => a + Number(b || 0),
                          0,
                        ),
                        godownBreakdown: Object.fromEntries(
                          Object.entries(i.godownQuants).map(([k, v]) => [
                            k,
                            Number(v) || 0,
                          ]),
                        ),
                        saleRate: Number(i.saleRate) || 0,
                        purchaseRate: Number(i.purchaseRate) || 0,
                        attributes: i.attributes || {},
                      })),
                      savedBy: currentUser.username,
                      savedAt: new Date().toISOString(),
                      transporter:
                        (matchedDetails as TransitRecord)?.transportName || "",
                      supplier:
                        (matchedDetails as TransitRecord)?.supplierName ||
                        (matchedDetails as PendingParcel)?.supplier ||
                        "",
                      businessId: activeBusinessId,
                    }));
                  setInwardSaved((prev) => [...newSavedEntries, ...prev]);
                }
                // Clear all
                setPerBaleData([]);
                setInwardPackages("1");
                setPackagesAutoLocked(false);
                setBiltyNumber("");
                setMatchedDetails(null);
                setBiltyLocked(false);
                setOpeningParcel(null);
                showNotification(
                  `Processed ${perBaleData.filter((b) => b.received).length} received, ${perBaleData.filter((b) => !b.received).length} pending bales`,
                  "success",
                );
              }}
              className="w-full bg-blue-700 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-xs shadow-xl hover:bg-blue-800 transition-transform active:scale-95 mt-4"
            >
              Save All {perBaleData.length} Bales
            </button>
          </div>
        </div>
      )}

      {showItemForm &&
        Number(inwardPackages) <= 1 &&
        perBaleData.length === 0 &&
        false && (
          <form
            onSubmit={addItemToBale}
            className="bg-white p-6 sm:p-8 rounded-[2.5rem] border shadow-xl space-y-6 animate-fade-in-down"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-[10px] font-black uppercase text-gray-400 ml-1">
                  Category *
                </p>
                <select
                  required
                  value={itemForm.category}
                  onChange={(e) =>
                    setItemForm({ ...itemForm, category: e.target.value })
                  }
                  className="w-full border rounded-xl p-3 font-bold bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">Select Category</option>
                  {categories.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <div className="flex items-center justify-between ml-1 mb-1">
                  <p className="text-[10px] font-black uppercase text-gray-400">
                    Item Name *
                  </p>
                  <label className="flex items-center gap-1 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isNewItemMode}
                      onChange={(e) => {
                        setIsNewItemMode(e.target.checked);
                        setItemForm({ ...itemForm, itemName: "" });
                      }}
                      className="w-3 h-3 accent-blue-600"
                    />
                    <span className="text-[10px] font-black uppercase text-blue-600">
                      ＋ New Item
                    </span>
                  </label>
                </div>
                {isNewItemMode ? (
                  <input
                    type="text"
                    value={itemForm.itemName}
                    onChange={(e) =>
                      setItemForm({ ...itemForm, itemName: e.target.value })
                    }
                    placeholder="Type new item name"
                    className="w-full border rounded-xl p-3 font-bold bg-yellow-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none text-sm border-blue-300"
                  />
                ) : (
                  <ItemNameCombo
                    category={itemForm.category}
                    value={itemForm.itemName}
                    onChange={(val) =>
                      setItemForm({ ...itemForm, itemName: val })
                    }
                    inventory={inventory}
                    activeBusinessId={activeBusinessId}
                  />
                )}
              </div>
            </div>
            {/* Total Qty in Bale - permanent, always shown */}
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
              <div className="flex items-start gap-4">
                <div className="flex-1">
                  <p className="text-[10px] font-black uppercase text-blue-800 ml-1">
                    Total Qty in Bale
                  </p>
                  <input
                    type="number"
                    value={totalQty}
                    onChange={(e) => setTotalQty(e.target.value)}
                    placeholder="Enter total qty in this bale"
                    className="w-full border border-blue-300 rounded-xl p-3 font-bold outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
                  />
                </div>
                <div className="shrink-0 pt-5">
                  {totalQty &&
                    (() => {
                      const savedTotal = baleItems.reduce(
                        (sum, i) =>
                          sum +
                          (Number(i.shopQty) || 0) +
                          Object.values(i.godownQuants).reduce(
                            (a, b) => a + Number(b || 0),
                            0,
                          ),
                        0,
                      );
                      const currentFormTotal =
                        (Number(itemForm.shopQty) || 0) +
                        Object.values(itemForm.godownQuants).reduce(
                          (a, b) => a + Number(b || 0),
                          0,
                        );
                      const grandTotal = savedTotal + currentFormTotal;
                      const expected = Number(totalQty);
                      return grandTotal === expected ? (
                        <span className="text-green-700 text-[10px] font-black bg-green-100 border border-green-300 px-3 py-2 rounded-xl block">
                          ✓ {grandTotal}/{expected} — All qty entered
                        </span>
                      ) : (
                        <span className="text-orange-700 text-[10px] font-black bg-orange-100 border border-orange-300 px-3 py-2 rounded-xl block">
                          ⚠ {grandTotal}/{expected} — Remaining:{" "}
                          {expected - grandTotal}
                        </span>
                      );
                    })()}
                </div>
              </div>
            </div>
            {selectedCat && (
              <div className="bg-blue-50/50 p-6 rounded-3xl border border-blue-100 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {(selectedCat?.fields ?? []).map((f) => (
                  <div key={f.name}>
                    <p className="text-[10px] font-black uppercase text-blue-900 ml-1">
                      {f.name}
                    </p>
                    {f.type === "select" ? (
                      <select
                        value={itemForm.attributes[f.name] || ""}
                        onChange={(e) =>
                          setItemForm({
                            ...itemForm,
                            attributes: {
                              ...itemForm.attributes,
                              [f.name]: e.target.value,
                            },
                          })
                        }
                        className="w-full border border-blue-200 rounded-xl p-2.5 font-bold text-sm bg-white"
                      >
                        <option value="">-</option>
                        {(f.options || []).map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    ) : f.type === "combo" ? (
                      <ComboInput
                        options={f.options || []}
                        value={itemForm.attributes[f.name] || ""}
                        onChange={(v) =>
                          setItemForm({
                            ...itemForm,
                            attributes: {
                              ...itemForm.attributes,
                              [f.name]: v,
                            },
                          })
                        }
                        className="w-full border border-blue-200 rounded-xl p-2.5 font-bold text-sm bg-white"
                      />
                    ) : (
                      <input
                        type="text"
                        value={itemForm.attributes[f.name] || ""}
                        onChange={(e) =>
                          setItemForm({
                            ...itemForm,
                            attributes: {
                              ...itemForm.attributes,
                              [f.name]: e.target.value,
                            },
                          })
                        }
                        className="w-full border border-blue-200 rounded-xl p-2.5 font-bold text-sm bg-white"
                      />
                    )}
                  </div>
                ))}
                <DynamicFields
                  fields={customColumns}
                  values={itemForm.customData}
                  onChange={(k, v) =>
                    setItemForm({
                      ...itemForm,
                      customData: { ...itemForm.customData, [k]: v },
                    })
                  }
                />
              </div>
            )}
            <div className="bg-green-50 p-6 rounded-3xl border border-green-200">
              <h4 className="text-[10px] font-black text-green-900 uppercase tracking-widest mb-4 ml-1">
                Distribution
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase text-green-700 ml-1">
                    Shop Qty
                  </p>
                  <input
                    type="number"
                    placeholder="Shop"
                    value={itemForm.shopQty}
                    onChange={(e) =>
                      setItemForm({ ...itemForm, shopQty: e.target.value })
                    }
                    className="w-full border-2 border-green-300 rounded-xl p-3 font-black text-green-700 text-lg outline-none focus:bg-white"
                  />
                </div>
                {godowns.map((g) => (
                  <div key={g}>
                    <p className="text-[10px] font-black uppercase text-amber-700 ml-1 truncate">
                      {g}
                    </p>
                    <input
                      type="number"
                      placeholder={g}
                      value={itemForm.godownQuants[g] || ""}
                      onChange={(e) =>
                        setItemForm({
                          ...itemForm,
                          godownQuants: {
                            ...itemForm.godownQuants,
                            [g]: e.target.value,
                          },
                        })
                      }
                      className="w-full border-2 border-amber-200 rounded-xl p-3 font-black text-amber-700 text-lg outline-none focus:bg-white"
                    />
                  </div>
                ))}
              </div>
            </div>
            <div
              className={`grid gap-6 ${currentUser.role === "staff" ? "grid-cols-1" : "grid-cols-2"}`}
            >
              <div>
                <p className="text-[10px] font-black uppercase text-blue-600 ml-1">
                  Sale Rate (₹) *
                </p>
                <input
                  required
                  type="number"
                  value={itemForm.saleRate}
                  onChange={(e) => {
                    const newRate = e.target.value;
                    const existingItem = Object.values(inventory).find(
                      (inv) =>
                        (!inv.businessId ||
                          inv.businessId === activeBusinessId) &&
                        inv.itemName.toLowerCase() ===
                          itemForm.itemName.toLowerCase() &&
                        String(inv.saleRate) !== newRate &&
                        inv.saleRate > 0,
                    );
                    if (existingItem && itemForm.itemName) {
                      setSaleRatePrompt({
                        show: true,
                        newRate,
                        mode: "single",
                        existingSku: existingItem.sku,
                      });
                    } else {
                      setItemForm({ ...itemForm, saleRate: newRate });
                    }
                  }}
                  className="w-full border-2 border-blue-200 rounded-xl p-3 font-black text-blue-700 text-lg outline-none focus:bg-white"
                />
              </div>
              {currentUser.role !== "staff" && (
                <div>
                  <p className="text-[10px] font-black uppercase text-gray-500 ml-1">
                    Pur. Rate (₹)
                  </p>
                  <input
                    type="number"
                    value={itemForm.purchaseRate}
                    onChange={(e) =>
                      setItemForm({ ...itemForm, purchaseRate: e.target.value })
                    }
                    className="w-full border rounded-xl p-3 font-black text-gray-600 outline-none focus:bg-white"
                  />
                </div>
              )}
            </div>
            <button
              type="submit"
              className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl uppercase tracking-widest shadow-xl hover:bg-blue-700 transition-transform active:scale-95 text-xs"
            >
              Add Item To Bale List
            </button>
          </form>
        )}

      {baleItems.length > 0 && perBaleData.length === 0 && (
        <div className="bg-white rounded-[2rem] border overflow-hidden shadow-2xl animate-fade-in-down">
          <div className="bg-gray-900 text-white px-6 py-4 flex justify-between items-center">
            <h3 className="font-black uppercase tracking-widest text-xs">
              Items in this Bale
            </h3>
            <span className="bg-blue-600 px-3 py-1 rounded-full text-[10px] font-bold">
              {baleItems.length} ITEMS
            </span>
          </div>
          <table className="w-full text-left text-sm">
            <tbody className="divide-y">
              {baleItems.map((i) => (
                <tr key={i.id}>
                  <td className="px-6 py-4 font-bold">
                    {i.itemName}{" "}
                    <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded ml-2 uppercase">
                      {i.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center font-black">
                    {(Number(i.shopQty) || 0) +
                      Object.values(i.godownQuants).reduce(
                        (a, b) => a + Number(b || 0),
                        0,
                      )}{" "}
                    Pcs
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      type="button"
                      onClick={() =>
                        setBaleItems((prev) =>
                          prev.filter((x) => x.id !== i.id),
                        )
                      }
                      className="text-red-500 p-2 bg-red-50 rounded-xl hover:bg-red-100"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="p-6 bg-gray-50 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <p className="text-[10px] font-black uppercase text-gray-400 ml-1">
                  Date Opened
                </p>
                <input
                  type="date"
                  value={dateOpened}
                  onChange={(e) => setDateOpened(e.target.value)}
                  className="w-full border rounded-xl p-2.5 font-bold outline-none focus:ring-2 focus:ring-green-500 bg-white text-sm"
                />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase text-gray-400 ml-1">
                  Opened By
                </p>
                <input
                  type="text"
                  value={openedBy}
                  onChange={(e) => setOpenedBy(e.target.value)}
                  className="w-full border rounded-xl p-2.5 font-bold outline-none focus:ring-2 focus:ring-green-500 bg-white text-sm"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={handleFinalSave}
              className="w-full bg-green-600 text-white font-black py-5 rounded-2xl uppercase tracking-[0.3em] shadow-xl shadow-green-200 hover:bg-green-700 transition-transform active:scale-95 text-sm"
            >
              Confirm & Save Entire Bale
            </button>
          </div>
        </div>
      )}
      {/* Sale Rate Overwrite Prompt */}
      {saleRatePrompt.show && (
        <div className="fixed inset-0 bg-gray-900/60 z-[110] flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl max-w-sm w-full animate-fade-in-down">
            <h3 className="text-xl font-black text-gray-800 mb-3">
              Update Price?
            </h3>
            <p className="text-sm font-bold text-gray-500 mb-6">
              This item already has a sale rate in inventory. How should we save
              the new rate ₹{saleRatePrompt.newRate}?
            </p>
            <div className="flex flex-col gap-3">
              <button
                type="button"
                data-ocid="inward.confirm_button"
                onClick={() => {
                  if (saleRatePrompt.mode === "single") {
                    setItemForm((prev) => ({
                      ...prev,
                      saleRate: saleRatePrompt.newRate,
                    }));
                    if (saleRatePrompt.existingSku) {
                      setInventory?.((prev) => ({
                        ...prev,
                        [saleRatePrompt.existingSku!]: {
                          ...prev[saleRatePrompt.existingSku!],
                          saleRate: Number(saleRatePrompt.newRate),
                        },
                      }));
                    }
                  } else if (
                    saleRatePrompt.mode === "multi" &&
                    saleRatePrompt.baleIdx !== undefined
                  ) {
                    setPerBaleForm(saleRatePrompt.baleIdx, {
                      saleRate: saleRatePrompt.newRate,
                    });
                    if (saleRatePrompt.existingSku) {
                      setInventory?.((prev) => ({
                        ...prev,
                        [saleRatePrompt.existingSku!]: {
                          ...prev[saleRatePrompt.existingSku!],
                          saleRate: Number(saleRatePrompt.newRate),
                        },
                      }));
                    }
                  }
                  setSaleRatePrompt({
                    show: false,
                    newRate: "",
                    mode: "single",
                  });
                }}
                className="bg-blue-600 text-white font-black py-3 rounded-2xl text-xs uppercase tracking-widest hover:bg-blue-700"
              >
                Update Existing Product Price
              </button>
              <button
                type="button"
                data-ocid="inward.secondary_button"
                onClick={() => {
                  if (saleRatePrompt.mode === "single") {
                    setItemForm((prev) => ({
                      ...prev,
                      saleRate: saleRatePrompt.newRate,
                    }));
                  } else if (
                    saleRatePrompt.mode === "multi" &&
                    saleRatePrompt.baleIdx !== undefined
                  ) {
                    setPerBaleForm(saleRatePrompt.baleIdx, {
                      saleRate: saleRatePrompt.newRate,
                    });
                  }
                  setSaleRatePrompt({
                    show: false,
                    newRate: "",
                    mode: "single",
                  });
                  showNotification(
                    "New product variant will be created on save",
                    "success",
                  );
                }}
                className="bg-gray-100 text-gray-700 font-black py-3 rounded-2xl text-xs uppercase tracking-widest hover:bg-gray-200"
              >
                Add as New Product
              </button>
              <button
                type="button"
                data-ocid="inward.cancel_button"
                onClick={() =>
                  setSaleRatePrompt({
                    show: false,
                    newRate: "",
                    mode: "single",
                  })
                }
                className="text-gray-400 text-xs font-bold py-2"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ================= TRANSFER TAB ================= */

export { InwardTab };
