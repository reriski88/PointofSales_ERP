import { z } from "zod";
import { financeRepository } from "@/backend/repositories/finance-repository";
import { purchaseRepository } from "@/backend/repositories/purchase-repository";
import { ApiError } from "@/lib/http";
import { decimal, fixed } from "@/lib/number";
import { requireOutletAccess, type Actor } from "@/lib/rbac";
import {
  cancelPurchaseOrderSchema,
  createPurchaseOrderSchema,
  createPurchasePaymentSchema,
  receivePurchaseOrderSchema,
} from "@/lib/validation";

type CreatePurchaseOrderInput = z.infer<typeof createPurchaseOrderSchema>;
type ReceivePurchaseOrderInput = z.infer<typeof receivePurchaseOrderSchema>;
type CreatePurchasePaymentInput = z.infer<typeof createPurchasePaymentSchema>;
type CancelPurchaseOrderInput = z.infer<typeof cancelPurchaseOrderSchema>;

function makePurchaseOrderNumber() {
  const now = new Date();
  const stamp = now.toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  return `PO-${stamp}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

export async function createPurchaseOrder(actor: Actor, input: CreatePurchaseOrderInput, request?: Request) {
  return purchaseRepository.transaction(async (tx) => {
    const [targetOutlet] = await purchaseRepository.findActiveOutlet(tx, input.outletId, actor.organizationId);
    if (!targetOutlet) {
      throw new ApiError("NOT_FOUND", "Outlet tidak ditemukan", 404);
    }

    const [targetSupplier] = await purchaseRepository.findSupplier(tx, input.supplierId, actor.organizationId);
    if (!targetSupplier || !targetSupplier.isActive) {
      throw new ApiError("NOT_FOUND", "Supplier tidak ditemukan atau nonaktif", 404);
    }

    const preparedItems = [];
    let subtotal = 0;
    for (const item of input.items) {
      const [targetSku] = await purchaseRepository.findActiveSku(tx, item.skuId, actor.organizationId, input.outletId);
      if (!targetSku) {
        throw new ApiError("NOT_FOUND", `SKU ${item.skuId} tidak ditemukan`, 404);
      }
      if (!targetSku.trackInventory) {
        throw new ApiError("BAD_REQUEST", `Produk non-stok ${targetSku.name} tidak bisa masuk pembelian stok`, 400);
      }
      const lineTotal = item.quantityBase * item.unitCost;
      subtotal += lineTotal;
      preparedItems.push({
        sku: targetSku,
        quantityBase: item.quantityBase,
        unitCost: item.unitCost,
        lineTotal,
        lotCode: item.lotCode,
        expiryDate: item.expiryDate,
      });
    }

    const [purchase] = await purchaseRepository.createPurchaseOrder(tx, {
      organizationId: actor.organizationId,
      outletId: input.outletId,
      supplierId: input.supplierId,
      orderNumber: input.orderNumber ?? makePurchaseOrderNumber(),
      status: "ordered",
      paymentStatus: "unpaid",
      subtotal: fixed(subtotal),
      paidTotal: "0.00",
      note: input.note,
      createdByUserId: actor.id,
    });

    const items = [];
    for (const item of preparedItems) {
      const [createdItem] = await purchaseRepository.createPurchaseOrderItem(tx, {
        purchaseOrderId: purchase.id,
        skuId: item.sku.id,
        nameSnapshot: item.sku.name,
        quantityBase: fixed(item.quantityBase, 3),
        unitId: item.sku.baseUnitId,
        unitCost: fixed(item.unitCost, 6),
        lineTotal: fixed(item.lineTotal),
        lotCode: item.lotCode,
        expiryDate: item.expiryDate,
      });
      items.push(createdItem);
    }

    await purchaseRepository.createAuditLog(tx, {
      organizationId: actor.organizationId,
      outletId: input.outletId,
      actorUserId: actor.id,
      action: "purchase.create",
      entityType: "purchase_order",
      entityId: purchase.id,
      after: { purchase, items },
      ipAddress: request?.headers.get("x-forwarded-for") ?? request?.headers.get("cf-connecting-ip"),
      userAgent: request?.headers.get("user-agent"),
    });

    return { purchase, items };
  });
}

export async function getPurchaseOrderDetail(actor: Actor, purchaseOrderId: string) {
  return purchaseRepository.transaction(async (tx) => {
    const [purchase] = await purchaseRepository.findPurchaseOrderDetail(tx, purchaseOrderId, actor.organizationId);
    if (!purchase) {
      throw new ApiError("NOT_FOUND", "Pesanan pembelian tidak ditemukan", 404);
    }
    await requireOutletAccess(actor, purchase.outletId);
    const [items, payments] = await Promise.all([
      purchaseRepository.findPurchaseOrderItems(tx, purchase.id),
      purchaseRepository.findPurchasePayments(tx, purchase.id),
    ]);
    return { purchase, items, payments };
  });
}

export async function receivePurchaseOrder(
  actor: Actor,
  purchaseOrderId: string,
  input: ReceivePurchaseOrderInput,
  request?: Request,
) {
  return purchaseRepository.transaction(async (tx) => {
    const [purchase] = await purchaseRepository.findPurchaseOrder(tx, purchaseOrderId, actor.organizationId);
    if (!purchase) {
      throw new ApiError("NOT_FOUND", "Pesanan pembelian tidak ditemukan", 404);
    }
    if (purchase.status !== "ordered") {
      throw new ApiError("CONFLICT", "Hanya pesanan berstatus dipesan yang bisa diterima", 409);
    }
    await requireOutletAccess(actor, purchase.outletId);

    const items = await purchaseRepository.findPurchaseOrderItems(tx, purchase.id);
    for (const item of items) {
      const quantityBase = decimal(item.quantityBase);
      await purchaseRepository.incrementBalance(tx, purchase.outletId, item.skuId, quantityBase);
      await purchaseRepository.updateSkuCost(tx, item.skuId, decimal(item.unitCost));
      const [batch] = await purchaseRepository.createInventoryBatch(tx, {
        organizationId: actor.organizationId,
        outletId: purchase.outletId,
        skuId: item.skuId,
        lotCode: item.lotCode?.trim() || purchase.orderNumber,
        expiryDate: item.expiryDate,
        initialBaseQty: fixed(quantityBase, 3),
        onHandBaseQty: fixed(quantityBase, 3),
        unitCost: fixed(decimal(item.unitCost), 6),
        sourceType: "purchase_order",
        sourceId: purchase.id,
        sourceItemId: item.id,
        note: input.note ?? `Terima barang ${purchase.orderNumber}`,
      });
      await purchaseRepository.updatePurchaseOrderItem(tx, item.id, {
        receivedBaseQty: fixed(quantityBase, 3),
        updatedAt: new Date(),
      });
      await purchaseRepository.createStockMovement(tx, {
        organizationId: actor.organizationId,
        outletId: purchase.outletId,
        skuId: item.skuId,
        batchId: batch.id,
        type: "purchase",
        quantityBase: fixed(quantityBase, 3),
        unitId: item.unitId,
        quantityInput: fixed(quantityBase, 3),
        referenceType: "purchase_order",
        referenceId: purchase.id,
        actorUserId: actor.id,
        note: input.note ?? `Terima barang ${purchase.orderNumber}`,
      });
    }

    const [updatedPurchase] = await purchaseRepository.updatePurchaseOrder(tx, purchase.id, {
      status: "received",
      receivedAt: new Date(),
      note: input.note ?? purchase.note,
      updatedAt: new Date(),
    });

    await financeRepository.postPurchaseReceipt(tx, {
      organizationId: actor.organizationId,
      outletId: purchase.outletId,
      purchaseOrderId: purchase.id,
      orderNumber: purchase.orderNumber,
      subtotal: decimal(purchase.subtotal),
      actorUserId: actor.id,
    });
    await financeRepository.postPurchaseAdvanceSettlement(tx, {
      organizationId: actor.organizationId,
      outletId: purchase.outletId,
      purchaseOrderId: purchase.id,
      orderNumber: purchase.orderNumber,
      amount: Math.min(decimal(purchase.paidTotal), decimal(purchase.subtotal)),
      actorUserId: actor.id,
    });

    await purchaseRepository.createAuditLog(tx, {
      organizationId: actor.organizationId,
      outletId: purchase.outletId,
      actorUserId: actor.id,
      action: "purchase.receive",
      entityType: "purchase_order",
      entityId: purchase.id,
      before: purchase,
      after: { purchase: updatedPurchase, items },
      ipAddress: request?.headers.get("x-forwarded-for") ?? request?.headers.get("cf-connecting-ip"),
      userAgent: request?.headers.get("user-agent"),
    });

    return { purchase: updatedPurchase, items };
  });
}

export async function cancelPurchaseOrder(
  actor: Actor,
  purchaseOrderId: string,
  input: CancelPurchaseOrderInput,
  request?: Request,
) {
  return purchaseRepository.transaction(async (tx) => {
    const [purchase] = await purchaseRepository.findPurchaseOrder(tx, purchaseOrderId, actor.organizationId);
    if (!purchase) {
      throw new ApiError("NOT_FOUND", "Pesanan pembelian tidak ditemukan", 404);
    }
    if (purchase.status !== "ordered") {
      throw new ApiError("CONFLICT", "Hanya pesanan berstatus dipesan yang bisa dibatalkan", 409);
    }
    await requireOutletAccess(actor, purchase.outletId);

    const payments = await purchaseRepository.findPurchasePayments(tx, purchase.id);
    if (payments.length || decimal(purchase.paidTotal) > 0) {
      throw new ApiError("CONFLICT", "Pesanan pembelian yang sudah dibayar tidak bisa dibatalkan", 409);
    }

    const cancellationNote = `Dibatalkan: ${input.reason}`;
    const [updatedPurchase] = await purchaseRepository.updatePurchaseOrder(tx, purchase.id, {
      status: "cancelled",
      cancelledAt: new Date(),
      note: purchase.note ? `${purchase.note}\n${cancellationNote}` : cancellationNote,
      updatedAt: new Date(),
    });

    await purchaseRepository.createAuditLog(tx, {
      organizationId: actor.organizationId,
      outletId: purchase.outletId,
      actorUserId: actor.id,
      action: "purchase.cancel",
      entityType: "purchase_order",
      entityId: purchase.id,
      before: purchase,
      after: { purchase: updatedPurchase, reason: input.reason },
      ipAddress: request?.headers.get("x-forwarded-for") ?? request?.headers.get("cf-connecting-ip"),
      userAgent: request?.headers.get("user-agent"),
    });

    return { purchase: updatedPurchase };
  });
}

export async function createPurchasePayment(
  actor: Actor,
  purchaseOrderId: string,
  input: CreatePurchasePaymentInput,
  request?: Request,
) {
  return purchaseRepository.transaction(async (tx) => {
    const [purchase] = await purchaseRepository.findPurchaseOrder(tx, purchaseOrderId, actor.organizationId);
    if (!purchase) {
      throw new ApiError("NOT_FOUND", "Pesanan pembelian tidak ditemukan", 404);
    }
    if (purchase.status === "cancelled") {
      throw new ApiError("CONFLICT", "Pesanan pembelian yang dibatalkan tidak bisa dibayar", 409);
    }
    await requireOutletAccess(actor, purchase.outletId);

    const nextPaidTotal = decimal(purchase.paidTotal) + input.amount;
    const subtotal = decimal(purchase.subtotal);
    if (nextPaidTotal > subtotal + 0.000001) {
      throw new ApiError("BAD_REQUEST", "Jumlah pembayaran melebihi total pembelian", 400);
    }

    const paymentStatus = nextPaidTotal >= subtotal ? "paid" : "partial";
    const [payment] = await purchaseRepository.createPurchasePayment(tx, {
      purchaseOrderId: purchase.id,
      method: input.method,
      amount: fixed(input.amount),
      reference: input.reference,
      note: input.note,
      actorUserId: actor.id,
    });
    const [updatedPurchase] = await purchaseRepository.updatePurchaseOrder(tx, purchase.id, {
      paidTotal: fixed(nextPaidTotal),
      paymentStatus,
      updatedAt: new Date(),
    });

    await financeRepository.postPurchasePayment(tx, {
      organizationId: actor.organizationId,
      outletId: purchase.outletId,
      purchaseOrderId: purchase.id,
      paymentId: payment.id,
      orderNumber: purchase.orderNumber,
      method: input.method,
      amount: input.amount,
      actorUserId: actor.id,
      isAdvance: purchase.status !== "received",
    });

    await purchaseRepository.createAuditLog(tx, {
      organizationId: actor.organizationId,
      outletId: purchase.outletId,
      actorUserId: actor.id,
      action: "purchase.payment",
      entityType: "purchase_order",
      entityId: purchase.id,
      before: { paidTotal: purchase.paidTotal, paymentStatus: purchase.paymentStatus },
      after: { paidTotal: updatedPurchase.paidTotal, paymentStatus: updatedPurchase.paymentStatus, payment },
      ipAddress: request?.headers.get("x-forwarded-for") ?? request?.headers.get("cf-connecting-ip"),
      userAgent: request?.headers.get("user-agent"),
    });

    return { purchase: updatedPurchase, payment };
  });
}
