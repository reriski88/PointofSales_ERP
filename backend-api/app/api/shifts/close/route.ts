import { shiftRepository } from "@/backend/repositories/shift-repository";
import { writeAudit } from "@/lib/audit";
import { ApiError, handleRouteError, ok, parseJson } from "@/lib/http";
import { decimal, fixed } from "@/lib/number";
import { requireActor, requireOutletAccess, requirePermission } from "@/lib/rbac";
import { requireActiveSubscription } from "@/lib/subscription-guard";
import { publishRealtimeEvent } from "@/lib/realtime";
import { closeShiftSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const actor = await requireActor(request);
    await requirePermission(actor, "cashier", "edit");
    const body = await parseJson(request, closeShiftSchema);

    const [existing] = await shiftRepository.findById(body.shiftId, actor.organizationId);

    if (!existing) {
      throw new ApiError("NOT_FOUND", "Shift tidak ditemukan", 404);
    }

    await requireOutletAccess(actor, existing.outletId);

    if (existing.status !== "open") {
      throw new ApiError("CONFLICT", "Shift sudah ditutup", 409);
    }

    if (actor.role === "cashier" && existing.cashierUserId !== actor.id) {
      throw new ApiError("FORBIDDEN", "Kasir hanya bisa menutup shift miliknya sendiri", 403);
    }

    const actualCash = body.actualCash;
    const expectedCash = decimal(existing.expectedCash);
    const variance = actualCash - expectedCash;
    const hasVariance = Math.abs(variance) >= 1;
    const isSupervisor = actor.role === "owner" || actor.role === "admin_outlet";

    if (hasVariance && !body.varianceReason?.trim()) {
      throw new ApiError("BAD_REQUEST", "Alasan selisih kas wajib diisi.", 400);
    }
    const closeApprovalStatus = hasVariance
      ? isSupervisor ? "variance_approved" : "variance_pending"
      : "normal";

    const [row] = await shiftRepository.close(body.shiftId, {
        status: "closed",
        actualCash: fixed(actualCash),
        cashVariance: fixed(variance),
        closeApprovalStatus,
        closedByUserId: actor.id,
        supervisorUserId: closeApprovalStatus === "variance_approved" ? actor.id : null,
        varianceReason: hasVariance ? body.varianceReason?.trim() : null,
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

    publishRealtimeEvent({
      organizationId: actor.organizationId,
      outletId: row.outletId,
      topics: ["shift", "dashboard"],
      type: closeApprovalStatus === "variance_pending" ? "shift.close_pending" : "shift.closed",
      payload: {
        shiftId: row.id,
        cashVariance: row.cashVariance,
        closeApprovalStatus: row.closeApprovalStatus,
      },
    });

    return ok(row);
  } catch (error) {
    return handleRouteError(error);
  }
}
