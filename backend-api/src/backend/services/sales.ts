import { z } from "zod";
import { ApiError } from "@/lib/http";
import { baseQty, decimal, fixed } from "@/lib/number";
import type { Actor } from "@/lib/rbac";
import { createSaleSchema } from "@/lib/validation";
import { salesRepository } from "@/backend/repositories/sales-repository";

export type CreateSaleInput = z.infer<typeof createSaleSchema>;

type CreateSaleOptions = {
  allowStockConflict?: boolean;
};

function makeReceiptNumber() {
  const now = new Date();
  const stamp = now.toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  return `POS-${stamp}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
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

    const preparedItems = [];
    let subtotal = 0;
    let cogsTotal = 0;
    let hasStockConflict = false;

    for (const item of input.items) {
      const [targetSku] = await salesRepository.findActiveSku(tx, item.skuId, actor.organizationId);

      if (!targetSku) {
        throw new ApiError("NOT_FOUND", `SKU ${item.skuId} not found`, 404);
      }

      const inputUnitId = item.unitId ?? targetSku.saleUnitId;
      if (inputUnitId !== targetSku.saleUnitId) {
        throw new ApiError("BAD_REQUEST", "Sale unit is not allowed for this SKU", 400);
      }

      const factor = decimal(targetSku.saleUnitToBaseFactor);
      const quantityBase = baseQty(item.quantity, factor);
      const unitPrice = item.unitPrice ?? decimal(targetSku.price);
      const discountTotal = item.discountTotal ?? 0;
      const lineTotal = item.quantity * unitPrice - discountTotal;
      const itemCogsTotal = quantityBase * decimal(targetSku.cost);

      const [balance] = await salesRepository.findBalance(tx, input.outletId, targetSku.id);

      const availableQty = decimal(balance?.onHandBaseQty ?? "0") - decimal(balance?.reservedBaseQty ?? "0");
      if (availableQty < quantityBase) {
        hasStockConflict = true;
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

    if (hasStockConflict && !options.allowStockConflict) {
      throw new ApiError("CONFLICT", "Insufficient stock for one or more sale items", 409);
    }

    const grandTotal = subtotal - input.discountTotal + input.taxTotal + input.serviceChargeTotal;
    const paidTotal = input.payments.reduce((sum, current) => sum + current.amount, 0);

    if (paidTotal < grandTotal) {
      throw new ApiError("BAD_REQUEST", "Payment total is lower than grand total", 400);
    }

    const [createdSale] = await salesRepository.createSale(tx, {
        organizationId: actor.organizationId,
        outletId: input.outletId,
        shiftId: activeShiftId,
        cashierUserId: actor.id,
        idempotencyKey: input.idempotencyKey,
        receiptNumber: input.receiptNumber ?? makeReceiptNumber(),
        status: hasStockConflict ? "sync_review" : "completed",
        subtotal: fixed(subtotal),
        discountTotal: fixed(input.discountTotal),
        taxTotal: fixed(input.taxTotal),
        serviceChargeTotal: fixed(input.serviceChargeTotal),
        grandTotal: fixed(grandTotal),
        cogsTotal: fixed(cogsTotal),
        source: input.source,
        clientCreatedAt: input.clientCreatedAt ? new Date(input.clientCreatedAt) : undefined,
        syncedAt: new Date(),
      });

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
        await salesRepository.decrementBalance(tx, input.outletId, item.sku.id, item.quantityBase);

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

    for (const item of input.payments) {
      await salesRepository.createPayment(tx, {
        saleId: createdSale.id,
        method: item.method,
        amount: fixed(item.amount),
        reference: item.reference,
      });
    }

    const cashTotal = input.payments
      .filter((item) => item.method === "cash")
      .reduce((sum, current) => sum + current.amount, 0);

    if (cashTotal > 0) {
      await salesRepository.incrementShiftCash(tx, activeShiftId, cashTotal);
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
        hasStockConflict,
      },
      ipAddress: request?.headers.get("x-forwarded-for") ?? request?.headers.get("cf-connecting-ip"),
      userAgent: request?.headers.get("user-agent"),
    });

    return { sale: createdSale, idempotent: false };
  });
}
