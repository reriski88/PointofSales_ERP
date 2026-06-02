import { customerRepository } from "@/backend/repositories/customer-repository";
import { ApiError, handleRouteError, ok } from "@/lib/http";
import { accessibleOutletIds, requireActor, requirePermission } from "@/lib/rbac";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireActor(request);
    await requirePermission(actor, "customers", "view");
    const { id } = await params;
    const [targetCustomer] = await customerRepository.findCustomerById(id, actor.organizationId);
    if (!targetCustomer) {
      throw new ApiError("NOT_FOUND", "Pelanggan tidak ditemukan", 404);
    }
    const outletIds = actor.role === "owner" ? undefined : await accessibleOutletIds(actor);
    const rows = await customerRepository.findCustomerSales(actor.organizationId, id, outletIds);
    return ok(rows);
  } catch (error) {
    return handleRouteError(error);
  }
}
