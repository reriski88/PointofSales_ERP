import { shiftRepository } from "@/backend/repositories/shift-repository";
import { writeAudit } from "@/lib/audit";
import { ApiError, created, handleRouteError, parseJson } from "@/lib/http";
import { fixed } from "@/lib/number";
import { requireActor, requireOutletAccess, requireRole } from "@/lib/rbac";
import { openShiftSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const actor = await requireActor(request);
    requireRole(actor, ["owner", "admin_outlet", "cashier"]);
    const body = await parseJson(request, openShiftSchema);
    await requireOutletAccess(actor, body.outletId);

    const [existing] = await shiftRepository.findOpen(body.outletId, actor.id);

    if (existing) {
      throw new ApiError("CONFLICT", "Cashier already has an open shift in this outlet", 409);
    }

    const [row] = await shiftRepository.create({
        organizationId: actor.organizationId,
        outletId: body.outletId,
        cashierUserId: actor.id,
        openingCash: fixed(body.openingCash),
        expectedCash: fixed(body.openingCash),
        note: body.note,
      });

    await writeAudit({
      actor,
      outletId: body.outletId,
      action: "shift.open",
      entityType: "shift",
      entityId: row.id,
      after: row,
      request,
    });

    return created(row);
  } catch (error) {
    return handleRouteError(error);
  }
}
