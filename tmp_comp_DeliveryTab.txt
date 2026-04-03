import { CheckCircle, Pencil, Truck, X } from "lucide-react";
import type React from "react";
import { useState } from "react";
import type {
  AppUser,
  Category,
  DeliveryRecord,
  InventoryItem,
  InwardSavedEntry,
  PendingParcel,
  Transaction,
} from "../types";
import { ItemNameCombo } from "./ItemNameCombo";

type DeliveryItem = {
  id: number;
  category: string;
  itemName: string;
  subCategory: string;
  qty: string;
  packages: string;
  attributes: Record<string, string>;
};

const emptyItem = (): DeliveryItem => ({
  id: Date.now(),
  category: "",
  itemName: "",
  subCategory: "",
  qty: "",
  packages: "1",
  attributes: {},
});

function DeliveryTab({
  inventory,
  setInventory: _setInventory,
  pendingParcels,
  setPendingParcels,
  godowns,
  categories,
  currentUser,
  activeBusinessId,
  deliveryRecords,
  setDeliveryRecords,
  transactions: _transactions,
  setTransactions,
  setInwardSaved,
  updateStock: _updateStock,
  generateSku,
  showNotification,
  onDeliveredBilty,
  actor,
  onInventoryRefresh,
  requiredFields,
}: {
  inventory: Record<string, InventoryItem>;
  setInventory: React.Dispatch<
    React.SetStateAction<Record<string, InventoryItem>>
  >;
  pendingParcels: PendingParcel[];
  setPendingParcels: React.Dispatch<React.SetStateAction<PendingParcel[]>>;
  godowns: string[];
  categories: Category[];
  currentUser: AppUser;
  activeBusinessId: string;
  deliveryRecords: DeliveryRecord[];
  setDeliveryRecords: React.Dispatch<React.SetStateAction<DeliveryRecord[]>>;
  transactions: Transaction[];
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
  setInwardSaved: React.Dispatch<React.SetStateAction<InwardSavedEntry[]>>;
  updateStock: (
    sku: string,
    details: Partial<InventoryItem>,
    shopDelta: number,
    godownDelta: number,
    targetGodown: string,
  ) => void;
  showNotification: (m: string, t?: string) => void;
  onDeliveredBilty?: (biltyNo: string) => void;
  actor?: any;
  onInventoryRefresh?: () => Promise<void>;
  requiredFields?: Record<string, Record<string, boolean>>;
  generateSku: (
    category: string,
    itemName: string,
    attributes: Record<string, string>,
    saleRate: string,
    businessId: string,
  ) => string;
}) {
  const [viewMode, setViewMode] = useState<"new" | "timeline">("new");
  const [sourceType, setSourceType] = useState<"GODOWN" | "QUEUE">("GODOWN");
  const [selectedGodown, setSelectedGodown] = useState(godowns[0] || "");
  const [selectedBiltyId, setSelectedBiltyId] = useState<number | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryItems, setDeliveryItems] = useState<DeliveryItem[]>([
    emptyItem(),
  ]);

  // Timeline filters
  const [filterCustomer, setFilterCustomer] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterGodown, setFilterGodown] = useState("all");
  const [isSaving, setIsSaving] = useState(false);

  // Edit delivery
  const [editingRecord, setEditingRecord] = useState<DeliveryRecord | null>(
    null,
  );
  const [editCustomerName, setEditCustomerName] = useState("");
  const [editCustomerPhone, setEditCustomerPhone] = useState("");
  const [editDeliveredAt, setEditDeliveredAt] = useState("");
  const [editGodown, setEditGodown] = useState("");
  const [editItems, setEditItems] = useState<
    Array<{
      itemName: string;
      category: string;
      subCategory?: string;
      qty: number;
    }>
  >([]);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const queueEntries = pendingParcels.filter(
    (p) => !p.businessId || p.businessId === activeBusinessId,
  );

  const selectedQueue =
    selectedBiltyId != null
      ? queueEntries.find((p) => p.id === selectedBiltyId)
      : null;

  const updateItem = (
    idx: number,
    field: keyof DeliveryItem,
    value: string,
  ) => {
    setDeliveryItems((prev) =>
      prev.map((x, i) => (i === idx ? { ...x, [field]: value } : x)),
    );
  };

  const updateItemAttr = (idx: number, attrKey: string, attrValue: string) => {
    setDeliveryItems((prev) =>
      prev.map((x, i) =>
        i === idx
          ? { ...x, attributes: { ...x.attributes, [attrKey]: attrValue } }
          : x,
      ),
    );
  };

  const handleQueueSelect = (id: number) => {
    setSelectedBiltyId(id);
    const entry = queueEntries.find((p) => p.id === id);
    if (entry) {
      setDeliveryItems([
        {
          id: Date.now(),
          category: entry.itemCategory || entry.category || "",
          itemName: entry.itemName || "",
          subCategory: "",
          qty: entry.packages || "1",
          packages: entry.packages || "1",
          attributes: {},
        },
      ]);
    }
  };

  const handleSaveDelivery = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const deliveryReq = requiredFields?.delivery || {};
      if (!customerName.trim())
        return showNotification("Customer Name is required", "error");
      if (deliveryReq.customerPhone && !customerPhone.trim())
        return showNotification("Customer Phone is required", "error");
      if (!selectedGodown) return showNotification("Select a godown", "error");
      const validItems = deliveryItems.filter(
        (i) => i.itemName && Number(i.qty) > 0,
      );
      if (validItems.length === 0)
        return showNotification("Add at least one item with qty", "error");

      // Only validate stock for GODOWN deliveries, not QUEUE
      if (sourceType === "GODOWN") {
        for (const item of validItems) {
          const existingItem = Object.values(inventory).find(
            (inv) =>
              (!inv.businessId || inv.businessId === activeBusinessId) &&
              inv.itemName.toLowerCase() === item.itemName.toLowerCase() &&
              (!item.category || inv.category === item.category),
          );
          const godownQty = existingItem?.godowns[selectedGodown] || 0;
          if (godownQty <= 0) {
            return showNotification(
              `No stock available for "${item.itemName}" in ${selectedGodown}`,
              "error",
            );
          }
          if (godownQty < Number(item.qty)) {
            return showNotification(
              `Only ${godownQty} units of "${item.itemName}" available in ${selectedGodown}`,
              "error",
            );
          }
        }
      }

      const now = new Date().toISOString();
      const record: DeliveryRecord = {
        id: Date.now().toString(),
        type: sourceType,
        sourceGodown: selectedGodown,
        biltyNo: selectedQueue?.biltyNo,
        items: validItems.map((i) => ({
          category: i.category,
          itemName: i.itemName,
          qty: Number(i.qty),
          subCategory: i.subCategory || undefined,
        })),
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        deliveredBy: currentUser.username,
        deliveredAt: now,
        businessId: activeBusinessId,
      };

      if (sourceType === "QUEUE" && selectedQueue) {
        setPendingParcels((prev) =>
          prev.filter((p) => p.id !== selectedQueue.id),
        );
      }

      setTransactions((prev) => [
        {
          id: Date.now(),
          type: "DELIVERY",
          biltyNo: selectedQueue?.biltyNo,
          businessId: activeBusinessId,
          date: now.split("T")[0],
          user: currentUser.username,
          fromLocation: selectedGodown,
          toLocation: customerName.trim(),
          notes: `Delivered to ${customerName}`,
          itemsCount: validItems.reduce((s, i) => s + Number(i.qty), 0),
          baleItemsList: validItems.map((item) => ({
            itemName: item.itemName,
            category: item.category,
            attributes: item.attributes || {},
            qty: Number(item.qty),
            shopQty: 0,
            godownQuants: { [selectedGodown]: Number(item.qty) },
            saleRate: 0,
            purchaseRate: 0,
          })),
        },
        ...prev,
      ]);

      if (actor) {
        try {
          const result = await actor.addDelivery({
            id: record.id,
            businessId: activeBusinessId,
            createdAt: BigInt(Date.now()),
            deliveredBy: currentUser.username,
            customerName: record.customerName,
            customerPhone: customerPhone || "",
            deliveryType: sourceType === "QUEUE" ? "QUEUE" : "From Godown",
            biltyNumber: record.biltyNo || "",
            items: validItems.map((item: any) => ({
              itemName: item.itemName,
              category: item.category || "",
              subCategory: item.subCategory || "",
              qty: BigInt(Number(item.qty)),
              godownId: selectedGodown,
            })),
          });
          if (result !== "ok") {
            showNotification(`Delivery failed: ${result}`, "error");
            return;
          }
          if (onInventoryRefresh) await onInventoryRefresh();
        } catch (e) {
          console.error(e);
          showNotification("Delivery failed: backend error", "error");
          return;
        }
      } else {
        showNotification("Not connected to backend", "error");
        return;
      }
      setDeliveryRecords((prev) => [record, ...prev]);

      // Auto-create inward + inward saved records when delivering from queue
      if (sourceType === "QUEUE" && selectedQueue) {
        const totalQty = validItems.reduce((s, i) => s + Number(i.qty), 0);
        const baleItems = validItems.map((item) => ({
          itemName: item.itemName,
          category: item.category,
          attributes: item.attributes || {},
          qty: Number(item.qty),
          shopQty: 0,
          godownQuants: { [selectedGodown]: Number(item.qty) },
          saleRate: 0,
          purchaseRate: 0,
          packages: item.packages || "1",
        }));

        setTransactions((prev) => [
          Object.assign(
            {
              id: Date.now() + 1,
              type: "INWARD",
              biltyNo: selectedQueue.biltyNo,
              businessId: activeBusinessId,
              date: now.split("T")[0],
              user: currentUser.username,
              fromLocation: "Queue",
              toLocation: selectedGodown,
              notes: "Auto-inward from queue delivery",
              itemsCount: totalQty,
              baleItemsList: baleItems,
            },
            { linkedDeliveryId: record.id },
          ),
          ...prev,
        ]);

        const inwardSavedEntry: any = {
          id: Date.now() + 2,
          biltyNumber: selectedQueue.biltyNo,
          baseNumber: selectedQueue.biltyNo,
          packages: validItems
            .reduce((s, i) => s + Number(i.packages || 1), 0)
            .toString(),
          items: validItems.map((item) => ({
            category: item.category,
            itemName: item.itemName,
            qty: Number(item.qty),
            godownQty: Number(item.qty),
            godownBreakdown: { [selectedGodown]: Number(item.qty) },
            shopQty: 0,
            saleRate: 0,
            purchaseRate: 0,
            attributes: item.attributes || {},
          })),
          savedBy: currentUser.username,
          savedAt: now,
          transporter: "Queue Delivery",
          supplier: "",
          businessId: activeBusinessId,
          linkedDeliveryId: record.id,
          remark: "Directly delivered to customer",
          notes: "Queue Delivery | Directly delivered to customer",
          isQueueDelivery: true,
        };
        setInwardSaved((prev) => [inwardSavedEntry, ...prev]);

        // Persist the inwardSaved entry to Motoko backend so it survives page refresh
        if (actor) {
          try {
            await (actor as any).saveInward({
              id: String(inwardSavedEntry.id),
              biltyNumber: inwardSavedEntry.biltyNumber,
              businessId: inwardSavedEntry.businessId,
              supplier: inwardSavedEntry.supplier || "",
              transport: inwardSavedEntry.transporter || "",
              savedBy: inwardSavedEntry.savedBy,
              savedAt: BigInt(new Date(inwardSavedEntry.savedAt).getTime()),
              items: inwardSavedEntry.items.map((item: any) => ({
                category: item.category,
                itemName: item.itemName,
                subCategory: JSON.stringify({
                  attributes: item.attributes,
                  godownQty: item.godownQty,
                }),
                totalQty: BigInt(Math.round(item.qty)),
                shopQty: BigInt(0),
                purchaseRate: item.purchaseRate || 0,
                saleRate: item.saleRate || 0,
                godownQtys:
                  item.godownBreakdown &&
                  Object.keys(item.godownBreakdown).length > 0
                    ? Object.entries(item.godownBreakdown).map(
                        ([godownId, qty]: [string, any]) => ({
                          godownId,
                          qty: BigInt(Math.round(qty)),
                        }),
                      )
                    : [
                        {
                          godownId: selectedGodown,
                          qty: BigInt(Math.round(item.qty)),
                        },
                      ],
              })),
            });
          } catch (e) {
            console.error(
              "Failed to persist inwardSaved for queue delivery:",
              e,
            );
          }
        }

        // Add items to inventory (inward) then immediately reduce via SALE (outward)
        // This ensures dashboard shows correct net stock and analytics record both flows
        for (const [idx, item] of validItems.entries()) {
          const generatedSku = generateSku(
            item.category,
            item.itemName,
            item.attributes || {},
            "0",
            activeBusinessId,
          );
          const itemQty = Number(item.qty);
          // Step 1: Add real qty to inventory (inward) - add to godown, not shop
          _updateStock(
            generatedSku,
            {
              category: item.category,
              itemName: item.itemName,
              attributes: item.attributes || {},
              businessId: activeBusinessId,
              saleRate: 0,
              purchaseRate: 0,
            },
            0,
            itemQty,
            selectedGodown,
          );
          // Step 2: Record SALE transaction (marks it as direct delivery to customer)
          const saleRecord = {
            id: Date.now() + 3 + idx,
            type: "SALE",
            sku: generatedSku,
            itemName: item.itemName,
            category: item.category,
            itemsCount: itemQty,
            fromLocation: selectedGodown,
            toLocation: customerName || "Direct Customer",
            date: now.split("T")[0],
            createdAt: now,
            user: currentUser.username,
            biltyNo: selectedQueue.biltyNo,
            businessId: activeBusinessId,
            isDirectDelivery: true,
            notes: `Direct Delivery to Customer | Bilty: ${selectedQueue.biltyNo} | Customer: ${customerName || "N/A"}`,
          };
          setTransactions((prev) => [saleRecord, ...prev]);
          // Step 3: Persist SALE to backend
          if (actor) {
            try {
              await (actor as any).addTxRecord({
                id: BigInt(saleRecord.id),
                txType: "SALE",
                biltyNo: saleRecord.biltyNo || "",
                businessId: saleRecord.businessId,
                date: saleRecord.date,
                user: saleRecord.user,
                fromLocation: saleRecord.fromLocation || "",
                toLocation: saleRecord.toLocation || "",
                notes: saleRecord.notes || "",
                itemsCount: BigInt(saleRecord.itemsCount),
                createdAt: BigInt(Date.now() + 3 + idx),
                baleItemsList: [
                  {
                    itemName: item.itemName,
                    category: item.category,
                    attributes: item.attributes || {},
                    qty: itemQty,
                    shopQty: 0,
                    godownQuants: { [selectedGodown]: itemQty },
                    saleRate: 0,
                    purchaseRate: 0,
                  },
                ],
              });
            } catch (e) {
              console.error("Failed to persist sale tx:", e);
            }
          }
          // Step 4: Reduce godown stock (outward) so dashboard shows net 0 for this item
          _updateStock(
            generatedSku,
            {
              category: item.category,
              itemName: item.itemName,
              attributes: item.attributes || {},
              businessId: activeBusinessId,
              saleRate: 0,
              purchaseRate: 0,
            },
            0,
            -itemQty,
            selectedGodown,
          );
        }

        // Persist the auto-inward transaction to backend
        if (actor) {
          const inwardTx = {
            id: Date.now() + 1,
            type: "INWARD",
            biltyNo: selectedQueue.biltyNo,
            businessId: activeBusinessId,
            date: now.split("T")[0],
            user: currentUser.username,
            fromLocation: "Queue",
            toLocation: selectedGodown,
            notes: "Auto-inward from queue delivery",
            itemsCount: totalQty,
            baleItemsList: baleItems,
            createdAt: BigInt(Date.now() + 1),
          };
          try {
            await (actor as any).addTxRecord({
              id: BigInt(inwardTx.id),
              txType: inwardTx.type,
              biltyNo: inwardTx.biltyNo,
              businessId: inwardTx.businessId,
              date: inwardTx.date,
              user: inwardTx.user,
              fromLocation: inwardTx.fromLocation,
              toLocation: inwardTx.toLocation,
              notes: inwardTx.notes,
              itemsCount: BigInt(inwardTx.itemsCount),
              createdAt: inwardTx.createdAt,
              baleItemsList: baleItems.map((bi: any) => ({
                itemName: bi.itemName,
                category: bi.category,
                attributes: bi.attributes || {},
                qty: bi.qty,
                shopQty: bi.shopQty || 0,
                godownQuants: bi.godownQuants || {},
                saleRate: bi.saleRate || 0,
                purchaseRate: bi.purchaseRate || 0,
              })),
            });
          } catch (e) {
            console.error("Failed to persist auto-inward tx:", e);
          }
        }
      }

      if (
        sourceType === "QUEUE" &&
        selectedQueue?.biltyNo &&
        onDeliveredBilty
      ) {
        onDeliveredBilty(selectedQueue.biltyNo.toLowerCase());
      }
      setCustomerName("");
      setCustomerPhone("");
      setDeliveryItems([emptyItem()]);
      setSelectedBiltyId(null);
      showNotification("Delivery recorded successfully!", "success");
    } finally {
      setIsSaving(false);
    }
  };

  const openEditDelivery = (r: DeliveryRecord) => {
    setEditingRecord(r);
    setEditCustomerName(r.customerName);
    setEditCustomerPhone(r.customerPhone || "");
    setEditDeliveredAt(r.deliveredAt.split("T")[0]);
    setEditGodown(r.sourceGodown);
    setEditItems(r.items.map((i) => ({ ...i })));
  };

  const handleSaveEditDelivery = async () => {
    if (!editingRecord || isSavingEdit) return;
    setIsSavingEdit(true);
    try {
      const updatedRecord: DeliveryRecord = {
        ...editingRecord,
        customerName: editCustomerName,
        customerPhone: editCustomerPhone,
        deliveredAt: new Date(editDeliveredAt).toISOString(),
        sourceGodown: editGodown,
        items: editItems,
      };
      const deliveryEntry = {
        id: editingRecord.id,
        businessId: editingRecord.businessId,
        createdAt: BigInt(new Date(updatedRecord.deliveredAt).getTime()),
        deliveredBy: editingRecord.deliveredBy,
        customerName: updatedRecord.customerName,
        customerPhone: updatedRecord.customerPhone || "",
        deliveryType: editingRecord.type === "QUEUE" ? "QUEUE" : "From Godown",
        biltyNumber: editingRecord.biltyNo || "",
        items: updatedRecord.items.map((i) => ({
          itemName: i.itemName,
          category: i.category || "",
          subCategory: i.subCategory || "",
          qty: BigInt(i.qty),
          godownId: updatedRecord.sourceGodown,
        })),
      };
      if (actor) {
        await actor.addDelivery(deliveryEntry);
      }
      setDeliveryRecords((prev) =>
        prev.map((r) => (r.id === editingRecord.id ? updatedRecord : r)),
      );

      // Update linked INWARD transaction if this was a queue delivery
      if (editingRecord.type === "QUEUE") {
        const updatedBaleItems = editItems.map((item) => ({
          itemName: item.itemName,
          category: item.category,
          attributes: {},
          qty: item.qty,
          shopQty: 0,
          godownQuants: { [editGodown]: item.qty },
          saleRate: 0,
          purchaseRate: 0,
        }));
        const totalQty = editItems.reduce((s, i) => s + i.qty, 0);

        setTransactions((prev) =>
          prev.map((tx) => {
            if ((tx as any).linkedDeliveryId === editingRecord.id) {
              return Object.assign({}, tx, {
                biltyNo: editingRecord.biltyNo,
                toLocation: editGodown,
                itemsCount: totalQty,
                baleItemsList: updatedBaleItems,
              });
            }
            return tx;
          }),
        );

        setInwardSaved((prev) =>
          prev.map((entry) => {
            if ((entry as any).linkedDeliveryId === editingRecord.id) {
              return Object.assign({}, entry, {
                items: editItems.map((item) => ({
                  category: item.category,
                  itemName: item.itemName,
                  qty: item.qty,
                  godownQty: item.qty,
                  godownBreakdown: { [editGodown]: item.qty },
                  shopQty: 0,
                  saleRate: 0,
                  purchaseRate: 0,
                  attributes: {},
                })),
                savedAt: new Date(editDeliveredAt).toISOString(),
              });
            }
            return entry;
          }),
        );
      }

      setEditingRecord(null);
      showNotification("Delivery updated successfully!", "success");
    } catch (e) {
      console.error(e);
      showNotification("Update failed: backend error", "error");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const filteredRecords = deliveryRecords
    .filter((r) => !r.businessId || r.businessId === activeBusinessId)
    .filter(
      (r) =>
        !filterCustomer ||
        r.customerName.toLowerCase().includes(filterCustomer.toLowerCase()),
    )
    .filter(
      (r) => !filterDateFrom || r.deliveredAt.split("T")[0] >= filterDateFrom,
    )
    .filter((r) => !filterDateTo || r.deliveredAt.split("T")[0] <= filterDateTo)
    .filter((r) => filterGodown === "all" || r.sourceGodown === filterGodown);

  return (
    <div className="space-y-6 animate-fade-in-down">
      <div className="flex justify-between items-center border-b pb-4">
        <h2 className="text-2xl font-black text-gray-800 tracking-tighter uppercase flex items-center gap-2">
          <Truck className="text-blue-600" /> Delivery
        </h2>
        <div className="flex gap-2">
          <button
            type="button"
            data-ocid="delivery.tab"
            onClick={() => setViewMode("new")}
            className={`px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-colors ${
              viewMode === "new"
                ? "bg-blue-600 text-white shadow-lg"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            New Delivery
          </button>
          <button
            type="button"
            data-ocid="delivery.timeline.tab"
            onClick={() => setViewMode("timeline")}
            className={`px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-colors ${
              viewMode === "timeline"
                ? "bg-blue-600 text-white shadow-lg"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            Timeline
          </button>
        </div>
      </div>

      {viewMode === "new" && (
        <div className="space-y-6">
          {/* Source Type */}
          <div className="flex gap-3">
            <button
              type="button"
              data-ocid="delivery.godown.toggle"
              onClick={() => {
                setSourceType("GODOWN");
                setSelectedBiltyId(null);
                setDeliveryItems([emptyItem()]);
              }}
              className={`flex-1 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest border-2 transition-colors ${
                sourceType === "GODOWN"
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"
              }`}
            >
              📦 From Godown
            </button>
            <button
              type="button"
              data-ocid="delivery.queue.toggle"
              onClick={() => {
                setSourceType("QUEUE");
                setDeliveryItems([emptyItem()]);
              }}
              className={`flex-1 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest border-2 transition-colors ${
                sourceType === "QUEUE"
                  ? "bg-amber-500 text-white border-amber-500"
                  : "bg-white text-gray-600 border-gray-200 hover:border-amber-300"
              }`}
            >
              🚚 From Queue
            </button>
          </div>

          <div className="bg-white border rounded-[2rem] p-6 space-y-5 shadow-sm">
            {/* Godown selector */}
            <div>
              <p className="text-[10px] font-black uppercase text-gray-400 mb-1">
                Source Godown
              </p>
              <select
                value={selectedGodown}
                onChange={(e) => setSelectedGodown(e.target.value)}
                className="w-full border rounded-xl p-3 font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
              >
                {godowns.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>

            {/* Queue selector */}
            {sourceType === "QUEUE" && (
              <div>
                <p className="text-[10px] font-black uppercase text-gray-400 mb-2">
                  Select Bilty from Queue
                </p>
                {queueEntries.length === 0 ? (
                  <p className="text-xs text-gray-400 font-bold">
                    No pending bilties in queue
                  </p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {queueEntries.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleQueueSelect(p.id)}
                        className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-colors font-bold text-xs ${
                          selectedBiltyId === p.id
                            ? "border-amber-500 bg-amber-50"
                            : "border-gray-200 hover:border-amber-300"
                        }`}
                      >
                        <span className="font-black">{p.biltyNo}</span>
                        {p.itemName && (
                          <span className="text-gray-500 ml-2">
                            · {p.itemName}
                          </span>
                        )}
                        {p.packages && (
                          <span className="text-amber-600 ml-2">
                            · {p.packages} pkg
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Items */}
            <div>
              <p className="text-[10px] font-black uppercase text-gray-400 mb-2">
                Items
              </p>
              <div className="space-y-3">
                {sourceType === "QUEUE"
                  ? /* ---- QUEUE MODE: free-entry form ---- */
                    deliveryItems.map((item, idx) => {
                      const selectedCat = categories.find(
                        (c) => c.name === item.category,
                      );
                      const catFields = selectedCat?.fields || [];
                      return (
                        <div
                          key={item.id}
                          className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3"
                        >
                          {/* Row header */}
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black uppercase text-amber-700">
                              Item {idx + 1}
                            </span>
                            {deliveryItems.length > 1 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setDeliveryItems((prev) =>
                                    prev.filter((_, i) => i !== idx),
                                  )
                                }
                                className="p-1 bg-red-50 text-red-400 rounded-lg hover:bg-red-100 transition-colors"
                              >
                                <X size={14} />
                              </button>
                            )}
                          </div>

                          {/* Category */}
                          <div>
                            <p className="text-[9px] font-black uppercase text-gray-400 mb-1">
                              Category
                            </p>
                            <select
                              value={item.category}
                              onChange={(e) => {
                                setDeliveryItems((prev) =>
                                  prev.map((x, i) =>
                                    i === idx
                                      ? {
                                          ...x,
                                          category: e.target.value,
                                          itemName: "",
                                          attributes: {},
                                        }
                                      : x,
                                  ),
                                );
                              }}
                              className="w-full border rounded-xl p-2.5 font-bold text-xs outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                            >
                              <option value="">Select Category</option>
                              {categories.map((c) => (
                                <option key={c.name} value={c.name}>
                                  {c.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Item Name (combo) */}
                          <div>
                            <p className="text-[9px] font-black uppercase text-gray-400 mb-1">
                              Item Name
                            </p>
                            <ItemNameCombo
                              category={item.category}
                              value={item.itemName}
                              onChange={(val) =>
                                updateItem(idx, "itemName", val)
                              }
                              inventory={inventory}
                              activeBusinessId={activeBusinessId}
                              onSelectItem={(inv) => {
                                setDeliveryItems((prev) =>
                                  prev.map((x, i) =>
                                    i === idx
                                      ? {
                                          ...x,
                                          attributes: {
                                            ...(inv.attributes || {}),
                                          },
                                        }
                                      : x,
                                  ),
                                );
                              }}
                            />
                          </div>

                          {/* Dynamic sub-category fields */}
                          {catFields.length > 0 && (
                            <div className="space-y-2">
                              {catFields.map((field) => (
                                <div key={field.name}>
                                  <p className="text-[9px] font-black uppercase text-gray-400 mb-1">
                                    {field.name}
                                  </p>
                                  {field.type === "select" ||
                                  field.type === "combo" ? (
                                    <select
                                      value={item.attributes[field.name] || ""}
                                      onChange={(e) =>
                                        updateItemAttr(
                                          idx,
                                          field.name,
                                          e.target.value,
                                        )
                                      }
                                      className="w-full border rounded-xl p-2.5 font-bold text-xs outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                                    >
                                      <option value="">
                                        Select {field.name}
                                      </option>
                                      {(field.options || []).map((opt) => (
                                        <option key={opt} value={opt}>
                                          {opt}
                                        </option>
                                      ))}
                                    </select>
                                  ) : (
                                    <input
                                      type="text"
                                      value={item.attributes[field.name] || ""}
                                      onChange={(e) =>
                                        updateItemAttr(
                                          idx,
                                          field.name,
                                          e.target.value,
                                        )
                                      }
                                      placeholder={field.name}
                                      className="w-full border rounded-xl p-2.5 font-bold text-xs outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                                    />
                                  )}
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Packages + Qty */}
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <p className="text-[9px] font-black uppercase text-gray-400 mb-1">
                                Packages
                              </p>
                              <input
                                type="number"
                                value={item.packages}
                                onChange={(e) =>
                                  updateItem(idx, "packages", e.target.value)
                                }
                                min="1"
                                placeholder="1"
                                className="w-full border rounded-xl p-2.5 font-bold text-xs outline-none focus:ring-2 focus:ring-amber-400 bg-white text-center"
                              />
                            </div>
                            <div>
                              <p className="text-[9px] font-black uppercase text-gray-400 mb-1">
                                Qty
                              </p>
                              <input
                                type="number"
                                value={item.qty}
                                onChange={(e) =>
                                  updateItem(idx, "qty", e.target.value)
                                }
                                min="1"
                                placeholder="0"
                                className="w-full border rounded-xl p-2.5 font-bold text-xs outline-none focus:ring-2 focus:ring-amber-400 bg-white text-center"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })
                  : /* ---- GODOWN MODE: existing form (unchanged) ---- */
                    deliveryItems.map((item, idx) => {
                      const matchedInvForQty = item.subCategory
                        ? Object.values(inventory).find(
                            (inv) =>
                              (!inv.businessId ||
                                inv.businessId === activeBusinessId) &&
                              inv.itemName.toLowerCase() ===
                                item.itemName.toLowerCase() &&
                              Object.entries(inv.attributes || {})
                                .map(([k, v]) => `${k}: ${v}`)
                                .join(", ") === item.subCategory,
                          )
                        : Object.values(inventory).find(
                            (inv) =>
                              (!inv.businessId ||
                                inv.businessId === activeBusinessId) &&
                              inv.itemName.toLowerCase() ===
                                item.itemName.toLowerCase(),
                          );
                      const godownQty =
                        matchedInvForQty?.godowns[selectedGodown] || 0;
                      return (
                        <div
                          key={item.id}
                          className="grid grid-cols-12 gap-2 bg-gray-50 p-3 rounded-xl"
                        >
                          <select
                            value={item.category}
                            onChange={(e) =>
                              setDeliveryItems((prev) =>
                                prev.map((x, i) =>
                                  i === idx
                                    ? {
                                        ...x,
                                        category: e.target.value,
                                        itemName: "",
                                      }
                                    : x,
                                ),
                              )
                            }
                            className="col-span-3 border rounded-lg p-2 text-xs font-bold outline-none"
                          >
                            <option value="">Category</option>
                            {categories.map((c) => (
                              <option key={c.name} value={c.name}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                          <div className="col-span-5 relative">
                            {(() => {
                              const richItems = Object.values(inventory).filter(
                                (inv) =>
                                  (!inv.businessId ||
                                    inv.businessId === activeBusinessId) &&
                                  (!item.category ||
                                    inv.category === item.category) &&
                                  (inv.godowns[selectedGodown] || 0) > 0,
                              );
                              return (
                                <select
                                  value={`${item.itemName}|||${item.subCategory || ""}`}
                                  onChange={(e) => {
                                    const [name, sub] =
                                      e.target.value.split("|||");
                                    setDeliveryItems((prev) =>
                                      prev.map((x, i) =>
                                        i === idx
                                          ? {
                                              ...x,
                                              itemName: name,
                                              subCategory: sub || "",
                                            }
                                          : x,
                                      ),
                                    );
                                  }}
                                  className="w-full border rounded-lg p-2 text-xs font-bold outline-none bg-white"
                                >
                                  <option value="|||">Select Item</option>
                                  {richItems.map((inv) => {
                                    const attrStr = Object.values(
                                      inv.attributes || {},
                                    )
                                      .filter(Boolean)
                                      .join(" -- ");
                                    const godownStock =
                                      inv.godowns[selectedGodown] || 0;
                                    const label = attrStr
                                      ? `${inv.itemName} -- ${attrStr} -- ${godownStock} PCS -- ₹${inv.saleRate}`
                                      : `${inv.itemName} -- ${godownStock} PCS -- ₹${inv.saleRate}`;
                                    const subVal = Object.entries(
                                      inv.attributes || {},
                                    )
                                      .map(([k, v]) => `${k}: ${v}`)
                                      .join(", ");
                                    return (
                                      <option
                                        key={inv.sku}
                                        value={`${inv.itemName}|||${subVal}`}
                                      >
                                        {label}
                                      </option>
                                    );
                                  })}
                                </select>
                              );
                            })()}
                            {item.itemName && (
                              <span className="text-[9px] text-gray-400 font-bold">
                                In {selectedGodown}: {godownQty}
                              </span>
                            )}
                            {item.itemName &&
                              (() => {
                                const matchingItems = Object.values(
                                  inventory,
                                ).filter(
                                  (inv) =>
                                    (!inv.businessId ||
                                      inv.businessId === activeBusinessId) &&
                                    inv.itemName.toLowerCase() ===
                                      item.itemName.toLowerCase() &&
                                    Object.keys(inv.attributes || {}).length >
                                      0,
                                );
                                if (matchingItems.length === 0) return null;
                                const subCatOptions = matchingItems
                                  .map((inv) =>
                                    Object.entries(inv.attributes || {})
                                      .map(([k, v]) => `${k}: ${v}`)
                                      .join(", "),
                                  )
                                  .filter(Boolean);
                                if (subCatOptions.length === 0) return null;
                                return (
                                  <select
                                    value={item.subCategory}
                                    onChange={(e) =>
                                      setDeliveryItems((prev) =>
                                        prev.map((x, i) =>
                                          i === idx
                                            ? {
                                                ...x,
                                                subCategory: e.target.value,
                                              }
                                            : x,
                                        ),
                                      )
                                    }
                                    className="w-full border border-blue-200 rounded-lg p-1.5 mt-1 text-[10px] font-bold outline-none bg-blue-50"
                                  >
                                    <option value="">
                                      -- Sub-category (required) --
                                    </option>
                                    {matchingItems.map((inv) => {
                                      const subLabel = Object.entries(
                                        inv.attributes || {},
                                      )
                                        .map(([k, v]) => `${k}: ${v}`)
                                        .join(", ");
                                      const subGodownQty =
                                        inv.godowns[selectedGodown] || 0;
                                      return (
                                        <option key={inv.sku} value={subLabel}>
                                          {subLabel} ({subGodownQty} in godown)
                                        </option>
                                      );
                                    })}
                                  </select>
                                );
                              })()}
                          </div>
                          <input
                            type="number"
                            value={item.qty}
                            onChange={(e) =>
                              setDeliveryItems((prev) =>
                                prev.map((x, i) =>
                                  i === idx ? { ...x, qty: e.target.value } : x,
                                ),
                              )
                            }
                            placeholder="Qty"
                            className="col-span-2 border rounded-lg p-2 text-xs font-bold outline-none text-center"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setDeliveryItems((prev) =>
                                prev.filter((_, i) => i !== idx),
                              )
                            }
                            className="col-span-2 bg-red-50 text-red-400 rounded-lg font-black text-xs hover:bg-red-100"
                            disabled={deliveryItems.length === 1}
                          >
                            ✕
                          </button>
                        </div>
                      );
                    })}

                {/* + Add Item button */}
                <button
                  type="button"
                  data-ocid="delivery.primary_button"
                  onClick={() =>
                    setDeliveryItems((prev) => [...prev, emptyItem()])
                  }
                  className={`w-full py-2 border-2 border-dashed rounded-xl font-black text-[10px] uppercase tracking-widest transition-colors ${
                    sourceType === "QUEUE"
                      ? "border-amber-300 text-amber-500 hover:border-amber-500 hover:text-amber-700"
                      : "border-gray-300 text-gray-400 hover:border-blue-400 hover:text-blue-600"
                  }`}
                >
                  + Add Item
                </button>
              </div>
            </div>

            {/* Customer Name */}
            <div>
              <p className="text-[10px] font-black uppercase text-gray-400 mb-1">
                Delivered To (Customer Name)
              </p>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                data-ocid="delivery.input"
                placeholder="Customer name..."
                className="w-full border rounded-xl p-3 font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
              />
            </div>

            {/* Customer Phone */}
            <div>
              <p className="text-[10px] font-black uppercase text-gray-400 mb-1">
                Customer Phone (Optional)
              </p>
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                data-ocid="delivery.phone.input"
                placeholder="Phone number..."
                className="w-full border rounded-xl p-3 font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
              />
            </div>

            <button
              type="button"
              data-ocid="delivery.submit_button"
              onClick={handleSaveDelivery}
              disabled={isSaving}
              className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-xs shadow-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? "Saving..." : "Save Delivery"}
            </button>
          </div>
        </div>
      )}

      {viewMode === "timeline" && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="bg-white border rounded-[2rem] p-5 shadow-sm grid grid-cols-2 md:grid-cols-4 gap-3">
            <input
              type="text"
              value={filterCustomer}
              onChange={(e) => setFilterCustomer(e.target.value)}
              placeholder="Search customer..."
              data-ocid="delivery.search_input"
              className="border rounded-xl p-2.5 text-xs font-bold outline-none col-span-2 md:col-span-1"
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
            <select
              value={filterGodown}
              onChange={(e) => setFilterGodown(e.target.value)}
              className="border rounded-xl p-2.5 text-xs font-bold outline-none"
            >
              <option value="all">All Godowns</option>
              {godowns.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>

          {filteredRecords.length === 0 ? (
            <div
              data-ocid="delivery.empty_state"
              className="text-center py-16 text-gray-400"
            >
              <Truck size={48} className="mx-auto mb-4 opacity-30" />
              <p className="font-black text-sm uppercase tracking-widest">
                No deliveries found
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredRecords.map((r, idx) => (
                <div
                  key={r.id}
                  data-ocid={`delivery.item.${idx + 1}`}
                  className="bg-white border rounded-[2rem] p-5 shadow-sm"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                          r.type === "GODOWN"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {r.type === "GODOWN" ? "Godown" : "Queue"}
                      </span>
                      <span className="font-black text-gray-800">
                        {r.customerName}
                        {r.customerPhone && (
                          <span className="text-[10px] text-blue-500 ml-1">
                            📞 {r.customerPhone}
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] font-bold text-gray-400">
                        {new Date(r.deliveredAt).toLocaleDateString("en-IN")}{" "}
                        {new Date(r.deliveredAt).toLocaleTimeString("en-IN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      {currentUser.role === "admin" && (
                        <button
                          type="button"
                          data-ocid={`delivery.item.${idx + 1}.edit_button`}
                          onClick={() => openEditDelivery(r)}
                          className="p-2 bg-purple-50 hover:bg-purple-100 rounded-xl transition-colors text-purple-500"
                        >
                          <Pencil size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[10px] font-bold text-gray-500 mb-3">
                    <span>📦 {r.sourceGodown}</span>
                    <span>👤 {r.deliveredBy}</span>
                    {r.biltyNo && (
                      <span className="col-span-2">🚚 {r.biltyNo}</span>
                    )}
                  </div>
                  <div className="space-y-1">
                    {r.items.map((item, i) => (
                      <div
                        key={`${r.id}-item-${item.itemName}-${i}`}
                        className="flex justify-between bg-gray-50 rounded-lg px-3 py-1.5 text-xs font-bold"
                      >
                        <span>
                          {item.category} — {item.itemName}
                        </span>
                        <span className="text-blue-700">×{item.qty}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Edit Delivery Modal */}
      {editingRecord && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-black text-lg text-gray-800 uppercase tracking-tight">
                Edit Delivery
              </h3>
              <button
                type="button"
                onClick={() => setEditingRecord(null)}
                data-ocid="delivery.edit.close_button"
                className="p-2 bg-gray-100 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-xl transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-[10px] font-black uppercase text-gray-400 mb-1">
                  Customer Name *
                </p>
                <input
                  type="text"
                  value={editCustomerName}
                  onChange={(e) => setEditCustomerName(e.target.value)}
                  data-ocid="delivery.edit.input"
                  className="w-full border rounded-xl p-3 font-bold text-sm outline-none focus:ring-2 focus:ring-blue-400 bg-gray-50"
                />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase text-gray-400 mb-1">
                  Customer Phone
                </p>
                <input
                  type="tel"
                  value={editCustomerPhone}
                  onChange={(e) => setEditCustomerPhone(e.target.value)}
                  className="w-full border rounded-xl p-3 font-bold text-sm outline-none focus:ring-2 focus:ring-blue-400 bg-gray-50"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase text-gray-400 mb-1">
                    Delivered At
                  </p>
                  <input
                    type="date"
                    value={editDeliveredAt}
                    onChange={(e) => setEditDeliveredAt(e.target.value)}
                    className="w-full border rounded-xl p-3 font-bold text-sm outline-none focus:ring-2 focus:ring-blue-400 bg-gray-50"
                  />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-gray-400 mb-1">
                    Source Godown
                  </p>
                  <select
                    value={editGodown}
                    onChange={(e) => setEditGodown(e.target.value)}
                    data-ocid="delivery.edit.select"
                    className="w-full border rounded-xl p-3 font-bold text-sm outline-none focus:ring-2 focus:ring-blue-400 bg-gray-50"
                  >
                    {godowns.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase text-gray-400 mb-2">
                  Items
                </p>
                <div className="space-y-2">
                  {editItems.map((item, idx) => (
                    <div
                      key={`edit-item-${item.itemName}-${idx}`}
                      className="flex items-center gap-3 bg-gray-50 p-3 rounded-xl"
                    >
                      <div className="flex-1">
                        <p className="font-black text-xs text-gray-800">
                          {item.category && `${item.category} — `}
                          {item.itemName}
                        </p>
                        {item.subCategory && (
                          <p className="text-[10px] text-gray-400 font-bold">
                            {item.subCategory}
                          </p>
                        )}
                      </div>
                      <input
                        type="number"
                        value={item.qty}
                        onChange={(e) =>
                          setEditItems((prev) =>
                            prev.map((x, i) =>
                              i === idx
                                ? { ...x, qty: Number(e.target.value) }
                                : x,
                            ),
                          )
                        }
                        className="w-20 border rounded-lg p-2 text-xs font-black text-center outline-none focus:ring-2 focus:ring-blue-400"
                        min="1"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setEditingRecord(null)}
                data-ocid="delivery.edit.cancel_button"
                className="flex-1 py-3 border-2 border-gray-200 rounded-xl font-black text-[10px] uppercase tracking-widest text-gray-500 hover:border-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEditDelivery}
                disabled={isSavingEdit}
                data-ocid="delivery.edit.save_button"
                className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-700 transition-colors disabled:opacity-50"
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

/* ================= MAIN APP ================= */

export { CheckCircle, DeliveryTab };
