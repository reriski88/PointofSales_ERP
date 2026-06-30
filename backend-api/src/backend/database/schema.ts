import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const appRoleEnum = pgEnum("app_role", ["owner", "admin_outlet", "cashier", "warehouse", "auditor"]);
export const unitKindEnum = pgEnum("unit_kind", ["weight", "count", "package"]);
export const stockMovementTypeEnum = pgEnum("stock_movement_type", [
  "opening",
  "purchase",
  "sale",
  "refund",
  "waste",
  "adjustment",
  "transfer_in",
  "transfer_out",
]);
export const saleStatusEnum = pgEnum("sale_status", ["completed", "voided", "refunded", "sync_review"]);
export const paymentMethodEnum = pgEnum("payment_method", ["cash", "qris", "transfer", "card", "ewallet", "other"]);
export const shiftStatusEnum = pgEnum("shift_status", ["open", "closed"]);
export const shiftCashMovementTypeEnum = pgEnum("shift_cash_movement_type", ["cash_in", "cash_out"]);
export const shiftCloseApprovalStatusEnum = pgEnum("shift_close_approval_status", [
  "normal",
  "variance_pending",
  "variance_approved",
]);
export const purchaseOrderStatusEnum = pgEnum("purchase_order_status", ["ordered", "received", "cancelled"]);
export const purchasePaymentStatusEnum = pgEnum("purchase_payment_status", ["unpaid", "partial", "paid"]);
export const customerReceivableStatusEnum = pgEnum("customer_receivable_status", ["open", "partial", "paid", "voided"]);
export const stockOpnameStatusEnum = pgEnum("stock_opname_status", [
  "draft",
  "counted",
  "approved",
  "posted",
  "cancelled",
]);
export const promotionTypeEnum = pgEnum("promotion_type", [
  "transaction_discount",
  "item_discount",
  "buy_x_get_y",
]);
export const promotionDiscountTypeEnum = pgEnum("promotion_discount_type", ["percent", "amount"]);
export const promotionScopeEnum = pgEnum("promotion_scope", ["all", "sku", "category"]);
export const wasteReasonEnum = pgEnum("waste_reason", [
  "crumbs_unsellable",
  "spilled",
  "damaged",
  "quality_drop",
  "expired",
  "weighing_difference",
  "sampling",
  "internal_use",
  "stock_opname_correction",
  "other",
]);
export const approvalStatusEnum = pgEnum("approval_status", ["pending", "posted", "approved", "rejected"]);
export const syncStatusEnum = pgEnum("sync_status", ["received", "processed", "conflict", "failed"]);
export const accountingAccountTypeEnum = pgEnum("accounting_account_type", [
  "asset",
  "liability",
  "equity",
  "revenue",
  "expense",
  "cogs",
]);
export const accountingNormalBalanceEnum = pgEnum("accounting_normal_balance", ["debit", "credit"]);
export const journalEntryStatusEnum = pgEnum("journal_entry_status", ["posted", "voided"]);
export const cashLedgerDirectionEnum = pgEnum("cash_ledger_direction", ["in", "out"]);

export const organization = pgTable("organization", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  logoUrl: text("logo_url"),
  receiptLayout: jsonb("receipt_layout"),
  rolePermissions: jsonb("role_permissions"),
  posSettings: jsonb("pos_settings"),
  ...timestamps,
});

export const outlet = pgTable(
  "outlet",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    code: text("code").notNull(),
    address: text("address"),
    logoUrl: text("logo_url"),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (table) => ({
    outletOrgCodeIdx: uniqueIndex("outlet_org_code_idx").on(table.organizationId, table.code),
  }),
);

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  role: appRoleEnum("role").notNull().default("cashier"),
  isActive: boolean("is_active").notNull().default(true),
  organizationId: uuid("organization_id").references(() => organization.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => ({
    sessionUserIdx: index("session_user_idx").on(table.userId),
  }),
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    accountUserIdx: index("account_user_idx").on(table.userId),
  }),
);

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const accountingAccount = pgTable(
  "accounting_account",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    name: text("name").notNull(),
    type: accountingAccountTypeEnum("type").notNull(),
    normalBalance: accountingNormalBalanceEnum("normal_balance").notNull(),
    isSystem: boolean("is_system").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (table) => ({
    accountingAccountOrgCodeIdx: uniqueIndex("accounting_account_org_code_idx").on(table.organizationId, table.code),
  }),
);

export const journalEntry = pgTable(
  "journal_entry",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    outletId: uuid("outlet_id").references(() => outlet.id, { onDelete: "set null" }),
    entryNumber: text("entry_number").notNull(),
    sourceType: text("source_type").notNull(),
    sourceId: text("source_id").notNull(),
    entryDate: timestamp("entry_date", { withTimezone: true }).notNull().defaultNow(),
    description: text("description"),
    status: journalEntryStatusEnum("status").notNull().default("posted"),
    actorUserId: text("actor_user_id").references(() => user.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (table) => ({
    journalEntryNumberIdx: uniqueIndex("journal_entry_number_idx").on(table.organizationId, table.entryNumber),
    journalEntrySourceIdx: index("journal_entry_source_idx").on(table.organizationId, table.sourceType, table.sourceId),
  }),
);

export const journalLine = pgTable(
  "journal_line",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    journalEntryId: uuid("journal_entry_id")
      .notNull()
      .references(() => journalEntry.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accountingAccount.id),
    debit: numeric("debit", { precision: 14, scale: 2 }).notNull().default("0"),
    credit: numeric("credit", { precision: 14, scale: 2 }).notNull().default("0"),
    memo: text("memo"),
    ...timestamps,
  },
  (table) => ({
    journalLineEntryIdx: index("journal_line_entry_idx").on(table.journalEntryId),
  }),
);

export const cashBankLedger = pgTable(
  "cash_bank_ledger",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    outletId: uuid("outlet_id").references(() => outlet.id, { onDelete: "set null" }),
    accountId: uuid("account_id").references(() => accountingAccount.id, { onDelete: "set null" }),
    journalEntryId: uuid("journal_entry_id").references(() => journalEntry.id, { onDelete: "set null" }),
    sourceType: text("source_type").notNull(),
    sourceId: text("source_id").notNull(),
    method: paymentMethodEnum("method").notNull(),
    direction: cashLedgerDirectionEnum("direction").notNull(),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    description: text("description"),
    actorUserId: text("actor_user_id").references(() => user.id, { onDelete: "set null" }),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    ...timestamps,
  },
  (table) => ({
    cashBankLedgerSourceIdx: index("cash_bank_ledger_source_idx").on(table.organizationId, table.sourceType, table.sourceId),
    cashBankLedgerDateIdx: index("cash_bank_ledger_date_idx").on(table.organizationId, table.occurredAt),
  }),
);

export const operationalExpense = pgTable(
  "operational_expense",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    outletId: uuid("outlet_id").references(() => outlet.id, { onDelete: "set null" }),
    expenseNumber: text("expense_number").notNull(),
    expenseAccountId: uuid("expense_account_id").references(() => accountingAccount.id, { onDelete: "set null" }),
    paidFromAccountId: uuid("paid_from_account_id").references(() => accountingAccount.id, { onDelete: "set null" }),
    method: paymentMethodEnum("method").notNull().default("cash"),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    vendor: text("vendor"),
    description: text("description").notNull(),
    expenseDate: timestamp("expense_date", { withTimezone: true }).notNull().defaultNow(),
    actorUserId: text("actor_user_id").references(() => user.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (table) => ({
    operationalExpenseNumberIdx: uniqueIndex("operational_expense_number_idx").on(table.organizationId, table.expenseNumber),
    operationalExpenseDateIdx: index("operational_expense_date_idx").on(table.organizationId, table.expenseDate),
  }),
);

export const userOutlet = pgTable(
  "user_outlet",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    outletId: uuid("outlet_id")
      .notNull()
      .references(() => outlet.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.outletId] }),
  }),
);

export const unit = pgTable(
  "unit",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    code: text("code").notNull(),
    kind: unitKindEnum("kind").notNull(),
    toBaseFactor: numeric("to_base_factor", { precision: 18, scale: 6 }).notNull().default("1"),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (table) => ({
    unitOrgCodeIdx: uniqueIndex("unit_org_code_idx").on(table.organizationId, table.code),
  }),
);

export const product = pgTable(
  "product",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    outletId: uuid("outlet_id"),
    globalProductId: uuid("global_product_id"),
    name: text("name").notNull(),
    category: text("category"),
    imageUrl: text("image_url"),
    voidWindowHours: integer("void_window_hours").default(0),
    refundWindowHours: integer("refund_window_hours").default(0),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (table) => ({
    productOrgNameIdx: index("product_org_name_idx").on(table.organizationId, table.name),
    productOutletActiveUpdatedIdx: index("product_outlet_active_updated_idx").on(table.outletId, table.isActive, table.updatedAt),
    productGlobalIdx: index("product_global_idx").on(table.organizationId, table.globalProductId),
  }),
);

export const sku = pgTable(
  "sku",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => product.id, { onDelete: "cascade" }),
    globalSkuId: uuid("global_sku_id"),
    sku: text("sku").notNull(),
    barcode: text("barcode"),
    name: text("name").notNull(),
    imageUrl: text("image_url"),
    baseUnitId: uuid("base_unit_id")
      .notNull()
      .references(() => unit.id),
    saleUnitId: uuid("sale_unit_id")
      .notNull()
      .references(() => unit.id),
    saleUnitToBaseFactor: numeric("sale_unit_to_base_factor", { precision: 18, scale: 6 }).notNull().default("1"),
    price: numeric("price", { precision: 14, scale: 2 }).notNull().default("0"),
    cost: numeric("cost", { precision: 14, scale: 6 }).notNull().default("0"),
    minStockBaseQty: numeric("min_stock_base_qty", { precision: 18, scale: 3 }).notNull().default("0"),
    trackInventory: boolean("track_inventory").notNull().default(true),
    quantityMode: text("quantity_mode").notNull().default("required"),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (table) => ({
    skuBarcodeIdx: index("sku_barcode_idx").on(table.barcode),
    skuProductActiveUpdatedIdx: index("sku_product_active_updated_idx").on(table.productId, table.isActive, table.updatedAt),
    skuGlobalIdx: index("sku_global_idx").on(table.organizationId, table.globalSkuId),
  }),
);

export const inventoryBalance = pgTable(
  "inventory_balance",
  {
    outletId: uuid("outlet_id")
      .notNull()
      .references(() => outlet.id, { onDelete: "cascade" }),
    skuId: uuid("sku_id")
      .notNull()
      .references(() => sku.id, { onDelete: "cascade" }),
    onHandBaseQty: numeric("on_hand_base_qty", { precision: 18, scale: 3 }).notNull().default("0"),
    reservedBaseQty: numeric("reserved_base_qty", { precision: 18, scale: 3 }).notNull().default("0"),
    holdBaseQty: numeric("hold_base_qty", { precision: 18, scale: 3 }).notNull().default("0"),
    ...timestamps,
  },
  (table) => ({
    pk: primaryKey({ columns: [table.outletId, table.skuId] }),
  }),
);

export const inventoryBatch = pgTable(
  "inventory_batch",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    outletId: uuid("outlet_id")
      .notNull()
      .references(() => outlet.id, { onDelete: "cascade" }),
    skuId: uuid("sku_id")
      .notNull()
      .references(() => sku.id, { onDelete: "cascade" }),
    lotCode: text("lot_code").notNull(),
    expiryDate: date("expiry_date", { mode: "date" }),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    initialBaseQty: numeric("initial_base_qty", { precision: 18, scale: 3 }).notNull(),
    onHandBaseQty: numeric("on_hand_base_qty", { precision: 18, scale: 3 }).notNull(),
    unitCost: numeric("unit_cost", { precision: 14, scale: 6 }),
    sourceType: text("source_type"),
    sourceId: text("source_id"),
    sourceItemId: text("source_item_id"),
    note: text("note"),
    ...timestamps,
  },
  (table) => ({
    batchOutletSkuExpiryIdx: index("inventory_batch_outlet_sku_expiry_idx").on(table.outletId, table.skuId, table.expiryDate),
    batchOrgLotIdx: index("inventory_batch_org_lot_idx").on(table.organizationId, table.lotCode),
  }),
);

export const stockMovement = pgTable(
  "stock_movement",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    outletId: uuid("outlet_id")
      .notNull()
      .references(() => outlet.id, { onDelete: "cascade" }),
    skuId: uuid("sku_id")
      .notNull()
      .references(() => sku.id),
    batchId: uuid("batch_id").references(() => inventoryBatch.id, { onDelete: "set null" }),
    type: stockMovementTypeEnum("type").notNull(),
    quantityBase: numeric("quantity_base", { precision: 18, scale: 3 }).notNull(),
    unitId: uuid("unit_id").references(() => unit.id),
    quantityInput: numeric("quantity_input", { precision: 18, scale: 3 }),
    referenceType: text("reference_type"),
    referenceId: text("reference_id"),
    note: text("note"),
    actorUserId: text("actor_user_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    movementOutletSkuIdx: index("movement_outlet_sku_idx").on(table.outletId, table.skuId, table.createdAt),
  }),
);

export const shift = pgTable(
  "shift",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    outletId: uuid("outlet_id")
      .notNull()
      .references(() => outlet.id, { onDelete: "cascade" }),
    cashierUserId: text("cashier_user_id")
      .notNull()
      .references(() => user.id),
    status: shiftStatusEnum("status").notNull().default("open"),
    openingCash: numeric("opening_cash", { precision: 14, scale: 2 }).notNull().default("0"),
    expectedCash: numeric("expected_cash", { precision: 14, scale: 2 }).notNull().default("0"),
    actualCash: numeric("actual_cash", { precision: 14, scale: 2 }),
    cashInTotal: numeric("cash_in_total", { precision: 14, scale: 2 }).notNull().default("0"),
    cashOutTotal: numeric("cash_out_total", { precision: 14, scale: 2 }).notNull().default("0"),
    cashVariance: numeric("cash_variance", { precision: 14, scale: 2 }),
    closeApprovalStatus: shiftCloseApprovalStatusEnum("close_approval_status").notNull().default("normal"),
    closedByUserId: text("closed_by_user_id").references(() => user.id, { onDelete: "set null" }),
    supervisorUserId: text("supervisor_user_id").references(() => user.id, { onDelete: "set null" }),
    varianceReason: text("variance_reason"),
    openedAt: timestamp("opened_at", { withTimezone: true }).notNull().defaultNow(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    note: text("note"),
    ...timestamps,
  },
  (table) => ({
    shiftOutletStatusIdx: index("shift_outlet_status_idx").on(table.outletId, table.status),
  }),
);

export const shiftCashMovement = pgTable(
  "shift_cash_movement",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    outletId: uuid("outlet_id")
      .notNull()
      .references(() => outlet.id, { onDelete: "cascade" }),
    shiftId: uuid("shift_id")
      .notNull()
      .references(() => shift.id, { onDelete: "cascade" }),
    type: shiftCashMovementTypeEnum("type").notNull(),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    reason: text("reason").notNull(),
    note: text("note"),
    actorUserId: text("actor_user_id").references(() => user.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (table) => ({
    shiftCashMovementShiftIdx: index("shift_cash_movement_shift_idx").on(table.shiftId, table.createdAt),
  }),
);

export const sale = pgTable(
  "sale",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    outletId: uuid("outlet_id")
      .notNull()
      .references(() => outlet.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id").references(() => customer.id, { onDelete: "set null" }),
    shiftId: uuid("shift_id").references(() => shift.id, { onDelete: "set null" }),
    cashierUserId: text("cashier_user_id")
      .notNull()
      .references(() => user.id),
    idempotencyKey: text("idempotency_key").notNull(),
    receiptNumber: text("receipt_number").notNull(),
    status: saleStatusEnum("status").notNull().default("completed"),
    subtotal: numeric("subtotal", { precision: 14, scale: 2 }).notNull(),
    discountTotal: numeric("discount_total", { precision: 14, scale: 2 }).notNull().default("0"),
    taxTotal: numeric("tax_total", { precision: 14, scale: 2 }).notNull().default("0"),
    serviceChargeTotal: numeric("service_charge_total", { precision: 14, scale: 2 }).notNull().default("0"),
    donationTotal: numeric("donation_total", { precision: 14, scale: 2 }).notNull().default("0"),
    roundingTotal: numeric("rounding_total", { precision: 14, scale: 2 }).notNull().default("0"),
    cashTenderedTotal: numeric("cash_tendered_total", { precision: 14, scale: 2 }).notNull().default("0"),
    changeTotal: numeric("change_total", { precision: 14, scale: 2 }).notNull().default("0"),
    grandTotal: numeric("grand_total", { precision: 14, scale: 2 }).notNull(),
    cogsTotal: numeric("cogs_total", { precision: 14, scale: 2 }).notNull().default("0"),
    source: text("source").notNull().default("pos"),
    clientCreatedAt: timestamp("client_created_at", { withTimezone: true }),
    syncedAt: timestamp("synced_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => ({
    saleIdempotencyIdx: uniqueIndex("sale_idempotency_idx").on(table.organizationId, table.idempotencyKey),
    saleReceiptIdx: uniqueIndex("sale_receipt_idx").on(table.organizationId, table.receiptNumber),
    saleOutletCreatedIdx: index("sale_outlet_created_idx").on(table.outletId, table.createdAt),
  }),
);

export const promotion = pgTable(
  "promotion",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    code: text("code"),
    type: promotionTypeEnum("type").notNull(),
    discountType: promotionDiscountTypeEnum("discount_type").notNull().default("amount"),
    discountValue: numeric("discount_value", { precision: 14, scale: 2 }).notNull().default("0"),
    scope: promotionScopeEnum("scope").notNull().default("all"),
    targetSkuId: uuid("target_sku_id").references(() => sku.id, { onDelete: "set null" }),
    targetCategory: text("target_category"),
    outletIds: jsonb("outlet_ids"),
    minSubtotal: numeric("min_subtotal", { precision: 14, scale: 2 }).notNull().default("0"),
    buyQty: numeric("buy_qty", { precision: 18, scale: 3 }).notNull().default("0"),
    getQty: numeric("get_qty", { precision: 18, scale: 3 }).notNull().default("0"),
    maxRedemptions: integer("max_redemptions"),
    redeemedCount: integer("redeemed_count").notNull().default(0),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (table) => ({
    promotionOrgCodeIdx: uniqueIndex("promotion_org_code_idx").on(table.organizationId, table.code),
    promotionOrgActiveIdx: index("promotion_org_active_idx").on(table.organizationId, table.isActive),
  }),
);

export const salePromotion = pgTable("sale_promotion", {
  id: uuid("id").primaryKey().defaultRandom(),
  saleId: uuid("sale_id")
    .notNull()
    .references(() => sale.id, { onDelete: "cascade" }),
  promotionId: uuid("promotion_id").references(() => promotion.id, { onDelete: "set null" }),
  codeSnapshot: text("code_snapshot"),
  nameSnapshot: text("name_snapshot").notNull(),
  typeSnapshot: text("type_snapshot").notNull(),
  discountTotal: numeric("discount_total", { precision: 14, scale: 2 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const customer = pgTable(
  "customer",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    name: text("name").notNull(),
    phone: text("phone"),
    address: text("address"),
    loyaltyPoints: integer("loyalty_points").notNull().default(0),
    totalSpent: numeric("total_spent", { precision: 14, scale: 2 }).notNull().default("0"),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (table) => ({
    customerOrgCodeIdx: uniqueIndex("customer_org_code_idx").on(table.organizationId, table.code),
    customerOrgPhoneIdx: index("customer_org_phone_idx").on(table.organizationId, table.phone),
  }),
);

export const customerReceivable = pgTable(
  "customer_receivable",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    outletId: uuid("outlet_id")
      .notNull()
      .references(() => outlet.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customer.id, { onDelete: "cascade" }),
    saleId: uuid("sale_id")
      .notNull()
      .references(() => sale.id, { onDelete: "cascade" }),
    status: customerReceivableStatusEnum("status").notNull().default("open"),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    paidTotal: numeric("paid_total", { precision: 14, scale: 2 }).notNull().default("0"),
    dueDate: timestamp("due_date", { withTimezone: true }),
    note: text("note"),
    ...timestamps,
  },
  (table) => ({
    receivableCustomerCreatedIdx: index("receivable_customer_created_idx").on(table.customerId, table.createdAt),
    receivableOutletStatusIdx: index("receivable_outlet_status_idx").on(table.outletId, table.status),
  }),
);

export const customerReceivablePayment = pgTable("customer_receivable_payment", {
  id: uuid("id").primaryKey().defaultRandom(),
  receivableId: uuid("receivable_id")
    .notNull()
    .references(() => customerReceivable.id, { onDelete: "cascade" }),
  method: paymentMethodEnum("method").notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  reference: text("reference"),
  note: text("note"),
  actorUserId: text("actor_user_id").references(() => user.id, { onDelete: "set null" }),
  paidAt: timestamp("paid_at", { withTimezone: true }).notNull().defaultNow(),
  ...timestamps,
});

export const saleItem = pgTable("sale_item", {
  id: uuid("id").primaryKey().defaultRandom(),
  saleId: uuid("sale_id")
    .notNull()
    .references(() => sale.id, { onDelete: "cascade" }),
  skuId: uuid("sku_id")
    .notNull()
    .references(() => sku.id),
  nameSnapshot: text("name_snapshot").notNull(),
  quantityInput: numeric("quantity_input", { precision: 18, scale: 3 }).notNull(),
  unitId: uuid("unit_id")
    .notNull()
    .references(() => unit.id),
  quantityBase: numeric("quantity_base", { precision: 18, scale: 3 }).notNull(),
  unitPrice: numeric("unit_price", { precision: 14, scale: 2 }).notNull(),
  discountTotal: numeric("discount_total", { precision: 14, scale: 2 }).notNull().default("0"),
  lineTotal: numeric("line_total", { precision: 14, scale: 2 }).notNull(),
  cogsTotal: numeric("cogs_total", { precision: 14, scale: 2 }).notNull().default("0"),
  ...timestamps,
});

export const payment = pgTable("payment", {
  id: uuid("id").primaryKey().defaultRandom(),
  saleId: uuid("sale_id")
    .notNull()
    .references(() => sale.id, { onDelete: "cascade" }),
  method: paymentMethodEnum("method").notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  reference: text("reference"),
  ...timestamps,
});

export const supplier = pgTable(
  "supplier",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    code: text("code").notNull(),
    phone: text("phone"),
    address: text("address"),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (table) => ({
    supplierOrgCodeIdx: uniqueIndex("supplier_org_code_idx").on(table.organizationId, table.code),
  }),
);

export const purchaseOrder = pgTable(
  "purchase_order",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    outletId: uuid("outlet_id")
      .notNull()
      .references(() => outlet.id, { onDelete: "cascade" }),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => supplier.id),
    orderNumber: text("order_number").notNull(),
    status: purchaseOrderStatusEnum("status").notNull().default("ordered"),
    paymentStatus: purchasePaymentStatusEnum("payment_status").notNull().default("unpaid"),
    subtotal: numeric("subtotal", { precision: 14, scale: 2 }).notNull().default("0"),
    paidTotal: numeric("paid_total", { precision: 14, scale: 2 }).notNull().default("0"),
    note: text("note"),
    createdByUserId: text("created_by_user_id").references(() => user.id, { onDelete: "set null" }),
    receivedAt: timestamp("received_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => ({
    purchaseOrderNumberIdx: uniqueIndex("purchase_order_number_idx").on(table.organizationId, table.orderNumber),
    purchaseOrderOutletCreatedIdx: index("purchase_order_outlet_created_idx").on(table.outletId, table.createdAt),
  }),
);

export const purchaseOrderItem = pgTable("purchase_order_item", {
  id: uuid("id").primaryKey().defaultRandom(),
  purchaseOrderId: uuid("purchase_order_id")
    .notNull()
    .references(() => purchaseOrder.id, { onDelete: "cascade" }),
  skuId: uuid("sku_id")
    .notNull()
    .references(() => sku.id),
  nameSnapshot: text("name_snapshot").notNull(),
  quantityBase: numeric("quantity_base", { precision: 18, scale: 3 }).notNull(),
  unitId: uuid("unit_id")
    .notNull()
    .references(() => unit.id),
  unitCost: numeric("unit_cost", { precision: 14, scale: 6 }).notNull(),
  lineTotal: numeric("line_total", { precision: 14, scale: 2 }).notNull(),
  receivedBaseQty: numeric("received_base_qty", { precision: 18, scale: 3 }).notNull().default("0"),
  lotCode: text("lot_code"),
  expiryDate: date("expiry_date", { mode: "date" }),
  ...timestamps,
});

export const purchasePayment = pgTable("purchase_payment", {
  id: uuid("id").primaryKey().defaultRandom(),
  purchaseOrderId: uuid("purchase_order_id")
    .notNull()
    .references(() => purchaseOrder.id, { onDelete: "cascade" }),
  method: paymentMethodEnum("method").notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  reference: text("reference"),
  note: text("note"),
  actorUserId: text("actor_user_id").references(() => user.id, { onDelete: "set null" }),
  paidAt: timestamp("paid_at", { withTimezone: true }).notNull().defaultNow(),
  ...timestamps,
});

export const stockOpname = pgTable(
  "stock_opname",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    outletId: uuid("outlet_id")
      .notNull()
      .references(() => outlet.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    status: stockOpnameStatusEnum("status").notNull().default("draft"),
    note: text("note"),
    createdByUserId: text("created_by_user_id").references(() => user.id, { onDelete: "set null" }),
    submittedByUserId: text("submitted_by_user_id").references(() => user.id, { onDelete: "set null" }),
    approvedByUserId: text("approved_by_user_id").references(() => user.id, { onDelete: "set null" }),
    postedByUserId: text("posted_by_user_id").references(() => user.id, { onDelete: "set null" }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    postedAt: timestamp("posted_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => ({
    stockOpnameCodeIdx: uniqueIndex("stock_opname_code_idx").on(table.organizationId, table.code),
    stockOpnameOutletCreatedIdx: index("stock_opname_outlet_created_idx").on(table.outletId, table.createdAt),
  }),
);

export const stockOpnameItem = pgTable(
  "stock_opname_item",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    stockOpnameId: uuid("stock_opname_id")
      .notNull()
      .references(() => stockOpname.id, { onDelete: "cascade" }),
    skuId: uuid("sku_id")
      .notNull()
      .references(() => sku.id),
    nameSnapshot: text("name_snapshot").notNull(),
    unitId: uuid("unit_id")
      .notNull()
      .references(() => unit.id),
    systemBaseQty: numeric("system_base_qty", { precision: 18, scale: 3 }).notNull().default("0"),
    physicalBaseQty: numeric("physical_base_qty", { precision: 18, scale: 3 }),
    differenceBaseQty: numeric("difference_base_qty", { precision: 18, scale: 3 }),
    note: text("note"),
    ...timestamps,
  },
  (table) => ({
    stockOpnameItemUniqueIdx: uniqueIndex("stock_opname_item_unique_idx").on(table.stockOpnameId, table.skuId),
  }),
);

export const wasteAdjustment = pgTable(
  "waste_adjustment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    outletId: uuid("outlet_id")
      .notNull()
      .references(() => outlet.id, { onDelete: "cascade" }),
    skuId: uuid("sku_id")
      .notNull()
      .references(() => sku.id),
    quantityInput: numeric("quantity_input", { precision: 18, scale: 3 }).notNull(),
    unitId: uuid("unit_id")
      .notNull()
      .references(() => unit.id),
    quantityBase: numeric("quantity_base", { precision: 18, scale: 3 }).notNull(),
    idempotencyKey: text("idempotency_key"),
    estimatedLoss: numeric("estimated_loss", { precision: 14, scale: 2 }).notNull(),
    reason: wasteReasonEnum("reason").notNull(),
    note: text("note"),
    photoUrl: text("photo_url"),
    status: approvalStatusEnum("status").notNull().default("posted"),
    requestedByUserId: text("requested_by_user_id")
      .notNull()
      .references(() => user.id),
    approvedByUserId: text("approved_by_user_id").references(() => user.id, { onDelete: "set null" }),
    postedAt: timestamp("posted_at", { withTimezone: true }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => ({
    wasteOutletCreatedIdx: index("waste_outlet_created_idx").on(table.outletId, table.createdAt),
    wasteIdempotencyIdx: uniqueIndex("waste_idempotency_idx").on(table.organizationId, table.idempotencyKey),
  }),
);

export const syncQueue = pgTable(
  "sync_queue",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    outletId: uuid("outlet_id")
      .notNull()
      .references(() => outlet.id, { onDelete: "cascade" }),
    idempotencyKey: text("idempotency_key").notNull(),
    payload: jsonb("payload").notNull(),
    status: syncStatusEnum("status").notNull().default("received"),
    error: text("error"),
    processedSaleId: uuid("processed_sale_id").references(() => sale.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
  },
  (table) => ({
    syncIdempotencyIdx: uniqueIndex("sync_idempotency_idx").on(table.organizationId, table.idempotencyKey),
  }),
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").references(() => organization.id, { onDelete: "set null" }),
    outletId: uuid("outlet_id").references(() => outlet.id, { onDelete: "set null" }),
    actorUserId: text("actor_user_id").references(() => user.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    before: jsonb("before"),
    after: jsonb("after"),
    note: text("note"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    auditOrgCreatedIdx: index("audit_org_created_idx").on(table.organizationId, table.createdAt),
  }),
);

export const organizationRelations = relations(organization, ({ many }) => ({
  outlets: many(outlet),
  users: many(user),
}));

export const outletRelations = relations(outlet, ({ one, many }) => ({
  organization: one(organization, {
    fields: [outlet.organizationId],
    references: [organization.id],
  }),
  userOutlets: many(userOutlet),
  balances: many(inventoryBalance),
}));

export const userRelations = relations(user, ({ one, many }) => ({
  organization: one(organization, {
    fields: [user.organizationId],
    references: [organization.id],
  }),
  outlets: many(userOutlet),
  sessions: many(session),
}));

export const userOutletRelations = relations(userOutlet, ({ one }) => ({
  user: one(user, {
    fields: [userOutlet.userId],
    references: [user.id],
  }),
  outlet: one(outlet, {
    fields: [userOutlet.outletId],
    references: [outlet.id],
  }),
}));

export const productRelations = relations(product, ({ one, many }) => ({
  organization: one(organization, {
    fields: [product.organizationId],
    references: [organization.id],
  }),
  skus: many(sku),
}));

export const skuRelations = relations(sku, ({ one }) => ({
  product: one(product, {
    fields: [sku.productId],
    references: [product.id],
  }),
  baseUnit: one(unit, {
    fields: [sku.baseUnitId],
    references: [unit.id],
  }),
  saleUnit: one(unit, {
    fields: [sku.saleUnitId],
    references: [unit.id],
  }),
}));

export type AppRole = (typeof appRoleEnum.enumValues)[number];
export type PaymentMethod = (typeof paymentMethodEnum.enumValues)[number];
export type ShiftCashMovementType = (typeof shiftCashMovementTypeEnum.enumValues)[number];
export type AccountingAccountType = (typeof accountingAccountTypeEnum.enumValues)[number];
export type AccountingNormalBalance = (typeof accountingNormalBalanceEnum.enumValues)[number];
export type WasteReason = (typeof wasteReasonEnum.enumValues)[number];
