import { inventoryRepository } from "@/backend/repositories/inventory-repository";
import { ApiError, handleRouteError, ok } from "@/lib/http";
import { requireActor, requireOutletAccess, requirePermission } from "@/lib/rbac";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const actor = await requireActor(request);
    await requirePermission(actor, "inventory", "view");
    const { searchParams } = new URL(request.url);
    const outletId = searchParams.get("outletId");
    const skuId = searchParams.get("skuId");
    if (!outletId) {
      throw new ApiError("BAD_REQUEST", "outletId is required", 400);
    }
    await requireOutletAccess(actor, outletId);

    const rows = await inventoryRepository.findBatches(actor.organizationId, outletId, skuId);
    return ok(rows);
  } catch (error) {
    return handleRouteError(error);
  }
}
