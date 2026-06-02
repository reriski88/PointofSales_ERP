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
    await requirePermission(actor, "stockOpname", "edit");
    const { id } = await params;
    const [opname] = await inventoryRepository.findStockOpname(id, actor.organizationId);
    if (!opname) {
      throw new ApiError("NOT_FOUND", "Stock opname tidak ditemukan", 404);
    }
    await requireOutletAccess(actor, opname.outletId);
    const body = await parseJson(request, stockOpnameActionNoteSchema);

    const result = await inventoryRepository.submitStockOpname({
      organizationId: actor.organizationId,
      stockOpnameId: id,
      actorUserId: actor.id,
      note: body.note,
    });
    if (!result) {
      throw new ApiError("NOT_FOUND", "Stock opname tidak ditemukan", 404);
    }
    if ("error" in result) {
      if (result.error === "UNCOUNTED_ITEMS") {
        throw new ApiError("CONFLICT", `${result.uncounted} item belum diisi hasil fisiknya`, 409);
      }
      throw new ApiError("CONFLICT", "Stock opname tidak bisa disubmit pada status ini", 409);
    }

    await writeAudit({
      actor,
      outletId: opname.outletId,
      action: "stock_opname.submit",
      entityType: "stock_opname",
      entityId: id,
      before: { status: opname.status },
      after: result,
      request,
    });

    publishRealtimeEvent({
      organizationId: actor.organizationId,
      outletId: opname.outletId,
      topics: ["stockOpname"],
      type: "stock_opname.submitted",
      payload: { stockOpnameId: id },
    });

    return ok(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
