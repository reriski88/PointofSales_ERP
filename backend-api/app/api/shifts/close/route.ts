import { shiftRepository } from "@/backend/repositories/shift-repository";
import { writeAudit } from "@/lib/audit";
import { ApiError, handleRouteError, ok, parseJson } from "@/lib/http";
import { fixed } from "@/lib/number";
import { requireActor, requireOutletAccess } from "@/lib/rbac";
import { closeShiftSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const actor = await requireActor(request);
    const body = await parseJson(request, closeShiftSchema);

    const [existing] = await shiftRepository.findById(body.shiftId, actor.organizationId);

    if (!existing) {
      throw new ApiError("NOT_FOUND", "Shift not found", 404);
    }

    await requireOutletAccess(actor, existing.outletId);

    if (existing.status !== "open") {
      throw new ApiError("CONFLICT", "Shift is already closed", 409);
    }

    if (actor.role === "cashier" && existing.cashierUserId !== actor.id) {
      throw new ApiError("FORBIDDEN", "Cashier can only close their own shift", 403);
    }

    const [row] = await shiftRepository.close(body.shiftId, {
        status: "closed",
        actualCash: fixed(body.actualCash),
        closedAt: new Date(),
        note: body.note ?? existing.note,
        updatedAt: new Date(),
      });

    await writeAudit({
      actor,
      outletId: row.outletId,
      action: "shift.close",
      entityType: "shift",
      entityId: row.id,
      before: existing,
      after: row,
      request,
    });

    return ok(row);
  } catch (error) {
    return handleRouteError(error);
  }
}
