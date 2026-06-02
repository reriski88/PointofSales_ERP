import { customerRepository } from "@/backend/repositories/customer-repository";
import { ApiError, handleRouteError, ok } from "@/lib/http";
import { requireActor, requireOutletAccess, requirePermission } from "@/lib/rbac";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const actor = await requireActor(request);
    await requirePermission(actor, "customers", "view");
    const { searchParams } = new URL(request.url);
    const outletId = searchParams.get("outletId");
    if (outletId) {
      await requireOutletAccess(actor, outletId);
    } else if (actor.role !== "owner" && actor.role !== "auditor") {
      throw new ApiError("BAD_REQUEST", "outletId wajib diisi untuk role ini", 400);
    }
    const rows = await customerRepository.findReceivables(actor.organizationId, outletId);
    return ok(rows);
  } catch (error) {
    return handleRouteError(error);
  }
}
