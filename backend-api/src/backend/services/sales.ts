import { z } from "zod";
import { ApiError } from "@/lib/http";
import { baseQty, decimal, fixed } from "@/lib/number";
import type { Actor } from "@/lib/rbac";
import { createSaleSchema, quoteSaleSchema, refundSaleSchema, voidSaleSchema } from "@/lib/validation";
import { salesRepository } from "@/backend/repositories/sales-repository";
import { customerRepository } from "@/backend/repositories/customer-repository";
import { promotionRepository } from "@/backend/repositories/promotion-repository";
import { financeRepository } from "@/backend/repositories/finance-repository";
import type { PaymentMethod } from "@/db/schema";

export type CreateSaleInput = z.infer<typeof createSaleSchema>;
export type QuoteSaleInput = z.infer<typeof quoteSaleSchema>;
export type VoidSaleInput = z.infer<typeof voidSaleSchema>;
export type RefundSaleInput = z.infer<typeof refundSaleSchema>;

type CreateSaleOptions = {
  allowStockConflict?: boolean;
};
type SalesTx = Parameters<Parameters<typeof salesRepository.transaction>[0]>[0];

function makeReceiptNumber() {
  const now = new Date();
  const stamp = now.toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  return `POS-${stamp}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

type PreparedSaleItem = {
  sku: Awaited<ReturnType<typeof salesRepository.findActiveSkuWithProduct>>[number];
  inputUnitId: string;
  quantityInput: number;
  quantityBase: number;
  unitPrice: number;
  discountTotal: number;
  lineTotal: number;
  cogsTotal: number;
};

type PosSettings = {
  taxEnabled: boolean;
  taxRatePercent: number;
  taxIncluded: boolean;
  serviceChargeEnabled: boolean;
  serviceChargeRatePercent: number;
};

type PromotionIssue = {
  code: string;
  reason: string;
  message: string;
};

const defaultPosSettings: PosSettings = {
  taxEnabled: false,
  taxRatePercent: 0,
  taxIncluded: false,
  serviceChargeEnabled: false,
  serviceChargeRatePercent: 0,
};

export async function quoteSale(actor: Actor, input: QuoteSaleInput) {
  return salesRepository.transaction(async (tx) => {
    const [targetOutlet] = await salesRepository.findActiveOutlet(tx, input.outletId, actor.organizationId);
    if (!targetOutlet) {
      throw new ApiError("NOT_FOUND", "Outlet not found", 404);
    }

    const { preparedItems, subtotal, cogsTotal } = await prepareSaleItems(tx, actor, input.outletId, input.items, false);
    return calculateSaleTotals(tx, actor.organizationId, input.outletId, preparedItems, {
      subtotal,
      cogsTotal,
      manualDiscountTotal: input.discountTotal,
      taxTotal: input.taxTotal,
      serviceChargeTotal: input.serviceChargeTotal,
      donationTotal: input.donationTotal,
      promotionCodes: input.promotionCodes,
    });
  });
}

export async function createSale(actor: Actor, input: CreateSaleInput, request?: Request, options: CreateSaleOptions = {}) {
  return salesRepository.transaction(async (tx) => {
    const [existing] = await salesRepository.findByIdempotencyKey(tx, actor.organizationId, input.idempotencyKey);

    if (existing) {
      return { sale: existing, idempotent: true };
    }

    const [targetOutlet] = await salesRepository.findActiveOutlet(tx, input.outletId, actor.organizationId);

    if (!targetOutlet) {
      throw new ApiError("NOT_FOUND", "Outlet not found", 404);
    }

    let activeShiftId = input.shiftId;
    if (!activeShiftId) {
      const [activeShift] = await salesRepository.findOpenShift(tx, input.outletId, actor.id);
      activeShiftId = activeShift?.id;
    }

    if (!activeShiftId) {
      throw new ApiError("CONFLICT", "Cashier must open a shift before creating a sale", 409);
    }

    const { preparedItems, subtotal, cogsTotal, hasStockConflict } = await prepareSaleItems(
      tx,
      actor,
      input.outletId,
      input.items,
      true,
    );

    if (hasStockConflict && !options.allowStockConflict) {
      throw new ApiError("CONFLICT", "Insufficient stock for one or more sale items", 409);
    }

    const totals = await calculateSaleTotals(tx, actor.organizationId, input.outletId, preparedItems, {
      subtotal,
      cogsTotal,
      manualDiscountTotal: input.discountTotal,
      taxTotal: input.taxTotal,
      serviceChargeTotal: input.serviceChargeTotal,
      donationTotal: input.donationTotal,
      promotionCodes: input.promotionCodes,
    });
    const grandTotal = totals.grandTotal;
    const nonCashPayments = input.payments.filter((item) => item.method !== "cash");
    const nonCashTotal = nonCashPayments.reduce((sum, current) => sum + current.amount, 0);
    const cashInputTotal = input.payments
      .filter((item) => item.method === "cash")
      .reduce((sum, current) => sum + current.amount, 0);
    if (nonCashTotal > grandTotal + 0.000001) {
      throw new ApiError("BAD_REQUEST", "Pembayaran non-tunai tidak boleh melebihi total transaksi", 400);
    }
    const cashDue = Math.max(0, grandTotal - nonCashTotal);
    const cashAppliedTotal = Math.min(cashInputTotal, cashDue);
    const normalizedPayments = [
      ...nonCashPayments,
      ...(cashAppliedTotal > 0 ? [{ method: "cash" as const, amount: cashAppliedTotal }] : []),
    ];
    const paidTotal = normalizedPayments.reduce((sum, current) => sum + current.amount, 0);
    const receivableTotal = grandTotal - paidTotal;
    const cashTenderedTotal = cashInputTotal > 0 ? input.cashTenderedTotal ?? cashInputTotal : 0;
    const changeTotal = Math.max(0, cashTenderedTotal - cashAppliedTotal);

    if (cashTenderedTotal + 0.000001 < cashAppliedTotal) {
      throw new ApiError("BAD_REQUEST", "Uang tunai diterima tidak boleh lebih kecil dari pembayaran tunai transaksi", 400);
    }

    if (paidTotal < grandTotal && (!input.allowReceivable || !input.customerId)) {
      throw new ApiError("BAD_REQUEST", "Payment total is lower than grand total", 400);
    }
    if (paidTotal < grandTotal && input.customerId) {
      const [targetCustomer] = await customerRepository.findActiveCustomer(tx, input.customerId, actor.organizationId);
      if (!targetCustomer) {
        throw new ApiError("NOT_FOUND", "Pelanggan tidak ditemukan atau nonaktif", 404);
      }
    }

    const isFinalSale = !hasStockConflict;
    const [createdSale] = await salesRepository.createSale(tx, {
        organizationId: actor.organizationId,
        outletId: input.outletId,
        customerId: input.customerId,
        shiftId: activeShiftId,
        cashierUserId: actor.id,
        idempotencyKey: input.idempotencyKey,
        receiptNumber: input.receiptNumber ?? makeReceiptNumber(),
        status: hasStockConflict ? "sync_review" : "completed",
        subtotal: fixed(totals.subtotal),
        discountTotal: fixed(totals.discountTotal),
        taxTotal: fixed(totals.taxTotal),
        serviceChargeTotal: fixed(totals.serviceChargeTotal),
        donationTotal: fixed(totals.donationTotal),
        roundingTotal: fixed(totals.roundingTotal),
        cashTenderedTotal: isFinalSale ? fixed(cashTenderedTotal) : "0.00",
        changeTotal: isFinalSale ? fixed(changeTotal) : "0.00",
        grandTotal: fixed(grandTotal),
        cogsTotal: fixed(totals.cogsTotal),
        source: input.source,
        clientCreatedAt: input.clientCreatedAt ? new Date(input.clientCreatedAt) : undefined,
        syncedAt: new Date(),
      });

    for (const promo of totals.appliedPromotions) {
      await promotionRepository.createSalePromotion(tx, {
        saleId: createdSale.id,
        promotionId: promo.promotionId,
        codeSnapshot: promo.code,
        nameSnapshot: promo.name,
        typeSnapshot: promo.type,
        discountTotal: fixed(promo.discountTotal),
      });
      if (isFinalSale && promo.promotionId) {
        await promotionRepository.incrementRedemption(tx, promo.promotionId);
      }
    }

    for (const item of preparedItems) {
      await salesRepository.createSaleItem(tx, {
        saleId: createdSale.id,
        skuId: item.sku.id,
        nameSnapshot: item.sku.name,
        quantityInput: fixed(item.quantityInput, 3),
        unitId: item.inputUnitId,
        quantityBase: fixed(item.quantityBase, 3),
        unitPrice: fixed(item.unitPrice),
        discountTotal: fixed(item.discountTotal),
        lineTotal: fixed(item.lineTotal),
        cogsTotal: fixed(item.cogsTotal),
      });

      if (!hasStockConflict) {
        const decremented = await salesRepository.decrementBalance(tx, input.outletId, item.sku.id, item.quantityBase);
        if (!decremented.length) {
          throw new ApiError("CONFLICT", `Stok tersedia ${item.sku.name} tidak cukup atau sedang berubah. Muat ulang data stok.`, 409);
        }

        await salesRepository.createStockMovement(tx, {
          organizationId: actor.organizationId,
          outletId: input.outletId,
          skuId: item.sku.id,
          type: "sale",
          quantityBase: fixed(-item.quantityBase, 3),
          unitId: item.inputUnitId,
          quantityInput: fixed(item.quantityInput, 3),
          referenceType: "sale",
          referenceId: createdSale.id,
          actorUserId: actor.id,
          note: "POS sale",
        });
      }
    }

    if (isFinalSale) {
      for (const item of normalizedPayments) {
        await salesRepository.createPayment(tx, {
          saleId: createdSale.id,
          method: item.method,
          amount: fixed(item.amount),
          reference: item.reference,
        });
      }
    }

    if (isFinalSale && cashAppliedTotal > 0) {
      await salesRepository.incrementShiftCash(tx, activeShiftId, cashAppliedTotal);
    }

    if (isFinalSale && input.customerId) {
      const loyaltyPoints = Math.max(0, Math.floor(grandTotal / 10000));
      await customerRepository.incrementCustomerStats(tx, input.customerId, grandTotal, loyaltyPoints);
    }

    if (isFinalSale && receivableTotal > 0 && input.customerId) {
      await customerRepository.createReceivable(tx, {
        organizationId: actor.organizationId,
        outletId: input.outletId,
        customerId: input.customerId,
        saleId: createdSale.id,
        status: "open",
        amount: fixed(receivableTotal),
        paidTotal: "0.00",
        dueDate: input.receivableDueDate ? new Date(input.receivableDueDate) : undefined,
        note: input.receivableNote,
      });
    }

    if (isFinalSale) {
      await financeRepository.postSale(tx, {
        organizationId: actor.organizationId,
        outletId: input.outletId,
        saleId: createdSale.id,
        receiptNumber: createdSale.receiptNumber,
        actorUserId: actor.id,
        subtotal: totals.subtotal,
        discountTotal: totals.discountTotal,
        taxTotal: totals.taxTotal,
        serviceChargeTotal: totals.serviceChargeTotal,
        donationTotal: totals.donationTotal,
        roundingTotal: totals.roundingTotal,
        cogsTotal: totals.cogsTotal,
        receivableTotal,
        payments: normalizedPayments,
        taxIncluded: totals.posSettings.taxIncluded,
      });
    }

    await salesRepository.createAuditLog(tx, {
      organizationId: actor.organizationId,
      outletId: input.outletId,
      actorUserId: actor.id,
      action: "sale.create",
      entityType: "sale",
      entityId: createdSale.id,
      after: {
        idempotencyKey: input.idempotencyKey,
        grandTotal,
        discountTotal: totals.discountTotal,
        taxTotal: totals.taxTotal,
        serviceChargeTotal: totals.serviceChargeTotal,
        donationTotal: totals.donationTotal,
        roundingTotal: totals.roundingTotal,
        appliedPromotions: totals.appliedPromotions,
        customerId: input.customerId,
        receivableTotal,
        hasStockConflict,
      },
      ipAddress: request?.headers.get("x-forwarded-for") ?? request?.headers.get("cf-connecting-ip"),
      userAgent: request?.headers.get("user-agent"),
    });

    return { sale: createdSale, idempotent: false };
  });
}

async function prepareSaleItems(
  tx: SalesTx,
  actor: Actor,
  outletId: string,
  items: Array<CreateSaleInput["items"][number]>,
  checkStock: boolean,
) {
  const preparedItems: PreparedSaleItem[] = [];
  let subtotal = 0;
  let cogsTotal = 0;
  let hasStockConflict = false;

  for (const item of items) {
    const [targetSku] = await salesRepository.findActiveSkuWithProduct(tx, item.skuId, actor.organizationId);

    if (!targetSku) {
      throw new ApiError("NOT_FOUND", `SKU ${item.skuId} not found`, 404);
    }

    const inputUnitId = item.unitId ?? targetSku.saleUnitId;
    const configuredSaleUnitFactor = decimal(targetSku.saleUnitToBaseFactor);
    const saleUnitFactor = configuredSaleUnitFactor > 0 ? configuredSaleUnitFactor : 1;
    const isSaleUnit = inputUnitId === targetSku.saleUnitId;
    const isBaseUnit = inputUnitId === targetSku.baseUnitId;
    if (!isSaleUnit && !isBaseUnit) {
      throw new ApiError(
        "BAD_REQUEST",
        `Satuan transaksi ${targetSku.name} tidak sesuai. Gunakan satuan jual atau satuan dasar produk.`,
        400,
      );
    }

    const factor = isBaseUnit ? 1 : saleUnitFactor;
    const quantityBase = baseQty(item.quantity, factor);
    const defaultUnitPrice = isBaseUnit ? decimal(targetSku.price) / saleUnitFactor : decimal(targetSku.price);
    const unitPrice = item.unitPrice ?? defaultUnitPrice;
    const discountTotal = item.discountTotal ?? 0;
    const grossLineTotal = item.quantity * unitPrice;
    if (discountTotal > grossLineTotal) {
      throw new ApiError("BAD_REQUEST", `Diskon item ${targetSku.name} melebihi nilai item`, 400);
    }
    const lineTotal = grossLineTotal - discountTotal;
    const itemCogsTotal = quantityBase * decimal(targetSku.cost);

    if (checkStock) {
      const [balance] = await salesRepository.findBalance(tx, outletId, targetSku.id);
      const availableQty =
        decimal(balance?.onHandBaseQty ?? "0") -
        decimal(balance?.reservedBaseQty ?? "0") -
        decimal(balance?.holdBaseQty ?? "0");
      if (availableQty < quantityBase) {
        hasStockConflict = true;
      }
    }

    subtotal += lineTotal;
    cogsTotal += itemCogsTotal;
    preparedItems.push({
      sku: targetSku,
      inputUnitId,
      quantityInput: item.quantity,
      quantityBase,
      unitPrice,
      discountTotal,
      lineTotal,
      cogsTotal: itemCogsTotal,
    });
  }

  return { preparedItems, subtotal, cogsTotal, hasStockConflict };
}

async function calculateSaleTotals(
  tx: SalesTx,
  organizationId: string,
  outletId: string,
  preparedItems: PreparedSaleItem[],
  input: {
    subtotal: number;
    cogsTotal: number;
    manualDiscountTotal: number;
    taxTotal: number;
    serviceChargeTotal: number;
    donationTotal: number;
    promotionCodes: string[];
  },
) {
  if (input.manualDiscountTotal > input.subtotal) {
    throw new ApiError("BAD_REQUEST", "Diskon transaksi melebihi subtotal", 400);
  }

  const settings = await loadPosSettings(tx, organizationId);
  const promotionCodes = normalizeCodes(input.promotionCodes);
  const promotions = await promotionRepository.findActiveForSale(tx, organizationId, promotionCodes);
  const appliedPromotions = [];
  const promotionIssues: PromotionIssue[] = [];
  let promotionDiscountTotal = 0;
  let remainingDiscountable = Math.max(0, input.subtotal - input.manualDiscountTotal);

  for (const promo of promotions) {
    const promoCode = promo.code?.trim().toUpperCase() ?? "";
    if (promoCode && !promotionCodes.includes(promoCode)) continue;
    if (!promotionOutletMatches(promo.outletIds, outletId)) continue;
    if (decimal(promo.minSubtotal) > input.subtotal) continue;

    const discount = Math.min(
      remainingDiscountable,
      promotionDiscount(preparedItems, {
        type: promo.type,
        discountType: promo.discountType,
        discountValue: decimal(promo.discountValue),
        scope: promo.scope,
        targetSkuId: promo.targetSkuId,
        targetCategory: promo.targetCategory,
        buyQty: decimal(promo.buyQty),
        getQty: decimal(promo.getQty),
      }),
    );
    if (discount <= 0) continue;

    promotionDiscountTotal += discount;
    remainingDiscountable -= discount;
    appliedPromotions.push({
      promotionId: promo.id,
      code: promo.code,
      name: promo.name,
      type: promo.type,
      discountTotal: roundMoney(discount),
    });
    if (remainingDiscountable <= 0) break;
  }

  const appliedCodes = new Set(
    appliedPromotions
      .map((promo) => promo.code?.trim().toUpperCase())
      .filter((code): code is string => Boolean(code)),
  );
  for (const code of promotionCodes) {
    if (appliedCodes.has(code)) continue;
    promotionIssues.push(await describePromotionIssue(tx, organizationId, outletId, preparedItems, input.subtotal, code));
  }

  const discountTotal = roundMoney(input.manualDiscountTotal + promotionDiscountTotal);
  const baseAfterDiscount = Math.max(0, input.subtotal - discountTotal);
  const serviceChargeTotal = settings.serviceChargeEnabled
    ? roundMoney(baseAfterDiscount * (settings.serviceChargeRatePercent / 100))
    : input.serviceChargeTotal;
  const taxBase = baseAfterDiscount + serviceChargeTotal;
  const taxTotal = settings.taxEnabled
    ? roundMoney(
        settings.taxIncluded
          ? taxBase - taxBase / (1 + settings.taxRatePercent / 100)
          : taxBase * (settings.taxRatePercent / 100),
      )
    : input.taxTotal;
  const donationTotal = roundMoney(input.donationTotal);
  const totalBeforeRounding = roundMoney(baseAfterDiscount + serviceChargeTotal + (settings.taxIncluded ? 0 : taxTotal) + donationTotal);
  const grandTotal = roundToCashHundred(totalBeforeRounding);
  const roundingTotal = roundMoney(grandTotal - totalBeforeRounding);

  return {
    subtotal: roundMoney(input.subtotal),
    cogsTotal: roundMoney(input.cogsTotal),
    manualDiscountTotal: roundMoney(input.manualDiscountTotal),
    promotionDiscountTotal: roundMoney(promotionDiscountTotal),
    discountTotal,
    taxTotal: roundMoney(taxTotal),
    serviceChargeTotal: roundMoney(serviceChargeTotal),
    donationTotal,
    roundingTotal,
    grandTotal,
    appliedPromotions,
    promotionIssues,
    posSettings: settings,
  };
}

async function loadPosSettings(tx: SalesTx, organizationId: string): Promise<PosSettings> {
  const [row] = await promotionRepository.findPosSettings(tx, organizationId);
  const raw = row?.posSettings;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return defaultPosSettings;
  }
  const value = raw as Partial<Record<keyof PosSettings, unknown>>;
  return {
    taxEnabled: value.taxEnabled === true,
    taxRatePercent: clampPercent(Number(value.taxRatePercent ?? 0)),
    taxIncluded: value.taxIncluded === true,
    serviceChargeEnabled: value.serviceChargeEnabled === true,
    serviceChargeRatePercent: clampPercent(Number(value.serviceChargeRatePercent ?? 0)),
  };
}

function promotionDiscount(
  items: PreparedSaleItem[],
  promo: {
    type: string;
    discountType: string;
    discountValue: number;
    scope: string;
    targetSkuId: string | null;
    targetCategory: string | null;
    buyQty: number;
    getQty: number;
  },
) {
  const eligibleItems = items.filter((item) => promotionItemMatches(item, promo));
  const eligibleTotal = eligibleItems.reduce((sum, item) => sum + item.lineTotal, 0);

  if (promo.type === "buy_x_get_y") {
    return eligibleItems.reduce((sum, item) => {
      const cycleQty = promo.buyQty + promo.getQty;
      if (cycleQty <= 0) return sum;
      const freeQty = Math.floor(item.quantityInput / cycleQty) * promo.getQty;
      return sum + Math.min(item.lineTotal, freeQty * item.unitPrice);
    }, 0);
  }

  if (promo.type === "item_discount") {
    return promo.discountType === "percent"
      ? eligibleTotal * (promo.discountValue / 100)
      : Math.min(eligibleTotal, promo.discountValue);
  }

  const transactionBase = items.reduce((sum, item) => sum + item.lineTotal, 0);
  return promo.discountType === "percent"
    ? transactionBase * (promo.discountValue / 100)
    : Math.min(transactionBase, promo.discountValue);
}

function promotionItemMatches(
  item: PreparedSaleItem,
  promo: { scope: string; targetSkuId: string | null; targetCategory: string | null },
) {
  if (promo.scope === "sku") return item.sku.id === promo.targetSkuId;
  if (promo.scope === "category") return (item.sku.productCategory ?? "") === (promo.targetCategory ?? "");
  return true;
}

function promotionOutletMatches(rawOutletIds: unknown, outletId: string) {
  if (!Array.isArray(rawOutletIds) || rawOutletIds.length === 0) return true;
  return rawOutletIds.includes(outletId);
}

async function describePromotionIssue(
  tx: SalesTx,
  organizationId: string,
  outletId: string,
  preparedItems: PreparedSaleItem[],
  subtotal: number,
  code: string,
): Promise<PromotionIssue> {
  const [promo] = await promotionRepository.findByCode(tx, organizationId, code);
  if (!promo) {
    return { code, reason: "not_found", message: `Kode promo ${code} tidak ditemukan.` };
  }

  const now = new Date();
  if (!promo.isActive) {
    return { code, reason: "inactive", message: `Promo ${promo.name} sedang nonaktif.` };
  }
  if (promo.startsAt && promo.startsAt > now) {
    return { code, reason: "not_started", message: `Promo ${promo.name} belum mulai.` };
  }
  if (promo.endsAt && promo.endsAt < now) {
    return { code, reason: "expired", message: `Promo ${promo.name} sudah berakhir.` };
  }
  if (promo.maxRedemptions !== null && promo.redeemedCount >= promo.maxRedemptions) {
    return { code, reason: "quota_exceeded", message: `Kuota promo ${promo.name} sudah habis.` };
  }
  if (!promotionOutletMatches(promo.outletIds, outletId)) {
    return { code, reason: "outlet_mismatch", message: `Promo ${promo.name} tidak berlaku untuk outlet ini.` };
  }
  const minSubtotal = decimal(promo.minSubtotal);
  if (minSubtotal > subtotal) {
    return {
      code,
      reason: "minimum_subtotal",
      message: `Promo ${promo.name} minimal subtotal Rp ${fixed(minSubtotal)}.`,
    };
  }
  const discount = promotionDiscount(preparedItems, {
    type: promo.type,
    discountType: promo.discountType,
    discountValue: decimal(promo.discountValue),
    scope: promo.scope,
    targetSkuId: promo.targetSkuId,
    targetCategory: promo.targetCategory,
    buyQty: decimal(promo.buyQty),
    getQty: decimal(promo.getQty),
  });
  if (discount <= 0) {
    return {
      code,
      reason: "condition_not_met",
      message: `Syarat produk atau qty untuk promo ${promo.name} belum terpenuhi.`,
    };
  }
  return { code, reason: "not_applied", message: `Promo ${promo.name} belum bisa digunakan pada transaksi ini.` };
}

function normalizeCodes(codes: string[]) {
  return Array.from(new Set(codes.map((code) => code.trim().toUpperCase()).filter(Boolean)));
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

function roundMoney(value: number) {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

function roundToCashHundred(value: number) {
  const amount = roundMoney(value);
  if (amount <= 0) return 0;
  return Math.ceil(amount / 100) * 100;
}

export async function voidSale(actor: Actor, saleId: string, input: VoidSaleInput, request?: Request) {
  return reverseCompletedSale({
    actor,
    saleId,
    reason: input.reason,
    nextStatus: "voided",
    action: "sale.void",
    policyField: "voidWindowHours",
    restock: true,
    cashReversalMode: "original_cash",
    request,
  });
}

export async function refundSale(actor: Actor, saleId: string, input: RefundSaleInput, request?: Request) {
  return reverseCompletedSale({
    actor,
    saleId,
    reason: input.reason,
    nextStatus: "refunded",
    action: "sale.refund",
    policyField: "refundWindowHours",
    restock: input.restock,
    cashReversalMode: input.refundMethod === "cash" ? "grand_total_cash" : input.refundMethod ? "none" : "original_cash",
    refundMethod: input.refundMethod,
    request,
  });
}

async function reverseCompletedSale(input: {
  actor: Actor;
  saleId: string;
  reason: string;
  nextStatus: "voided" | "refunded";
  action: "sale.void" | "sale.refund";
  policyField: "voidWindowHours" | "refundWindowHours";
  restock: boolean;
  cashReversalMode: "original_cash" | "grand_total_cash" | "none";
  refundMethod?: string;
  request?: Request;
}) {
  return salesRepository.transaction(async (tx) => {
    const [targetSale] = await salesRepository.findSaleByIdTx(tx, input.saleId, input.actor.organizationId);

    if (!targetSale) {
      throw new ApiError("NOT_FOUND", "Transaksi tidak ditemukan", 404);
    }

    if (targetSale.status !== "completed") {
      throw new ApiError("CONFLICT", "Hanya transaksi selesai yang bisa dibatalkan atau dikembalikan dananya", 409);
    }

    const items = await salesRepository.findSaleItemsTx(tx, targetSale.id);
    const policyItems = await salesRepository.findSaleItemsWithProductPolicyTx(tx, targetSale.id);
    enforceCorrectionWindow(targetSale.createdAt, policyItems, input.policyField);
    const payments = await salesRepository.findSalePaymentsTx(tx, targetSale.id);
    const originalCashTotal = payments
      .filter((payment) => payment.method === "cash")
      .reduce((sum, payment) => sum + decimal(payment.amount), 0);
    const cashReversal =
      input.cashReversalMode === "grand_total_cash"
        ? decimal(targetSale.grandTotal)
        : input.cashReversalMode === "original_cash"
          ? originalCashTotal
          : 0;

    if (cashReversal > 0) {
      if (!targetSale.shiftId) {
        throw new ApiError("CONFLICT", "Koreksi tunai membutuhkan shift asal transaksi", 409);
      }

      const [targetShift] = await salesRepository.findShift(tx, targetSale.shiftId);
      if (!targetShift || targetShift.status !== "open") {
        throw new ApiError(
          "CONFLICT",
          "Transaksi tunai hanya bisa dibatalkan atau dikembalikan dananya saat shift asal masih terbuka",
          409,
        );
      }

      await salesRepository.decrementShiftCash(tx, targetSale.shiftId, cashReversal);
    }

    if (input.restock) {
      for (const item of items) {
        const quantityBase = decimal(item.quantityBase);
        await salesRepository.incrementBalance(tx, targetSale.outletId, item.skuId, quantityBase);
        await salesRepository.createStockMovement(tx, {
          organizationId: input.actor.organizationId,
          outletId: targetSale.outletId,
          skuId: item.skuId,
          type: "refund",
          quantityBase: fixed(quantityBase, 3),
          unitId: item.unitId,
          quantityInput: item.quantityInput,
          referenceType: input.action,
          referenceId: targetSale.id,
          actorUserId: input.actor.id,
          note: input.reason,
        });
      }
    }

    const originalSettlementPayments = aggregatePaymentsByMethod(
      payments.map((payment) => ({
        method: payment.method,
        amount: decimal(payment.amount),
      })),
    );
    const originalPaidTotal = originalSettlementPayments.reduce((sum, payment) => sum + payment.amount, 0);
    const originalReceivableTotal = Math.max(0, decimal(targetSale.grandTotal) - originalPaidTotal);
    const reversalSettlementPayments = input.refundMethod
      ? [{ method: input.refundMethod as PaymentMethod, amount: decimal(targetSale.grandTotal) }]
      : originalSettlementPayments;

    await financeRepository.postSaleReversal(tx, {
      organizationId: input.actor.organizationId,
      outletId: targetSale.outletId,
      saleId: targetSale.id,
      receiptNumber: targetSale.receiptNumber,
      actorUserId: input.actor.id,
      correctionType: input.nextStatus === "voided" ? "void" : "refund",
      subtotal: decimal(targetSale.subtotal),
      discountTotal: decimal(targetSale.discountTotal),
      taxTotal: decimal(targetSale.taxTotal),
      serviceChargeTotal: decimal(targetSale.serviceChargeTotal),
      donationTotal: decimal(targetSale.donationTotal),
      roundingTotal: decimal(targetSale.roundingTotal),
      cogsTotal: decimal(targetSale.cogsTotal),
      receivableTotal: input.refundMethod ? 0 : originalReceivableTotal,
      settlementPayments: reversalSettlementPayments,
      restock: input.restock,
      taxIncluded: inferSaleTaxIncluded(targetSale),
    });

    const [updatedSale] = await salesRepository.updateSale(tx, targetSale.id, {
      status: input.nextStatus,
      updatedAt: new Date(),
    });

    await salesRepository.createAuditLog(tx, {
      organizationId: input.actor.organizationId,
      outletId: targetSale.outletId,
      actorUserId: input.actor.id,
      action: input.action,
      entityType: "sale",
      entityId: targetSale.id,
      before: {
        status: targetSale.status,
      },
      after: {
        status: updatedSale.status,
        reason: input.reason,
        restock: input.restock,
        refundMethod: input.refundMethod,
        cashReversal,
      },
      ipAddress: input.request?.headers.get("x-forwarded-for") ?? input.request?.headers.get("cf-connecting-ip"),
      userAgent: input.request?.headers.get("user-agent"),
    });

    return { sale: updatedSale, items, payments, cashReversal, restocked: input.restock };
  });
}

function aggregatePaymentsByMethod(payments: Array<{ method: PaymentMethod; amount: number }>) {
  const amountByMethod = new Map<PaymentMethod, number>();
  for (const payment of payments) {
    amountByMethod.set(payment.method, (amountByMethod.get(payment.method) ?? 0) + payment.amount);
  }
  return [...amountByMethod.entries()]
    .map(([method, amount]) => ({ method, amount: roundMoney(amount) }))
    .filter((payment) => payment.amount > 0);
}

function inferSaleTaxIncluded(sale: {
  subtotal: string;
  discountTotal: string;
  taxTotal: string;
  serviceChargeTotal: string;
  donationTotal: string;
  roundingTotal: string;
  grandTotal: string;
}) {
  const taxTotal = decimal(sale.taxTotal);
  if (taxTotal <= 0) return false;
  const includedGrandTotal = roundMoney(
    decimal(sale.subtotal) -
      decimal(sale.discountTotal) +
      decimal(sale.serviceChargeTotal) +
      decimal(sale.donationTotal) +
      decimal(sale.roundingTotal),
  );
  return Math.abs(decimal(sale.grandTotal) - includedGrandTotal) < 0.01;
}

function enforceCorrectionWindow(
  saleCreatedAt: Date,
  items: Array<{
    nameSnapshot: string;
    productName: string;
    voidWindowHours: number | null;
    refundWindowHours: number | null;
  }>,
  policyField: "voidWindowHours" | "refundWindowHours",
) {
  const now = Date.now();
  const saleAgeHours = (now - saleCreatedAt.getTime()) / (1000 * 60 * 60);

  for (const item of items) {
    const windowHours = item[policyField];
    if (windowHours === null) continue;

    const actionLabel = policyField === "voidWindowHours" ? "pembatalan transaksi" : "pengembalian dana";
    if (windowHours <= 0) {
      throw new ApiError(
        "CONFLICT",
        `${actionLabel} dinonaktifkan untuk produk ${item.productName || item.nameSnapshot}`,
        409,
      );
    }

    if (saleAgeHours > windowHours) {
      throw new ApiError(
        "CONFLICT",
        `Batas waktu ${actionLabel} untuk produk ${item.productName || item.nameSnapshot} adalah ${windowHours} jam`,
        409,
      );
    }
  }
}
