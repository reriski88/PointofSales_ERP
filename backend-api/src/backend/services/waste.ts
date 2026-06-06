import { z } from "zod";
import { ApiError } from "@/lib/http";
import { baseQty, decimal, fixed } from "@/lib/number";
import type { Actor } from "@/lib/rbac";
import { createWasteAdjustmentSchema } from "@/lib/validation";
import { wasteRepository, type WasteTransaction } from "@/backend/repositories/waste-repository";

export type CreateWasteAdjustmentInput = z.infer<
  typeof createWasteAdjustmentSchema
>;

const AUTO_POST_THRESHOLD = 25_000;

export async function createWasteAdjustment(
  actor: Actor,
  input: CreateWasteAdjustmentInput,
  request?: Request,
) {
  return wasteRepository.transaction(async (tx) => {
    if (input.idempotencyKey) {
      const [existing] = await wasteRepository.findByIdempotencyKey(tx, actor.organizationId, input.idempotencyKey);
      if (existing) return existing;
    }

    const [targetOutlet] = await wasteRepository.findActiveOutlet(tx, input.outletId, actor.organizationId);

    if (!targetOutlet) {
      throw new ApiError("NOT_FOUND", "Outlet not found", 404);
    }

    const [targetSku] = await wasteRepository.findActiveSku(tx, input.skuId, actor.organizationId, input.outletId);

    if (!targetSku) {
      throw new ApiError("NOT_FOUND", "SKU not found", 404);
    }
    if (!targetSku.trackInventory) {
      throw new ApiError("BAD_REQUEST", "Produk non-stok tidak bisa dicatat sebagai waste/remahan.", 400);
    }

    let factor = decimal(targetSku.saleUnitToBaseFactor);
    if (input.unitId === targetSku.baseUnitId) {
      factor = 1;
    } else if (input.unitId !== targetSku.saleUnitId) {
      const [inputUnit] = await wasteRepository.findUnit(tx, input.unitId, actor.organizationId);

      if (!inputUnit) {
        throw new ApiError("NOT_FOUND", "Unit not found", 404);
      }

      factor = decimal(inputUnit.toBaseFactor);
    }

    const quantityBase = baseQty(input.quantity, factor);
    const estimatedLoss = quantityBase * decimal(targetSku.cost);
    const shouldAutoPost =
      input.reason === "crumbs_unsellable" ||
      estimatedLoss < AUTO_POST_THRESHOLD;
    const status = shouldAutoPost ? "posted" : "pending";

    const [createdWaste] = await wasteRepository.createAdjustment(tx, {
        organizationId: actor.organizationId,
        outletId: input.outletId,
        skuId: input.skuId,
        quantityInput: fixed(input.quantity, 3),
        unitId: input.unitId,
        quantityBase: fixed(quantityBase, 3),
        idempotencyKey: input.idempotencyKey,
        estimatedLoss: fixed(estimatedLoss),
        reason: input.reason,
        note: input.note,
        photoUrl: input.photoUrl,
        status,
        requestedByUserId: actor.id,
        postedAt: shouldAutoPost ? new Date() : undefined,
      });

    if (shouldAutoPost) {
      await postWasteMovement(
        tx,
        actor,
        createdWaste.id,
        input.outletId,
        input.skuId,
        quantityBase,
        input.unitId,
        input.quantity,
      );
    }

    await wasteRepository.createAuditLog(tx, {
      organizationId: actor.organizationId,
      outletId: input.outletId,
      actorUserId: actor.id,
      action: "waste.create",
      entityType: "waste_adjustment",
      entityId: createdWaste.id,
      after: {
        status,
        quantityBase,
        estimatedLoss,
        reason: input.reason,
        idempotencyKey: input.idempotencyKey,
      },
      ipAddress:
        request?.headers.get("x-forwarded-for") ??
        request?.headers.get("cf-connecting-ip"),
      userAgent: request?.headers.get("user-agent"),
    });

    return createdWaste;
  });
}

export async function approveWasteAdjustment(
  actor: Actor,
  wasteId: string,
  approved: boolean,
  note?: string,
  request?: Request,
) {
  return wasteRepository.transaction(async (tx) => {
    const [targetWaste] = await wasteRepository.findAdjustment(tx, wasteId, actor.organizationId);

    if (!targetWaste) {
      throw new ApiError("NOT_FOUND", "Waste adjustment not found", 404);
    }

    if (targetWaste.status !== "pending") {
      throw new ApiError("CONFLICT", "Waste adjustment is not pending", 409);
    }

    const nextStatus = approved ? "approved" : "rejected";
    const [updatedWaste] = await wasteRepository.updateApproval(tx, wasteId, {
        status: nextStatus,
        approvedByUserId: actor.id,
        approvedAt: new Date(),
        postedAt: approved ? new Date() : undefined,
        note: note ?? targetWaste.note,
        updatedAt: new Date(),
      });

    if (approved) {
      await postWasteMovement(
        tx,
        actor,
        targetWaste.id,
        targetWaste.outletId,
        targetWaste.skuId,
        decimal(targetWaste.quantityBase),
        targetWaste.unitId,
        decimal(targetWaste.quantityInput),
      );
    }

    await wasteRepository.createAuditLog(tx, {
      organizationId: actor.organizationId,
      outletId: targetWaste.outletId,
      actorUserId: actor.id,
      action: approved ? "waste.approve" : "waste.reject",
      entityType: "waste_adjustment",
      entityId: targetWaste.id,
      before: { status: targetWaste.status },
      after: { status: nextStatus },
      note,
      ipAddress:
        request?.headers.get("x-forwarded-for") ??
        request?.headers.get("cf-connecting-ip"),
      userAgent: request?.headers.get("user-agent"),
    });

    return updatedWaste;
  });
}

async function postWasteMovement(
  tx: WasteTransaction,
  actor: Actor,
  wasteId: string,
  outletId: string,
  skuId: string,
  quantityBase: number,
  unitId: string,
  quantityInput: number,
) {
  const decremented = await wasteRepository.decrementBalance(tx, outletId, skuId, quantityBase);
  if (!decremented.length) {
    throw new ApiError("CONFLICT", "Stok tersedia tidak cukup atau sedang berubah. Muat ulang data stok.", 409);
  }

  const batchAllocations = await wasteRepository.decrementBatchesFefo(
    tx,
    actor.organizationId,
    outletId,
    skuId,
    quantityBase,
  );
  if (!batchAllocations) {
    throw new ApiError("CONFLICT", "Batch stok tidak cukup atau sedang berubah. Muat ulang data stok.", 409);
  }

  for (const allocation of batchAllocations) {
    const allocatedInputQty = quantityInput * (allocation.quantityBase / quantityBase);
    await wasteRepository.createStockMovement(tx, {
      organizationId: actor.organizationId,
      outletId,
      skuId,
      batchId: allocation.batchId ?? undefined,
      type: "waste",
      quantityBase: fixed(-allocation.quantityBase, 3),
      unitId,
      quantityInput: fixed(allocatedInputQty, 3),
      referenceType: "waste_adjustment",
      referenceId: wasteId,
      actorUserId: actor.id,
      note: "Waste/shrinkage posted",
    });
  }
}
