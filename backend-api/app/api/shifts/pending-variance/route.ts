import { shiftRepository } from "@/backend/repositories/shift-repository";
import { ApiError, handleRouteError, ok } from "@/lib/http";
import { requireActor, requireOutletAccess, requirePermission } from "@/lib/rbac";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const actor = await requireActor(request);
    await requirePermission(actor, "cashier", "view");
    if (actor.role !== "owner" && actor.role !== "admin_outlet") {
      throw new ApiError("FORBIDDEN", "Hanya owner/admin outlet yang bisa melihat approval selisih kas shift", 403);
    }
    const { searchParams } = new URL(request.url);
    const outletId = searchParams.get("outletId");
    if (!outletId) {
      throw new ApiError("BAD_REQUEST", "outletId is required", 400);
    }
    await requireOutletAccess(actor, outletId);

    const rows = await shiftRepository.listPendingVariance(actor.organizationId, outletId);
    return ok(rows);
  } catch (error) {
    return handleRouteError(error);
  }
}
