import { inventoryRepository } from "@/backend/repositories/inventory-repository";
import { writeAudit } from "@/lib/audit";
import { ApiError, created, handleRouteError, parseJson } from "@/lib/http";
import { requireActor, requireOutletAccess, requirePermission } from "@/lib/rbac";
import { publishRealtimeEvent } from "@/lib/realtime";
import { createInventoryAdjustmentSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const actor = await requireActor(request);
    await requirePermission(actor, "inventory", "create");
    const body = await parseJson(request, createInventoryAdjustmentSchema);
    await requireOutletAccess(actor, body.outletId);

    if ((body.type === "opening" || body.type === "purchase") && body.quantityBase < 0) {
      throw new ApiError("BAD_REQUEST", "Opening and purchase stock must be positive", 400);
    }

    const result = await inventoryRepository.adjustStock({
      organizationId: actor.organizationId,
      outletId: body.outletId,
      skuId: body.skuId,
      type: body.type,
      quantityBase: body.quantityBase,
      lotCode: body.lotCode,
      expiryDate: body.expiryDate,
      note: body.note,
      actorUserId: actor.id,
    });
    if (!result) {
      throw new ApiError("NOT_FOUND", "SKU not found", 404);
    }
    if ("error" in result) {
      throw new ApiError("CONFLICT", "Stok tidak cukup untuk adjustment negatif", 409);
    }

    await writeAudit({
      actor,
      outletId: body.outletId,
      action: "inventory.adjust",
      entityType: "stock_movement",
      entityId: result.id,
      after: body,
      request,
    });

    publishRealtimeEvent({
      organizationId: actor.organizationId,
      outletId: body.outletId,
      topics: ["inventory", "dashboard"],
      type: "inventory.adjusted",
      payload: {
        movementId: result.id,
        skuId: body.skuId,
        movementType: body.type,
      },
    });

    return created(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
