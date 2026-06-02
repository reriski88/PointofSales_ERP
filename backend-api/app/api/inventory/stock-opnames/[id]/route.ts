import { inventoryRepository } from "@/backend/repositories/inventory-repository";
import { writeAudit } from "@/lib/audit";
import { ApiError, handleRouteError, ok, parseJson } from "@/lib/http";
import { requireActor, requireOutletAccess, requirePermission } from "@/lib/rbac";
import { publishRealtimeEvent } from "@/lib/realtime";
import { updateStockOpnameCountsSchema } from "@/lib/validation";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  try {
    const actor = await requireActor(request);
    await requirePermission(actor, "stockOpname", "view");
    const { id } = await params;
    const detail = await inventoryRepository.findStockOpnameDetail(id, actor.organizationId);
    if (!detail) {
      throw new ApiError("NOT_FOUND", "Stock opname tidak ditemukan", 404);
    }
    await requireOutletAccess(actor, detail.opname.outletId);
    return ok(detail);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const actor = await requireActor(request);
    await requirePermission(actor, "stockOpname", "edit");
    const { id } = await params;
    const [opname] = await inventoryRepository.findStockOpname(id, actor.organizationId);
    if (!opname) {
      throw new ApiError("NOT_FOUND", "Stock opname tidak ditemukan", 404);
    }
    await requireOutletAccess(actor, opname.outletId);
    const body = await parseJson(request, updateStockOpnameCountsSchema);

    const result = await inventoryRepository.updateStockOpnameCounts({
      organizationId: actor.organizationId,
      stockOpnameId: id,
      items: body.items,
    });
    if (!result) {
      throw new ApiError("NOT_FOUND", "Stock opname tidak ditemukan", 404);
    }
    if ("error" in result && result.error === "LOCKED_STATUS") {
      throw new ApiError("CONFLICT", "Hitungan hanya bisa diubah saat opname masih draft atau counted", 409);
    }

    await writeAudit({
      actor,
      outletId: opname.outletId,
      action: "stock_opname.count",
      entityType: "stock_opname",
      entityId: id,
      after: { itemCount: body.items.length },
      request,
    });

    const detail = await inventoryRepository.findStockOpnameDetail(id, actor.organizationId);
    publishRealtimeEvent({
      organizationId: actor.organizationId,
      outletId: opname.outletId,
      topics: ["stockOpname"],
      type: "stock_opname.counts_updated",
      payload: { stockOpnameId: id, itemCount: body.items.length },
    });
    return ok(detail);
  } catch (error) {
    return handleRouteError(error);
  }
}
