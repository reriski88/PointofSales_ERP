import { inventoryRepository } from "@/backend/repositories/inventory-repository";
import { writeAudit } from "@/lib/audit";
import { ApiError, handleRouteError, ok, parseJson } from "@/lib/http";
import { requireActor, requireOutletAccess, requirePermission } from "@/lib/rbac";
import { publishRealtimeEvent } from "@/lib/realtime";
import { stockOpnameActionNoteSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireActor(request);
    await requirePermission(actor, "stockOpname", "approve");
    const { id } = await params;
    const [opname] = await inventoryRepository.findStockOpname(id, actor.organizationId);
    if (!opname) {
      throw new ApiError("NOT_FOUND", "Stock opname tidak ditemukan", 404);
    }
    await requireOutletAccess(actor, opname.outletId);
    const body = await parseJson(request, stockOpnameActionNoteSchema);

    const result = await inventoryRepository.postStockOpname({
      organizationId: actor.organizationId,
      stockOpnameId: id,
      actorUserId: actor.id,
      note: body.note,
    });
    if (!result) {
      throw new ApiError("NOT_FOUND", "Stock opname tidak ditemukan", 404);
    }
    if ("error" in result) {
      throw new ApiError("CONFLICT", "Stock opname harus diapprove sebelum diposting", 409);
    }

    await writeAudit({
      actor,
      outletId: opname.outletId,
      action: "stock_opname.post",
      entityType: "stock_opname",
      entityId: id,
      before: { status: opname.status },
      after: {
        status: result.opname.status,
        movementCount: result.movements.length,
      },
      request,
    });

    publishRealtimeEvent({
      organizationId: actor.organizationId,
      outletId: opname.outletId,
      topics: ["stockOpname", "inventory", "dashboard"],
      type: "stock_opname.posted",
      payload: {
        stockOpnameId: id,
        movementCount: result.movements.length,
      },
    });

    return ok(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
