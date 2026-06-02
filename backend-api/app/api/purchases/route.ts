import { purchaseRepository } from "@/backend/repositories/purchase-repository";
import { createPurchaseOrder } from "@/services/purchases";
import { ApiError, created, handleRouteError, ok, parseJson } from "@/lib/http";
import { requireActor, requireOutletAccess, requirePermission } from "@/lib/rbac";
import { publishRealtimeEvent } from "@/lib/realtime";
import { createPurchaseOrderSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const actor = await requireActor(request);
    await requirePermission(actor, "purchases", "view");
    const { searchParams } = new URL(request.url);
    const outletId = searchParams.get("outletId");
    if (outletId) {
      await requireOutletAccess(actor, outletId);
    } else if (actor.role !== "owner" && actor.role !== "auditor") {
      throw new ApiError("BAD_REQUEST", "outletId wajib diisi untuk role ini", 400);
    }
    const rows = await purchaseRepository.findPurchaseOrders(actor.organizationId, outletId);
    return ok(rows);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireActor(request);
    await requirePermission(actor, "purchases", "create");
    const body = await parseJson(request, createPurchaseOrderSchema);
    await requireOutletAccess(actor, body.outletId);
    const result = await createPurchaseOrder(actor, body, request);
    publishRealtimeEvent({
      organizationId: actor.organizationId,
      outletId: body.outletId,
      topics: ["purchases", "dashboard"],
      type: "purchase.created",
      payload: { purchaseOrderId: result.purchase.id },
    });
    return created(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
