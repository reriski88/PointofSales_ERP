import { createSale } from "@/services/sales";
import { created, handleRouteError, parseJson } from "@/lib/http";
import { requireActor, requireOutletAccess, requireRole } from "@/lib/rbac";
import { createSaleSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const actor = await requireActor(request);
    requireRole(actor, ["owner", "admin_outlet", "cashier"]);
    const body = await parseJson(request, createSaleSchema);
    await requireOutletAccess(actor, body.outletId);
    const result = await createSale(actor, body, request);
    return created(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
