import { randomUUID } from "node:crypto";
import { inventoryRepository } from "@/backend/repositories/inventory-repository";
import { writeAudit } from "@/lib/audit";
import { ApiError, created, handleRouteError, parseJson } from "@/lib/http";
import { requireActor, requireOutletAccess, requirePermission } from "@/lib/rbac";
import { publishRealtimeEvent } from "@/lib/realtime";
import { createInventoryTransferSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const actor = await requireActor(request);
    await requirePermission(actor, "inventory", "create");
    const body = await parseJson(request, createInventoryTransferSchema);
    await requireOutletAccess(actor, body.fromOutletId);
    await requireOutletAccess(actor, body.toOutletId);

    const referenceId = `TRF-${randomUUID()}`;
    const result = await inventoryRepository.transferStock({
      organizationId: actor.organizationId,
      fromOutletId: body.fromOutletId,
      toOutletId: body.toOutletId,
      skuId: body.skuId,
      targetSkuId: body.targetSkuId,
      cloneToOutlet: body.cloneToOutlet,
      quantityBase: body.quantityBase,
      note: body.note,
      actorUserId: actor.id,
      referenceId,
    });

    if (!result) {
      throw new ApiError("NOT_FOUND", "Outlet atau SKU tidak ditemukan", 404);
    }
    if ("error" in result && result.error === "INSUFFICIENT_STOCK") {
      throw new ApiError("BAD_REQUEST", "Stok outlet asal tidak mencukupi", 400);
    }
    if ("error" in result && result.error === "TARGET_SKU_MISMATCH") {
      throw new ApiError("BAD_REQUEST", "SKU tujuan bukan barang yang sama. Gunakan mode otomatis atau pilih SKU tujuan yang terhubung.", 400);
    }

    await writeAudit({
      actor,
      outletId: body.fromOutletId,
      action: "inventory.transfer",
      entityType: "stock_movement",
      entityId: referenceId,
      after: { ...body, referenceId, targetSkuId: result.targetSku.id, clonedTarget: result.clonedTarget },
      request,
    });

    publishRealtimeEvent({
      organizationId: actor.organizationId,
      outletId: body.fromOutletId,
      topics: ["inventory", "dashboard"],
      type: "inventory.transfer.out",
      payload: { referenceId, skuId: body.skuId, sourceSkuId: body.skuId, targetSkuId: result.targetSku.id, toOutletId: body.toOutletId },
    });
    publishRealtimeEvent({
      organizationId: actor.organizationId,
      outletId: body.toOutletId,
      topics: ["inventory", "dashboard"],
      type: "inventory.transfer.in",
      payload: { referenceId, skuId: result.targetSku.id, sourceSkuId: body.skuId, targetSkuId: result.targetSku.id, fromOutletId: body.fromOutletId },
    });

    return created({ referenceId, ...result });
  } catch (error) {
    return handleRouteError(error);
  }
}
