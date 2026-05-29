import { shiftRepository } from "@/backend/repositories/shift-repository";
import { ApiError, handleRouteError, ok } from "@/lib/http";
import { requireActor, requireOutletAccess } from "@/lib/rbac";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const actor = await requireActor(request);
    const { searchParams } = new URL(request.url);
    const outletId = searchParams.get("outletId");
    if (!outletId) {
      throw new ApiError("BAD_REQUEST", "outletId is required", 400);
    }
    await requireOutletAccess(actor, outletId);
    const rows = await shiftRepository.findOpen(outletId, actor.id);
    return ok(rows[0] ?? null);
  } catch (error) {
    return handleRouteError(error);
  }
}
