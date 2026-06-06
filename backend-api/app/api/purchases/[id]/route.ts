import { cancelPurchaseOrder, getPurchaseOrderDetail } from "@/services/purchases";
import { handleRouteError, ok, parseJson } from "@/lib/http";
import { requireActor, requirePermission } from "@/lib/rbac";
import { publishRealtimeEvent } from "@/lib/realtime";
import { cancelPurchaseOrderSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireActor(_);
    await requirePermission(actor, "purchases", "view");
    const { id } = await params;
    const result = await getPurchaseOrderDetail(actor, id);
    return ok(result);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireActor(request);
    await requirePermission(actor, "purchases", "edit");
    const { id } = await params;
    const body = await parseJson(request, cancelPurchaseOrderSchema);
    const result = await cancelPurchaseOrder(actor, id, body, request);
    publishRealtimeEvent({
      organizationId: actor.organizationId,
      outletId: result.purchase.outletId,
      topics: ["purchases", "dashboard"],
      type: "purchase.cancelled",
      payload: { purchaseOrderId: result.purchase.id },
    });
    return ok(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
