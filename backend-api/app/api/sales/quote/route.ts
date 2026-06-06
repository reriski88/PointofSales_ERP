import { quoteSale } from "@/services/sales";
import { handleRouteError, ok, parseJson } from "@/lib/http";
import { quoteSaleSchema } from "@/lib/validation";
import { requireActor, requireOutletAccess, requirePermission } from "@/lib/rbac";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const actor = await requireActor(request);
    await requirePermission(actor, "cashier", "view");
    const body = await parseJson(request, quoteSaleSchema);
    await requireOutletAccess(actor, body.outletId);
    const result = await quoteSale(actor, body);
    return ok(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
