import { z } from "zod";
import { appRoles, roleAccessMenus } from "@/lib/role-access";

export const uuidSchema = z.string().uuid();
export const dateStringSchema = z.string().datetime().optional();

export const createOutletSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1).max(24),
  address: z.string().optional(),
  logoUrl: z.string().optional(),
});

export const updateOutletSchema = z.object({
  name: z.string().min(1).optional(),
  address: z.string().nullable().optional(),
  logoUrl: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

export const updateSettingsSchema = z.object({
  defaultOutletLogoUrl: z.string().nullable().optional(),
  posSettings: z
    .object({
      taxEnabled: z.boolean().default(false),
      taxRatePercent: z.coerce.number().min(0).max(100).default(0),
      taxIncluded: z.boolean().default(false),
      serviceChargeEnabled: z.boolean().default(false),
      serviceChargeRatePercent: z.coerce.number().min(0).max(100).default(0),
    })
    .optional(),
  receiptLayout: z
    .object({
      paperWidth: z.enum(["58", "80"]).default("58"),
      autoPrint: z.boolean().default(false),
      printerName: z.string().trim().max(120).default("Thermal Bluetooth RPP02N"),
      header: z.array(z.string()).default(["logo", "outlet", "address"]),
      body: z.array(z.string()).default(["items", "totals", "payment"]),
      footer: z.array(z.string()).default(["note"]),
      footerNote: z.string().max(240).default("Terima kasih"),
    })
    .nullable()
    .optional(),
});

const promotionBaseSchema = z.object({
    name: z.string().min(1).max(120),
    code: z.string().trim().max(40).nullable().optional(),
    type: z.enum(["transaction_discount", "item_discount", "buy_x_get_y"]),
    discountType: z.enum(["percent", "amount"]).default("amount"),
    discountValue: z.coerce.number().nonnegative().default(0),
    scope: z.enum(["all", "sku", "category"]).default("all"),
    targetSkuId: uuidSchema.nullable().optional(),
    targetCategory: z.string().trim().max(120).nullable().optional(),
    outletIds: z.array(uuidSchema).default([]),
    minSubtotal: z.coerce.number().nonnegative().default(0),
    buyQty: z.coerce.number().nonnegative().default(0),
    getQty: z.coerce.number().nonnegative().default(0),
    maxRedemptions: z.coerce.number().int().positive().nullable().optional(),
    startsAt: dateStringSchema.nullable(),
    endsAt: dateStringSchema.nullable(),
    isActive: z.boolean().default(true),
  });

export const promotionSchema = promotionBaseSchema
  .refine((value) => value.scope !== "sku" || Boolean(value.targetSkuId), {
    message: "SKU target wajib dipilih untuk promo produk.",
    path: ["targetSkuId"],
  })
  .refine((value) => value.scope !== "category" || Boolean(value.targetCategory), {
    message: "Kategori target wajib diisi untuk promo kategori.",
    path: ["targetCategory"],
  })
  .refine((value) => value.type !== "buy_x_get_y" || (value.buyQty > 0 && value.getQty > 0), {
    message: "Buy X Get Y wajib memiliki qty beli dan qty gratis lebih dari 0.",
    path: ["buyQty"],
  })
  .refine((value) => value.type === "buy_x_get_y" || value.discountValue > 0, {
    message: "Nilai diskon wajib lebih dari 0.",
    path: ["discountValue"],
  })
  .refine((value) => value.discountType !== "percent" || value.discountValue <= 100, {
    message: "Diskon persen maksimal 100.",
    path: ["discountValue"],
  });

export const updatePromotionSchema = promotionBaseSchema
  .partial()
  .extend({
    isActive: z.boolean().optional(),
  })
  .refine((value) => value.discountType !== "percent" || value.discountValue === undefined || value.discountValue <= 100, {
    message: "Diskon persen maksimal 100.",
    path: ["discountValue"],
  });

const roleAccessMenuSchema = z.object(
  Object.fromEntries(
    roleAccessMenus.map((menu) => [
      menu.key,
      z.array(z.enum(menu.actions as [string, ...string[]])).default([]),
    ]),
  ),
);

export const updateRoleAccessSchema = z.object({
  permissions: z.object(
    Object.fromEntries(
      appRoles.map((role) => [role, roleAccessMenuSchema]),
    ),
  ),
});

export const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  image: z.string().nullable().optional(),
  password: z.string().min(8),
  role: z.enum(["owner", "admin_outlet", "cashier", "warehouse", "auditor"]).default("cashier"),
  outletIds: z.array(uuidSchema).default([]),
});

export const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  image: z.string().nullable().optional(),
  password: z.string().min(8).optional(),
  role: z.enum(["owner", "admin_outlet", "cashier", "warehouse", "auditor"]).optional(),
  isActive: z.boolean().optional(),
  outletIds: z.array(uuidSchema).optional(),
});

export const createUnitSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1).max(16),
  kind: z.enum(["weight", "count", "package"]),
  toBaseFactor: z.coerce.number().positive().default(1),
});

export const createProductSchema = z.object({
  name: z.string().min(1),
  category: z.string().optional(),
  voidWindowHours: z.coerce.number().int().nonnegative().nullable().default(0),
  refundWindowHours: z.coerce.number().int().nonnegative().nullable().default(0),
  sku: z.object({
    sku: z.string().min(1),
    barcode: z.string().optional(),
    name: z.string().min(1),
    baseUnitId: uuidSchema,
    saleUnitId: uuidSchema,
    saleUnitToBaseFactor: z.coerce.number().positive().default(1),
    price: z.coerce.number().nonnegative(),
    cost: z.coerce.number().nonnegative().default(0),
    minStockBaseQty: z.coerce.number().nonnegative().default(0),
  }),
});

export const updateProductSchema = z.object({
  name: z.string().min(1).optional(),
  category: z.string().nullable().optional(),
  voidWindowHours: z.coerce.number().int().nonnegative().nullable().optional(),
  refundWindowHours: z.coerce.number().int().nonnegative().nullable().optional(),
  isActive: z.boolean().optional(),
  skus: z
    .array(
      z.object({
        id: uuidSchema,
        sku: z.string().min(1).optional(),
        barcode: z.string().nullable().optional(),
        name: z.string().min(1).optional(),
        baseUnitId: uuidSchema.optional(),
        saleUnitId: uuidSchema.optional(),
        saleUnitToBaseFactor: z.coerce.number().positive().optional(),
        price: z.coerce.number().nonnegative().optional(),
        cost: z.coerce.number().nonnegative().optional(),
        minStockBaseQty: z.coerce.number().nonnegative().optional(),
        isActive: z.boolean().optional(),
      }),
    )
    .optional(),
});

export const createSupplierSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1).max(32),
  phone: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
});

export const createCustomerSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1).max(32).optional(),
  phone: z.string().max(40).nullable().optional(),
  address: z.string().max(300).nullable().optional(),
});

export const updateCustomerSchema = z.object({
  name: z.string().min(1).optional(),
  code: z.string().min(1).max(32).optional(),
  phone: z.string().max(40).nullable().optional(),
  address: z.string().max(300).nullable().optional(),
  isActive: z.boolean().optional(),
});

export const createCustomerReceivablePaymentSchema = z.object({
  amount: z.coerce.number().positive(),
  method: z.enum(["cash", "qris", "transfer", "card", "ewallet", "other"]),
  reference: z.string().max(120).optional(),
  note: z.string().max(500).optional(),
});

export const updateSupplierSchema = z.object({
  name: z.string().min(1).optional(),
  code: z.string().min(1).max(32).optional(),
  phone: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

export const createPurchaseOrderSchema = z.object({
  outletId: uuidSchema,
  supplierId: uuidSchema,
  orderNumber: z.string().min(1).max(64).optional(),
  note: z.string().max(500).optional(),
  items: z
    .array(
      z.object({
        skuId: uuidSchema,
        quantityBase: z.coerce.number().positive(),
        unitCost: z.coerce.number().nonnegative(),
        lotCode: z.string().min(1).max(64).optional(),
        expiryDate: z.coerce.date().optional(),
      }),
    )
    .min(1),
});

export const receivePurchaseOrderSchema = z.object({
  note: z.string().max(500).optional(),
});

export const createPurchasePaymentSchema = z.object({
  amount: z.coerce.number().positive(),
  method: z.enum(["cash", "qris", "transfer", "card", "ewallet", "other"]),
  reference: z.string().max(120).optional(),
  note: z.string().max(500).optional(),
});

export const saleItemSchema = z.object({
  skuId: uuidSchema,
  quantity: z.coerce.number().positive(),
  unitId: uuidSchema.optional(),
  unitPrice: z.coerce.number().nonnegative().optional(),
  discountTotal: z.coerce.number().nonnegative().default(0),
});

export const salePaymentSchema = z.object({
  method: z.enum(["cash", "qris", "transfer", "card", "ewallet", "other"]),
  amount: z.coerce.number().positive(),
  reference: z.string().optional(),
});

export const createSaleSchema = z.object({
  outletId: uuidSchema,
  customerId: uuidSchema.optional(),
  shiftId: uuidSchema.optional(),
  idempotencyKey: z.string().min(8).max(128),
  receiptNumber: z.string().min(1).max(64).optional(),
  items: z.array(saleItemSchema).min(1),
  payments: z.array(salePaymentSchema).default([]),
  allowReceivable: z.boolean().default(false),
  receivableDueDate: dateStringSchema,
  receivableNote: z.string().max(500).optional(),
  discountTotal: z.coerce.number().nonnegative().default(0),
  taxTotal: z.coerce.number().nonnegative().default(0),
  serviceChargeTotal: z.coerce.number().nonnegative().default(0),
  donationTotal: z.coerce.number().nonnegative().default(0),
  cashTenderedTotal: z.coerce.number().nonnegative().optional(),
  promotionCodes: z.array(z.string().trim().min(1).max(40)).default([]),
  source: z.string().min(1).default("pos"),
  clientCreatedAt: dateStringSchema,
});

export const quoteSaleSchema = createSaleSchema
  .omit({
    idempotencyKey: true,
    receiptNumber: true,
    payments: true,
    shiftId: true,
    allowReceivable: true,
    receivableDueDate: true,
    receivableNote: true,
    source: true,
    clientCreatedAt: true,
  })
  .extend({
    discountTotal: z.coerce.number().nonnegative().default(0),
    taxTotal: z.coerce.number().nonnegative().default(0),
    serviceChargeTotal: z.coerce.number().nonnegative().default(0),
    donationTotal: z.coerce.number().nonnegative().default(0),
    promotionCodes: z.array(z.string().trim().min(1).max(40)).default([]),
  });

export const voidSaleSchema = z.object({
  reason: z.string().min(3).max(240),
});

export const refundSaleSchema = z.object({
  reason: z.string().min(3).max(240),
  restock: z.boolean().default(true),
  refundMethod: z.enum(["cash", "qris", "transfer", "card", "ewallet", "other"]).optional(),
});

export const openShiftSchema = z.object({
  outletId: uuidSchema,
  openingCash: z.coerce.number().nonnegative().default(0),
  note: z.string().optional(),
});

export const closeShiftSchema = z.object({
  shiftId: uuidSchema,
  actualCash: z.coerce.number().nonnegative(),
  note: z.string().optional(),
  varianceReason: z.string().max(500).optional(),
});

export const createShiftCashMovementSchema = z.object({
  shiftId: uuidSchema,
  type: z.enum(["cash_in", "cash_out"]),
  amount: z.coerce.number().positive(),
  reason: z.string().min(3).max(120),
  note: z.string().max(500).optional(),
});

export const createOperationalExpenseSchema = z.object({
  outletId: uuidSchema.optional(),
  amount: z.coerce.number().positive(),
  method: z.enum(["cash", "qris", "transfer", "card", "ewallet", "other"]).default("cash"),
  vendor: z.string().trim().max(120).optional(),
  description: z.string().trim().min(3).max(300),
  expenseDate: dateStringSchema,
});

export const createWasteAdjustmentSchema = z.object({
  outletId: uuidSchema,
  skuId: uuidSchema,
  quantity: z.coerce.number().positive(),
  unitId: uuidSchema,
  reason: z.enum([
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
  ]),
  note: z.string().optional(),
  photoUrl: z.string().url().optional(),
});

export const createInventoryAdjustmentSchema = z.object({
  outletId: uuidSchema,
  skuId: uuidSchema,
  type: z.enum(["opening", "purchase", "adjustment"]),
  quantityBase: z.coerce.number().refine((value) => value !== 0, "Quantity cannot be zero"),
  lotCode: z.string().min(1).max(64).optional(),
  expiryDate: z.coerce.date().optional(),
  note: z.string().min(1).optional(),
});

export const createInventoryTransferSchema = z
  .object({
    fromOutletId: uuidSchema,
    toOutletId: uuidSchema,
    skuId: uuidSchema,
    quantityBase: z.coerce.number().positive(),
    note: z.string().max(500).optional(),
  })
  .refine((value) => value.fromOutletId !== value.toOutletId, {
    message: "Outlet asal dan tujuan tidak boleh sama",
    path: ["toOutletId"],
  });

export const createStockOpnameSchema = z.object({
  outletId: uuidSchema,
  note: z.string().max(500).optional(),
});

export const updateStockOpnameCountsSchema = z.object({
  items: z
    .array(
      z.object({
        itemId: uuidSchema,
        physicalBaseQty: z.coerce.number().nonnegative(),
        note: z.string().max(500).optional(),
      }),
    )
    .min(1),
});

export const stockOpnameActionNoteSchema = z.object({
  note: z.string().max(500).optional(),
});

export const approveWasteSchema = z.object({
  approved: z.boolean(),
  note: z.string().optional(),
});

export const syncPushSchema = z.object({
  outletId: uuidSchema,
  transactions: z.array(createSaleSchema).min(1),
});
