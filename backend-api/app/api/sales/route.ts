import { createSale } from "@/services/sales";
import { created, handleRouteError, parseJson } from "@/lib/http";
import { requireActor, requireOutletAccess, requirePermission } from "@/lib/rbac";
import { publishRealtimeEvent } from "@/lib/realtime";
import { createSaleSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const actor = await requireActor(request);
    await requirePermission(actor, "cashier", "create");
    const body = await parseJson(request, createSaleSchema);
    await requireOutletAccess(actor, body.outletId);
    const result = await createSale(actor, body, request);
    publishRealtimeEvent({
      organizationId: actor.organizationId,
      outletId: body.outletId,
      topics: ["sales", "inventory", "dashboard", "shift", "customers"],
      type: "sale.created",
      payload: {
        saleId: result.sale.id,
        status: result.sale.status,
        idempotent: result.idempotent,
      },
    });
    return created(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
