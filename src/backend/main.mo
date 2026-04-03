import Time     "mo:core/Time";
import Array    "mo:base/Array";
import Buffer   "mo:base/Buffer";
import HashMap  "mo:base/HashMap";
import Text     "mo:base/Text";
import AccessControl    "authorization/access-control";
import MixinAuthorization "authorization/MixinAuthorization";
import Principal "mo:core/Principal";

actor {

  type Role = { #admin; #staff; #supplier };

  type User = {
    id          : Text;
    username    : Text;
    password    : Text;
    role        : Role;
    businessIds : [Text];
    createdAt   : Int;
  };

  type Business = { id : Text; name : Text };
  type Godown   = { id : Text; name : Text; businessId : Text };

  type SubCategory = {
    id        : Text;
    name      : Text;
    fieldType : Text;
    options   : [Text];
  };

  type Category = {
    id            : Text;
    name          : Text;
    subCategories : [SubCategory];
  };

  type CategoryV2 = {
    id            : Text;
    name          : Text;
    subCategories : [SubCategory];
    businessId    : Text;
  };

  type BiltyPrefix      = { id : Text; prefix : Text };
  type TransportTracker = { id : Text; transport : Text; trackingUrl : Text };
  type LoginResult      = { #ok : User; #err : Text };

  type TransitEntry = {
    id          : Text;
    biltyNumber : Text;
    transport   : Text;
    supplier    : Text;
    category    : Text;
    itemName    : Text;
    packages    : Int;
    biltyDate   : Text;
    businessId  : Text;
    enteredBy   : Text;
    createdAt   : Int;
  };

  type QueueBale  = { baleLabel : Text; category : Text; itemName : Text; status : Text };

  type QueueEntry = {
    id          : Text;
    biltyNumber : Text;
    transport   : Text;
    supplier    : Text;
    bales       : [QueueBale];
    businessId  : Text;
    enteredBy   : Text;
    createdAt   : Int;
    delivered   : Bool;
  };

  type GodownQty = { godownId : Text; qty : Int };

  type InwardItem = {
    category     : Text;
    itemName     : Text;
    subCategory  : Text;
    totalQty     : Int;
    shopQty      : Int;
    godownQtys   : [GodownQty];
    purchaseRate : Float;
    saleRate     : Float;
  };

  type InwardSavedEntry = {
    id          : Text;
    biltyNumber : Text;
    transport   : Text;
    supplier    : Text;
    savedBy     : Text;
    savedAt     : Int;
    businessId  : Text;
    items       : [InwardItem];
  };

  type InventoryItem = {
    id           : Text;
    businessId   : Text;
    category     : Text;
    itemName     : Text;
    subCategory  : Text;
    godownQtys   : [GodownQty];
    shopQty      : Int;
    purchaseRate : Float;
    saleRate     : Float;
  };

  type TransferEntry = {
    id            : Text;
    businessId    : Text;
    category      : Text;
    itemName      : Text;
    subCategory   : Text;
    fromType      : Text;
    fromId        : Text;
    toType        : Text;
    toId          : Text;
    qty           : Int;
    rate          : Float;
    transferredBy : Text;
    createdAt     : Int;
  };

  type DeliveryLineItem = {
    category    : Text;
    itemName    : Text;
    subCategory : Text;
    qty         : Int;
    godownId    : Text;
  };

  type DeliveryEntry = {
    id            : Text;
    businessId    : Text;
    deliveryType  : Text;
    biltyNumber   : Text;
    customerName  : Text;
    customerPhone : Text;
    items         : [DeliveryLineItem];
    deliveredBy   : Text;
    createdAt     : Int;
  };

  type SaleLineItem = {
    category    : Text;
    itemName    : Text;
    subCategory : Text;
    qty         : Int;
    rate        : Float;
  };

  type SaleEntry = {
    id         : Text;
    businessId : Text;
    items      : [SaleLineItem];
    recordedBy : Text;
    createdAt  : Int;
  };

  type TxType = { #inward; #transfer; #delivery; #sale; #directStock };

  type TxRecord = {
    id           : Text;
    businessId   : Text;
    txType       : TxType;
    biltyNumber  : Text;
    category     : Text;
    itemName     : Text;
    subCategory  : Text;
    fromLocation : Text;
    toLocation   : Text;
    transport    : Text;
    qty          : Int;
    rate         : Float;
    enteredBy    : Text;
    notes        : Text;
    createdAt    : Int;
  };

  // ---- Stable storage ----
  stable var users             : [User]             = [];
  stable var businesses        : [Business]         = [];
  stable var godowns           : [Godown]           = [];
  stable var categories        : [Category]         = [];
  stable var categoriesV2      : [CategoryV2]       = [];
  stable var biltyPrefixes     : [BiltyPrefix]      = [];
  stable var transportTrackers : [TransportTracker] = [];
  stable var transitEntries    : [TransitEntry]     = [];
  stable var queueEntries      : [QueueEntry]       = [];
  stable var inwardSaved       : [InwardSavedEntry] = [];
  stable var inventory         : [InventoryItem]    = [];
  stable var transfers         : [TransferEntry]    = [];
  stable var deliveries        : [DeliveryEntry]    = [];
  stable var sales             : [SaleEntry]        = [];
  stable var txHistory         : [TxRecord]         = [];
  stable var appSettings       : Text               = "{}";
  stable var categoryBusinessMap : [(Text, Text)]   = [];
  stable var seeded      : Bool = false;
  stable var seedVersion : Nat  = 0;

  let accessControlState = AccessControl.initState();
  include MixinAuthorization(accessControlState);

  // ---- Helpers ----

  func invKey(businessId : Text, category : Text, itemName : Text, subCategory : Text) : Text {
    businessId # "|" # category # "|" # itemName # "|" # subCategory
  };

  // Build an inventory index: composite key -> array index
  func buildInventoryIndex() : HashMap.HashMap<Text, Nat> {
    let m = HashMap.HashMap<Text, Nat>(inventory.size() + 1, Text.equal, Text.hash);
    var i = 0;
    for (item in inventory.vals()) {
      m.put(invKey(item.businessId, item.category, item.itemName, item.subCategory), i);
      i += 1;
    };
    m
  };

  // Build bilty existence sets for fast O(1) lookup
  func buildTransitBiltySet() : HashMap.HashMap<Text, Bool> {
    let m = HashMap.HashMap<Text, Bool>(transitEntries.size() + 1, Text.equal, Text.hash);
    for (e in transitEntries.vals()) { m.put(e.biltyNumber, true) };
    m
  };
  func buildQueueBiltySet() : HashMap.HashMap<Text, Bool> {
    let m = HashMap.HashMap<Text, Bool>(queueEntries.size() + 1, Text.equal, Text.hash);
    for (e in queueEntries.vals()) { m.put(e.biltyNumber, true) };
    m
  };
  func buildInwardBiltySet() : HashMap.HashMap<Text, Bool> {
    let m = HashMap.HashMap<Text, Bool>(inwardSaved.size() + 1, Text.equal, Text.hash);
    for (e in inwardSaved.vals()) { m.put(e.biltyNumber, true) };
    m
  };

  // ---- Seed ----
  func seedOnce() {
    if (seeded and seedVersion >= 8) return;

    if (seedVersion < 4) {
      seedVersion := 4;
      businesses := [{ id = "b1"; name = "Demo Business" }];
      godowns := [
        { id = "g1"; name = "Main Godown";   businessId = "b1" },
        { id = "g2"; name = "Second Godown"; businessId = "b1" }
      ];
      categoriesV2 := [
        { id = "cat1"; name = "Safi";   businessId = "b1";
          subCategories = [
            { id = "sc1"; name = "Size";  fieldType = "text";   options = [] },
            { id = "sc2"; name = "Color"; fieldType = "select"; options = ["black","tiranga","mix"] }
          ]
        },
        { id = "cat2"; name = "Lungi";  businessId = "b1";
          subCategories = [
            { id = "sc3"; name = "Size";  fieldType = "select"; options = ["2 mtr","2.25 mtr","2.5 mtr"] },
            { id = "sc4"; name = "Color"; fieldType = "select"; options = ["plain white","plain colour","mix"] }
          ]
        },
        { id = "cat3"; name = "Napkin"; businessId = "b1";
          subCategories = [
            { id = "sc5"; name = "Size"; fieldType = "select"; options = ["14x21","12x18","16x24"] }
          ]
        }
      ];
      categoryBusinessMap := [("cat1","b1"),("cat2","b1"),("cat3","b1")];
      biltyPrefixes := [
        { id = "p1"; prefix = "sola" },
        { id = "p2"; prefix = "erob" },
        { id = "p3"; prefix = "cheb" },
        { id = "p4"; prefix = "0"    }
      ];
      users := [
        { id = "u1"; username = "admin";    password = "password"; role = #admin;    businessIds = ["b1"]; createdAt = 0 },
        { id = "u2"; username = "staff";    password = "password"; role = #staff;    businessIds = ["b1"]; createdAt = 0 },
        { id = "u3"; username = "supplier"; password = "password"; role = #supplier; businessIds = ["b1"]; createdAt = 0 }
      ];
    };

    if (seedVersion < 8) {
      seedVersion := 8;
      if (categoriesV2.size() == 0 and categories.size() > 0) {
        let buf = Buffer.Buffer<CategoryV2>(categories.size());
        for (c in categories.vals()) {
          let bizMappings = Array.filter(categoryBusinessMap, func((cId, _) : (Text, Text)) : Bool { cId == c.id });
          if (bizMappings.size() == 0) {
            buf.add({ id = c.id; name = c.name; subCategories = c.subCategories; businessId = "b1" });
          } else {
            for ((_, bId) in bizMappings.vals()) {
              let uniqueId = if (bizMappings.size() > 1) { bId # "-" # c.id } else { c.id };
              buf.add({ id = uniqueId; name = c.name; subCategories = c.subCategories; businessId = bId });
            };
          };
        };
        categoriesV2 := Buffer.toArray(buf);
      };
    };

    seeded := true;
  };

  seedOnce();

  // ---- Users ----

  public func login(username : Text, password : Text) : async LoginResult {
    for (u in users.vals()) {
      if (u.username == username and u.password == password) return #ok(u);
    };
    #err("Invalid username or password")
  };

  public query func getUsers() : async [User] { users };

  public func addUser(id : Text, username : Text, password : Text, role : Role, businessIds : [Text]) : async () {
    let buf = Buffer.fromArray<User>(users);
    buf.add({ id; username; password; role; businessIds; createdAt = Time.now() });
    users := Buffer.toArray(buf);
  };

  public func updateUser(id : Text, username : Text, password : Text, role : Role, businessIds : [Text]) : async () {
    let buf = Buffer.Buffer<User>(users.size());
    for (u in users.vals()) {
      if (u.id == id) { buf.add({ id; username; password; role; businessIds; createdAt = u.createdAt }) }
      else buf.add(u);
    };
    users := Buffer.toArray(buf);
  };

  public func deleteUser(id : Text) : async () {
    users := Array.filter(users, func(u : User) : Bool { u.id != id });
  };

  // ---- Businesses ----

  public query func getBusinesses() : async [Business] { businesses };

  public func addBusiness(id : Text, name : Text) : async () {
    let buf = Buffer.fromArray<Business>(businesses);
    buf.add({ id; name });
    businesses := Buffer.toArray(buf);
  };

  public func updateBusiness(id : Text, name : Text) : async () {
    let buf = Buffer.Buffer<Business>(businesses.size());
    for (b in businesses.vals()) {
      if (b.id == id) buf.add({ id; name }) else buf.add(b);
    };
    businesses := Buffer.toArray(buf);
  };

  public func deleteBusiness(id : Text) : async () {
    businesses := Array.filter(businesses, func(b : Business) : Bool { b.id != id });
  };

  // ---- Godowns ----

  public query func getGodowns() : async [Godown] { godowns };

  public query func getGodownsByBusiness(businessId : Text) : async [Godown] {
    Array.filter(godowns, func(g : Godown) : Bool {
      g.businessId == businessId or (g.businessId == "" and businessId == "b1")
    })
  };

  public func addGodown(id : Text, name : Text, businessId : Text) : async () {
    let buf = Buffer.fromArray<Godown>(godowns);
    buf.add({ id; name; businessId });
    godowns := Buffer.toArray(buf);
  };

  public func updateGodown(id : Text, name : Text, businessId : Text) : async () {
    let buf = Buffer.Buffer<Godown>(godowns.size());
    for (g in godowns.vals()) {
      if (g.id == id) buf.add({ id; name; businessId }) else buf.add(g);
    };
    godowns := Buffer.toArray(buf);
  };

  public func deleteGodown(id : Text) : async () {
    godowns := Array.filter(godowns, func(g : Godown) : Bool { g.id != id });
  };

  // ---- Categories ----

  public query func getCategories() : async [CategoryV2] { categoriesV2 };

  public query func getCategoriesByBusiness(businessId : Text) : async [CategoryV2] {
    Array.filter(categoriesV2, func(c : CategoryV2) : Bool {
      c.businessId == businessId or (c.businessId == "" and businessId == "b1")
    })
  };

  public func addCategory(id : Text, name : Text, businessId : Text) : async () {
    for (c in categoriesV2.vals()) {
      if (c.id == id and c.businessId == businessId) return;
    };
    let buf = Buffer.fromArray<CategoryV2>(categoriesV2);
    buf.add({ id; name; subCategories = []; businessId });
    categoriesV2 := Buffer.toArray(buf);
    categoryBusinessMap := Array.append(categoryBusinessMap, [(id, businessId)]);
  };

  public func updateCategory(id : Text, name : Text) : async () {
    let buf = Buffer.Buffer<CategoryV2>(categoriesV2.size());
    for (c in categoriesV2.vals()) {
      if (c.id == id) buf.add({ id; name; subCategories = c.subCategories; businessId = c.businessId })
      else buf.add(c);
    };
    categoriesV2 := Buffer.toArray(buf);
  };

  public func deleteCategory(id : Text, businessId : Text) : async () {
    categoriesV2 := Array.filter(categoriesV2, func(c : CategoryV2) : Bool {
      not (c.id == id and c.businessId == businessId)
    });
    categoryBusinessMap := Array.filter(categoryBusinessMap, func((cId, bId) : (Text, Text)) : Bool {
      not (cId == id and bId == businessId)
    });
  };

  public func deleteCategoryGlobal(id : Text) : async () {
    categoriesV2      := Array.filter(categoriesV2, func(c : CategoryV2) : Bool { c.id != id });
    categories        := Array.filter(categories,   func(c : Category)   : Bool { c.id != id });
    categoryBusinessMap := Array.filter(categoryBusinessMap, func((cId,_) : (Text,Text)) : Bool { cId != id });
  };

  public func addSubCategory(categoryId : Text, sc : SubCategory) : async () {
    let buf = Buffer.Buffer<CategoryV2>(categoriesV2.size());
    for (c in categoriesV2.vals()) {
      if (c.id == categoryId) {
        buf.add({ id = c.id; name = c.name; businessId = c.businessId;
                  subCategories = Array.append(c.subCategories, [sc]) });
      } else buf.add(c);
    };
    categoriesV2 := Buffer.toArray(buf);
  };

  public func updateSubCategory(categoryId : Text, sc : SubCategory) : async () {
    let buf = Buffer.Buffer<CategoryV2>(categoriesV2.size());
    for (c in categoriesV2.vals()) {
      if (c.id == categoryId) {
        buf.add({ id = c.id; name = c.name; businessId = c.businessId;
                  subCategories = Array.map(c.subCategories, func(s : SubCategory) : SubCategory {
                    if (s.id == sc.id) sc else s
                  }) });
      } else buf.add(c);
    };
    categoriesV2 := Buffer.toArray(buf);
  };

  public func deleteSubCategory(categoryId : Text, subCategoryId : Text) : async () {
    let buf = Buffer.Buffer<CategoryV2>(categoriesV2.size());
    for (c in categoriesV2.vals()) {
      if (c.id == categoryId) {
        buf.add({ id = c.id; name = c.name; businessId = c.businessId;
                  subCategories = Array.filter(c.subCategories, func(s : SubCategory) : Bool { s.id != subCategoryId }) });
      } else buf.add(c);
    };
    categoriesV2 := Buffer.toArray(buf);
  };

  // ---- Bilty Prefixes ----

  public query func getBiltyPrefixes() : async [BiltyPrefix] { biltyPrefixes };

  public func addBiltyPrefix(id : Text, prefix : Text) : async () {
    let buf = Buffer.fromArray<BiltyPrefix>(biltyPrefixes);
    buf.add({ id; prefix });
    biltyPrefixes := Buffer.toArray(buf);
  };

  public func deleteBiltyPrefix(id : Text) : async () {
    biltyPrefixes := Array.filter(biltyPrefixes, func(p : BiltyPrefix) : Bool { p.id != id });
  };

  // ---- Transport Trackers ----

  public query func getTransportTrackers() : async [TransportTracker] { transportTrackers };

  public func addTransportTracker(id : Text, transport : Text, trackingUrl : Text) : async () {
    let buf = Buffer.fromArray<TransportTracker>(transportTrackers);
    buf.add({ id; transport; trackingUrl });
    transportTrackers := Buffer.toArray(buf);
  };

  public func updateTransportTracker(id : Text, transport : Text, trackingUrl : Text) : async () {
    let buf = Buffer.Buffer<TransportTracker>(transportTrackers.size());
    for (t in transportTrackers.vals()) {
      if (t.id == id) buf.add({ id; transport; trackingUrl }) else buf.add(t);
    };
    transportTrackers := Buffer.toArray(buf);
  };

  public func deleteTransportTracker(id : Text) : async () {
    transportTrackers := Array.filter(transportTrackers, func(t : TransportTracker) : Bool { t.id != id });
  };

  // ---- Transit Entries ----

  public query func getTransitEntries(businessId : Text) : async [TransitEntry] {
    Array.filter(transitEntries, func(e : TransitEntry) : Bool { e.businessId == businessId })
  };

  public func addTransitEntry(entry : TransitEntry) : async () {
    let buf = Buffer.fromArray<TransitEntry>(transitEntries);
    buf.add(entry);
    transitEntries := Buffer.toArray(buf);
  };

  public func updateTransitEntry(entry : TransitEntry) : async () {
    let buf = Buffer.Buffer<TransitEntry>(transitEntries.size());
    for (e in transitEntries.vals()) {
      if (e.id == entry.id) buf.add(entry) else buf.add(e);
    };
    transitEntries := Buffer.toArray(buf);
  };

  public func deleteTransitEntry(id : Text) : async () {
    transitEntries := Array.filter(transitEntries, func(e : TransitEntry) : Bool { e.id != id });
  };

  // O(1) bilty existence check via hash sets built on demand
  public func biltyExists(biltyNumber : Text) : async Bool {
    let ts = buildTransitBiltySet();
    switch (ts.get(biltyNumber)) { case (?_) return true; case null {} };
    let qs = buildQueueBiltySet();
    switch (qs.get(biltyNumber)) { case (?_) return true; case null {} };
    let is_ = buildInwardBiltySet();
    switch (is_.get(biltyNumber)) { case (?_) return true; case null {} };
    false
  };

  // ---- Queue Entries ----

  public query func getQueueEntries(businessId : Text) : async [QueueEntry] {
    Array.filter(queueEntries, func(e : QueueEntry) : Bool { e.businessId == businessId and not e.delivered })
  };

  public func addQueueEntry(entry : QueueEntry) : async () {
    let buf = Buffer.fromArray<QueueEntry>(queueEntries);
    buf.add(entry);
    queueEntries   := Buffer.toArray(buf);
    // Remove from transit
    transitEntries := Array.filter(transitEntries, func(e : TransitEntry) : Bool { e.biltyNumber != entry.biltyNumber });
  };

  public func updateQueueEntry(entry : QueueEntry) : async () {
    let buf = Buffer.Buffer<QueueEntry>(queueEntries.size());
    for (e in queueEntries.vals()) {
      if (e.id == entry.id) buf.add(entry) else buf.add(e);
    };
    queueEntries := Buffer.toArray(buf);
  };

  public func markQueueDelivered(id : Text) : async () {
    let buf = Buffer.Buffer<QueueEntry>(queueEntries.size());
    for (e in queueEntries.vals()) {
      if (e.id == id) {
        buf.add({ id = e.id; biltyNumber = e.biltyNumber; transport = e.transport;
                  supplier = e.supplier; bales = e.bales; businessId = e.businessId;
                  enteredBy = e.enteredBy; createdAt = e.createdAt; delivered = true });
      } else buf.add(e);
    };
    queueEntries := Buffer.toArray(buf);
  };

  public func deleteQueueEntry(id : Text) : async () {
    queueEntries := Array.filter(queueEntries, func(e : QueueEntry) : Bool { e.id != id });
  };

  // ---- Inward Saved ----

  public query func getInwardSaved(businessId : Text) : async [InwardSavedEntry] {
    Array.filter(inwardSaved, func(e : InwardSavedEntry) : Bool { e.businessId == businessId })
  };

  public func saveInward(entry : InwardSavedEntry) : async () {
    let exists = Array.find(inwardSaved, func(e : InwardSavedEntry) : Bool { e.id == entry.id });
    switch (exists) {
      case (?_) {};
      case null {
        let buf = Buffer.fromArray<InwardSavedEntry>(inwardSaved);
        buf.add(entry);
        inwardSaved := Buffer.toArray(buf);
      };
    };
    transitEntries := Array.filter(transitEntries, func(e : TransitEntry)  : Bool { e.biltyNumber != entry.biltyNumber });
    queueEntries   := Array.filter(queueEntries,   func(e : QueueEntry)    : Bool { e.biltyNumber != entry.biltyNumber });
  };

  // restoreInward: used ONLY during System Restore. Unlike saveInward it:
  //  1. Always writes the entry (upsert — overwrite if ID exists, insert if not).
  //  2. Does NOT modify transitEntries or queueEntries (those are restored separately).
  public func restoreInward(entry : InwardSavedEntry) : async () {
    let exists = Array.find(inwardSaved, func(e : InwardSavedEntry) : Bool { e.id == entry.id });
    switch (exists) {
      case (?_) {
        // Overwrite existing entry with the restored version
        let buf = Buffer.Buffer<InwardSavedEntry>(inwardSaved.size());
        for (e in inwardSaved.vals()) {
          if (e.id == entry.id) buf.add(entry) else buf.add(e);
        };
        inwardSaved := Buffer.toArray(buf);
      };
      case null {
        let buf = Buffer.fromArray<InwardSavedEntry>(inwardSaved);
        buf.add(entry);
        inwardSaved := Buffer.toArray(buf);
      };
    };
  };

  public func updateInwardSaved(entry : InwardSavedEntry) : async () {
    let buf = Buffer.Buffer<InwardSavedEntry>(inwardSaved.size());
    for (e in inwardSaved.vals()) {
      if (e.id == entry.id) buf.add(entry) else buf.add(e);
    };
    inwardSaved := Buffer.toArray(buf);
  };

  public func deleteInwardSaved(id : Text) : async () {
    inwardSaved := Array.filter(inwardSaved, func(e : InwardSavedEntry) : Bool { e.id != id });
  };

  // ---- Inventory ----

  public query func getInventory(businessId : Text) : async [InventoryItem] {
    Array.filter(inventory, func(i : InventoryItem) : Bool {
      i.businessId == businessId or (i.businessId == "" and businessId == "b1")
    })
  };

  public func addInventoryItem(item : InventoryItem) : async () {
    let idx = buildInventoryIndex();
    let k = invKey(item.businessId, item.category, item.itemName, item.subCategory);
    switch (idx.get(k)) {
      case (?pos) {
        // Overwrite existing
        let buf = Buffer.fromArray<InventoryItem>(inventory);
        buf.put(pos, item);
        inventory := Buffer.toArray(buf);
      };
      case null {
        let buf = Buffer.fromArray<InventoryItem>(inventory);
        buf.add(item);
        inventory := Buffer.toArray(buf);
      };
    };
  };

  public func updateInventoryItem(item : InventoryItem) : async () {
    let buf = Buffer.Buffer<InventoryItem>(inventory.size());
    for (i in inventory.vals()) {
      if (i.id == item.id) buf.add(item) else buf.add(i);
    };
    inventory := Buffer.toArray(buf);
  };

  public func deleteInventoryItem(id : Text) : async () {
    inventory := Array.filter(inventory, func(i : InventoryItem) : Bool { i.id != id });
  };

  func applyInventoryAddition(businessId : Text, item : InwardItem) {
    let k   = invKey(businessId, item.category, item.itemName, item.subCategory);
    let idx = buildInventoryIndex();
    switch (idx.get(k)) {
      case null {
        let buf = Buffer.fromArray<InventoryItem>(inventory);
        buf.add({
          id = k; businessId; category = item.category; itemName = item.itemName;
          subCategory = item.subCategory; godownQtys = item.godownQtys;
          shopQty = item.shopQty; purchaseRate = item.purchaseRate; saleRate = item.saleRate;
        });
        inventory := Buffer.toArray(buf);
      };
      case (?pos) {
        let inv = inventory[pos];
        // Merge godown quantities using a HashMap for O(n) merge
        let gMap = HashMap.HashMap<Text, Int>(inv.godownQtys.size() + 1, Text.equal, Text.hash);
        for (gq in inv.godownQtys.vals())  { gMap.put(gq.godownId, gq.qty) };
        for (gq in item.godownQtys.vals()) {
          let prev = switch (gMap.get(gq.godownId)) { case (?v) v; case null 0 };
          gMap.put(gq.godownId, prev + gq.qty);
        };
        let merged = Buffer.Buffer<GodownQty>(gMap.size());
        for ((gId, qty) in gMap.entries()) { merged.add({ godownId = gId; qty }) };
        let updated : InventoryItem = {
          id = inv.id; businessId = inv.businessId; category = inv.category;
          itemName = inv.itemName; subCategory = inv.subCategory;
          godownQtys = Buffer.toArray(merged);
          shopQty = inv.shopQty + item.shopQty;
          purchaseRate = item.purchaseRate; saleRate = item.saleRate;
        };
        let buf = Buffer.fromArray<InventoryItem>(inventory);
        buf.put(pos, updated);
        inventory := Buffer.toArray(buf);
      };
    };
  };

  // ---- Transfers ----

  public query func getTransfers(businessId : Text) : async [TransferEntry] {
    Array.filter(transfers, func(t : TransferEntry) : Bool { t.businessId == businessId })
  };

  public func postTransfer(entry : TransferEntry) : async Text {
    let k   = invKey(entry.businessId, entry.category, entry.itemName, entry.subCategory);
    let idx = buildInventoryIndex();
    switch (idx.get(k)) {
      case null return "Item not found in inventory";
      case (?pos) {
        let item = inventory[pos];
        if (entry.fromType == "godown") {
          var found = false;
          let newGQ = Buffer.Buffer<GodownQty>(item.godownQtys.size());
          for (g in item.godownQtys.vals()) {
            if (g.godownId == entry.fromId) {
              if (g.qty < entry.qty) return "Insufficient godown stock";
              found := true;
              newGQ.add({ godownId = g.godownId; qty = g.qty - entry.qty });
            } else newGQ.add(g);
          };
          if (not found) return "Godown not found";
          let buf = Buffer.fromArray<InventoryItem>(inventory);
          buf.put(pos, { id = item.id; businessId = item.businessId; category = item.category;
            itemName = item.itemName; subCategory = item.subCategory;
            godownQtys = Buffer.toArray(newGQ); shopQty = item.shopQty + entry.qty;
            purchaseRate = item.purchaseRate; saleRate = item.saleRate });
          inventory := Buffer.toArray(buf);
        } else {
          if (item.shopQty < entry.qty) return "Insufficient shop stock";
          let newGQ = Buffer.Buffer<GodownQty>(item.godownQtys.size());
          for (g in item.godownQtys.vals()) {
            if (g.godownId == entry.toId) newGQ.add({ godownId = g.godownId; qty = g.qty + entry.qty })
            else newGQ.add(g);
          };
          let buf = Buffer.fromArray<InventoryItem>(inventory);
          buf.put(pos, { id = item.id; businessId = item.businessId; category = item.category;
            itemName = item.itemName; subCategory = item.subCategory;
            godownQtys = Buffer.toArray(newGQ); shopQty = item.shopQty - entry.qty;
            purchaseRate = item.purchaseRate; saleRate = item.saleRate });
          inventory := Buffer.toArray(buf);
        };
        let tbuf = Buffer.fromArray<TransferEntry>(transfers);
        tbuf.add(entry);
        transfers := Buffer.toArray(tbuf);
        let hbuf = Buffer.fromArray<TxRecord>(txHistory);
        hbuf.add({
          id = entry.id; businessId = entry.businessId; txType = #transfer;
          biltyNumber = ""; category = entry.category; itemName = entry.itemName;
          subCategory = entry.subCategory;
          fromLocation = entry.fromType # ":" # entry.fromId;
          toLocation   = entry.toType   # ":" # entry.toId;
          transport = ""; qty = entry.qty; rate = entry.rate;
          enteredBy = entry.transferredBy; notes = "transfer"; createdAt = entry.createdAt;
        });
        txHistory := Buffer.toArray(hbuf);
        return "ok";
      };
    };
  };

  // ---- Deliveries ----

  public query func getDeliveries(businessId : Text) : async [DeliveryEntry] {
    Array.filter(deliveries, func(d : DeliveryEntry) : Bool { d.businessId == businessId })
  };

  public func addDelivery(entry : DeliveryEntry) : async Text {
    // Build index once for all items in this delivery
    let idx = buildInventoryIndex();
    let invBuf = Buffer.fromArray<InventoryItem>(inventory);
    let hbuf   = Buffer.fromArray<TxRecord>(txHistory);

    for (item in entry.items.vals()) {
      let k = invKey(entry.businessId, item.category, item.itemName, item.subCategory);
      switch (idx.get(k)) {
        case null {};
        case (?pos) {
          let existing = invBuf.get(pos);
          var found = false;
          let newGQ = Buffer.Buffer<GodownQty>(existing.godownQtys.size());
          for (g in existing.godownQtys.vals()) {
            if (g.godownId == item.godownId) {
              if (g.qty < item.qty) return "Insufficient stock in godown";
              found := true;
              newGQ.add({ godownId = g.godownId; qty = g.qty - item.qty });
            } else newGQ.add(g);
          };
          if (found) {
            invBuf.put(pos, {
              id = existing.id; businessId = existing.businessId; category = existing.category;
              itemName = existing.itemName; subCategory = existing.subCategory;
              godownQtys = Buffer.toArray(newGQ); shopQty = existing.shopQty + item.qty;
              purchaseRate = existing.purchaseRate; saleRate = existing.saleRate;
            });
          };
        };
      };
      hbuf.add({
        id = entry.id # "-" # item.itemName; businessId = entry.businessId; txType = #delivery;
        biltyNumber = entry.biltyNumber; category = item.category; itemName = item.itemName;
        subCategory = item.subCategory; fromLocation = item.godownId; toLocation = entry.customerName;
        transport = ""; qty = item.qty; rate = 0.0; enteredBy = entry.deliveredBy;
        notes = entry.customerPhone; createdAt = entry.createdAt;
      });
    };

    inventory := Buffer.toArray(invBuf);
    txHistory := Buffer.toArray(hbuf);

    let dbuf = Buffer.fromArray<DeliveryEntry>(deliveries);
    dbuf.add(entry);
    deliveries := Buffer.toArray(dbuf);

    if (entry.deliveryType == "queue" and entry.biltyNumber != "") {
      let qbuf = Buffer.Buffer<QueueEntry>(queueEntries.size());
      for (e in queueEntries.vals()) {
        if (e.biltyNumber == entry.biltyNumber) {
          qbuf.add({ id = e.id; biltyNumber = e.biltyNumber; transport = e.transport;
                     supplier = e.supplier; bales = e.bales; businessId = e.businessId;
                     enteredBy = e.enteredBy; createdAt = e.createdAt; delivered = true });
        } else qbuf.add(e);
      };
      queueEntries := Buffer.toArray(qbuf);
    };
    "ok"
  };
  // Delete a delivery record by id (does NOT touch inventory or txHistory).
  public func deleteDelivery(id : Text) : async () {
    deliveries := Array.filter(deliveries, func(d : DeliveryEntry) : Bool { d.id != id });
  };

  // Restore a delivery record without applying stock-side effects.
  // Use this during backup restore so that inventory (already restored) is not touched again.
  public func restoreDelivery(entry : DeliveryEntry) : async () {
    let dbuf = Buffer.fromArray<DeliveryEntry>(deliveries);
    dbuf.add(entry);
    deliveries := Buffer.toArray(dbuf);
  };

  // ---- Sales ----

  public query func getSales(businessId : Text) : async [SaleEntry] {
    Array.filter(sales, func(s : SaleEntry) : Bool { s.businessId == businessId })
  };

  public func addSale(entry : SaleEntry) : async Text {
    // Build index once for all items in this sale
    let idx    = buildInventoryIndex();
    let invBuf = Buffer.fromArray<InventoryItem>(inventory);
    let hbuf   = Buffer.fromArray<TxRecord>(txHistory);

    for (item in entry.items.vals()) {
      let k = invKey(entry.businessId, item.category, item.itemName, item.subCategory);
      switch (idx.get(k)) {
        case null return "Item not found: " # item.itemName;
        case (?pos) {
          let existing = invBuf.get(pos);
          if (existing.shopQty < item.qty) return "Insufficient shop stock for: " # item.itemName;
          invBuf.put(pos, {
            id = existing.id; businessId = existing.businessId; category = existing.category;
            itemName = existing.itemName; subCategory = existing.subCategory;
            godownQtys = existing.godownQtys; shopQty = existing.shopQty - item.qty;
            purchaseRate = existing.purchaseRate; saleRate = item.rate;
          });
        };
      };
      hbuf.add({
        id = entry.id # "-" # item.itemName; businessId = entry.businessId; txType = #sale;
        biltyNumber = ""; category = item.category; itemName = item.itemName;
        subCategory = item.subCategory; fromLocation = "Shop"; toLocation = "Customer";
        transport = ""; qty = item.qty; rate = item.rate; enteredBy = entry.recordedBy;
        notes = "sale"; createdAt = entry.createdAt;
      });
    };

    inventory := Buffer.toArray(invBuf);
    txHistory := Buffer.toArray(hbuf);

    let sbuf = Buffer.fromArray<SaleEntry>(sales);
    sbuf.add(entry);
    sales := Buffer.toArray(sbuf);
    "ok"
  };

  public func deleteSale(id : Text) : async () {
    sales := Array.filter(sales, func(s : SaleEntry) : Bool { s.id != id });
  };

  // Restore a sale record without applying inventory side effects.
  // Use this during backup restore so inventory (already restored) is not touched again.
  public func restoreSale(entry : SaleEntry) : async () {
    let buf = Buffer.fromArray<SaleEntry>(sales);
    buf.add(entry);
    sales := Buffer.toArray(buf);
  };

  // ---- TX History ----

  public query func getTxHistory(businessId : Text) : async [TxRecord] {
    Array.filter(txHistory, func(t : TxRecord) : Bool { t.businessId == businessId })
  };

  public func addTxRecord(record : TxRecord) : async () {
    let buf = Buffer.fromArray<TxRecord>(txHistory);
    buf.add(record);
    txHistory := Buffer.toArray(buf);
  };

  public func deleteTxRecord(id : Text) : async () {
    txHistory := Array.filter(txHistory, func(t : TxRecord) : Bool { t.id != id });
  };

  // ---- App Settings ----

  public func saveAppSettings(json : Text) : async () {
    appSettings := json;
  };

  public query func getAppSettings() : async Text {
    appSettings
  };

  public shared ({ caller }) func getCurrentUser() : async Text {
    caller.toText()
  };

};
