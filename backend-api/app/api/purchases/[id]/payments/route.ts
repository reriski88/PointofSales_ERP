import { createPurchasePayment } from "@/services/purchases";
import { created, handleRouteError, parseJson } from "@/lib/http";
import { requireActor, requirePermission } from "@/lib/rbac";
import { publishRealtimeEvent } from "@/lib/realtime";
import { createPurchasePaymentSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireActor(request);
    await requirePermission(actor, "purchases", "create");
    const { id } = await params;
    const body = await parseJson(request, createPurchasePaymentSchema);
    const result = await createPurchasePayment(actor, id, body, request);
    publishRealtimeEvent({
      organizationId: actor.organizationId,
      outletId: result.purchase.outletId,
      topics: ["purchases", "dashboard"],
      type: "purchase.payment.created",
      payload: {
        purchaseOrderId: result.purchase.id,
        paymentId: result.payment.id,
      },
    });
    return created(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
