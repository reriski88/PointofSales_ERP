import { wasteRepository } from "@/backend/repositories/waste-repository";
import { createWasteAdjustment } from "@/services/waste";
import { created, handleRouteError, ok, parseJson } from "@/lib/http";
import { requireActor, requireAnyPermission, requireOutletAccess } from "@/lib/rbac";
import { publishRealtimeEvent } from "@/lib/realtime";
import { createWasteAdjustmentSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const actor = await requireActor(request);
    const rows = await wasteRepository.findManyByOrganization(actor.organizationId);
    return ok(rows);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireActor(request);
    await requireAnyPermission(actor, [
      { menu: "cashier", action: "create" },
      { menu: "inventory", action: "create" },
    ]);
    const body = await parseJson(request, createWasteAdjustmentSchema);
    await requireOutletAccess(actor, body.outletId);
    const result = await createWasteAdjustment(actor, body, request);
    publishRealtimeEvent({
      organizationId: actor.organizationId,
      outletId: body.outletId,
      topics: result.status === "posted" ? ["waste", "inventory", "dashboard"] : ["waste"],
      type: "waste.created",
      payload: {
        wasteAdjustmentId: result.id,
        status: result.status,
      },
    });
    return created(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
