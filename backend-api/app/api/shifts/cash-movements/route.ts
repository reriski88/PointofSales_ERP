import { shiftRepository } from "@/backend/repositories/shift-repository";
import { writeAudit } from "@/lib/audit";
import { ApiError, created, handleRouteError, parseJson } from "@/lib/http";
import { fixed } from "@/lib/number";
import { requireActor, requireOutletAccess, requirePermission } from "@/lib/rbac";
import { publishRealtimeEvent } from "@/lib/realtime";
import { createShiftCashMovementSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const actor = await requireActor(request);
    await requirePermission(actor, "cashier", "edit");
    const body = await parseJson(request, createShiftCashMovementSchema);

    const [targetShift] = await shiftRepository.findById(body.shiftId, actor.organizationId);
    if (!targetShift) {
      throw new ApiError("NOT_FOUND", "Shift tidak ditemukan", 404);
    }

    await requireOutletAccess(actor, targetShift.outletId);

    if (targetShift.status !== "open") {
      throw new ApiError("CONFLICT", "Mutasi kas hanya bisa dicatat pada shift yang masih terbuka", 409);
    }

    if (actor.role === "cashier" && targetShift.cashierUserId !== actor.id) {
      throw new ApiError("FORBIDDEN", "Kasir hanya bisa mencatat mutasi pada shift miliknya", 403);
    }

    const row = await shiftRepository.createCashMovement({
      organizationId: actor.organizationId,
      outletId: targetShift.outletId,
      shiftId: targetShift.id,
      type: body.type,
      amount: fixed(body.amount),
      reason: body.reason,
      note: body.note,
      actorUserId: actor.id,
    });

    await writeAudit({
      actor,
      outletId: targetShift.outletId,
      action: `shift.${body.type}`,
      entityType: "shift_cash_movement",
      entityId: row.id,
      before: targetShift,
      after: row,
      request,
    });

    publishRealtimeEvent({
      organizationId: actor.organizationId,
      outletId: targetShift.outletId,
      topics: ["shift", "dashboard"],
      type: "shift.cash_movement.created",
      payload: {
        shiftId: targetShift.id,
        cashMovementId: row.id,
        movementType: body.type,
      },
    });

    return created(row);
  } catch (error) {
    return handleRouteError(error);
  }
}
