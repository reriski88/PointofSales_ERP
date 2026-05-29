import {
  boolean,
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

export const organization = pgTable("organization", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  logoUrl: text("logo_url"),
  receiptLayout: jsonb("receipt_layout"),
  rolePermissions: jsonb("role_permissions"),
  publicApiUrl: text("public_api_url"),
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
    name: text("name").notNull(),
    category: text("category"),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (table) => ({
    productOrgNameIdx: index("product_org_name_idx").on(table.organizationId, table.name),
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
    sku: text("sku").notNull(),
    barcode: text("barcode"),
    name: text("name").notNull(),
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
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (table) => ({
    skuOrgSkuIdx: uniqueIndex("sku_org_sku_idx").on(table.organizationId, table.sku),
    skuBarcodeIdx: index("sku_barcode_idx").on(table.barcode),
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
    openedAt: timestamp("opened_at", { withTimezone: true }).notNull().defaultNow(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    note: text("note"),
    ...timestamps,
  },
  (table) => ({
    shiftOutletStatusIdx: index("shift_outlet_status_idx").on(table.outletId, table.status),
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
export type WasteReason = (typeof wasteReasonEnum.enumValues)[number];
