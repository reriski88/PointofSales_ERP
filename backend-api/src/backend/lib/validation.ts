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
  receiptLayout: z
    .object({
      paperWidth: z.enum(["58", "80"]).default("58"),
      autoPrint: z.boolean().default(false),
      header: z.array(z.string()).default(["logo", "outlet", "address"]),
      body: z.array(z.string()).default(["items", "totals", "payment"]),
      footer: z.array(z.string()).default(["note"]),
      footerNote: z.string().max(240).default("Terima kasih"),
    })
    .nullable()
    .optional(),
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
  shiftId: uuidSchema.optional(),
  idempotencyKey: z.string().min(8).max(128),
  receiptNumber: z.string().min(1).max(64).optional(),
  items: z.array(saleItemSchema).min(1),
  payments: z.array(salePaymentSchema).min(1),
  discountTotal: z.coerce.number().nonnegative().default(0),
  taxTotal: z.coerce.number().nonnegative().default(0),
  serviceChargeTotal: z.coerce.number().nonnegative().default(0),
  source: z.string().min(1).default("pos"),
  clientCreatedAt: dateStringSchema,
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
  note: z.string().min(1).optional(),
});

export const approveWasteSchema = z.object({
  approved: z.boolean(),
  note: z.string().optional(),
});

export const syncPushSchema = z.object({
  outletId: uuidSchema,
  transactions: z.array(createSaleSchema).min(1),
});
