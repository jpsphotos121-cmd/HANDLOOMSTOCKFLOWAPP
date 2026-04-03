// Auto-extracted types from App.tsx

export interface CategoryField {
  name: string;
  type: "text" | "select" | "combo";
  options?: string[];
}
export interface Category {
  name: string;
  fields: CategoryField[];
}
export interface Business {
  id: string;
  name: string;
}
export interface AppUser {
  username: string;
  password: string;
  role: "admin" | "staff" | "supplier";
  assignedBusinessIds?: string[];
}
export interface DeliveryRecord {
  id: string;
  type: "GODOWN" | "QUEUE";
  sourceGodown: string;
  biltyNo?: string;
  items: Array<{
    category: string;
    itemName: string;
    qty: number;
    subCategory?: string;
  }>;
  customerName: string;
  customerPhone?: string;
  deliveredBy: string;
  deliveredAt: string;
  businessId: string;
}
export interface InventoryItem {
  sku: string;
  category: string;
  itemName: string;
  attributes: Record<string, string>;
  shop: number;
  godowns: Record<string, number>;
  saleRate: number;
  purchaseRate: number;
  businessId: string;
  minThreshold?: number;
}
export interface TransitRecord {
  id: number;
  biltyNo: string;
  transportName: string;
  supplierName: string;
  itemName: string;
  packages: string;
  date: string;
  addedBy: string;
  businessId: string;
  customData: Record<string, string>;
  category?: string;
  itemCategory?: string;
}
export interface PendingParcel {
  id: number;
  biltyNo: string;
  transportName: string;
  packages: string;
  dateReceived: string;
  arrivalDate?: string;
  recordedAt?: string; // full ISO timestamp when entry was logged
  businessId: string;
  customData: Record<string, string>;
  itemName?: string;
  category?: string;
  supplier?: string;
  itemCategory?: string;
}
export interface Transaction {
  id: number;
  type: string;
  biltyNo?: string;
  businessId: string;
  date: string;
  user: string;
  transportName?: string;
  itemsCount?: number;
  sku?: string;
  itemName?: string;
  category?: string;
  notes?: string;
  fromLocation?: string;
  toLocation?: string;
  transferredBy?: string;
  subCategory?: string;
  totalQtyInBale?: number;
  createdAt?: string;
  isDirectDelivery?: boolean;
  baleItemsList?: {
    itemName: string;
    category: string;
    attributes: Record<string, string>;
    qty: number;
    shopQty?: number;
    godownQuants?: Record<string, number>;
    saleRate?: number;
    purchaseRate?: number;
  }[];
}
export interface InwardRecord {
  id: number;
  biltyNo: string;
  dateOpened: string;
  openedBy: string;
  transport: string;
  baleItems: BaleItem[];
  businessId: string;
  createdAt: string;
}
export interface ColumnDef {
  name: string;
  type: string;
}
export interface CustomColumns {
  transit: ColumnDef[];
  warehouse: ColumnDef[];
  inward: ColumnDef[];
}
export interface BaleItem {
  id: number;
  sku: string;
  category: string;
  itemName: string;
  attributes: Record<string, string>;
  shopQty: string;
  godownQuants: Record<string, string>;
  saleRate: string;
  purchaseRate: string;
  customData: Record<string, string>;
}
export interface InwardSavedEntry {
  id: number;
  biltyNumber: string;
  baseNumber: string;
  packages: string;
  items: {
    category: string;
    itemName: string;
    qty: number;
    godownQty: number;
    godownBreakdown?: Record<string, number>;
    shopQty: number;
    saleRate: number;
    purchaseRate: number;
    attributes: Record<string, string>;
  }[];
  savedBy: string;
  savedAt: string;
  transporter: string;
  supplier: string;
  businessId: string;
}
export interface EditingCategory {
  originalName: string;
  name: string;
  fields: (CategoryField & { optionsStr?: string })[];
}
