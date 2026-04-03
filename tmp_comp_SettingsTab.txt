import {
  AlertCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Download,
  Edit,
  Edit2,
  Pencil,
  PlusCircle,
  RefreshCw,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import type {
  Transaction as AppTransaction,
  AppUser,
  Business,
  Category,
  CategoryField,
  ColumnDef,
  CustomColumns,
  DeliveryRecord,
  InventoryItem,
  InwardSavedEntry,
  PendingParcel,
  TransitRecord,
} from "../types";
import { StockOverwriteTable } from "./OpeningStockTab";

interface EditingCategory {
  originalName: string;
  name: string;
  fields: (CategoryField & { optionsStr?: string })[];
}

function BiltyPrefixManager({
  biltyPrefixes,
  setBiltyPrefixes,
  showNotification,
}: {
  biltyPrefixes: string[];
  setBiltyPrefixes: React.Dispatch<React.SetStateAction<string[]>>;
  showNotification: (m: string, t?: string) => void;
}) {
  const [newPrefix, setNewPrefix] = useState("");
  const [editValues, setEditValues] = useState<Record<number, string>>({});

  return (
    <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm max-w-lg">
      <h4 className="font-black text-xs uppercase tracking-widest text-blue-900 mb-6">
        Bilty Prefixes
      </h4>
      <div className="space-y-3 mb-6">
        {biltyPrefixes.map((prefix, idx) => (
          <div
            key={prefix}
            className="flex items-center gap-3 p-3 bg-gray-50 rounded-2xl"
          >
            <input
              type="text"
              value={editValues[idx] !== undefined ? editValues[idx] : prefix}
              onChange={(e) =>
                setEditValues((prev) => ({ ...prev, [idx]: e.target.value }))
              }
              onBlur={() => {
                const val = (editValues[idx] ?? prefix).trim();
                if (!val) return;
                if (biltyPrefixes.some((p, i) => i !== idx && p === val)) {
                  showNotification("Duplicate prefix", "error");
                  return;
                }
                setBiltyPrefixes((prev) =>
                  prev.map((p, i) => (i === idx ? val : p)),
                );
                setEditValues((prev) => {
                  const n = { ...prev };
                  delete n[idx];
                  return n;
                });
              }}
              className="flex-1 border rounded-xl p-3 text-sm font-bold"
            />
            <button
              type="button"
              onClick={() => {
                if (biltyPrefixes.length <= 1) {
                  showNotification("At least one prefix is required", "error");
                  return;
                }
                setBiltyPrefixes((prev) => prev.filter((_, i) => i !== idx));
                showNotification("Prefix removed", "success");
              }}
              className="p-2 text-red-500 hover:bg-red-50 rounded-xl"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
      <div className="flex gap-3">
        <input
          type="text"
          placeholder="New prefix (e.g. abc)"
          value={newPrefix}
          onChange={(e) => setNewPrefix(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const val = newPrefix.trim();
              if (!val) return;
              if (biltyPrefixes.includes(val)) {
                showNotification("Prefix already exists", "error");
                return;
              }
              setBiltyPrefixes((prev) => [...prev, val]);
              setNewPrefix("");
              showNotification("Prefix added", "success");
            }
          }}
          className="flex-1 border rounded-xl p-3 text-sm"
        />
        <button
          type="button"
          onClick={() => {
            const val = newPrefix.trim();
            if (!val) return;
            if (biltyPrefixes.includes(val)) {
              showNotification("Prefix already exists", "error");
              return;
            }
            setBiltyPrefixes((prev) => [...prev, val]);
            setNewPrefix("");
            showNotification("Prefix added", "success");
          }}
          className="px-5 py-3 bg-blue-600 text-white rounded-xl font-black text-xs uppercase"
        >
          Add
        </button>
      </div>
      <p className="text-[10px] text-gray-400 font-bold mt-4">
        {biltyPrefixes.length} prefix{biltyPrefixes.length !== 1 ? "es" : ""}{" "}
        configured. These appear in the bilty entry prefix selector.
      </p>
    </div>
  );
}

function AddFieldRow({
  onAdd,
}: {
  onAdd: (key: string, label: string) => void;
}) {
  const [newLabel, setNewLabel] = useState("");
  return (
    <div className="mt-4 pt-4 border-t border-gray-100">
      <p className="text-[9px] font-black uppercase text-gray-400 mb-2">
        Add Custom Field
      </p>
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Field label (e.g. Remarks)"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          className="flex-1 border rounded-xl p-2.5 text-sm font-bold bg-gray-50 outline-none"
        />
        <button
          type="button"
          onClick={() => {
            if (!newLabel.trim()) return;
            onAdd(newLabel.trim(), newLabel.trim());
            setNewLabel("");
          }}
          className="px-4 py-2.5 bg-blue-600 text-white rounded-xl font-black text-xs uppercase"
        >
          Add
        </button>
      </div>
    </div>
  );
}

function SettingsTab({
  users,
  setUsers,
  categories,
  setCategories,
  customColumns,
  setCustomColumns,
  setPromptDialog,
  setConfirmDialog,
  exportDatabase,
  importDatabase,
  showNotification,
  businesses,
  setBusinesses,
  activeBusinessId,
  setActiveBusinessId,
  inventory,
  setInventory,
  godowns,
  setGodowns,
  minStockThreshold,
  setMinStockThreshold,
  setTransactions,
  currentUser: settingsCurrentUser,
  transportTracking,
  setTransportTracking,
  tabNames,
  setTabNames,
  fieldLabels,
  setFieldLabels,
  requiredFields,
  setRequiredFields,
  fieldOrder,
  setFieldOrder,
  thresholdExcludedItems = [],
  setThresholdExcludedItems,
  setTransitGoods,
  setPendingParcels,
  setInwardSaved,
  setDeliveryRecords,
  setDeliveredBilties,
  biltyPrefixes = ["sola", "erob", "cheb", "0"],
  setBiltyPrefixes,
  fieldTypes = {},
  setFieldTypes,
  fieldComboOptions = {},
  setFieldComboOptions,
  customTabFields = {},
  setCustomTabFields,
  initialSubTab,
  categoryUnits = {},
  setCategoryUnits,
  itemUnitOverrides = {},
  setItemUnitOverrides,
}: {
  users: AppUser[];
  setUsers: React.Dispatch<React.SetStateAction<AppUser[]>>;
  categories: Category[];
  setCategories: React.Dispatch<React.SetStateAction<Category[]>>;
  customColumns: CustomColumns;
  setCustomColumns: React.Dispatch<React.SetStateAction<CustomColumns>>;
  setPromptDialog: (
    d: {
      message: string;
      defaultValue?: string;
      onConfirm: (v: string) => void;
    } | null,
  ) => void;
  setConfirmDialog: (
    d: { message: string; onConfirm: () => void } | null,
  ) => void;
  exportDatabase: () => void | Promise<void>;
  importDatabase: (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => void | Promise<void>;
  showNotification: (m: string, t?: string) => void;
  businesses: Business[];
  setBusinesses: React.Dispatch<React.SetStateAction<Business[]>>;
  activeBusinessId: string;
  setActiveBusinessId: (id: string) => void;
  inventory: Record<string, InventoryItem>;
  setInventory: React.Dispatch<
    React.SetStateAction<Record<string, InventoryItem>>
  >;
  godowns: string[];
  setGodowns: React.Dispatch<React.SetStateAction<string[]>>;
  minStockThreshold: number;
  setMinStockThreshold: React.Dispatch<React.SetStateAction<number>>;
  setTransactions: React.Dispatch<React.SetStateAction<AppTransaction[]>>;
  currentUser: AppUser;
  transportTracking: Record<string, string>;
  setTransportTracking: React.Dispatch<
    React.SetStateAction<Record<string, string>>
  >;
  tabNames: Record<string, string>;
  setTabNames: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  fieldLabels: Record<string, Record<string, string>>;
  setFieldLabels: React.Dispatch<
    React.SetStateAction<Record<string, Record<string, string>>>
  >;
  requiredFields: Record<string, Record<string, boolean>>;
  setRequiredFields: React.Dispatch<
    React.SetStateAction<Record<string, Record<string, boolean>>>
  >;
  fieldOrder: Record<string, string[]>;
  setFieldOrder: React.Dispatch<React.SetStateAction<Record<string, string[]>>>;
  thresholdExcludedItems?: string[];
  setThresholdExcludedItems?: React.Dispatch<React.SetStateAction<string[]>>;
  setTransitGoods?: React.Dispatch<React.SetStateAction<TransitRecord[]>>;
  setPendingParcels?: React.Dispatch<React.SetStateAction<PendingParcel[]>>;
  setInwardSaved?: React.Dispatch<React.SetStateAction<InwardSavedEntry[]>>;
  setDeliveryRecords?: React.Dispatch<React.SetStateAction<DeliveryRecord[]>>;
  setDeliveredBilties?: React.Dispatch<React.SetStateAction<string[]>>;
  biltyPrefixes?: string[];
  setBiltyPrefixes?: React.Dispatch<React.SetStateAction<string[]>>;
  fieldTypes?: Record<string, Record<string, "text" | "combo" | "drop">>;
  setFieldTypes?: React.Dispatch<
    React.SetStateAction<
      Record<string, Record<string, "text" | "combo" | "drop">>
    >
  >;
  fieldComboOptions?: Record<string, Record<string, string[]>>;
  setFieldComboOptions?: React.Dispatch<
    React.SetStateAction<Record<string, Record<string, string[]>>>
  >;
  customTabFields?: Record<string, { key: string; label: string }[]>;
  setCustomTabFields?: React.Dispatch<
    React.SetStateAction<Record<string, { key: string; label: string }[]>>
  >;
  initialSubTab?: string;
  categoryUnits?: Record<string, "pcs" | "dozen">;
  setCategoryUnits?: React.Dispatch<
    React.SetStateAction<Record<string, "pcs" | "dozen">>
  >;
  itemUnitOverrides?: Record<string, "pcs" | "dozen">;
  setItemUnitOverrides?: React.Dispatch<
    React.SetStateAction<Record<string, "pcs" | "dozen">>
  >;
}) {
  const [activeSub, setActiveSub] = useState(initialSubTab || "businesses");
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally sync when prop changes
  useEffect(() => {
    if (initialSubTab) setActiveSub(initialSubTab);
  }, [initialSubTab]);
  const [selectedFieldTab, setSelectedFieldTab] = useState("transit");
  const [newUser, setNewUser] = useState<AppUser>({
    username: "",
    password: "",
    role: "staff",
  });
  const [editUser, setEditUser] = useState<{ oldName: string } | null>(null);
  const [editTarget, setEditTarget] = useState<{
    tab: keyof CustomColumns;
    oldName: string;
  } | null>(null);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState("text");
  const [editingCategoryFull, setEditingCategoryFull] =
    useState<EditingCategory | null>(null);

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (editUser) {
      setUsers((prev) =>
        prev.map((u) =>
          u.username === editUser.oldName ? { ...u, ...newUser } : u,
        ),
      );
      setEditUser(null);
      showNotification("User Updated");
    } else {
      const duplicate = users.some((u) => u.username === newUser.username);
      if (duplicate) {
        showNotification("Username already exists", "error");
        return;
      }
      setUsers((prev) => [...prev, newUser]);
      showNotification("User Created");
    }
    setNewUser({ username: "", password: "", role: "staff" });
  };

  const handleUpdateColumn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim() || !editTarget) return;
    const { tab, oldName } = editTarget;
    setCustomColumns((prev) => ({
      ...prev,
      [tab]: prev[tab].map((c) =>
        c.name === oldName ? { name: editName, type: editType } : c,
      ),
    }));
    setEditTarget(null);
    showNotification("Column Updated");
  };

  const handleSaveCategory = () => {
    if (!editingCategoryFull?.name.trim())
      return showNotification("Name required", "error");
    const fieldsToSave: CategoryField[] = editingCategoryFull.fields.map(
      (f) => ({
        name: f.name.trim(),
        type: f.type as "text" | "select" | "combo",
        options:
          f.type === "select" || f.type === "combo"
            ? (f.optionsStr || "")
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean)
            : [],
      }),
    );
    setCategories((prev) =>
      prev.map((c) =>
        c.name === editingCategoryFull.originalName
          ? { name: editingCategoryFull.name.trim(), fields: fieldsToSave }
          : c,
      ),
    );
    setEditingCategoryFull(null);
    showNotification("Category Settings Saved");
  };

  // Redirect non-admins away from "users" sub-tab
  if (activeSub === "users" && settingsCurrentUser?.role !== "admin") {
    setActiveSub("businesses");
  }

  const visibleSubs = (
    [
      "businesses",
      "stock",
      "godowns",
      "tracking",
      "tabnames",
      "fieldlabels",
      "users",
      "columns",
      "threshold",
      "purchaseprices",
      "biltyprefix",
      "units",
      "data",
    ] as const
  ).filter((sub) => sub !== "users" || settingsCurrentUser?.role === "admin");

  return (
    <div className="space-y-6 animate-fade-in-down relative">
      <div className="flex bg-gray-100 p-1.5 rounded-[1.5rem] font-black uppercase text-[10px] tracking-widest shadow-inner overflow-x-auto scrollbar-hide">
        {visibleSubs.map((sub) => (
          <button
            type="button"
            key={sub}
            onClick={() => setActiveSub(sub as string)}
            className={`flex-none py-3 px-4 rounded-2xl transition-all whitespace-nowrap text-[10px] ${activeSub === sub ? "bg-blue-600 text-white shadow-lg" : "text-gray-500"}`}
          >
            {sub === "businesses"
              ? "Business"
              : sub === "stock"
                ? "Stock Control"
                : sub === "godowns"
                  ? "Godowns"
                  : sub === "tracking"
                    ? "Tracking"
                    : sub === "tabnames"
                      ? "Tab Names"
                      : sub === "fieldlabels"
                        ? "Field Labels"
                        : sub === "users"
                          ? "Logins"
                          : sub === "columns"
                            ? "Forms"
                            : sub === "threshold"
                              ? "Thresholds"
                              : sub === "purchaseprices"
                                ? "Purchase Prices"
                                : sub === "biltyprefix"
                                  ? "Bilty Prefixes"
                                  : "System Data"}
          </button>
        ))}
      </div>

      {editTarget && (
        <div className="fixed inset-0 bg-gray-900/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl w-full max-w-sm animate-fade-in-down">
            <h3 className="font-black uppercase tracking-widest text-xs mb-6 text-blue-900 border-b pb-2">
              Edit Column
            </h3>
            <form onSubmit={handleUpdateColumn} className="space-y-4">
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full border rounded-xl p-3 outline-none font-bold focus:ring-2 focus:ring-blue-500 bg-gray-50"
              />
              <select
                value={editType}
                onChange={(e) => setEditType(e.target.value)}
                className="w-full border rounded-xl p-3 outline-none font-bold bg-gray-50"
              >
                <option value="text">Text</option>
                <option value="number">Number</option>
                <option value="date">Date</option>
              </select>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditTarget(null)}
                  className="flex-1 bg-gray-100 text-gray-600 font-black py-3 rounded-xl uppercase text-[10px] tracking-widest"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white font-black py-3 rounded-xl uppercase text-[10px] tracking-widest shadow-lg"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {activeSub === "businesses" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <h4 className="font-black text-xs uppercase tracking-widest text-blue-900">
                Business Profiles
              </h4>
              <button
                type="button"
                onClick={() =>
                  setPromptDialog({
                    message: "New Business Name?",
                    onConfirm: (name) => {
                      if (name) {
                        const newId = `biz_${Date.now()}`;
                        setBusinesses((prev) => [...prev, { id: newId, name }]);
                        setActiveBusinessId(newId);
                      }
                    },
                  })
                }
                className="bg-blue-100 text-blue-700 p-2 rounded-xl"
              >
                <PlusCircle size={20} />
              </button>
            </div>
            <div className="space-y-3">
              {businesses.map((b) => (
                <div
                  key={b.id}
                  className="flex justify-between items-center bg-gray-50 border p-4 rounded-2xl font-bold text-sm hover:border-blue-200 transition-colors"
                >
                  <span>
                    {b.name}{" "}
                    {activeBusinessId === b.id && (
                      <span className="text-[8px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full uppercase ml-2">
                        Active
                      </span>
                    )}
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setPromptDialog({
                          message: "Edit Business Name:",
                          defaultValue: b.name,
                          onConfirm: (name) => {
                            if (name)
                              setBusinesses((prev) =>
                                prev.map((x) =>
                                  x.id === b.id ? { ...x, name } : x,
                                ),
                              );
                          },
                        })
                      }
                      className="text-blue-500 bg-white p-2 rounded-lg shadow-sm hover:bg-blue-50"
                    >
                      <Edit size={14} />
                    </button>
                    {businesses.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setConfirmDialog({
                            message: "Delete Business Profile?",
                            onConfirm: () => {
                              const fallback = businesses.find(
                                (x) => x.id !== b.id,
                              );
                              setBusinesses((prev) =>
                                prev.filter((x) => x.id !== b.id),
                              );
                              if (activeBusinessId === b.id && fallback)
                                setActiveBusinessId(fallback.id);
                            },
                          })
                        }
                        className="text-red-400 bg-white p-2 rounded-lg shadow-sm hover:bg-red-50"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeSub === "stock" && (
        <div className="space-y-8">
          {/* Global Threshold */}
          <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm">
            <h4 className="font-black text-xs uppercase tracking-widest text-blue-900 mb-2">
              Global Low Stock Threshold
            </h4>
            <p className="text-xs text-gray-500 font-bold mb-4">
              Items below this total quantity are flagged as low stock (unless
              overridden per item)
            </p>
            <div className="flex items-center gap-4">
              <input
                type="number"
                min={0}
                value={minStockThreshold}
                onChange={(e) => setMinStockThreshold(Number(e.target.value))}
                className="border rounded-xl p-3 font-black text-lg w-28 outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 text-center"
              />
              <span className="text-xs font-bold text-gray-400">units</span>
            </div>
          </div>

          {/* Per-Item Threshold Overrides */}
          <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm">
            <h4 className="font-black text-xs uppercase tracking-widest text-blue-900 mb-4">
              Per-Item Threshold Overrides
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-bold">
                <thead>
                  <tr className="border-b text-gray-400 uppercase tracking-widest">
                    <th className="text-left py-2 pr-4">Item Name</th>
                    <th className="text-left py-2 pr-4">Category</th>
                    <th className="text-left py-2 pr-4">SKU</th>
                    <th className="text-left py-2 pr-4">Current Threshold</th>
                    <th className="text-left py-2 pr-4">Override</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {Object.values(inventory)
                    .filter(
                      (item) =>
                        !item.businessId ||
                        item.businessId === activeBusinessId,
                    )
                    .map((item) => (
                      <tr
                        key={item.sku}
                        className="border-b hover:bg-gray-50 transition-colors"
                      >
                        <td className="py-2 pr-4">{item.itemName}</td>
                        <td className="py-2 pr-4">{item.category}</td>
                        <td className="py-2 pr-4 text-gray-400 font-mono text-[10px]">
                          {item.sku.substring(0, 16)}...
                        </td>
                        <td className="py-2 pr-4">
                          {item.minThreshold != null ? (
                            <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                              {item.minThreshold}
                            </span>
                          ) : (
                            <span className="bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                              Global ({minStockThreshold})
                            </span>
                          )}
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            type="number"
                            min={0}
                            placeholder="Override..."
                            defaultValue={item.minThreshold ?? ""}
                            className="border rounded-lg p-1.5 w-24 outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 text-center"
                            onChange={(e) => {
                              const val =
                                e.target.value === ""
                                  ? undefined
                                  : Number(e.target.value);
                              setInventory((prev) => ({
                                ...prev,
                                [item.sku]: {
                                  ...prev[item.sku],
                                  minThreshold: val,
                                },
                              }));
                            }}
                          />
                        </td>
                        <td className="py-2">
                          {item.minThreshold != null && (
                            <button
                              type="button"
                              onClick={() =>
                                setInventory((prev) => {
                                  const copy = {
                                    ...prev,
                                    [item.sku]: { ...prev[item.sku] },
                                  };
                                  copy[item.sku].minThreshold = undefined;
                                  return copy;
                                })
                              }
                              className="text-red-400 hover:text-red-600 text-[10px] uppercase tracking-widest font-black px-2 py-1 rounded-lg hover:bg-red-50"
                            >
                              Clear
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  {Object.values(inventory).filter(
                    (item) =>
                      !item.businessId || item.businessId === activeBusinessId,
                  ).length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="text-center py-8 text-gray-400"
                      >
                        No inventory items yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Stock Overwrite Section */}
          <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm">
            <h4 className="font-black text-xs uppercase tracking-widest text-blue-900 mb-1">
              Direct Stock Overwrite
            </h4>
            <p className="text-xs text-gray-500 font-bold mb-4">
              Set exact quantity values for any item — overwrites current stock
              and logs to history.
            </p>
            {Object.values(inventory).filter(
              (item) =>
                !item.businessId || item.businessId === activeBusinessId,
            ).length === 0 ? (
              <p className="text-center text-gray-400 py-8 text-xs font-bold">
                No inventory items yet
              </p>
            ) : (
              <StockOverwriteTable
                inventory={inventory}
                setInventory={setInventory}
                godowns={godowns}
                activeBusinessId={activeBusinessId}
                setTransactions={setTransactions}
                currentUser={settingsCurrentUser}
                showNotification={showNotification}
              />
            )}
          </div>
        </div>
      )}

      {activeSub === "users" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm">
            <h4 className="font-black text-xs uppercase tracking-widest text-gray-400 mb-6">
              {editUser ? "Edit User" : "Create User"}
            </h4>
            <form onSubmit={handleSaveUser} className="space-y-4">
              <input
                required
                type="text"
                value={newUser.username}
                onChange={(e) =>
                  setNewUser({ ...newUser, username: e.target.value })
                }
                className="w-full border rounded-2xl p-4 outline-none font-bold bg-gray-50"
                placeholder="Username"
              />
              <input
                required
                type="password"
                value={newUser.password}
                onChange={(e) =>
                  setNewUser({ ...newUser, password: e.target.value })
                }
                className="w-full border rounded-2xl p-4 outline-none font-bold bg-gray-50"
                placeholder="Password"
              />
              <select
                value={newUser.role}
                onChange={(e) =>
                  setNewUser({
                    ...newUser,
                    role: e.target.value as AppUser["role"],
                  })
                }
                className="w-full border rounded-2xl p-4 font-black uppercase text-xs tracking-widest bg-gray-50"
              >
                <option value="staff">Staff</option>
                <option value="admin">Admin</option>
                <option value="supplier">Supplier</option>
              </select>
              <button
                type="submit"
                className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-xs shadow-lg hover:bg-blue-700"
              >
                {editUser ? "Save Updates" : "Activate Login"}
              </button>
              {editUser && (
                <button
                  type="button"
                  onClick={() => {
                    setEditUser(null);
                    setNewUser({ username: "", password: "", role: "staff" });
                  }}
                  className="w-full text-gray-400 font-bold text-[10px] uppercase tracking-widest py-2"
                >
                  Cancel Edit
                </button>
              )}
            </form>
          </div>
          <div className="space-y-3">
            {users.map((u) => (
              <div
                key={u.username}
                className="bg-white border p-5 rounded-[2rem] flex justify-between items-center font-bold shadow-sm"
              >
                <div className="flex-1">
                  <p className="text-lg font-black tracking-tight text-gray-800">
                    {u.username}
                  </p>
                  <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest mt-1">
                    {u.role}
                  </p>
                  {u.role !== "admin" && (
                    <div className="mt-2">
                      <p className="text-[9px] font-black uppercase text-gray-400 tracking-widest mb-1">
                        Business Access
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {businesses.map((b) => {
                          const checked =
                            !u.assignedBusinessIds ||
                            u.assignedBusinessIds.length === 0 ||
                            u.assignedBusinessIds.includes(b.id);
                          return (
                            <label
                              key={b.id}
                              className="flex items-center gap-1 text-[10px] font-bold cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  setUsers((prev) =>
                                    prev.map((x) => {
                                      if (x.username !== u.username) return x;
                                      const current =
                                        x.assignedBusinessIds &&
                                        x.assignedBusinessIds.length > 0
                                          ? x.assignedBusinessIds
                                          : businesses.map((biz) => biz.id);
                                      if (e.target.checked) {
                                        return {
                                          ...x,
                                          assignedBusinessIds: [
                                            ...new Set([...current, b.id]),
                                          ],
                                        };
                                      }
                                      const next = current.filter(
                                        (id) => id !== b.id,
                                      );
                                      return {
                                        ...x,
                                        assignedBusinessIds: next,
                                      };
                                    }),
                                  );
                                }}
                                className="rounded"
                              />
                              {b.name}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setEditUser({ oldName: u.username });
                      setNewUser({
                        username: u.username,
                        password: u.password,
                        role: u.role,
                      });
                    }}
                    className="text-blue-500 bg-blue-50 p-3 hover:bg-blue-100 rounded-xl"
                  >
                    <Edit size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setConfirmDialog({
                        message: "Delete Account?",
                        onConfirm: () =>
                          setUsers((prev) =>
                            prev.filter((x) => x.username !== u.username),
                          ),
                      })
                    }
                    className="text-red-400 bg-red-50 p-3 hover:bg-red-100 rounded-xl"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeSub === "columns" && (
        <div>
          {editingCategoryFull ? (
            <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm">
              <div className="flex justify-between items-center mb-6 border-b pb-4">
                <h4 className="font-black text-lg uppercase tracking-widest text-blue-900">
                  Edit: {editingCategoryFull.originalName}
                </h4>
                <button
                  type="button"
                  onClick={() => setEditingCategoryFull(null)}
                  className="p-2 bg-gray-100 rounded-full"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="mb-6">
                <p className="text-[10px] font-black uppercase text-gray-400">
                  Category Name
                </p>
                <input
                  type="text"
                  value={editingCategoryFull.name}
                  onChange={(e) =>
                    setEditingCategoryFull({
                      ...editingCategoryFull,
                      name: e.target.value,
                    })
                  }
                  className="w-full border-2 border-blue-100 focus:border-blue-500 rounded-xl p-4 font-black text-lg outline-none mt-1 bg-gray-50"
                />
              </div>
              <div className="space-y-4 mb-6">
                {editingCategoryFull.fields.map((f, i) => (
                  <div
                    // biome-ignore lint/suspicious/noArrayIndexKey: index key intentional — fields have no stable ID and order is user-controlled
                    key={`field-${i}`}
                    className="bg-gray-50 p-5 rounded-2xl border relative"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setEditingCategoryFull((prev) => {
                          if (!prev) return null;
                          const nf = [...prev.fields];
                          nf.splice(i, 1);
                          return { ...prev, fields: nf };
                        })
                      }
                      className="absolute top-4 right-4 text-red-400 bg-red-50 p-1.5 rounded"
                    >
                      <Trash2 size={16} />
                    </button>
                    <div className="pr-12 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <p className="text-[9px] font-black uppercase text-gray-400 ml-1">
                          Field Name
                        </p>
                        <input
                          type="text"
                          value={f.name}
                          onChange={(e) => {
                            const nf = [...editingCategoryFull.fields];
                            nf[i] = { ...nf[i], name: e.target.value };
                            setEditingCategoryFull({
                              ...editingCategoryFull,
                              fields: nf,
                            });
                          }}
                          className="w-full border rounded-xl p-3 text-sm font-bold mt-1 outline-none"
                        />
                      </div>
                      <div>
                        <p className="text-[9px] font-black uppercase text-gray-400 ml-1">
                          Type
                        </p>
                        <select
                          value={f.type}
                          onChange={(e) => {
                            const nf = [...editingCategoryFull.fields];
                            nf[i] = {
                              ...nf[i],
                              type: e.target.value as
                                | "text"
                                | "select"
                                | "combo",
                            };
                            setEditingCategoryFull({
                              ...editingCategoryFull,
                              fields: nf,
                            });
                          }}
                          className="w-full border rounded-xl p-3 text-sm font-bold mt-1 outline-none bg-white"
                        >
                          <option value="text">Text</option>
                          <option value="select">Dropdown</option>
                          <option value="combo">Combo (type + select)</option>
                        </select>
                      </div>
                      {(f.type === "select" || f.type === "combo") && (
                        <div className="sm:col-span-2">
                          <p className="text-[9px] font-black uppercase text-blue-500 ml-1">
                            Options (comma separated)
                          </p>
                          <input
                            type="text"
                            value={f.optionsStr || ""}
                            onChange={(e) => {
                              const nf = [...editingCategoryFull.fields];
                              nf[i] = { ...nf[i], optionsStr: e.target.value };
                              setEditingCategoryFull({
                                ...editingCategoryFull,
                                fields: nf,
                              });
                            }}
                            className="w-full border-2 border-blue-100 rounded-xl p-3 text-sm font-bold mt-1 outline-none"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setEditingCategoryFull((prev) =>
                      prev
                        ? {
                            ...prev,
                            fields: [
                              ...prev.fields,
                              {
                                name: "New Field",
                                type: "text",
                                optionsStr: "",
                              },
                            ],
                          }
                        : prev,
                    )
                  }
                  className="bg-blue-100 text-blue-700 px-5 py-3 rounded-xl text-xs font-black uppercase"
                >
                  + Add Field
                </button>
              </div>
              <div className="flex gap-3 border-t pt-6">
                <button
                  type="button"
                  onClick={() => setEditingCategoryFull(null)}
                  className="flex-1 bg-gray-100 text-gray-600 font-black py-4 rounded-2xl uppercase tracking-widest text-xs"
                >
                  Discard
                </button>
                <button
                  type="button"
                  onClick={handleSaveCategory}
                  className="flex-1 bg-blue-600 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-xs shadow-lg"
                >
                  Save Category
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm flex flex-col">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-black text-xs uppercase tracking-widest text-blue-900">
                    Categories
                  </h4>
                  <button
                    type="button"
                    onClick={() =>
                      setPromptDialog({
                        message: "New Category Name?",
                        onConfirm: (name) => {
                          if (name)
                            setCategories((prev) => [
                              ...prev,
                              { name, fields: [] },
                            ]);
                        },
                      })
                    }
                    className="bg-blue-100 text-blue-700 p-2 rounded-xl"
                  >
                    <PlusCircle size={20} />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 mb-4">
                  <button
                    type="button"
                    onClick={() => {
                      const header =
                        "Category,SubCategory,Field1Name,Field1Type,Field1Options,Field2Name,Field2Type,Field2Options,Field3Name,Field3Type,Field3Options";
                      const note =
                        "# Field types: text / dropbox / combo. Leave FieldOptions blank for text. Comma-separate options for dropbox/combo.";
                      const rows = [
                        'Lungi,Size,Length,dropbox,"2mtr,2.5mtr",Colour,dropbox,"white,mix",,',
                        'Lungi,Dhoti,Length,dropbox,"2.5mtr,3mtr",Colour,combo,"white,mix",,',
                        'Safi,Jasmine,Size,dropbox,"1.5mtr,2mtr",,,,,',
                      ];
                      const csv = `${note}\n${header}\n${rows.join("\n")}`;
                      const blob = new Blob([csv], { type: "text/csv" });
                      const a = document.createElement("a");
                      a.href = URL.createObjectURL(blob);
                      a.download = "category_template.csv";
                      a.click();
                    }}
                    className="flex items-center gap-1 bg-blue-100 text-blue-700 px-3 py-1.5 rounded-xl text-[10px] font-black"
                  >
                    <Download size={12} /> Template
                  </button>
                  <label
                    htmlFor="items-csv-upload"
                    className="flex items-center gap-1 bg-green-100 text-green-700 px-3 py-1.5 rounded-xl text-[10px] font-black cursor-pointer"
                  >
                    <Upload size={12} /> Upload Items
                  </label>
                  <input
                    id="items-csv-upload"
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        const raw = (ev.target?.result as string)
                          .split(/\r?\n/)
                          .filter((l) => l.trim() && !l.trim().startsWith("#"));
                        // Parse CSV respecting quoted fields
                        const parseRow = (line: string): string[] => {
                          const result: string[] = [];
                          let cur = "";
                          let inQ = false;
                          for (let ci = 0; ci < line.length; ci++) {
                            const ch = line[ci];
                            if (ch === '"') {
                              inQ = !inQ;
                            } else if (ch === "," && !inQ) {
                              result.push(cur.trim());
                              cur = "";
                            } else {
                              cur += ch;
                            }
                          }
                          result.push(cur.trim());
                          return result;
                        };
                        // Skip header row
                        let catCount = 0;
                        const updatedCats: typeof categories = [...categories];
                        for (let i = 1; i < raw.length; i++) {
                          const cols = parseRow(raw[i]);
                          const catName = cols[0]?.trim();
                          const subCat = cols[1]?.trim();
                          if (!catName || !subCat) continue;
                          // Build fields from Field1..Field3 columns
                          const fields: import("../types").CategoryField[] = [];
                          for (let fi = 0; fi < 3; fi++) {
                            const fn = cols[2 + fi * 3]?.trim();
                            const ft = cols[3 + fi * 3]?.trim();
                            const fo = cols[4 + fi * 3]?.trim();
                            if (!fn) continue;
                            const ftype: "text" | "select" | "combo" =
                              ft === "dropbox" || ft === "select"
                                ? "select"
                                : ft === "combo"
                                  ? "combo"
                                  : "text";
                            fields.push({
                              name: fn,
                              type: ftype,
                              options: fo
                                ? fo
                                    .split(",")
                                    .map((x) => x.trim())
                                    .filter(Boolean)
                                : [],
                            });
                          }
                          // Upsert category
                          const catIdx = updatedCats.findIndex(
                            (c) => c.name === catName,
                          );
                          if (catIdx === -1) {
                            updatedCats.push({ name: catName, fields });
                            catCount++;
                          } else {
                            // Merge fields — only add new ones
                            for (const nf of fields) {
                              if (
                                !updatedCats[catIdx].fields.find(
                                  (ef) => ef.name === nf.name,
                                )
                              ) {
                                updatedCats[catIdx].fields.push(nf);
                              }
                            }
                          }
                        }
                        setCategories(updatedCats);
                        showNotification(
                          `Imported: ${catCount} categories updated`,
                          "success",
                        );
                      };
                      reader.readAsText(file);
                      e.target.value = "";
                    }}
                  />
                </div>
                <div className="space-y-3 overflow-y-auto max-h-80">
                  {categories.map((c) => (
                    <div
                      key={c.name}
                      className="flex justify-between items-center bg-gray-50 border p-4 rounded-2xl font-bold text-sm"
                    >
                      <span>{c.name}</span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setEditingCategoryFull({
                              originalName: c.name,
                              name: c.name,
                              fields: c.fields.map((f) => ({
                                ...f,
                                optionsStr: (f.options || []).join(", "),
                              })),
                            })
                          }
                          className="text-blue-500 bg-white p-2 rounded-lg shadow-sm"
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setConfirmDialog({
                              message: "Delete Category?",
                              onConfirm: () =>
                                setCategories((prev) =>
                                  prev.filter((x) => x.name !== c.name),
                                ),
                            })
                          }
                          className="text-red-400 bg-white p-2 rounded-lg shadow-sm"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {(["transit", "warehouse", "inward"] as const).map((tab) => (
                <div
                  key={tab}
                  className="bg-white p-8 rounded-[2.5rem] border shadow-sm flex flex-col"
                >
                  <div className="flex justify-between items-center mb-6">
                    <h4 className="font-black text-xs uppercase tracking-widest text-amber-600">
                      {tab} Columns
                    </h4>
                    <button
                      type="button"
                      onClick={() =>
                        setPromptDialog({
                          message: "Column Name?",
                          onConfirm: (name) => {
                            if (name)
                              setCustomColumns((prev) => ({
                                ...prev,
                                [tab]: [...prev[tab], { name, type: "text" }],
                              }));
                          },
                        })
                      }
                      className="bg-amber-100 text-amber-700 p-2 rounded-xl"
                    >
                      <PlusCircle size={20} />
                    </button>
                  </div>
                  <div className="space-y-3 overflow-y-auto max-h-80">
                    {customColumns[tab].map((col) => (
                      <div
                        key={col.name}
                        className="flex justify-between items-center bg-gray-50 border p-4 rounded-2xl font-bold text-xs uppercase text-gray-700"
                      >
                        <span>
                          {col.name}{" "}
                          <span className="opacity-40 text-[9px] lowercase">
                            ({col.type})
                          </span>
                        </span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditTarget({ tab, oldName: col.name });
                              setEditName(col.name);
                              setEditType(col.type || "text");
                            }}
                            className="text-amber-500 bg-white p-2 rounded-lg shadow-sm"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setConfirmDialog({
                                message: "Delete Column?",
                                onConfirm: () =>
                                  setCustomColumns((prev) => ({
                                    ...prev,
                                    [tab]: prev[tab].filter(
                                      (c) => c.name !== col.name,
                                    ),
                                  })),
                              })
                            }
                            className="text-red-400 bg-white p-2 rounded-lg shadow-sm"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeSub === "godowns" && (
        <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm max-w-md">
          <div className="flex justify-between items-center mb-6">
            <h4 className="font-black text-xs uppercase tracking-widest text-blue-900">
              Godown Locations
            </h4>
            <button
              type="button"
              onClick={() => {
                const name = prompt("New Godown Name:");
                if (name?.trim() && !godowns.includes(name.trim())) {
                  setGodowns((prev) => [...prev, name.trim()]);
                }
              }}
              className="bg-blue-100 text-blue-700 p-2 rounded-xl"
            >
              <PlusCircle size={18} />
            </button>
          </div>
          <div className="space-y-3">
            {godowns.map((g, i) => (
              <div
                key={g}
                className="flex justify-between items-center bg-gray-50 border p-4 rounded-2xl font-bold text-sm"
              >
                <span>{g}</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const newName = prompt("Rename godown:", g);
                      if (
                        newName?.trim() &&
                        !godowns.includes(newName.trim())
                      ) {
                        setGodowns((prev) =>
                          prev.map((x, j) => (j === i ? newName.trim() : x)),
                        );
                      }
                    }}
                    className="text-blue-500 bg-white p-2 rounded-lg shadow-sm hover:bg-blue-50"
                  >
                    <Edit size={14} />
                  </button>
                  {godowns.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`Delete godown "${g}"?`)) {
                          setGodowns((prev) => prev.filter((_, j) => j !== i));
                        }
                      }}
                      className="text-red-400 bg-white p-2 rounded-lg shadow-sm hover:bg-red-50"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeSub === "tracking" && (
        <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm max-w-2xl">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h4 className="font-black text-xs uppercase tracking-widest text-blue-900">
                Transport Tracking URLs
              </h4>
              <p className="text-[10px] text-gray-400 font-bold mt-1">
                Map transport names to tracking URLs. A Track button appears in
                the Queue tab.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                const transport = prompt("Transport Name (e.g. DRTC):");
                if (!transport) return;
                const url = prompt(`Tracking URL for ${transport}:`);
                if (url)
                  setTransportTracking((prev) => ({
                    ...prev,
                    [transport.trim()]: url.trim(),
                  }));
              }}
              className="bg-blue-100 text-blue-700 p-2 rounded-xl"
            >
              <PlusCircle size={18} />
            </button>
          </div>
          Object.keys(transportTracking).length === 0 ? (
          <p className="text-gray-400 font-bold text-xs text-center py-8">
            No tracking URLs configured yet.
          </p>
          ) : (
          <div className="space-y-3">
            {Object.entries(transportTracking).map(([transport, url]) => (
              <div
                key={transport}
                className="flex justify-between items-center bg-gray-50 border p-4 rounded-2xl font-bold text-sm"
              >
                <div>
                  <p className="font-black">{transport}</p>
                  <p className="text-[10px] text-blue-600 font-bold truncate max-w-xs">
                    {url}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const newUrl = prompt("Edit URL:", url);
                      if (newUrl)
                        setTransportTracking((prev) => ({
                          ...prev,
                          [transport]: newUrl.trim(),
                        }));
                    }}
                    className="text-blue-500 bg-white p-2 rounded-lg shadow-sm"
                  >
                    <Edit size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`Remove tracking for ${transport}?`)) {
                        setTransportTracking((prev) => {
                          const c = { ...prev };
                          delete c[transport];
                          return c;
                        });
                      }
                    }}
                    className="text-red-400 bg-white p-2 rounded-lg shadow-sm"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
          )
        </div>
      )}

      {activeSub === "fieldlabels" &&
        (() => {
          const TAB_FIELDS: Record<string, { key: string; default: string }[]> =
            {
              transit: [
                { key: "biltyNo", default: "Bilty No" },
                { key: "transport", default: "Transport" },
                { key: "supplier", default: "Supplier" },
                { key: "itemCategory", default: "Item Category" },
                { key: "itemInfo", default: "Item Info" },
                { key: "packages", default: "Packages" },
                { key: "date", default: "Bilty Date" },
              ],
              queue: [
                { key: "biltyNo", default: "Bilty No" },
                { key: "transport", default: "Transport" },
                { key: "supplier", default: "Supplier" },
                { key: "itemCategory", default: "Item Category" },
                { key: "itemName", default: "Item Name" },
                { key: "packages", default: "Total Packages" },
                { key: "arrivalDate", default: "Arrival Date" },
              ],
              inward: [
                { key: "biltyNo", default: "Bilty No" },
                { key: "packages", default: "Packages" },
                { key: "category", default: "Category" },
                { key: "itemName", default: "Item Name" },
                { key: "totalQty", default: "Total Qty in Bale" },
                { key: "shopQty", default: "Shop Qty" },
                { key: "saleRate", default: "Sale Rate" },
                { key: "purchaseRate", default: "Purchase Rate" },
              ],
              delivery: [
                { key: "godown", default: "Source Godown" },
                { key: "itemCategory", default: "Item Category" },
                { key: "itemName", default: "Item Name" },
                { key: "qty", default: "Qty" },
                { key: "customerName", default: "Customer Name" },
                { key: "customerPhone", default: "Customer Phone" },
              ],
              transfer: [
                { key: "fromGodown", default: "From Godown" },
                { key: "toGodown", default: "To Godown" },
                { key: "itemCategory", default: "Item Category" },
                { key: "itemName", default: "Item Name" },
                { key: "qty", default: "Qty" },
              ],
            };

          const defaultOrder =
            TAB_FIELDS[selectedFieldTab]?.map((f) => f.key) || [];
          const currentOrder = fieldOrder[selectedFieldTab] || defaultOrder;
          const fieldsByKey = Object.fromEntries(
            (TAB_FIELDS[selectedFieldTab] || []).map((f) => [f.key, f]),
          );
          const orderedFields = currentOrder
            .map((k) => fieldsByKey[k])
            .filter(Boolean);

          // Merge custom fields
          const customFields = (customTabFields[selectedFieldTab] || []).map(
            (cf) => ({ key: cf.key, default: cf.label, isCustom: true }),
          );
          const allFields = [
            ...orderedFields.map((f) => ({ ...f, isCustom: false })),
            ...customFields,
          ];

          const moveField = (idx: number, dir: -1 | 1) => {
            const order = [...currentOrder];
            const newIdx = idx + dir;
            if (newIdx < 0 || newIdx >= order.length) return;
            [order[idx], order[newIdx]] = [order[newIdx], order[idx]];
            setFieldOrder((prev) => ({ ...prev, [selectedFieldTab]: order }));
          };

          const tabLabels = fieldLabels[selectedFieldTab] || {};
          const tabRequired = requiredFields[selectedFieldTab] || {};
          return (
            <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm max-w-2xl">
              <h4 className="font-black text-xs uppercase tracking-widest text-blue-900 mb-6">
                Field Labels & Required Fields
              </h4>
              <div className="flex gap-2 mb-6 flex-wrap">
                {Object.keys(TAB_FIELDS).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setSelectedFieldTab(tab)}
                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-colors ${selectedFieldTab === tab ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
              <div className="space-y-3">
                {allFields.map((f, idx) => (
                  <div
                    key={f.key}
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-2xl"
                  >
                    <div className="flex flex-col gap-1 shrink-0">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => moveField(idx, -1)}
                        className="p-1 rounded-lg bg-white border hover:bg-blue-50 disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Move up"
                      >
                        <ChevronUp size={12} />
                      </button>
                      <button
                        type="button"
                        disabled={idx === orderedFields.length - 1}
                        onClick={() => moveField(idx, 1)}
                        className="p-1 rounded-lg bg-white border hover:bg-blue-50 disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Move down"
                      >
                        <ChevronDown size={12} />
                      </button>
                    </div>
                    <div className="flex-1">
                      <p className="text-[9px] font-black uppercase text-gray-400 mb-1">
                        {f.default}
                      </p>
                      <input
                        type="text"
                        placeholder={f.default}
                        value={tabLabels[f.key] || ""}
                        onChange={(e) =>
                          setFieldLabels((prev) => ({
                            ...prev,
                            [selectedFieldTab]: {
                              ...(prev[selectedFieldTab] || {}),
                              [f.key]: e.target.value,
                            },
                          }))
                        }
                        className="w-full border rounded-xl p-2.5 font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      />
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      <p className="text-[9px] font-black uppercase text-gray-400">
                        Type
                      </p>
                      <div className="flex gap-1">
                        {(["text", "combo", "drop"] as const).map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() =>
                              setFieldTypes?.((prev) => ({
                                ...prev,
                                [selectedFieldTab]: {
                                  ...(prev[selectedFieldTab] || {}),
                                  [f.key]: t,
                                },
                              }))
                            }
                            className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase transition-colors ${
                              (
                                fieldTypes[selectedFieldTab]?.[f.key] || "text"
                              ) === t
                                ? "bg-blue-600 text-white"
                                : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                            }`}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                      {(["combo", "drop"] as const).includes(
                        fieldTypes[selectedFieldTab]?.[f.key] as
                          | "combo"
                          | "drop",
                      ) && (
                        <input
                          type="text"
                          placeholder="Option A, Option B, ..."
                          value={(
                            fieldComboOptions[selectedFieldTab]?.[f.key] || []
                          ).join(", ")}
                          onChange={(e) =>
                            setFieldComboOptions?.((prev) => ({
                              ...prev,
                              [selectedFieldTab]: {
                                ...(prev[selectedFieldTab] || {}),
                                [f.key]: e.target.value
                                  .split(",")
                                  .map((s) => s.trim())
                                  .filter(Boolean),
                              },
                            }))
                          }
                          className="text-[10px] border rounded-lg px-2 py-1 mt-1 w-32"
                        />
                      )}
                    </div>
                    <div className="flex flex-col items-center gap-1 shrink-0">
                      <p className="text-[9px] font-black uppercase text-gray-400">
                        Compulsory
                      </p>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!tabRequired[f.key]}
                          onChange={(e) =>
                            setRequiredFields((prev) => ({
                              ...prev,
                              [selectedFieldTab]: {
                                ...(prev[selectedFieldTab] || {}),
                                [f.key]: e.target.checked,
                              },
                            }))
                          }
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-gray-200 peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600" />
                      </label>
                    </div>
                    <button
                      type="button"
                      title="Delete field"
                      onClick={() => {
                        if ((f as any).isCustom) {
                          setCustomTabFields?.((prev) => ({
                            ...prev,
                            [selectedFieldTab]: (
                              prev[selectedFieldTab] || []
                            ).filter((cf) => cf.key !== f.key),
                          }));
                        } else {
                          setFieldOrder((prev) => ({
                            ...prev,
                            [selectedFieldTab]: currentOrder.filter(
                              (k) => k !== f.key,
                            ),
                          }));
                        }
                      }}
                      className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <AddFieldRow
                onAdd={(key, label) => {
                  const safeKey = key
                    .replace(/\s+/g, "_")
                    .replace(/[^a-zA-Z0-9_]/g, "");
                  if (!safeKey) return;
                  setCustomTabFields?.((prev) => ({
                    ...prev,
                    [selectedFieldTab]: [
                      ...(prev[selectedFieldTab] || []),
                      { key: safeKey, label },
                    ],
                  }));
                  setFieldOrder((prev) => ({
                    ...prev,
                    [selectedFieldTab]: [
                      ...(prev[selectedFieldTab] || currentOrder),
                      safeKey,
                    ],
                  }));
                }}
              />
              <p className="text-[10px] text-gray-400 font-bold mt-4">
                Label changes apply immediately. Use arrows to reorder fields.
                Required fields block form submission if empty.
              </p>
            </div>
          );
        })()}

      {activeSub === "biltyprefix" && setBiltyPrefixes && (
        <BiltyPrefixManager
          biltyPrefixes={biltyPrefixes}
          setBiltyPrefixes={setBiltyPrefixes}
          showNotification={showNotification}
        />
      )}

      {activeSub === "tabnames" && (
        <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm max-w-lg">
          <h4 className="font-black text-xs uppercase tracking-widest text-blue-900 mb-6">
            Rename Navigation Tabs
          </h4>
          <div className="space-y-4">
            {Object.entries(tabNames).map(([key, name]) => (
              <div key={key} className="flex items-center gap-4">
                <p className="text-[10px] font-black uppercase text-gray-400 w-28 shrink-0">
                  {key}
                </p>
                <input
                  type="text"
                  value={name}
                  onChange={(e) =>
                    setTabNames((prev) => ({ ...prev, [key]: e.target.value }))
                  }
                  className="flex-1 border rounded-xl p-3 font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                />
              </div>
            ))}
            <p className="text-[10px] text-gray-400 font-bold">
              Changes apply immediately to navigation.
            </p>
          </div>
        </div>
      )}

      {activeSub === "threshold" && (
        <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm max-w-2xl">
          <h4 className="font-black text-xs uppercase tracking-widest text-blue-900 mb-2">
            Threshold Exclusions
          </h4>
          <p className="text-[10px] text-gray-400 font-bold mb-6">
            Items toggled here will be excluded from low stock alerts on the
            dashboard.
          </p>
          {Object.keys(inventory).filter(
            (sku) =>
              !inventory[sku].businessId ||
              inventory[sku].businessId === activeBusinessId,
          ).length === 0 ? (
            <p className="text-gray-400 font-bold text-sm text-center py-8">
              No inventory items yet.
            </p>
          ) : (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2">
              {Object.keys(inventory)
                .filter(
                  (sku) =>
                    !inventory[sku].businessId ||
                    inventory[sku].businessId === activeBusinessId,
                )
                .map((sku) => {
                  const item = inventory[sku];
                  const excluded = (thresholdExcludedItems || []).includes(sku);
                  return (
                    <div
                      key={sku}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl"
                    >
                      <div>
                        <p className="font-black text-sm text-gray-800">
                          {item.itemName}
                        </p>
                        <p className="text-[10px] font-bold text-gray-400 uppercase">
                          {item.category}
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer gap-2">
                        <span
                          className={`text-[10px] font-black uppercase ${excluded ? "text-red-500" : "text-green-600"}`}
                        >
                          {excluded ? "Excluded" : "Alerting"}
                        </span>
                        <input
                          type="checkbox"
                          checked={excluded}
                          onChange={(e) => {
                            if (setThresholdExcludedItems) {
                              setThresholdExcludedItems((prev) =>
                                e.target.checked
                                  ? [...prev, sku]
                                  : prev.filter((s) => s !== sku),
                              );
                            }
                          }}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-gray-200 peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-red-500 relative" />
                      </label>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {activeSub === "purchaseprices" && (
        <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm">
          <h4 className="font-black text-xs uppercase tracking-widest text-blue-900 mb-2">
            Purchase Price Manager
          </h4>
          <p className="text-[10px] text-gray-400 font-bold mb-6">
            Set or update the purchase price for each inventory item.
          </p>
          {Object.keys(inventory).filter(
            (sku) =>
              !inventory[sku].businessId ||
              inventory[sku].businessId === activeBusinessId,
          ).length === 0 ? (
            <p className="text-gray-400 font-bold text-sm text-center py-8">
              No inventory items yet.
            </p>
          ) : (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2">
              {Object.values(inventory)
                .filter(
                  (item) =>
                    !item.businessId || item.businessId === activeBusinessId,
                )
                .sort(
                  (a, b) =>
                    a.category.localeCompare(b.category) ||
                    a.itemName.localeCompare(b.itemName),
                )
                .map((item) => {
                  const attrStr = Object.entries(item.attributes || {})
                    .filter(([, v]) => v)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(", ");
                  return (
                    <div
                      key={item.sku}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-sm text-gray-800 truncate">
                          {item.itemName}
                        </p>
                        <p className="text-[10px] font-bold text-gray-400 uppercase truncate">
                          {item.category}
                          {attrStr ? ` · ${attrStr}` : ""}
                        </p>
                        <p className="text-[10px] font-bold text-blue-500">
                          Sell: ₹{item.saleRate}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <p className="text-[10px] font-black uppercase text-gray-500">
                          Pur. Price ₹
                        </p>
                        <input
                          type="number"
                          defaultValue={item.purchaseRate || 0}
                          onBlur={(e) => {
                            const newRate = Number(e.target.value);
                            setInventory((prev) => ({
                              ...prev,
                              [item.sku]: {
                                ...item,
                                purchaseRate: newRate,
                              },
                            }));
                          }}
                          className="w-24 border rounded-xl p-2 font-black text-sm outline-none focus:ring-2 focus:ring-purple-400 text-purple-700 bg-purple-50"
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {activeSub === "units" && (
        <div className="space-y-8">
          {/* Section 1: Category Defaults */}
          <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm">
            <h4 className="font-black text-xs uppercase tracking-widest text-blue-900 mb-2">
              Category Unit Defaults
            </h4>
            <p className="text-[10px] font-bold text-gray-400 mb-6">
              Set the default unit for each category. Items in that category
              will use this unit everywhere.
            </p>
            <div className="space-y-3">
              {categories.map((cat) => {
                const unit = categoryUnits[cat.name] || "pcs";
                return (
                  <div
                    key={cat.name}
                    className="flex items-center justify-between py-3 border-b last:border-0"
                  >
                    <span className="font-black text-sm text-gray-800">
                      {cat.name}
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setCategoryUnits?.((prev) => ({
                            ...prev,
                            [cat.name]: "pcs",
                          }))
                        }
                        className={`px-4 py-2 rounded-xl text-[11px] font-black uppercase transition-all ${unit === "pcs" ? "bg-blue-600 text-white shadow" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}
                      >
                        pcs
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setCategoryUnits?.((prev) => ({
                            ...prev,
                            [cat.name]: "dozen",
                          }))
                        }
                        className={`px-4 py-2 rounded-xl text-[11px] font-black uppercase transition-all ${unit === "dozen" ? "bg-blue-600 text-white shadow" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}
                      >
                        dozen
                      </button>
                    </div>
                  </div>
                );
              })}
              {categories.length === 0 && (
                <p className="text-sm text-gray-400 font-bold text-center py-4">
                  No categories yet.
                </p>
              )}
            </div>
          </div>

          {/* Section 2: Item Exceptions */}
          {Object.values(categoryUnits).includes("dozen") && (
            <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm">
              <h4 className="font-black text-xs uppercase tracking-widest text-blue-900 mb-2">
                Item Exceptions (Override to pcs)
              </h4>
              <p className="text-[10px] font-bold text-gray-400 mb-6">
                These items belong to dozen-default categories. Toggle on to
                track them in pcs instead.
              </p>
              <div className="space-y-3">
                {Object.values(inventory || {})
                  .filter((item) => categoryUnits[item.category] === "dozen")
                  .map((item) => {
                    const isOverride = itemUnitOverrides[item.sku] === "pcs";
                    return (
                      <div
                        key={item.sku}
                        className="flex items-center justify-between py-3 border-b last:border-0"
                      >
                        <div>
                          <span className="font-black text-sm text-gray-800">
                            {item.itemName}
                          </span>
                          <span className="ml-2 text-[9px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-black uppercase">
                            {item.category}
                          </span>
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isOverride}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setItemUnitOverrides?.((prev) => ({
                                  ...prev,
                                  [item.sku]: "pcs",
                                }));
                              } else {
                                setItemUnitOverrides?.((prev) => {
                                  const next = { ...prev };
                                  delete next[item.sku];
                                  return next;
                                });
                              }
                            }}
                            className="w-4 h-4 accent-blue-600"
                          />
                          <span className="text-[11px] font-black text-gray-600">
                            Override to pcs
                          </span>
                        </label>
                      </div>
                    );
                  })}
                {Object.values(inventory || {}).filter(
                  (item) => categoryUnits[item.category] === "dozen",
                ).length === 0 && (
                  <p className="text-sm text-gray-400 font-bold text-center py-4">
                    No items in dozen-default categories yet.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {activeSub === "data" && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-10 rounded-[3rem] border shadow-sm flex flex-col items-center text-center gap-4">
              <div className="bg-green-100 text-green-600 p-5 rounded-[2rem]">
                <Download size={32} />
              </div>
              <div>
                <h4 className="font-black text-lg text-gray-800">
                  Secure Backup
                </h4>
                <p className="text-xs text-gray-400 font-bold mt-2">
                  Export a complete JSON snapshot
                </p>
              </div>
              <button
                type="button"
                onClick={exportDatabase}
                data-ocid="admin.primary_button"
                className="w-full bg-green-600 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-sm shadow-xl mt-4 hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
              >
                <Download size={18} /> Download Backup Now
              </button>
            </div>
            <div className="bg-white p-10 rounded-[3rem] border shadow-sm flex flex-col items-center text-center gap-4">
              <div className="bg-orange-100 text-orange-600 p-5 rounded-[2rem]">
                <Upload size={32} />
              </div>
              <div>
                <h4 className="font-black text-lg text-gray-800">
                  System Restore
                </h4>
                <p className="text-xs text-gray-400 font-bold mt-2">
                  Load data from a JSON backup file
                </p>
              </div>
              <label
                htmlFor="system-restore-input"
                className="w-full bg-orange-600 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-xs shadow-lg mt-4 cursor-pointer block text-center"
              >
                Select File
              </label>
              <input
                id="system-restore-input"
                type="file"
                accept=".json"
                className="hidden"
                onChange={importDatabase}
              />
            </div>
          </div>

          {/* Danger Zone: Reset All Data */}
          <div className="bg-red-50 border border-red-200 p-8 rounded-[2.5rem] mt-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-red-100 text-red-600 p-3 rounded-2xl">
                <AlertCircle size={24} />
              </div>
              <div>
                <h4 className="font-black text-lg text-red-800">Danger Zone</h4>
                <p className="text-xs text-red-500 font-bold mt-1">
                  Permanently delete all transactional data. Categories and
                  settings are kept.
                </p>
              </div>
            </div>
            <button
              type="button"
              data-ocid="admin.delete_button"
              onClick={() => {
                const confirmed = window.prompt(
                  "Type RESET to confirm deleting all transactional data (Transit, Queue, Inward, Inventory, Deliveries, Sales):",
                );
                if (confirmed === "RESET") {
                  if (setTransitGoods) setTransitGoods([]);
                  if (setPendingParcels) setPendingParcels([]);
                  if (setInwardSaved) setInwardSaved([]);
                  if (setInventory) setInventory({});
                  if (setTransactions) setTransactions([]);
                  if (setDeliveryRecords) setDeliveryRecords([]);
                  if (setDeliveredBilties) setDeliveredBilties([]);
                  showNotification(
                    "All transactional data has been reset.",
                    "success",
                  );
                } else if (confirmed !== null) {
                  showNotification(
                    "Reset cancelled. You must type RESET exactly.",
                    "error",
                  );
                }
              }}
              className="w-full bg-red-600 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-xs shadow-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
            >
              <AlertCircle size={16} /> Reset All Transactional Data
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* ================= ITEM NAME COMBO (OPENING STOCK) ================= */

export { SettingsTab };
