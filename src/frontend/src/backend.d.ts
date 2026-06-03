import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface DeliveryEntry {
    id: string;
    customerName: string;
    deliveredBy: string;
    customerPhone: string;
    businessId: string;
    createdAt: bigint;
    deliveryType: string;
    biltyNumber: string;
    items: Array<DeliveryLineItem>;
}
export interface BiltyPrefix {
    id: string;
    businessId: string;
    prefix: string;
}
export interface Business {
    id: string;
    name: string;
}
export interface User {
    id: string;
    username: string;
    businessIds: Array<string>;
    password: string;
    createdAt: bigint;
    role: Role;
}
export interface TransportTracker {
    id: string;
    trackingUrl: string;
    transport: string;
}
export interface QueueBale {
    status: string;
    baleLabel: string;
    itemName: string;
    category: string;
}
export interface SaleLineItem {
    qty: bigint;
    subCategory: string;
    rate: number;
    itemName: string;
    category: string;
}
export interface InwardSavedEntry {
    id: string;
    businessId: string;
    supplier: string;
    transport: string;
    biltyNumber: string;
    savedAt: bigint;
    savedBy: string;
    items: Array<InwardItem>;
}
export interface CategoryV2 {
    id: string;
    businessId: string;
    name: string;
    subCategories: Array<SubCategory>;
}
export interface InventoryItem {
    id: string;
    subCategory: string;
    businessId: string;
    purchaseRate: number;
    godownQtys: Array<GodownQty>;
    shopQty: bigint;
    itemName: string;
    category: string;
    saleRate: number;
}
export interface Godown {
    id: string;
    businessId: string;
    name: string;
}
export interface QueueEntry {
    id: string;
    businessId: string;
    supplier: string;
    createdAt: bigint;
    transport: string;
    biltyNumber: string;
    bales: Array<QueueBale>;
    delivered: boolean;
    enteredBy: string;
}
export interface TransferEntry {
    id: string;
    qty: bigint;
    subCategory: string;
    businessId: string;
    createdAt: bigint;
    rate: number;
    toId: string;
    toType: string;
    itemName: string;
    fromType: string;
    category: string;
    fromId: string;
    transferredBy: string;
}
export interface TxRecord {
    id: string;
    qty: bigint;
    subCategory: string;
    businessId: string;
    createdAt: bigint;
    rate: number;
    transport: string;
    toLocation: string;
    fromLocation: string;
    biltyNumber: string;
    notes: string;
    itemName: string;
    category: string;
    txType: TxType;
    enteredBy: string;
}
export interface TransitEntry {
    id: string;
    businessId: string;
    packages: bigint;
    supplier: string;
    createdAt: bigint;
    transport: string;
    biltyNumber: string;
    itemName: string;
    category: string;
    enteredBy: string;
    biltyDate: string;
}
export type LoginResult = {
    __kind__: "ok";
    ok: User;
} | {
    __kind__: "err";
    err: string;
};
export interface SaleEntry {
    id: string;
    businessId: string;
    createdAt: bigint;
    recordedBy: string;
    items: Array<SaleLineItem>;
}
export interface InwardItem {
    subCategory: string;
    purchaseRate: number;
    godownQtys: Array<GodownQty>;
    totalQty: bigint;
    shopQty: bigint;
    itemName: string;
    category: string;
    saleRate: number;
}
export interface GodownQty {
    qty: bigint;
    godownId: string;
}
export interface DeliveryLineItem {
    qty: bigint;
    subCategory: string;
    godownId: string;
    itemName: string;
    category: string;
}
export interface SubCategory {
    id: string;
    name: string;
    options: Array<string>;
    fieldType: string;
}
export enum Role {
    admin = "admin",
    supplier = "supplier",
    staff = "staff"
}
export enum TxType {
    directStock = "directStock",
    sale = "sale",
    inward = "inward",
    delivery = "delivery",
    transfer = "transfer"
}
export enum UserRole {
    admin = "admin",
    user = "user",
    guest = "guest"
}
export interface backendInterface {
    addBiltyPrefix(id: string, prefix: string, businessId: string): Promise<void>;
    addBusiness(id: string, name: string): Promise<void>;
    addCategory(id: string, name: string, businessId: string): Promise<void>;
    addDelivery(entry: DeliveryEntry): Promise<string>;
    addGodown(id: string, name: string, businessId: string): Promise<void>;
    addInventoryItem(item: InventoryItem): Promise<void>;
    addQueueEntry(entry: QueueEntry): Promise<void>;
    addSale(entry: SaleEntry): Promise<string>;
    addSubCategory(categoryId: string, sc: SubCategory): Promise<void>;
    addTransitEntry(entry: TransitEntry): Promise<void>;
    addTransportTracker(id: string, transport: string, trackingUrl: string): Promise<void>;
    addTxRecord(record: TxRecord): Promise<void>;
    addUser(id: string, username: string, password: string, role: Role, businessIds: Array<string>): Promise<void>;
    assignCallerUserRole(user: Principal, role: UserRole): Promise<void>;
    batchAddInventoryItems(items: Array<InventoryItem>): Promise<void>;
    batchSaveInwardItems(businessId: string, items: Array<InwardItem>): Promise<void>;
    biltyExists(biltyNumber: string): Promise<boolean>;
    deleteBiltyPrefix(id: string): Promise<void>;
    deleteBusiness(id: string): Promise<void>;
    deleteCategory(id: string, businessId: string): Promise<void>;
    deleteCategoryGlobal(id: string): Promise<void>;
    deleteDelivery(id: string): Promise<void>;
    deleteGodown(id: string): Promise<void>;
    deleteInventoryItem(id: string): Promise<void>;
    deleteInwardSaved(id: string): Promise<void>;
    deleteQueueEntry(id: string): Promise<void>;
    deleteSale(id: string): Promise<void>;
    deleteSubCategory(categoryId: string, subCategoryId: string): Promise<void>;
    deleteTransitEntry(id: string): Promise<void>;
    deleteTransportTracker(id: string): Promise<void>;
    deleteTxRecord(id: string): Promise<void>;
    deleteUser(id: string): Promise<void>;
    getAppSettings(): Promise<string>;
    getBiltyPrefixes(): Promise<Array<BiltyPrefix>>;
    getBiltyPrefixesByBusiness(businessId: string): Promise<Array<BiltyPrefix>>;
    getBusinesses(): Promise<Array<Business>>;
    getCallerUserRole(): Promise<UserRole>;
    getCategories(): Promise<Array<CategoryV2>>;
    getCategoriesByBusiness(businessId: string): Promise<Array<CategoryV2>>;
    getCurrentUser(): Promise<string>;
    getDeliveries(businessId: string): Promise<Array<DeliveryEntry>>;
    getGodowns(): Promise<Array<Godown>>;
    getGodownsByBusiness(businessId: string): Promise<Array<Godown>>;
    getInventory(businessId: string): Promise<Array<InventoryItem>>;
    getInwardSaved(businessId: string): Promise<Array<InwardSavedEntry>>;
    getQueueEntries(businessId: string): Promise<Array<QueueEntry>>;
    getSales(businessId: string): Promise<Array<SaleEntry>>;
    getTransfers(businessId: string): Promise<Array<TransferEntry>>;
    getTransitEntries(businessId: string): Promise<Array<TransitEntry>>;
    getTransportTrackers(): Promise<Array<TransportTracker>>;
    getTxHistory(businessId: string): Promise<Array<TxRecord>>;
    getUsers(): Promise<Array<User>>;
    isCallerAdmin(): Promise<boolean>;
    login(username: string, password: string): Promise<LoginResult>;
    markQueueDelivered(id: string): Promise<void>;
    postTransfer(entry: TransferEntry): Promise<string>;
    restoreDelivery(entry: DeliveryEntry): Promise<void>;
    restoreInward(entry: InwardSavedEntry): Promise<void>;
    restoreQueueEntry(entry: QueueEntry): Promise<void>;
    restoreSale(entry: SaleEntry): Promise<void>;
    saveAppSettings(json: string): Promise<void>;
    saveInward(entry: InwardSavedEntry): Promise<void>;
    updateBusiness(id: string, name: string): Promise<void>;
    updateCategory(id: string, name: string): Promise<void>;
    updateGodown(id: string, name: string, businessId: string): Promise<void>;
    updateInventoryItem(item: InventoryItem): Promise<void>;
    updateInwardSaved(entry: InwardSavedEntry): Promise<void>;
    updateQueueEntry(entry: QueueEntry): Promise<void>;
    updateSubCategory(categoryId: string, sc: SubCategory): Promise<void>;
    updateTransitEntry(entry: TransitEntry): Promise<void>;
    updateTransportTracker(id: string, transport: string, trackingUrl: string): Promise<void>;
    updateUser(id: string, username: string, password: string, role: Role, businessIds: Array<string>): Promise<void>;
}
