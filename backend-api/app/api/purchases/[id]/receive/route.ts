import { receivePurchaseOrder } from "@/services/purchases";
import { handleRouteError, ok, parseJson } from "@/lib/http";
import { requireActor, requirePermission } from "@/lib/rbac";
import { publishRealtimeEvent } from "@/lib/realtime";
import { receivePurchaseOrderSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireActor(request);
    await requirePermission(actor, "purchases", "create");
    const { id } = await params;
    const body = await parseJson(request, receivePurchaseOrderSchema);
    const result = await receivePurchaseOrder(actor, id, body, request);
    publishRealtimeEvent({
      organizationId: actor.organizationId,
      outletId: result.purchase.outletId,
      topics: ["purchases", "inventory", "dashboard"],
      type: "purchase.received",
      payload: { purchaseOrderId: result.purchase.id },
    });
    return ok(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
