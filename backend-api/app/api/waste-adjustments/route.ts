import { wasteRepository } from "@/backend/repositories/waste-repository";
import { createWasteAdjustment } from "@/services/waste";
import { created, handleRouteError, ok, parseJson } from "@/lib/http";
import { requireActor, requireOutletAccess, requireRole } from "@/lib/rbac";
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
    requireRole(actor, ["owner", "admin_outlet", "warehouse", "cashier"]);
    const body = await parseJson(request, createWasteAdjustmentSchema);
    await requireOutletAccess(actor, body.outletId);
    const result = await createWasteAdjustment(actor, body, request);
    return created(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
