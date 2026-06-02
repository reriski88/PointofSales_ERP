import { inventoryRepository } from "@/backend/repositories/inventory-repository";
import { writeAudit } from "@/lib/audit";
import { ApiError, created, handleRouteError, ok, parseJson } from "@/lib/http";
import { requireActor, requireOutletAccess, requirePermission } from "@/lib/rbac";
import { publishRealtimeEvent } from "@/lib/realtime";
import { createStockOpnameSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const actor = await requireActor(request);
    await requirePermission(actor, "stockOpname", "view");
    const { searchParams } = new URL(request.url);
    const outletId = searchParams.get("outletId");
    if (!outletId) {
      throw new ApiError("BAD_REQUEST", "outletId is required", 400);
    }
    await requireOutletAccess(actor, outletId);

    const rows = await inventoryRepository.listStockOpnames(actor.organizationId, outletId);
    return ok(rows);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireActor(request);
    await requirePermission(actor, "stockOpname", "create");
    const body = await parseJson(request, createStockOpnameSchema);
    await requireOutletAccess(actor, body.outletId);

    const result = await inventoryRepository.createStockOpname({
      organizationId: actor.organizationId,
      outletId: body.outletId,
      note: body.note,
      actorUserId: actor.id,
    });
    if (!result) {
      throw new ApiError("NOT_FOUND", "Outlet tidak ditemukan atau nonaktif", 404);
    }
    if (!("id" in result)) {
      if (result.error === "EMPTY_CATALOG") {
        throw new ApiError("CONFLICT", "Belum ada SKU aktif untuk dibuatkan daftar opname", 409);
      }
      throw new ApiError("CONFLICT", "Stock opname gagal dibuat", 409);
    }
    const createdStockOpname = result;

    await writeAudit({
      actor,
      outletId: body.outletId,
      action: "stock_opname.create",
      entityType: "stock_opname",
      entityId: createdStockOpname.id,
      after: createdStockOpname,
      request,
    });

    publishRealtimeEvent({
      organizationId: actor.organizationId,
      outletId: body.outletId,
      topics: ["stockOpname", "inventory"],
      type: "stock_opname.created",
      payload: { stockOpnameId: createdStockOpname.id },
    });

    return created(createdStockOpname);
  } catch (error) {
    return handleRouteError(error);
  }
}
